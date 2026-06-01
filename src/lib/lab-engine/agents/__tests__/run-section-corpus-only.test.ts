import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  competitorLandscapeBodySchema,
  type CompetitorLandscapeBody,
} from '@/lib/lab-engine/artifacts/schemas/competitor-landscape';
import type { MarketCategorySectionOutput } from '@/lib/lab-engine/artifacts/schemas/market-category';
import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';

import { runSection } from '../run-section';
import type {
  AgentStep,
  AnswerToolRunner,
  EvidencePassRunner,
  StructuredCaller,
} from '../section-agent';

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

function buildInvalidMarketCategoryOutput(): MarketCategorySectionOutput {
  const output = buildMarketCategoryOutput();

  return {
    ...output,
    body: {
      ...output.body,
      marketSize: {
        ...output.body.marketSize,
        signals: output.body.marketSize.signals.slice(1),
      },
    },
  };
}

function buildMarketCategoryOutputWithUnsupportedRates(
  rates: readonly string[],
): MarketCategorySectionOutput {
  const output = structuredClone(buildMarketCategoryOutput());
  const body = requireRecord(output.body);
  const marketSize = requireRecord(body.marketSize);
  const signals = marketSize.signals;

  if (!Array.isArray(signals)) {
    throw new Error('Expected marketSize.signals array.');
  }

  rates.forEach((rate, index) => {
    const signal = requireRecord(signals[index]);
    signal.evidence = `The category is expanding at ${rate} annually.`;
  });

  return output;
}

function buildMarketCategorySupportStep(): AgentStep {
  return {
    stepNumber: 0,
    finishReason: 'stop',
    text: '',
    toolCalls: [],
    toolResults: [
      {
        toolName: 'fixture_support',
        output: {
          text:
            'Fixture ad sources: https://example.com/fixtures/ad-library/pipelinepilot-google and https://example.com/fixtures/ad-library/signalforge-linkedin.',
        },
      },
    ],
  };
}

function buildNumericSupportStep(value: string): AgentStep {
  return {
    stepNumber: 1,
    finishReason: 'tool-calls',
    text: '',
    toolCalls: [],
    toolResults: [
      {
        toolName: 'web_search',
        output: {
          text: `A fetched source says the category is expanding at ${value} annually.`,
        },
      },
    ],
  };
}

function buildCompetitorLandscapeSupportStep(): AgentStep {
  return {
    stepNumber: 0,
    finishReason: 'stop',
    text: '',
    toolCalls: [],
    toolResults: [
      {
        toolName: 'fixture_support',
        output: {
          text: [
            'https://example.com/signalforge',
            'https://example.com/pipelinepilot',
            'https://example.com/revenueos-lab',
            'https://example.com/growthops-studio',
            'https://example.com/diy-spreadsheet',
            'https://example.com/saaslaunch/positioning-notes',
            'https://example.com/fixtures/ad-library/signalforge-linkedin',
            'https://example.com/fixtures/ad-library/pipelinepilot-google',
            'https://example.com/fixtures/ad-library/revenueos-meta',
            'https://example.com/fixtures/ad-library/growthops-linkedin',
            'https://example.com/signalforge/pipeline-priority',
            'https://example.com/pipelinepilot/crm-cleanup',
            'https://example.com/revenueos-lab/operator',
            'https://example.com/fixtures/creative/revenueos-operator.png',
            'https://www.linkedin.com/ad-library/search?company=SignalForge',
            'https://adstransparency.google.com/?region=US&query=PipelinePilot',
            'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=RevenueOS%20Lab',
            'https://adstransparency.google.com/?region=US&query=Kalungi',
            'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=Kalungi',
          ].join(' '),
        },
      },
    ],
  };
}

function buildCompetitorLandscapeOutput() {
  return {
    sectionTitle: competitorLandscapeFixtureArtifact.sectionTitle,
    verdict: competitorLandscapeFixtureArtifact.verdict,
    statusSummary: competitorLandscapeFixtureArtifact.statusSummary,
    confidence: competitorLandscapeFixtureArtifact.confidence,
    sources: competitorLandscapeFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: competitorLandscapeFixtureArtifact.body,
  };
}

