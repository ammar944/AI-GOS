import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import type { MarketCategorySectionOutput } from '@/lib/lab-engine/artifacts/schemas/market-category';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';
import type { SectionPartialPublishFn } from '@/lib/research-v2/section-partial-broadcaster';
import {
  applySectionPartialPayload,
  type SectionPartialsByZone,
} from '@/lib/research-v2/use-section-partials';

import { runSection } from '../run-section';
import type { AnswerToolRunner, StructuredStreamer } from '../section-agent';

async function makeStore(): Promise<ReturnType<typeof createRunStore>> {
  const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-streaming-'));
  const store = createRunStore({
    rootDir,
    defaultSectionIds: ['positioningMarketCategory'],
    now: () => new Date('2026-06-01T00:00:00.000Z'),
  });
  await store.createRun(saaslaunchResearchInput);
  return store;
}

async function* partials(
  values: readonly unknown[],
): AsyncIterable<unknown> {
  for (const value of values) {
    yield value;
  }
}

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

interface MarketCategoryDraft {
  verdict: string;
  statusSummary: string;
  body: Record<string, unknown>;
}

function buildMarketCategoryDraft({
  body = marketCategoryFixtureArtifact.body as Record<string, unknown>,
  statusSummary =
    'Authored status: evidence points to an emerging category with clear maturity signals.',
  verdict =
    'Authored verdict: lead with lifecycle orchestration, not generic project management.',
}: Partial<MarketCategoryDraft> = {}): MarketCategoryDraft {
  return {
    body,
    statusSummary,
    verdict,
  };
}

function buildInvalidMarketCategoryBody(): Record<string, unknown> {
  const output = structuredClone(buildMarketCategoryOutput());

  return {
    ...output.body,
    marketSize: {
      ...output.body.marketSize,
      signals: output.body.marketSize.signals.slice(1),
    },
  };
}

function collectFixtureSourceUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectFixtureSourceUrls(item));
  }

  if (typeof value !== 'object' || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const current =
    typeof record.sourceUrl === 'string' ? [record.sourceUrl] : [];

  return [
    ...current,
    ...Object.values(record).flatMap((item) => collectFixtureSourceUrls(item)),
  ];
}

function emitFixtureEvidenceStep(params: Parameters<StructuredStreamer>[0]): void {
  params.onStepFinish?.({
    stepNumber: 1,
    finishReason: 'stop',
    text: 'Fixture evidence supplied for structured body verification.',
    toolCalls: [],
    toolResults: Array.from(
      new Set(collectFixtureSourceUrls(marketCategoryFixtureArtifact.body)),
    ).map((sourceUrl) => ({
      toolName: 'fixture_evidence',
      output: {
        sourceUrl,
        text: `Fixture source evidence for ${sourceUrl}`,
      },
    })),
  });
}

