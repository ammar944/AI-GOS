import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  competitorLandscapeBodySchema,
  type CompetitorLandscapeBody,
  type CompetitorLandscapeSectionOutput,
} from '@/lib/lab-engine/artifacts/schemas/competitor-landscape';
import type { BuyerICPSectionOutput } from '@/lib/lab-engine/artifacts/schemas/buyer-icp';
import type { DemandIntentSectionOutput } from '@/lib/lab-engine/artifacts/schemas/demand-intent';
import type { MarketCategorySectionOutput } from '@/lib/lab-engine/artifacts/schemas/market-category';
import { buyerICPFixtureArtifact } from '@/lib/lab-engine/fixtures/buyer-icp-artifact';
import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
import { demandIntentFixtureSectionOutput } from '@/lib/lab-engine/fixtures/demand-intent-artifact';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { positioningSynthesisFixtureArtifact } from '@/lib/lab-engine/fixtures/positioning-synthesis-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { strategyModel } from '@/lib/lab-engine/ai/models';
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

function buildBuyerICPOutputWithGenericPersonaNames(): BuyerICPSectionOutput {
  return {
    sectionTitle: buyerICPFixtureArtifact.sectionTitle,
    verdict: buyerICPFixtureArtifact.verdict,
    statusSummary: buyerICPFixtureArtifact.statusSummary,
    confidence: buyerICPFixtureArtifact.confidence,
    sources: buyerICPFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: {
      ...buyerICPFixtureArtifact.body,
      personaReality: {
        ...buyerICPFixtureArtifact.body.personaReality,
        personas: buyerICPFixtureArtifact.body.personaReality.personas.map(
          (persona, index) => ({
            ...persona,
            name: [
              'Economic buyer',
              'Finance leaders',
              'Revenue Operator',
              'Fixture SaaS 4',
              'Enterprise finance team',
            ][index] ?? persona.name,
          }),
        ),
      },
    },
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
            'Fixture ad sources: https://example.com/fixtures/ad-library/pipelinepilot-google and https://example.com/fixtures/ad-library/signalforge-linkedin. Fixture TAM recipe support: 1,900 monthly searches from https://example.com/fixtures/keyword-volume/saaslaunch; 40% commercial-intent share from https://example.com/fixtures/ad-library/pipelinepilot-google; 2% visitor-to-opportunity conversion from https://example.com/saaslaunch/pricing; $6,000 ACV from https://example.com/saaslaunch/positioning-notes; $1.09M directional reachable revenue.',
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

function buildDemandIntentKeywordVolumeStep(): AgentStep {
  const keywords = demandIntentFixtureSectionOutput.body.keywordDemand.keywords;

  return {
    stepNumber: 0,
    finishReason: 'tool-calls',
    text: '',
    toolCalls: [
      {
        toolName: 'keyword_volume',
        input: {
          keywords: keywords.map((keyword) => keyword.keyword),
        },
      },
    ],
    toolResults: [
      {
        toolName: 'keyword_volume',
        input: {
          keywords: keywords.map((keyword) => keyword.keyword),
        },
        output: {
          type: 'result',
          source: 'SpyFu',
          keywords: keywords.map((keyword, index) => ({
            keyword: keyword.keyword,
            searchVolume: keyword.monthlyVolumeValue,
            cpc: 4.1 + index / 10,
            difficulty: keyword.difficulty,
          })),
        },
        type: 'tool-result',
      },
    ],
  };
}

function buildCompetitorLandscapeOutput(): CompetitorLandscapeSectionOutput {
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

function buildCompetitorLandscapeOutputWithGenericIncumbent(): CompetitorLandscapeSectionOutput {
  const output = structuredClone(buildCompetitorLandscapeOutput());

  output.body.incumbentBlindSpot.incumbent =
    'This section summarizes the competitive landscape.';

  return output;
}

function buildDemandIntentOutputWithNumericSiblings(): DemandIntentSectionOutput {
  return {
    ...demandIntentFixtureSectionOutput,
    sources: demandIntentFixtureSectionOutput.sources.map((source) => ({
      ...source,
    })),
    body: {
      ...demandIntentFixtureSectionOutput.body,
      keywordDemand: {
        ...demandIntentFixtureSectionOutput.body.keywordDemand,
        keywords: demandIntentFixtureSectionOutput.body.keywordDemand.keywords.map(
          (keyword, index) => ({
            ...keyword,
            cpc: `$${(4.1 + index / 10).toFixed(2)} (SpyFu-estimated)`,
            cpcValue: 4.1 + index / 10,
          }),
        ),
      },
    },
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

function buildPositioningSynthesisOutput(): Record<string, unknown> {
  return {
    sectionTitle: positioningSynthesisFixtureArtifact.sectionTitle,
    verdict: positioningSynthesisFixtureArtifact.verdict,
    statusSummary: positioningSynthesisFixtureArtifact.statusSummary,
    confidence: positioningSynthesisFixtureArtifact.confidence,
    sources: positioningSynthesisFixtureArtifact.sources.map((source) => ({
      id: source.id,
      observedAt: source.observedAt,
      title: source.title,
      url: source.url,
    })),
    body: structuredClone(positioningSynthesisFixtureArtifact.body),
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
        "Do not call web_search, firecrawl, pagespeed, reviews, keyword_ad_probe, adlibrary, google_ads, meta_ads, or linkedin_ads.",
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

  it('commits a BuyerICP persona evidence gap after repairs leave generic persona labels', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningBuyerICP'],
      now: () => new Date('2026-06-05T04:39:37.613Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    let calls = 0;
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      calls += 1;

      if (calls >= 2) {
        expect(params.prompt).toContain('BuyerICP persona-name repair');
        expect(params.prompt).toContain('body.personaReality.personas[4].name');
      }

      return {
        steps: [],
        text: '',
        answerInput: buildBuyerICPOutputWithGenericPersonaNames(),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningBuyerICP',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date('2026-06-05T04:39:37.613Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const body = requireRecord(result.artifact.body);
    const personaReality = requireRecord(body.personaReality);
    const personas = personaReality.personas;
    const evidenceGapReport = requireRecord(body.evidenceGapReport);
    const rejectedPersonaLabels = evidenceGapReport.rejectedPersonaLabels;

    if (!Array.isArray(personas) || !Array.isArray(rejectedPersonaLabels)) {
      throw new Error('Expected BuyerICP persona evidence-gap arrays.');
    }

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(body.evidenceGap).toBe(true);
    expect(evidenceGapReport.reason).toBe('insufficient_named_buyer_personas');
    expect(evidenceGapReport.foundNamedPersonaCount).toBe(0);
    expect(personas).toHaveLength(0);
    expect(rejectedPersonaLabels).toEqual([
      'Economic buyer',
      'Finance leaders',
      'Revenue Operator',
      'Fixture SaaS 4',
      'Enterprise finance team',
    ]);
    expect(result.artifact.verdict).toContain(
      'Named BuyerICP persona proof is below the evidence bar',
    );
    expect(record.sections.positioningBuyerICP?.status).toBe('completed');
    expect(record.events.map((event) => event.type)).not.toContain(
      'section-failed',
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
        // Explicit zero gate so the single unsupported claim exceeds the
        // threshold and triggers the bounded grounding repair.
        env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '0' },
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

  it('fails residual unsupported load-bearing claims when the verifier gate is set to an explicit zero threshold', async (): Promise<void> => {
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
          now: () => new Date('2026-05-29T12:30:00.000Z'),
        },
      ),
    ).rejects.toThrow(expectedReason);

    const record = await store.readRun(saaslaunchResearchInput.runId);

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(record.sections.positioningMarketCategory?.status).toBe('failed');
    expect(record.sections.positioningMarketCategory?.artifact).toBeNull();
    expect(record.events.map((event) => event.type)).toContain('section-failed');
  });

  it('repairs unsupported load-bearing claims when the verifier gate is set to an explicit zero threshold', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningMarketCategory'],
      now: () => new Date('2026-05-29T12:35:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const unsupportedOutput =
      buildMarketCategoryOutputWithUnsupportedRates(['44%']);
    let calls = 0;
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => {
      calls += 1;

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
        env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '0' },
        runAnswerTool,
        now: () => new Date('2026-05-29T12:35:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);

    expect(runAnswerTool).toHaveBeenCalledTimes(2);
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

    // 1 unsupported claim is within the threshold of 2 ⇒ no repair fires; commit
    // on the first attempt rather than burning wasted grounding re-runs.
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
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

  it('commits an explicit competitor strategic evidence gap after repairs leave incumbent text generic', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningCompetitorLandscape'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    let calls = 0;
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      calls += 1;

      if (calls >= 2) {
        expect(params.prompt).toContain('body.incumbentBlindSpot.incumbent');
        expect(params.prompt).toContain('missing incumbent/status-quo signal');
      }

      return {
        steps: [buildCompetitorLandscapeSupportStep()],
        text: '',
        answerInput: buildCompetitorLandscapeOutputWithGenericIncumbent(),
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

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    assertCompetitorLandscapeBody(result.artifact.body);
    expect(result.artifact.body.incumbentBlindSpot.incumbent).toMatch(
      /^evidence gap:/i,
    );
    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(eventTypes).toContain('validation-failed');
    expect(eventTypes).toContain('repair-started');
    expect(eventTypes).not.toContain('section-failed');
    expect(record.sections.positioningCompetitorLandscape?.status).toBe(
      'completed',
    );
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

  it('preserves Demand Intent keyword numeric siblings when committing artifacts', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningDemandIntent'],
      now: () => new Date('2026-06-04T04:45:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildDemandIntentOutputWithNumericSiblings();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(Object.keys(params.externalTools)).toEqual([]);

      return {
        steps: [buildDemandIntentKeywordVolumeStep()],
        text: '',
        answerInput: output,
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningDemandIntent',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        env: { LAB_SECTION_STREAMING: 'false', LAB_VERIFIER_MAX_UNSUPPORTED: '50' },
        runAnswerTool,
        now: () => new Date('2026-06-04T04:45:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const resultBody = requireRecord(result.artifact.body);
    const resultKeywordDemand = requireRecord(resultBody.keywordDemand);
    const resultKeywords = resultKeywordDemand.keywords;
    const committedArtifact = record.sections.positioningDemandIntent?.artifact;
    const committedBody = requireRecord(requireRecord(committedArtifact).body);
    const committedKeywordDemand = requireRecord(committedBody.keywordDemand);
    const committedKeywords = committedKeywordDemand.keywords;

    if (!Array.isArray(resultKeywords) || !Array.isArray(committedKeywords)) {
      throw new Error('Expected Demand Intent keyword arrays.');
    }

    expect(result.artifact.sectionId).toBe('positioningDemandIntent');
    expect(requireRecord(resultKeywords[0])).toMatchObject({
      monthlyVolumeValue: 320,
      cpc: '$4.10 (SpyFu-estimated)',
      cpcValue: 4.1,
      difficulty: 22,
    });
    expect(record.sections.positioningDemandIntent?.status).toBe('completed');
    expect(requireRecord(committedKeywords[0])).toMatchObject({
      monthlyVolumeValue: 320,
      cpc: '$4.10 (SpyFu-estimated)',
      cpcValue: 4.1,
      difficulty: 22,
    });
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
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

    const campaignPhases = requireRecord(body.campaignPhases);
    const phases = campaignPhases.phases;
    if (!Array.isArray(phases)) {
      throw new Error('Expected phases array.');
    }

    const audienceTypes = requireRecord(body.audienceTypes);
    const audiences = audienceTypes.audiences;
    if (!Array.isArray(audiences)) {
      throw new Error('Expected audiences array.');
    }
    const firstAudience = requireRecord(audiences[0]);
    firstAudience.dailyBudgetValue = 33.33;
    delete firstAudience.dailyBudgetProvenance;

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

    const orderedMoves = requireRecord(body.orderedMoves);
    const moves = orderedMoves.moves;
    if (!Array.isArray(moves)) {
      throw new Error('Expected ordered moves array.');
    }
    const genericLearningPriorities = [
      'Test message-market fit',
      'Measure creative performance',
      'Optimize paid media',
    ];
    moves.forEach((move, index) => {
      requireRecord(move).learningPriority = genericLearningPriorities[index];
    });

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
      competitorRecord.estSpendValue = 12345;
      delete competitorRecord.estSpendProvenance;
    }

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.model).toBe(strategyModel);
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
        env: { LAB_SECTION_STREAMING: 'false' },
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
    const artifactStrategicThesis = requireRecord(
      artifactBody.strategicThesis,
    );
    const artifactContradictionReconciliation = requireRecord(
      artifactBody.contradictionReconciliation,
    );
    const artifactOrderedMoves = requireRecord(artifactBody.orderedMoves);
    const artifactCampaignOverview = requireRecord(
      artifactBody.campaignOverview,
    );
    const artifactCampaignPhases = requireRecord(artifactBody.campaignPhases);
    const artifactPhases = artifactCampaignPhases.phases;
    const artifactAudienceTypes = requireRecord(artifactBody.audienceTypes);
    const artifactAudiences = artifactAudienceTypes.audiences;
    const artifactCreativeFramework = requireRecord(
      artifactBody.creativeFramework,
    );
    const artifactCreatives = artifactCreativeFramework.creatives;
    const artifactCompetitorMarketingInsights = requireRecord(
      artifactBody.competitorMarketingInsights,
    );
    const artifactCompetitors =
      artifactCompetitorMarketingInsights.competitors;
    if (
      !Array.isArray(artifactPhases) ||
      !Array.isArray(artifactAudiences) ||
      !Array.isArray(artifactCreatives) ||
      !Array.isArray(artifactCompetitors) ||
      !Array.isArray(artifactStrategicThesis.sourceSections) ||
      !Array.isArray(artifactContradictionReconciliation.sourceSections) ||
      !Array.isArray(artifactOrderedMoves.moves)
    ) {
      throw new Error('Expected normalized paid-media arrays and strategy fields.');
    }
    expect(artifactStrategicThesis.thesis).toContain(
      'proof-backed time-to-first-campaign',
    );
    expect(artifactStrategicThesis.sourceSections.map((source) =>
      requireRecord(source).sourceSection,
    )).toEqual([
      'positioningVoiceOfCustomer',
      'positioningCompetitorLandscape',
      'positioningOfferDiagnostic',
    ]);
    expect(artifactContradictionReconciliation.resolution).toContain(
      'speed-and-proof loop',
    );
    expect(requireRecord(artifactOrderedMoves.moves[0]).rank).toBe(1);
    expect(requireRecord(artifactOrderedMoves.moves[1]).dependsOn).toEqual([1]);
    expect(
      artifactOrderedMoves.moves.map((move) =>
        requireRecord(move).learningPriority,
      ),
    ).toEqual([
      expect.stringContaining('Evidence gap: ordered move 1'),
      expect.stringContaining('Evidence gap: ordered move 2'),
      expect.stringContaining('Evidence gap: ordered move 3'),
    ]);
    expect(requireRecord(artifactOrderedMoves.moves[1]).thesisTrace).toContain(
      'thesis differentiator',
    );
    expect(artifactCampaignOverview.monthlyBudget).toBe('3000');
    expect(artifactCampaignOverview.dailySpend).toBe('100');
    expect(artifactCampaignOverview.monthlyBudgetValue).toBe(3000);
    expect(artifactCampaignOverview.dailySpendValue).toBe(100);
    expect(artifactCampaignOverview.monthlyBudgetProvenance).toBe(
      'user-supplied',
    );
    expect(artifactCampaignOverview.dailySpendProvenance).toBe(
      'model-estimated',
    );
    expect(requireRecord(artifactPhases[0]).monthlyBudgetValue).toBe(3000);
    expect(requireRecord(artifactPhases[0]).monthlyBudgetProvenance).toBe(
      'model-estimated',
    );
    expect(requireRecord(artifactAudiences[0])).not.toHaveProperty(
      'dailyBudgetValue',
    );
    expect(requireRecord(artifactAudiences[0]).dailyBudgetProvenance).toBe(
      'unknown',
    );
    expect(requireRecord(artifactAudiences[1]).dailyBudgetValue).toBe(33.33);
    expect(requireRecord(artifactCompetitors[0]).estSpendProvenance).toBe(
      'unknown',
    );
    expect(requireRecord(artifactCompetitors[0])).not.toHaveProperty(
      'estSpendValue',
    );
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

  it('runs synthesis capstones on the strategy model and preserves strategy fields', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningSynthesis'],
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const synthesisOutput = buildPositioningSynthesisOutput();
    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.model).toBe(strategyModel);
      expect(params.schema.safeParse(synthesisOutput).success).toBe(true);

      return synthesisOutput;
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningSynthesis',
      },
      {
        store,
        loadSkill: async () => 'Synthesize the committed positioning corpus.',
        allowedTools: [],
        runEvidencePass,
        callStructured,
        env: { LAB_SECTION_STREAMING: 'false' },
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      },
    );
    const record = await store.readRun(saaslaunchResearchInput.runId);
    const artifactBody = requireRecord(result.artifact.body);
    const artifactStrategicThesis = requireRecord(
      artifactBody.strategicThesis,
    );
    const artifactContradictionReconciliation = requireRecord(
      artifactBody.contradictionReconciliation,
    );
    const artifactOrderedMoves = requireRecord(artifactBody.orderedMoves);

    if (
      !Array.isArray(artifactStrategicThesis.sourceSections) ||
      !Array.isArray(artifactContradictionReconciliation.sourceSections) ||
      !Array.isArray(artifactOrderedMoves.moves)
    ) {
      throw new Error('Expected normalized synthesis strategy arrays.');
    }
    expect(result.artifact.sectionId).toBe('positioningSynthesis');
    expect(artifactStrategicThesis.force).toContain(
      'Operational impatience',
    );
    expect(artifactContradictionReconciliation.tradeOffAccepted).toContain(
      'smaller initial story',
    );
    expect(requireRecord(artifactOrderedMoves.moves[2]).dependsOn).toEqual([
      1,
      2,
    ]);
    expect(requireRecord(artifactOrderedMoves.moves[2]).thesisTrace).toContain(
      'thesis expansion step',
    );
    expect(record.sections.positioningSynthesis?.artifact?.body).toEqual(
      result.artifact.body,
    );
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
        env: { LAB_SECTION_STREAMING: 'false' },
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
      (funnelIdeation.recommendations as Record<string, unknown>[]).map(
        (item) => item.sourceUrl,
      ),
    ).toEqual(['https://example.com/paid-media/source-3']);
    expect(
      (channelSuggestions.suggestions as Record<string, unknown>[]).map(
        (item) => item.sourceSection,
      ),
    ).toEqual(Array.from({ length: 2 }, () => 'positioningDemandIntent'));
    expect(
      (channelSuggestions.suggestions as Record<string, unknown>[]).map(
        (item) => item.sourceUrl,
      ),
    ).toEqual(
      Array.from({ length: 2 }, () => 'https://example.com/paid-media/source-3'),
    );
    expect(callStructured).toHaveBeenCalledTimes(1);
  });
});