function buildPaidMediaPlanOutput(): Record<string, unknown> {
  return {
    sectionTitle: paidMediaPlanFixtureArtifact.sectionTitle,
    verdict: paidMediaPlanFixtureArtifact.verdict,
    statusSummary: paidMediaPlanFixtureArtifact.statusSummary,
    confidence: paidMediaPlanFixtureArtifact.confidence,
    sources: paidMediaPlanFixtureArtifact.sources.map((source) => ({
      id: source.id,
      observedAt: source.observedAt,
      title: source.title,
      url: source.url,
    })),
    body: structuredClone(paidMediaPlanFixtureArtifact.body),
  };
}

function forceSynthesizedPaidMediaItemsToGtmBrief(
  output: Record<string, unknown>,
): void {
  const body = requireRecord(output.body);
  const containerKeys = [
    ['anglesToTest', 'angles'],
    ['creativeFramework', 'creatives'],
    ['competitorReviewInsights', 'insights'],
    ['competitorMarketingInsights', 'competitors'],
    ['funnelIdeation', 'recommendations'],
    ['channelSuggestions', 'suggestions'],
  ] as const;

  for (const [containerKey, arrayKey] of containerKeys) {
    const container = requireRecord(body[containerKey]);
    const items = container[arrayKey];
    if (!Array.isArray(items)) {
      throw new Error(`Expected ${containerKey}.${arrayKey} array.`);
    }

    for (const item of items) {
      requireRecord(item).sourceSection = 'gtmBrief';
    }
  }
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected record.');
  }

  return value as Record<string, unknown>;
}

function assertCompetitorLandscapeBody(
  body: unknown,
): asserts body is CompetitorLandscapeBody {
  competitorLandscapeBodySchema.parse(body);
}