describe('runSection artifact streaming path', (): void => {
  it('streams partial bodies but gates only the final validated output', async (): Promise<void> => {
    const store = await makeStore();
    const consumeStream = vi.fn(() => Promise.resolve());
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitFixtureEvidenceStep(params);
      const finalDraft = buildMarketCategoryDraft();

      expect(params.schema.safeParse(finalDraft).success).toBe(true);
      expect(params.schema.safeParse(marketCategoryFixtureArtifact.body).success).toBe(
        false,
      );
      expect(params.schema.safeParse(buildMarketCategoryOutput()).success).toBe(
        false,
      );

      return {
        consumeStream,
        output: Promise.resolve(finalDraft),
        partialOutputStream: partials([
          {
            verdict: 'Draft verdict while sources are still streaming.',
            statusSummary: 'Draft status while the body is incomplete.',
            body: {
              categoryDefinition: {
                prose: 'drafting only; this partial is intentionally incomplete',
              },
            },
          },
        ]),
      };
    });
    const broadcastPartial = vi.fn<SectionPartialPublishFn>(
      async () => undefined,
    );
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => {
      throw new Error('Answer-tool fallback should require LAB_SECTION_STREAMING=false.');
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use streamed structured body output.',
        allowedTools: [],
        streamStructured,
        broadcastPartial,
        runAnswerTool,
        now: () => new Date('2026-06-01T00:00:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);

    expect(consumeStream).toHaveBeenCalledTimes(1);
    expect(runAnswerTool).not.toHaveBeenCalled();
    expect(streamStructured).toHaveBeenCalledTimes(1);
    expect(broadcastPartial).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
        zone: 'positioningMarketCategory',
        seq: 1,
        snapshot: expect.objectContaining({
          body: expect.objectContaining({
            categoryDefinition: expect.any(Object),
          }),
          statusSummary: expect.any(String),
          verdict: expect.any(String),
        }),
      }),
    );
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
    expect(result.artifact.verdict).toBe(
      'Authored verdict: lead with lifecycle orchestration, not generic project management.',
    );
    expect(result.artifact.statusSummary).toBe(
      'Authored status: evidence points to an emerging category with clear maturity signals.',
    );
    expect(result.artifact.verdict).not.toBe(result.artifact.statusSummary);
    expect(result.artifact.verification).toEqual(
      expect.objectContaining({
        claims: expect.any(Array),
        unsupportedCount: expect.any(Number),
        verifiedCount: expect.any(Number),
      }),
    );
    expect(record.events.map((event) => event.type)).not.toContain(
      'validation-failed',
    );
    expect(record.events.map((event) => event.type)).not.toContain(
      'artifact-partial' as never,
    );
  });

  it('repairs streamed final outputs that miss section minimums', async (): Promise<void> => {
    const store = await makeStore();
    let calls = 0;
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      calls += 1;
      emitFixtureEvidenceStep(params);

      if (calls === 2) {
        expect(params.prompt).toContain('The previous output failed validation');
        expect(params.prompt).toContain('body.marketSize.signals');
      }

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(
          calls === 1
            ? buildMarketCategoryDraft({
                body: buildInvalidMarketCategoryBody(),
                statusSummary: 'Initial status that still misses minimums.',
                verdict: 'Initial verdict that still misses minimums.',
              })
            : buildMarketCategoryDraft({
                statusSummary: 'Repair status that now satisfies minimums.',
                verdict: 'Repair verdict that now satisfies minimums.',
              }),
        ),
        partialOutputStream: partials([
          {
            body: {
              marketSize: {
                prose: calls === 1 ? 'initial partial' : 'repair partial',
              },
            },
            statusSummary:
              calls === 1 ? 'Initial partial status' : 'Repair partial status',
            verdict:
              calls === 1 ? 'Initial partial verdict' : 'Repair partial verdict',
          },
        ]),
      };
    });
    const broadcastPartial = vi.fn<SectionPartialPublishFn>(
      async () => undefined,
    );

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Repair streamed structured body output.',
        allowedTools: [],
        streamStructured,
        broadcastPartial,
        now: () => new Date('2026-06-01T00:05:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(streamStructured).toHaveBeenCalledTimes(2);
    const publishedPayloads = broadcastPartial.mock.calls.map(
      ([payload]) => payload,
    );
    expect(publishedPayloads.map((payload) => payload.seq)).toEqual([1, 2]);

    let partialState: SectionPartialsByZone = {};
    for (const payload of publishedPayloads) {
      partialState = applySectionPartialPayload(partialState, {
        sectionId: payload.sectionId,
        seq: payload.seq,
        snapshot: payload.snapshot,
        zone: payload.zone,
      });
    }
    expect(partialState.positioningMarketCategory).toEqual(
      expect.objectContaining({
        seq: 2,
        snapshot: expect.objectContaining({
          statusSummary: 'Repair partial status',
        }),
      }),
    );
    expect(eventTypes).toContain('validation-failed');
    expect(eventTypes).toContain('repair-started');
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
  });
});
