import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MarketCategorySectionOutput } from '@/lib/lab-engine/artifacts/schemas/market-category';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';
import { deriveSectionPhase } from '@/app/api/research-v2/audit-state/derive-section-phase';
import type { ActivityEvent } from '@/lib/lab-engine/events/activity-event';
import type { RunStore } from '@/lib/lab-engine/runs/run-store';

import { runSection } from '../run-section';
import type { AgentStep, AnswerToolRunner } from '../section-agent';

const RUN_ID = saaslaunchResearchInput.runId;
const NOW = new Date('2026-05-25T12:00:00.000Z');

function buildMarketCategoryOutput(): MarketCategorySectionOutput {
  return {
    sectionTitle: marketCategoryFixtureArtifact.sectionTitle,
    verdict: marketCategoryFixtureArtifact.verdict,
    statusSummary: marketCategoryFixtureArtifact.statusSummary,
    confidence: marketCategoryFixtureArtifact.confidence,
    sources: marketCategoryFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: marketCategoryFixtureArtifact.body,
  };
}

// A step carrying a tool call + result so buildToolEvents emits a tool-started
// and a tool-finished event.
function buildToolStep(): AgentStep {
  return {
    stepNumber: 0,
    finishReason: 'tool-calls',
    text: '',
    toolCalls: [{ toolName: 'web_search', input: { query: 'category size' } }],
    toolResults: [
      {
        toolName: 'web_search',
        input: { query: 'category size' },
        output: {
          text:
            'A fetched source describes the category and its trajectory. Fixture TAM recipe support: monthly keyword volume x 12 x commercial-intent share x conversion rate x ACV. $1.09M directional reachable revenue = 1,900 monthly searches x 12 x 40% commercial-intent share x 2% conversion x $6,000 ACV. 1,900 monthly searches across CRM cleanup, sales workflow automation, and pipeline review keywords. 40% of sampled demand sits in comparison, pricing, CRM cleanup, and pipeline review terms. 2% directional visitor-to-opportunity assumption from the fixture pricing/onboarding path. $6,000 ACV from fixture pricing notes.',
        },
      },
    ],
  };
}

interface RecordingStore extends RunStore {
  appendedTypes: string[];
}

// Wrap the real file store so the test can observe appendEvent ordering and
// optionally inject a one-shot failure on a tool event.
function wrapStore(
  store: RunStore,
  options: { failOnceForType?: string } = {},
): RecordingStore {
  const appendedTypes: string[] = [];
  let failuresLeft = options.failOnceForType ? 1 : 0;
  return {
    ...store,
    appendedTypes,
    appendEvent: async (runId: string, event: ActivityEvent) => {
      if (
        failuresLeft > 0 &&
        options.failOnceForType === event.type &&
        !appendedTypes.includes(event.type)
      ) {
        failuresLeft -= 1;
        throw new Error('simulated transient append failure');
      }
      const record = await store.appendEvent(runId, event);
      appendedTypes.push(event.type);
      return record;
    },
  };
}

async function makeStore(): Promise<RunStore> {
  const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-live-'));
  const store = createRunStore({
    rootDir,
    defaultSectionIds: ['positioningMarketCategory'],
    now: () => NOW,
  });
  await store.createRun(saaslaunchResearchInput);
  return store;
}

describe('runSection live event persistence', (): void => {
  beforeEach((): void => {
    vi.stubEnv('LAB_SECTION_STREAMING', 'false');
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it('persists tool events while the answer-tool attempt is still pending', async (): Promise<void> => {
    const recording = wrapStore(await makeStore());

    let releaseAttempt: () => void = () => undefined;
    const attemptBlocker = new Promise<void>((resolve) => {
      releaseAttempt = resolve;
    });

    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      // Emit a tool step, then BLOCK before returning the answer.
      params.onStepFinish?.(buildToolStep());
      await attemptBlocker;
      return {
        steps: [buildToolStep()],
        text: '',
        answerInput: buildMarketCategoryOutput(),
      };
    });

    const sectionPromise = runSection(
      { runId: RUN_ID, sectionId: 'positioningMarketCategory' },
      {
        store: recording,
        env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '10' },
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: ['web_search'],
        runAnswerTool,
        now: () => NOW,
      },
    );

    // Let the scheduled flush from onStep drain while the attempt is still
    // pending (runAnswerTool has NOT resolved — attemptBlocker is unresolved).
    await vi.waitFor(() => {
      expect(recording.appendedTypes).toContain('tool-finished');
    });
    expect(recording.appendedTypes).toContain('tool-started');

    // Now let the attempt finish and the section complete.
    releaseAttempt();
    const result = await sectionPromise;
    expect(result.artifact.sectionId).toBe('positioningMarketCategory');
  });

  it('emits a reading-sources-started heartbeat right after skill-loaded', async (): Promise<void> => {
    const store = await makeStore();

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildToolStep()],
      text: '',
      answerInput: buildMarketCategoryOutput(),
    }));

    await runSection(
      { runId: RUN_ID, sectionId: 'positioningMarketCategory' },
      {
        store,
        env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '10' },
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: ['web_search'],
        runAnswerTool,
        now: () => NOW,
      },
    );

    const record = await store.readRun(RUN_ID);
    const types = record.events.map((event) => event.type);
    const skillIdx = types.indexOf('skill-loaded');
    const heartbeatIdx = types.indexOf('reading-sources-started');

    expect(skillIdx).toBeGreaterThanOrEqual(0);
    expect(heartbeatIdx).toBe(skillIdx + 1);
    // The heartbeat moves the reader off "Compiling context".
    expect(
      deriveSectionPhase({
        status: 'running',
        latestEventType: 'reading-sources-started',
      }),
    ).toBe('Reading sources');
    expect(
      deriveSectionPhase({
        status: 'running',
        latestEventType: 'skill-loaded',
      }),
    ).toBe('Compiling context');
  });

  it('does not abort the section when a telemetry append fails, and retries the event', async (): Promise<void> => {
    // The first tool-finished append throws; the section must still complete and
    // the event must be retried (not skipped) so the cursor never desyncs.
    const recording = wrapStore(await makeStore(), {
      failOnceForType: 'tool-finished',
    });

    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      params.onStepFinish?.(buildToolStep());
      return {
        steps: [buildToolStep()],
        text: '',
        answerInput: buildMarketCategoryOutput(),
      };
    });

    const result = await runSection(
      { runId: RUN_ID, sectionId: 'positioningMarketCategory' },
      {
        store: recording,
        env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '10' },
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: ['web_search'],
        runAnswerTool,
        now: () => NOW,
      },
    );

    // Section still produced an artifact despite the telemetry write failure.
    expect(result.artifact.sectionId).toBe('positioningMarketCategory');

    // The tool-finished event was retried and eventually persisted.
    const record = await recording.readRun(RUN_ID);
    const toolFinished = record.events.filter(
      (event) => event.type === 'tool-finished',
    );
    expect(toolFinished.length).toBeGreaterThanOrEqual(1);
  });
});