describe('runSection corpus-only mode', (): void => {
  beforeEach((): void => {
    vi.stubEnv('LAB_SECTION_STREAMING', 'false');
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it('passes an empty external tool map and still validates a section output', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildMarketCategoryOutput();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(Object.keys(params.externalTools)).toEqual([]);
      expect(params.telemetry).toEqual(
        expect.objectContaining({
          functionId: 'lab-section.answer-tool',
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
          metadata: expect.objectContaining({
            model: 'claude-sonnet-4-5',
            operation: 'answer-tool',
            runId: saaslaunchResearchInput.runId,
            sectionId: 'positioningMarketCategory',
            traceId: saaslaunchResearchInput.runId,
          }),
        }),
      );
      expect(params.instructions).toContain("Corpus-only mode:");
      expect(params.instructions).toContain(
        "Do not call web_search, firecrawl, pagespeed, reviews, keyword_ad_probe, adlibrary, google_ads, or meta_ads.",
      );
      expect(params.prompt).toContain(
        "No external research tools are available.",
      );

      return {
        steps: [buildMarketCategorySupportStep()],
        text: '',
        answerInput: output,
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    expect(result.artifact.sectionId).toBe('positioningMarketCategory');
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
    expect(result.artifact.verification).toEqual(
      expect.objectContaining({
        claims: expect.any(Array),
        unsupportedCount: expect.any(Number),
        verifiedCount: expect.any(Number),
      }),
    );
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
  });

  it('emits sub-section commit events before the final artifact save event', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-26T10:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildMarketCategorySupportStep()],
      text: '',
      answerInput: buildMarketCategoryOutput(),
    }));

    await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-26T10:00:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);
    const subSectionEvents = record.events.filter(
      (event) => event.type === 'sub-section-committed',
    );

    expect(subSectionEvents.map((event) => event.metadata.subSectionKey)).toEqual([
      'categoryDefinition',
      'marketSize',
      'structuralForces',
      'categoryMaturity',
    ]);
    expect(subSectionEvents.every((event) => event.metadata.status === 'committed')).toBe(
      true,
    );
    expect(eventTypes.indexOf('sub-section-committed')).toBeLessThan(
      eventTypes.indexOf('artifact-saved'),
    );
  });

  it('repairs answer-tool outputs that miss section minimums', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    let calls = 0;
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      calls += 1;

      if (calls === 2) {
        expect(params.prompt).toContain('The previous output failed validation');
        expect(params.prompt).toContain('body.marketSize.signals');
        expect(params.prompt).toContain('Previous output JSON');
      }

      return {
        steps: [buildMarketCategorySupportStep()],
        text: '',
        answerInput:
          calls === 1
            ? buildInvalidMarketCategoryOutput()
            : buildMarketCategoryOutput(),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(result.artifact.sectionId).toBe('positioningMarketCategory');
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
    expect(runAnswerTool).toHaveBeenCalledTimes(2);
    expect(eventTypes).toContain('validation-failed');
    expect(eventTypes).toContain('repair-started');
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
  });

  it('runs a second repair when the first answer-tool repair still misses section minimums', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    let calls = 0;
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      calls += 1;

      if (calls >= 2) {
        expect(params.prompt).toContain('The previous output failed validation');
        expect(params.prompt).toContain('body.marketSize.signals');
        expect(params.prompt).toContain('Previous output JSON');
      }

      return {
        steps: [buildMarketCategorySupportStep()],
        text: '',
        answerInput:
          calls < 3
            ? buildInvalidMarketCategoryOutput()
            : buildMarketCategoryOutput(),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const validationFailures = record.events.filter(
      (event) => event.type === 'validation-failed',
    );
    const repairStarts = record.events.filter(
      (event) => event.type === 'repair-started',
    );

    expect(result.artifact.sectionId).toBe('positioningMarketCategory');
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(validationFailures).toHaveLength(2);
    expect(repairStarts).toHaveLength(2);
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
  });

  it('repairs unsupported load-bearing numeric claims and commits the grounded repair', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-29T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    let calls = 0;
    const unsupportedOutput =
      buildMarketCategoryOutputWithUnsupportedRates(['44%']);
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      calls += 1;

      if (calls === 2) {
        expect(params.prompt).toContain('numeric claim "44%"');
        expect(params.prompt).toContain('cite a real source');
      }

      return {
        steps:
          calls === 1
            ? [buildMarketCategorySupportStep()]
            : [
                buildMarketCategorySupportStep(),
                buildNumericSupportStep('44%'),
              ],
        text: '',
        answerInput: unsupportedOutput,
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-29T12:00:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const validationFailure = record.events.find(
      (event) => event.type === 'validation-failed',
    );
    const groundingRepair = record.events.find(
      (event) =>
        event.type === 'repair-started' &&
        event.metadata.reason === 'grounding 1 unsupported claim(s)',
    );

    expect(runAnswerTool).toHaveBeenCalledTimes(2);
    expect(validationFailure?.metadata.issues).toContain(
      'numeric claim "44%" is not supported by any fetched source or corpus excerpt - cite a real source for it or remove it / restate it as a data gap.',
    );
    expect(groundingRepair).toBeDefined();
    expect(result.artifact.verification?.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'verified',
          claim: expect.objectContaining({ kind: 'numeric', value: '44%' }),
        }),
      ]),
    );
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
  });

  it('commits with the honest badge when unsupported load-bearing claims survive repairs', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-29T12:30:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const unsupportedOutput =
      buildMarketCategoryOutputWithUnsupportedRates(['44%']);
    let calls = 0;
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      calls += 1;

      if (calls > 1) {
        expect(params.prompt).toContain('numeric claim "44%"');
      }

      return {
        steps: [buildMarketCategorySupportStep()],
        text: '',
        answerInput: unsupportedOutput,
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-29T12:30:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const unsupportedNumericClaims =
      result.artifact.verification?.claims.filter(
        (claim) =>
          claim.status === 'unsupported' &&
          claim.claim.kind === 'numeric' &&
          claim.claim.value === '44%',
      ) ?? [];

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(unsupportedNumericClaims).toHaveLength(1);
    expect(result.artifact.verification?.unsupportedCount).toBeGreaterThanOrEqual(
      1,
    );
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
    expect(record.events.map((event) => event.type)).not.toContain(
      'section-failed',
    );
  });

  it('leaves the verifier threshold disabled when the env is unset', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-29T12:35:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const unsupportedOutput =
      buildMarketCategoryOutputWithUnsupportedRates(['44%']);
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildMarketCategorySupportStep()],
      text: '',
      answerInput: unsupportedOutput,
    }));

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        env: { LAB_SECTION_STREAMING: 'false' },
        runAnswerTool,
        now: () => new Date('2026-05-29T12:35:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const unsupportedNumericClaims =
      result.artifact.verification?.claims.filter(
        (claim) =>
          claim.status === 'unsupported' &&
          claim.claim.kind === 'numeric' &&
          claim.claim.value === '44%',
      ) ?? [];

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(unsupportedNumericClaims).toHaveLength(1);
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
    expect(record.events.map((event) => event.type)).not.toContain(
      'section-failed',
    );
  });

  it('fails the section when residual unsupported claims exceed the verifier threshold', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-29T12:40:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const unsupportedOutput =
      buildMarketCategoryOutputWithUnsupportedRates(['44%']);
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildMarketCategorySupportStep()],
      text: '',
      answerInput: unsupportedOutput,
    }));
    const expectedReason =
      'evidence-gate: 1 unsupported load-bearing claims exceed max 0';

    await expect(
      runSection(
        {
          runId: saaslaunchResearchInput.runId,
          sectionId: 'positioningMarketCategory',
        },
        {
          store,
          loadSkill: async () => 'Use the injected corpus only.',
          allowedTools: [],
          env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '0' },
          runAnswerTool,
          now: () => new Date('2026-05-29T12:40:00.000Z'),
        },
      ),
    ).rejects.toThrow(expectedReason);

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const validationFailures = record.events.filter(
      (event) => event.type === 'validation-failed',
    );
    const sectionFailed = record.events.find(
      (event) => event.type === 'section-failed',
    );

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(validationFailures.at(-1)?.metadata.issues).toEqual([
      expectedReason,
    ]);
    expect(sectionFailed?.metadata.error).toBe(expectedReason);
    expect(record.sections.positioningMarketCategory?.status).toBe('failed');
    expect(record.sections.positioningMarketCategory?.artifact).toBeNull();
    expect(record.events.map((event) => event.type)).not.toContain(
      'artifact-saved',
    );
  });

  it('commits when residual unsupported claims are within the verifier threshold', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-29T12:45:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const unsupportedOutput =
      buildMarketCategoryOutputWithUnsupportedRates(['44%']);
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildMarketCategorySupportStep()],
      text: '',
      answerInput: unsupportedOutput,
    }));

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningMarketCategory',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '2' },
        runAnswerTool,
        now: () => new Date('2026-05-29T12:45:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const unsupportedNumericClaims =
      result.artifact.verification?.claims.filter(
        (claim) =>
          claim.status === 'unsupported' &&
          claim.claim.kind === 'numeric' &&
          claim.claim.value === '44%',
      ) ?? [];

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(unsupportedNumericClaims).toHaveLength(1);
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
    expect(record.events.map((event) => event.type)).not.toContain(
      'section-failed',
    );
  });

  it('records an honest competitor ad gap when ad tools are disabled', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningCompetitorLandscape'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildCompetitorLandscapeOutput();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(Object.keys(params.externalTools)).toEqual([]);

      return {
        steps: [buildCompetitorLandscapeSupportStep()],
        text: '',
        answerInput: output,
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningCompetitorLandscape',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    expect(result.artifact.sectionId).toBe('positioningCompetitorLandscape');
    expect(result.artifact.body).toMatchObject({
      competitorSet: competitorLandscapeFixtureArtifact.body.competitorSet,
    });
    assertCompetitorLandscapeBody(result.artifact.body);
    expect(result.artifact.body.adEvidence.advertiserGroups[0]).toMatchObject({
      advertiserName: 'Kalungi',
      domain: 'kalungi.com',
      sourceErrors: [
        {
          platform: 'google',
          message: expect.stringContaining('google_ads tool is unavailable'),
        },
        {
          platform: 'meta',
          message: expect.stringContaining('meta_ads tool is unavailable'),
        },
      ],
    });
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
  });

  it('harvests model ad-tool calls from answer steps into competitor adEvidence', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningCompetitorLandscape'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    const researchInput = {
      ...saaslaunchResearchInput,
      runId: 'run-model-ad-tools',
      competitorAds: [],
    };
    await store.createRun(researchInput);

    const output = buildCompetitorLandscapeOutput();
    const toolStep: AgentStep = {
      stepNumber: 0,
      finishReason: 'tool-calls',
      text: '',
      toolCalls: [
        {
          toolName: 'google_ads',
          input: {
            advertiser: 'Gong',
            domain: 'gong.io',
            max_results: 4,
          },
        },
      ],
      toolResults: [
        {
          toolName: 'google_ads',
          input: {
            advertiser: 'Gong',
            domain: 'gong.io',
            max_results: 4,
          },
          output: {
            type: 'result',
            advertiser: 'Gong',
            platform: 'google',
            ads: [
              {
                url: 'https://adstransparency.google.com/advertiser/gong',
                id: 'gong-ad-1',
                advertiserName: 'Gong',
                title: 'Improve forecast accuracy',
                detailsUrl:
                  'https://adstransparency.google.com/advertiser/gong',
              },
            ],
          },
          type: 'tool-result',
        },
      ],
    };
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(Object.keys(params.externalTools)).toEqual(
        expect.arrayContaining(['google_ads', 'meta_ads']),
      );
      params.onStepFinish?.(toolStep);

      return {
        steps: [toolStep, buildCompetitorLandscapeSupportStep()],
        text: '',
        answerInput: output,
      };
    });

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningCompetitorLandscape',
      },
      {
        store,
        loadSkill: async () => 'Use model-selected ad tools.',
        runAnswerTool,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    assertCompetitorLandscapeBody(result.artifact.body);
    expect(result.artifact.body.adEvidence.advertiserGroups).toEqual([
      expect.objectContaining({
        advertiserName: 'Gong',
        domain: 'gong.io',
        returnedCreativeCount: 1,
        creatives: [
          expect.objectContaining({
            advertiserName: 'Gong',
            id: 'gong-ad-1',
            platform: 'google',
          }),
        ],
      }),
    ]);

    const record = await store.readRun(researchInput.runId);
    expect(
      record.events
        .filter((event) => event.type === 'tool-started')
        .map((event) => event.metadata),
    ).toContainEqual({
      toolName: 'google_ads',
      query: 'Gong (gong.io)',
    });
  });

  it('normalizes paid-media structured drift before strict validation', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const driftOutput = buildPaidMediaPlanOutput();
    const body = requireRecord(driftOutput.body);
    const campaignOverview = requireRecord(body.campaignOverview);
    campaignOverview.monthlyBudget = 3000;
    campaignOverview.dailySpend = 100;

    const creativeFramework = requireRecord(body.creativeFramework);
    const creatives = creativeFramework.creatives;
    if (!Array.isArray(creatives)) {
      throw new Error('Expected creatives array.');
    }
    for (const creative of creatives) {
      const creativeRecord = requireRecord(creative);
      creativeRecord.headline = 'Extra generated headline';
      creativeRecord.body = 'Extra generated body';
      creativeRecord.cta = 'Book a demo';
      creativeRecord.visualDescription = 'Extra visual direction';
      creativeRecord.landingPageUrl = 'https://example.com/landing';
    }

    const competitorMarketingInsights = requireRecord(
      body.competitorMarketingInsights,
    );
    const competitors = competitorMarketingInsights.competitors;
    if (!Array.isArray(competitors)) {
      throw new Error('Expected competitors array.');
    }
    for (const competitor of competitors) {
      const competitorRecord = requireRecord(competitor);
      competitorRecord.anglesTested = ['Speed', 'Simplicity'];
      competitorRecord.adPlatforms = 'Meta, Google';
    }

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.schema.safeParse(driftOutput).success).toBe(true);

      return driftOutput;
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningPaidMediaPlan',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runEvidencePass,
        callStructured,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );

    expect(result.artifact.sectionId).toBe('positioningPaidMediaPlan');
    expect(result.artifact.verification).toEqual(
      expect.objectContaining({
        claims: expect.any(Array),
        unsupportedCount: expect.any(Number),
        verifiedCount: expect.any(Number),
      }),
    );
    const artifactBody = requireRecord(result.artifact.body);
    const artifactCampaignOverview = requireRecord(
      artifactBody.campaignOverview,
    );
    const artifactCreativeFramework = requireRecord(
      artifactBody.creativeFramework,
    );
    const artifactCreatives = artifactCreativeFramework.creatives;
    const artifactCompetitorMarketingInsights = requireRecord(
      artifactBody.competitorMarketingInsights,
    );
    const artifactCompetitors =
      artifactCompetitorMarketingInsights.competitors;
    if (!Array.isArray(artifactCreatives) || !Array.isArray(artifactCompetitors)) {
      throw new Error('Expected normalized paid-media arrays.');
    }
    expect(artifactCampaignOverview.monthlyBudget).toBe('3000');
    expect(artifactCampaignOverview.dailySpend).toBe('100');
    expect(artifactCreatives[0]).not.toHaveProperty('headline');
    expect(requireRecord(artifactCompetitors[0]).anglesTested).toBe(
      'Speed; Simplicity',
    );
    expect(requireRecord(artifactCompetitors[0]).adPlatforms).toEqual([
      'Meta',
      'Google',
    ]);
    expect(callStructured).toHaveBeenCalledTimes(1);
  });

  it('normalizes paid-media synthesized item grounding away from the GTM brief', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-05-27T04:22:16.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const driftOutput = buildPaidMediaPlanOutput();
    forceSynthesizedPaidMediaItemsToGtmBrief(driftOutput);

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async () => driftOutput);

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningPaidMediaPlan',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runEvidencePass,
        callStructured,
        now: () => new Date('2026-05-27T04:22:16.000Z'),
      },
    );

    const artifactBody = requireRecord(result.artifact.body);
    const anglesToTest = requireRecord(artifactBody.anglesToTest);
    const creativeFramework = requireRecord(artifactBody.creativeFramework);
    const competitorReviewInsights = requireRecord(
      artifactBody.competitorReviewInsights,
    );
    const competitorMarketingInsights = requireRecord(
      artifactBody.competitorMarketingInsights,
    );
    const funnelIdeation = requireRecord(artifactBody.funnelIdeation);
    const channelSuggestions = requireRecord(artifactBody.channelSuggestions);

    expect(
      (anglesToTest.angles as Record<string, unknown>[]).map(
        (item) => item.sourceSection,
      ),
    ).toEqual(Array.from({ length: 4 }, () => 'positioningVoiceOfCustomer'));
    expect(
      (creativeFramework.creatives as Record<string, unknown>[]).map(
        (item) => item.sourceSection,
      ),
    ).toEqual(Array.from({ length: 3 }, () => 'positioningOfferDiagnostic'));
    expect(
      (competitorReviewInsights.insights as Record<string, unknown>[]).map(
        (item) => item.sourceSection,
      ),
    ).toEqual(
      Array.from({ length: 2 }, () => 'positioningCompetitorLandscape'),
    );
    expect(
      (competitorMarketingInsights.competitors as Record<string, unknown>[]).map(
        (item) => item.sourceSection,
      ),
    ).toEqual(
      Array.from({ length: 2 }, () => 'positioningCompetitorLandscape'),
    );
    expect(
      (funnelIdeation.recommendations as Record<string, unknown>[]).map(
        (item) => item.sourceSection,
      ),
    ).toEqual(['positioningOfferDiagnostic']);
    expect(
      (channelSuggestions.suggestions as Record<string, unknown>[]).map(
        (item) => item.sourceSection,
      ),
    ).toEqual(Array.from({ length: 2 }, () => 'positioningDemandIntent'));
    expect(callStructured).toHaveBeenCalledTimes(1);
  });
});
