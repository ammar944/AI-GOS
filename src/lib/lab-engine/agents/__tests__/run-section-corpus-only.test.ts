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
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { sectionRunnerModel } from '@/lib/lab-engine/ai/models';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';

import { labSectionRepairFloorMs, runSection } from '../run-section';
import type {
  PaidMediaPlanVerificationResult,
  VerifyPaidMediaPlanInput,
} from '../verification/claim-source-verifier';
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

function buildBuyerICPOutputWithNestedEvidenceGapKeys(): unknown {
  const output = buildBuyerICPOutputWithGenericPersonaNames();

  return {
    ...output,
    body: {
      ...output.body,
      personaReality: {
        ...output.body.personaReality,
        evidenceGap: true,
        evidenceGapReport: {
          reason: 'insufficient_named_buyer_personas',
          summary:
            'Model-authored nested evidence gaps must not become artifact shape.',
        },
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
        signals: output.body.marketSize.signals.slice(0, 1),
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

function buildCompetitorLandscapeMisattributionSupportStep(): AgentStep {
  const supportStep = buildCompetitorLandscapeSupportStep();
  const toolResult = supportStep.toolResults[0];
  const output = requireRecord(toolResult?.output);
  const text = output.text;

  if (typeof text !== 'string') {
    throw new Error('Expected competitor fixture support text.');
  }

  return {
    ...supportStep,
    toolResults: [
      {
        ...toolResult,
        output: {
          ...output,
          text: [
            text,
            'Clean up your CRM before pipeline review',
            'https://baserow.io/reviews',
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

function buildCompetitorLandscapeOutputWithMisattributedQuote(): CompetitorLandscapeSectionOutput {
  const output = structuredClone(buildCompetitorLandscapeOutput());
  const firstWeakness = output.body.publicWeaknesses.items[0];

  if (firstWeakness === undefined) {
    throw new Error('Expected public weakness fixture item.');
  }

  output.body.publicWeaknesses.items[0] = {
    ...firstWeakness,
    source: 'G2',
    sourceUrl: 'https://baserow.io/reviews',
  };

  return output;
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

type PaidMediaVerifierResultOverrides = Omit<
  Partial<PaidMediaPlanVerificationResult>,
  'summary'
> & {
  summary?: Partial<PaidMediaPlanVerificationResult['summary']>;
};

function buildPaidMediaVerifierResult(
  overrides: PaidMediaVerifierResultOverrides = {},
): PaidMediaPlanVerificationResult {
  const { summary: summaryOverrides, ...resultOverrides } = overrides;
  const summary: PaidMediaPlanVerificationResult['summary'] = {
    totalClaims: 0,
    judged: 0,
    deterministicFlags: 0,
    judgeFlags: 0,
    verifierErrors: 0,
    judgeSkipped: 0,
    hardFailCount: 0,
    needsReviewCount: 0,
    hardFailIds: [],
    needsReviewIds: [],
    ...summaryOverrides,
  };

  return {
    verdicts: [],
    claims: [],
    summary,
    hardFail: false,
    needsReview: false,
    repairIssues: [],
    ...resultOverrides,
  };
}

function createPaidMediaVerifierMock(
  results: readonly PaidMediaPlanVerificationResult[] = [
    buildPaidMediaVerifierResult(),
  ],
): (input: VerifyPaidMediaPlanInput) => Promise<PaidMediaPlanVerificationResult> {
  const queue = [...results];

  return vi.fn(async (): Promise<PaidMediaPlanVerificationResult> => {
    return queue.shift() ?? buildPaidMediaVerifierResult();
  });
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected record.');
  }

  return value as Record<string, unknown>;
}

async function sourceLivenessUnavailableFetch(): Promise<Response> {
  throw new Error('source liveness network unavailable in test');
}

function assertCompetitorLandscapeBody(
  body: unknown,
): asserts body is CompetitorLandscapeBody {
  competitorLandscapeBodySchema.parse(body);
}

describe('runSection corpus-only mode', (): void => {
  beforeEach((): void => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-deepseek-key');
    vi.stubEnv('LAB_SECTION_STREAMING', 'false');
    vi.stubGlobal('fetch', sourceLivenessUnavailableFetch);
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it('strips model-authored nested BuyerICP evidence-gap keys before committing the runner-owned gap', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningBuyerICP'],
      now: () => new Date('2026-06-05T04:39:37.613Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [],
      text: '',
      answerInput: buildBuyerICPOutputWithNestedEvidenceGapKeys(),
    }));

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
    const evidenceGapReport = requireRecord(body.evidenceGapReport);

    expect(runAnswerTool).toHaveBeenCalledTimes(3);
    expect(body.evidenceGap).toBe(true);
    expect(evidenceGapReport.reason).toBe('insufficient_named_buyer_personas');
    expect(personaReality.evidenceGap).toBeUndefined();
    expect(personaReality.evidenceGapReport).toBeUndefined();
    expect(record.sections.positioningBuyerICP?.status).toBe('completed');
    expect(record.events.map((event) => event.type)).not.toContain(
      'section-failed',
    );
  });

  it('skips BuyerICP repair below the deadline floor and commits the evidence gap', async (): Promise<void> => {
    const nowIso = '2026-06-05T04:39:37.613Z';
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningBuyerICP'],
      now: () => new Date(nowIso),
    });
    await store.createRun(saaslaunchResearchInput);

    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [],
      text: '',
      answerInput: buildBuyerICPOutputWithGenericPersonaNames(),
    }));

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningBuyerICP',
        deadlineAt: Date.parse(nowIso) + labSectionRepairFloorMs - 1,
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        runAnswerTool,
        now: () => new Date(nowIso),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const body = requireRecord(result.artifact.body);
    const eventTypes = record.events.map((event) => event.type);
    const deadlineSkip = record.events.find(
      (event) =>
        event.type === 'validation-failed' &&
        event.message === 'Answer tool repair skipped for deadline-aware salvage',
    );

    expect(runAnswerTool).toHaveBeenCalledTimes(1);
    expect(body.evidenceGap).toBe(true);
    expect(eventTypes).not.toContain('repair-started');
    const deadlineSkipIssues =
      deadlineSkip !== undefined && 'issues' in deadlineSkip.metadata
        ? deadlineSkip.metadata.issues
        : undefined;
    expect(deadlineSkipIssues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('deadline-aware salvage: skipped repair'),
      ]),
    );
    expect(record.sections.positioningBuyerICP?.status).toBe('completed');
    expect(eventTypes).not.toContain('section-failed');
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
    const resultBody = requireRecord(result.artifact.body);
    const marketSize = requireRecord(resultBody.marketSize);
    const signals = marketSize.signals;

    if (!Array.isArray(signals)) {
      throw new Error('Expected marketSize.signals array.');
    }

    // The body string ships untouched (no inline [unverified] splice); the
    // unsupported figure is carried as verifierSummary metadata only.
    expect(requireRecord(signals[0]).evidence).toBe(
      'The category is expanding at 44% annually.',
    );
    expect(result.artifact.verifierSummary).toEqual(
      expect.objectContaining({
        strippedNumericClaims: [
          {
            action: 'recorded',
            field: 'body.marketSize.signals[0].evidence',
            value: '44%',
          },
        ],
      }),
    );
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
    expect(record.events.map((event) => event.type)).not.toContain(
      'section-failed',
    );
  });

  it('commits flag-only quote provenance with needs_review metadata', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningCompetitorLandscape'],
      now: () => new Date('2026-05-29T12:46:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildCompetitorLandscapeOutputWithMisattributedQuote();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildCompetitorLandscapeMisattributionSupportStep()],
      text: '',
      answerInput: output,
    }));

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningCompetitorLandscape',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        env: { LAB_SECTION_STREAMING: 'false' },
        runAnswerTool,
        now: () => new Date('2026-05-29T12:46:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);

    expect(runAnswerTool).toHaveBeenCalledTimes(1);
    expect(result.artifact.needs_review).toBe(true);
    expect(result.artifact.verifierSummary).toEqual(
      expect.objectContaining({
        provenanceFlags: [
          expect.objectContaining({
            reason: 'misattributed',
            value: 'Clean up your CRM before pipeline review',
          }),
        ],
        strippedQuoteAttributions: [
          expect.objectContaining({
            actualHost: 'baserow.io',
            claimedPlatform: 'g2',
            claimedSource: 'G2',
            relabeledTo: 'baserow.io',
            value: 'Clean up your CRM before pipeline review',
          }),
        ],
      }),
    );
    expect(result.artifact.confidence).toBeLessThan(1);
    expect(
      record.sections.positioningCompetitorLandscape?.artifact,
    ).toEqual(
      expect.objectContaining({
        needs_review: true,
        verifierSummary: expect.objectContaining({
          provenanceFlags: [
            expect.objectContaining({
              reason: 'misattributed',
              value: 'Clean up your CRM before pipeline review',
            }),
          ],
        }),
      }),
    );
    // The lie never ships: the committed body no longer asserts G2 — the quote
    // is kept but relabeled to the host that actually served it, and because
    // that host is a page-level source (not a per-review permalink) the
    // provenance gate also downgrades the verbatim claim to an explicit
    // paraphrased pattern.
    const committedBody = record.sections.positioningCompetitorLandscape
      ?.artifact?.body as {
      publicWeaknesses: {
        items: Array<{ source: string; verbatimQuote: string }>;
      };
    };
    expect(committedBody.publicWeaknesses.items[0]?.source).toBe(
      'baserow.io — page-level source; not verifiable as verbatim',
    );
    expect(committedBody.publicWeaknesses.items[0]?.verbatimQuote).toBe(
      'Paraphrased pattern (no per-review permalink): Clean up your CRM before pipeline review',
    );
    expect(record.sections.positioningCompetitorLandscape?.status).toBe(
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
    // The subject is always probed first (its own ads are first-class
    // evidence), so its gap group leads the wall, flagged isSubject.
    expect(result.artifact.body.adEvidence.advertiserGroups[0]).toMatchObject({
      advertiserName: 'SaaSLaunch',
      domain: 'example.com',
      isSubject: true,
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
    // With the corpus-only probe slot taken by the subject, the post-draft
    // rescue carries the drafted competitorSet (SignalForge rides first there).
    expect(result.artifact.body.adEvidence.advertiserGroups[1]).toMatchObject({
      advertiserName: 'SignalForge',
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
    // The harvested model ad-tool group is on the wall. With blank brief seeds
    // the post-draft rescue probe ALSO fires for the drafted competitorSet;
    // its lookups gap out here (no SEARCHAPI_KEY in tests), so the rescue adds
    // honest gap-only groups tagged with the rescue provenance note alongside
    // the harvested Gong group.
    const advertiserGroups = result.artifact.body.adEvidence.advertiserGroups;
    expect(advertiserGroups).toEqual(
      expect.arrayContaining([
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
      ]),
    );
    expect(
      advertiserGroups
        .filter(
          (group) =>
            group.advertiserName !== 'Gong' && group.isSubject !== true,
        )
        .every((group) =>
          group.dataGaps.some((gap) =>
            gap.reason.includes('post-draft rescue probe'),
          ),
        ),
    ).toBe(true);

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
    // This corpus-only fixture leaves > 6 unsupported load-bearing claims, so
    // the finite repair trigger spends both bounded grounding repairs
    // (1 initial + answerToolMaxRepairAttempts) before committing the best
    // attempt — the gate itself (50) still never hard-fails the section.
    expect(runAnswerTool).toHaveBeenCalledTimes(3);
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

    const campaignPhases = body.campaignPhases;
    if (!Array.isArray(campaignPhases)) {
      throw new Error('Expected campaign phases array.');
    }
    campaignPhases.push(structuredClone(campaignPhases[0]));

    const audiences = body.audienceTypes;
    if (!Array.isArray(audiences)) {
      throw new Error('Expected audiences array.');
    }
    const firstAudience = requireRecord(audiences[0]);
    firstAudience.dailyBudgetValue = 33.33;
    delete firstAudience.dailyBudgetProvenance;
    firstAudience.sourceSection = 'positioningVoC';
    const secondAudience = requireRecord(audiences[1]);
    secondAudience.dailyBudgetProvenance = 'customer';

    const anglesToTest = body.anglesToTest;
    if (!Array.isArray(anglesToTest)) {
      throw new Error('Expected angles array.');
    }
    requireRecord(anglesToTest[0]).sourceSection = 'positioningVoC';
    anglesToTest.push(structuredClone(anglesToTest[0]));

    const creatives = body.creativeFramework;
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
    const competitors = body.competitorMarketingInsights;
    if (!Array.isArray(competitors)) {
      throw new Error('Expected competitors array.');
    }
    const firstCompetitor = requireRecord(competitors[0]);
    firstCompetitor.adPlatforms = ['Meta', 'Google'];
    firstCompetitor.anglesTested = 'Speed; Simplicity';
    firstCompetitor.sourceSection = 'competitors';
    delete firstCompetitor.angles;

    const channelSuggestions = body.channelSuggestions;
    if (!Array.isArray(channelSuggestions)) {
      throw new Error('Expected channel suggestions array.');
    }
    const firstChannel = requireRecord(channelSuggestions[0]);
    firstChannel.verdict = 'start';
    firstChannel.sourceSection = 'offer diagnostic';

    const reviewInsights = body.competitorReviewInsights;
    if (!Array.isArray(reviewInsights) || reviewInsights.length < 2) {
      throw new Error('Expected competitor review insights array.');
    }
    const weakReviewInsight = requireRecord(reviewInsights[1]);
    weakReviewInsight.verbatimComplaint = 'Too generic.';
    delete weakReviewInsight.howWeLeverage;
    weakReviewInsight.adLeverage = 'Use this in ads.';

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.model).toBe(sectionRunnerModel);

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
        verifyPaidMediaPlan: createPaidMediaVerifierMock(),
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
    const artifactCampaignOverview = requireRecord(
      artifactBody.campaignOverview,
    );
    const artifactPhases = artifactBody.campaignPhases;
    const artifactAudiences = artifactBody.audienceTypes;
    const artifactAngles = artifactBody.anglesToTest;
    const artifactCreatives = artifactBody.creativeFramework;
    const artifactReviewInsights = artifactBody.competitorReviewInsights;
    const artifactCompetitors = artifactBody.competitorMarketingInsights;
    const artifactChannels = artifactBody.channelSuggestions;
    const artifactCrossSectionInsight = artifactBody.crossSectionInsight;
    if (
      !Array.isArray(artifactPhases) ||
      !Array.isArray(artifactAudiences) ||
      !Array.isArray(artifactAngles) ||
      !Array.isArray(artifactCreatives) ||
      !Array.isArray(artifactReviewInsights) ||
      !Array.isArray(artifactCompetitors) ||
      !Array.isArray(artifactChannels) ||
      !Array.isArray(artifactCrossSectionInsight)
    ) {
      throw new Error('Expected normalized paid-media arrays.');
    }
    expect(artifactBody).not.toHaveProperty('strategicThesis');
    expect(artifactBody).not.toHaveProperty('contradictionReconciliation');
    expect(artifactBody).not.toHaveProperty('orderedMoves');
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
    expect(artifactPhases).toHaveLength(3);
    expect(artifactAudiences).toHaveLength(3);
    expect(artifactAngles).toHaveLength(5);
    expect(artifactCreatives).toHaveLength(8);
    expect(artifactChannels).toHaveLength(4);
    expect(artifactCrossSectionInsight).toHaveLength(1);
    expect(requireRecord(artifactPhases[0])).not.toHaveProperty(
      'monthlyBudgetValue',
    );
    expect(requireRecord(artifactPhases[0]).monthlyBudgetProvenance).toBe(
      'unknown',
    );
    expect(requireRecord(artifactAudiences[0])).not.toHaveProperty(
      'dailyBudgetValue',
    );
    expect(requireRecord(artifactAudiences[0]).dailyBudgetProvenance).toBe(
      'unknown',
    );
    expect(requireRecord(artifactAudiences[0]).sourceSection).toBe(
      'positioningVoiceOfCustomer',
    );
    expect(requireRecord(artifactAudiences[1]).dailyBudgetValue).toBe(33.33);
    // The model-asserted "user-supplied" label (snapped from "customer") is
    // unearned — the saaslaunch brief carries no economics — so provenance
    // downgrades to "model-estimated" while the display value stays.
    expect(requireRecord(artifactAudiences[1]).dailyBudgetProvenance).toBe(
      'model-estimated',
    );
    expect(requireRecord(artifactAngles[0]).sourceSection).toBe(
      'positioningVoiceOfCustomer',
    );
    expect(artifactCreatives[0]).not.toHaveProperty('headline');
    expect(requireRecord(artifactReviewInsights[1]).howWeLeverage).toBe(
      'Use this in ads.',
    );
    expect(requireRecord(artifactCompetitors[0]).angles).toBe(
      'Speed; Simplicity',
    );
    expect(requireRecord(artifactCompetitors[0]).adPlatforms).toBe('Meta; Google');
    expect(requireRecord(artifactCompetitors[0]).sourceSection).toBe(
      'positioningCompetitorLandscape',
    );
    expect(requireRecord(artifactChannels[0]).verdict).toBe('ADD');
    expect(requireRecord(artifactChannels[0]).sourceSection).toBe(
      'positioningOfferDiagnostic',
    );
    expect(callStructured).toHaveBeenCalledTimes(1);
  });

  it('omits inconsistent paid-media numeric siblings before minimum validation', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-06-05T12:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const driftOutput = buildPaidMediaPlanOutput();
    const body = requireRecord(driftOutput.body);
    const campaignOverview = requireRecord(body.campaignOverview);
    campaignOverview.monthlyBudget = '$50,000 (unknown)';
    campaignOverview.monthlyBudgetValue = 50000;
    campaignOverview.monthlyBudgetProvenance = 'unknown';
    campaignOverview.dailySpend = '~$1,667 (unknown)';
    campaignOverview.dailySpendValue = 1667;
    campaignOverview.dailySpendProvenance = 'unknown';

    const phases = body.campaignPhases;
    if (!Array.isArray(phases)) {
      throw new Error('Expected phases array.');
    }
    const phaseMonthlyBudgetValues = [15000, 20000, 15000];
    phases.forEach((phaseValue, index) => {
      const monthlyBudgetValue =
        phaseMonthlyBudgetValues[index % phaseMonthlyBudgetValues.length];
      const phase = requireRecord(phaseValue);
      phase.monthlyBudget = `$${monthlyBudgetValue.toLocaleString()} (unknown)`;
      phase.monthlyBudgetValue = monthlyBudgetValue;
      phase.monthlyBudgetProvenance = 'unknown';
    });

    const audiences = body.audienceTypes;
    if (!Array.isArray(audiences)) {
      throw new Error('Expected audiences array.');
    }
    audiences.forEach((audience) => {
      const audienceRecord = requireRecord(audience);
      audienceRecord.dailyBudget = '$500 (unknown)';
      audienceRecord.dailyBudgetValue = 500;
      audienceRecord.dailyBudgetProvenance = 'unknown';
    });

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.model).toBe(sectionRunnerModel);

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
        verifyPaidMediaPlan: createPaidMediaVerifierMock(),
        env: { LAB_SECTION_STREAMING: 'false' },
        now: () => new Date('2026-06-05T12:00:00.000Z'),
      },
    );

    const artifactBody = requireRecord(result.artifact.body);
    const artifactCampaignOverview = requireRecord(
      artifactBody.campaignOverview,
    );
    const artifactPhases = artifactBody.campaignPhases;
    const artifactAudiences = artifactBody.audienceTypes;
    if (!Array.isArray(artifactPhases) || !Array.isArray(artifactAudiences)) {
      throw new Error('Expected normalized paid-media spend arrays.');
    }

    expect(artifactCampaignOverview).not.toHaveProperty('monthlyBudgetValue');
    expect(artifactCampaignOverview).not.toHaveProperty('dailySpendValue');
    artifactPhases.forEach((phase) => {
      expect(requireRecord(phase)).not.toHaveProperty('monthlyBudgetValue');
    });
    artifactAudiences.forEach((audience) => {
      expect(requireRecord(audience)).not.toHaveProperty('dailyBudgetValue');
    });
    expect(callStructured).toHaveBeenCalledTimes(1);
  });

  it('retries paid-media length finishes once with the expanded token budget', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-06-09T08:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildPaidMediaPlanOutput();
    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.model).toBe(sectionRunnerModel);

      if (callStructured.mock.calls.length === 1) {
        expect(params.maxOutputTokens).toBe(16_384);
        throw new Error(
          'Structured output PaidMediaPlanSectionOutput ended with finishReason=length.',
        );
      }

      expect(params.maxOutputTokens).toBe(20_480);
      return output;
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
        env: { LAB_SECTION_STREAMING: 'false' },
        runEvidencePass,
        callStructured,
        verifyPaidMediaPlan: createPaidMediaVerifierMock(),
        now: () => new Date('2026-06-09T08:00:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const startedEvents = record.events.filter(
      (event) => event.type === 'structured-output-started',
    );

    expect(result.artifact.sectionId).toBe('positioningPaidMediaPlan');
    expect(callStructured).toHaveBeenCalledTimes(2);
    expect(startedEvents.map((event) => event.metadata.attempt)).toEqual([1, 2]);
    expect(startedEvents.at(-1)?.metadata.maxOutputTokens).toBe(20_480);
    expect(record.sections.positioningPaidMediaPlan?.status).toBe('completed');
    expect(record.events.map((event) => event.type)).not.toContain(
      'section-failed',
    );
  });

  it('fails paid-media length finishes after the single expanded retry', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-06-09T08:05:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const lengthError =
      'Structured output PaidMediaPlanSectionOutput ended with finishReason=length.';
    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      expect(params.model).toBe(sectionRunnerModel);
      expect(params.maxOutputTokens).toBe(
        callStructured.mock.calls.length === 1 ? 16_384 : 20_480,
      );
      throw new Error(lengthError);
    });

    await expect(
      runSection(
        {
          runId: saaslaunchResearchInput.runId,
          sectionId: 'positioningPaidMediaPlan',
        },
        {
          store,
          loadSkill: async () => 'Use the injected corpus only.',
          allowedTools: [],
          env: { LAB_SECTION_STREAMING: 'false' },
          runEvidencePass,
          callStructured,
          verifyPaidMediaPlan: createPaidMediaVerifierMock(),
          now: () => new Date('2026-06-09T08:05:00.000Z'),
        },
      ),
    ).rejects.toThrow('finishReason=length');

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const startedEvents = record.events.filter(
      (event) => event.type === 'structured-output-started',
    );

    expect(callStructured).toHaveBeenCalledTimes(2);
    expect(startedEvents.map((event) => event.metadata.attempt)).toEqual([1, 2]);
    expect(startedEvents.at(-1)?.metadata.maxOutputTokens).toBe(20_480);
    expect(record.sections.positioningPaidMediaPlan?.status).toBe('failed');
    expect(record.sections.positioningPaidMediaPlan?.artifact).toBeNull();
    expect(record.events.map((event) => event.type)).toContain('section-failed');
  });

  it('commits paid-media verifier soft flags with needs_review metadata', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-06-09T09:00:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async () => {
      const output = buildPaidMediaPlanOutput();
      const body = requireRecord(output.body);
      const overview = requireRecord(body.campaignOverview);

      overview.monthlyBudget = '$99,999 / Month';
      overview.monthlyBudgetValue = 99_999;
      overview.monthlyBudgetProvenance = 'model-estimated';
      overview.dailySpend = '$3,333 / day';
      overview.dailySpendValue = 3_333;
      overview.dailySpendProvenance = 'user-supplied';

      return output;
    });
    const verifierSummary = {
      totalClaims: 4,
      judged: 4,
      deterministicFlags: 0,
      judgeFlags: 1,
      verifierErrors: 0,
      judgeSkipped: 0,
      hardFailCount: 0,
      needsReviewCount: 1,
      hardFailIds: [],
      needsReviewIds: ['anglesToTest[0].Founder proof'],
    };
    const verifyPaidMediaPlan = createPaidMediaVerifierMock([
      buildPaidMediaVerifierResult({
        needsReview: true,
        summary: verifierSummary,
        repairIssues: [
          'paid-media verifier FABRICATION anglesToTest[0].Founder proof: mechanism not grounded',
        ],
      }),
    ]);

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningPaidMediaPlan',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        env: { LAB_SECTION_STREAMING: 'false' },
        runEvidencePass,
        callStructured,
        verifyPaidMediaPlan,
        now: () => new Date('2026-06-09T09:00:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const committedOverview = requireRecord(
      requireRecord(result.artifact.body).campaignOverview,
    );

    expect(result.artifact.needs_review).toBe(true);
    expect(result.artifact.verifierSummary).toEqual(
      expect.objectContaining({
        ...verifierSummary,
        strippedNumericClaims: expect.arrayContaining([
          expect.objectContaining({
            action: 'provenance-unknown',
            field: 'body.campaignOverview.monthlyBudget',
            value: expect.stringContaining('$99,999'),
          }),
        ]),
      }),
    );
    expect(committedOverview.monthlyBudgetProvenance).toBe('unknown');
    expect(committedOverview).not.toHaveProperty('monthlyBudgetValue');
    // Model-claimed "user-supplied" with no matching brief economics figure:
    // downgraded to "model-estimated"; the display value survives.
    expect(committedOverview.dailySpendProvenance).toBe('model-estimated');
    expect(committedOverview.dailySpendValue).toBe(3_333);
    expect(record.sections.positioningPaidMediaPlan?.artifact).toEqual(
      expect.objectContaining({
        needs_review: true,
        verifierSummary: expect.objectContaining({
          ...verifierSummary,
          strippedNumericClaims: expect.arrayContaining([
            expect.objectContaining({
              action: 'provenance-unknown',
              field: 'body.campaignOverview.monthlyBudget',
              value: expect.stringContaining('$99,999'),
            }),
          ]),
        }),
      }),
    );
    expect(verifyPaidMediaPlan).toHaveBeenCalledTimes(1);
    expect(callStructured).toHaveBeenCalledTimes(1);
  });

  it('repairs paid-media once when the verifier hard-fails the first artifact', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-06-09T09:05:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(async (params) => {
      if (callStructured.mock.calls.length === 2) {
        expect(params.prompt).toContain('The previous output failed validation');
        expect(params.prompt).toContain('paid-media verifier FABRICATED_QUOTE');
      }

      return buildPaidMediaPlanOutput();
    });
    const verifyPaidMediaPlan = createPaidMediaVerifierMock([
      buildPaidMediaVerifierResult({
        hardFail: true,
        summary: {
          hardFailCount: 1,
          hardFailIds: ['competitorReviewInsights[0]'],
        },
        repairIssues: [
          'paid-media verifier FABRICATED_QUOTE competitorReviewInsights[0]: quoted review text not found',
        ],
      }),
      buildPaidMediaVerifierResult(),
    ]);

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningPaidMediaPlan',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        env: { LAB_SECTION_STREAMING: 'false' },
        runEvidencePass,
        callStructured,
        verifyPaidMediaPlan,
        now: () => new Date('2026-06-09T09:05:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);
    const eventTypes = record.events.map((event) => event.type);

    expect(result.artifact.sectionId).toBe('positioningPaidMediaPlan');
    expect(callStructured).toHaveBeenCalledTimes(2);
    expect(verifyPaidMediaPlan).toHaveBeenCalledTimes(2);
    expect(eventTypes).toContain('validation-failed');
    expect(eventTypes).toContain('repair-started');
    expect(record.sections.positioningPaidMediaPlan?.status).toBe('completed');
  });

  it('commits the paid-media plan with a needs_review badge when the verifier throws (never hard-fails)', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-06-09T09:07:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(
      async () => buildPaidMediaPlanOutput(),
    );
    const verifyPaidMediaPlan = vi.fn(
      async (): Promise<PaidMediaPlanVerificationResult> => {
        throw new Error('verifier transport failed');
      },
    );

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningPaidMediaPlan',
      },
      {
        store,
        loadSkill: async () => 'Use the injected corpus only.',
        allowedTools: [],
        env: { LAB_SECTION_STREAMING: 'false' },
        runEvidencePass,
        callStructured,
        verifyPaidMediaPlan,
        now: () => new Date('2026-06-09T09:07:00.000Z'),
      },
    );

    const record = await store.readRun(saaslaunchResearchInput.runId);

    // ARI: a verifier crash never kills the section. It commits ONCE with an
    // honest needs_review badge — no repair attempt, no hard fail.
    expect(result.artifact.sectionId).toBe('positioningPaidMediaPlan');
    expect(callStructured).toHaveBeenCalledTimes(1);
    expect(verifyPaidMediaPlan).toHaveBeenCalledTimes(1);
    expect(record.sections.positioningPaidMediaPlan?.status).toBe('completed');
  });

  it('fails paid-media when verifier hard-fails after the single repair', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-06-09T09:10:00.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [],
      text: '',
    }));
    const callStructured = vi.fn<StructuredCaller>(
      async () => buildPaidMediaPlanOutput(),
    );
    const verifierHardFail = buildPaidMediaVerifierResult({
      hardFail: true,
      summary: {
        hardFailCount: 1,
        hardFailIds: ['competitorReviewInsights[0]'],
      },
      repairIssues: [
        'paid-media verifier FABRICATED_QUOTE competitorReviewInsights[0]: quoted review text not found',
      ],
    });
    const verifyPaidMediaPlan = createPaidMediaVerifierMock([
      verifierHardFail,
      verifierHardFail,
    ]);

    await expect(
      runSection(
        {
          runId: saaslaunchResearchInput.runId,
          sectionId: 'positioningPaidMediaPlan',
        },
        {
          store,
          loadSkill: async () => 'Use the injected corpus only.',
          allowedTools: [],
          env: { LAB_SECTION_STREAMING: 'false' },
          runEvidencePass,
          callStructured,
          verifyPaidMediaPlan,
          now: () => new Date('2026-06-09T09:10:00.000Z'),
        },
      ),
    ).rejects.toThrow('FABRICATED_QUOTE');

    const record = await store.readRun(saaslaunchResearchInput.runId);

    expect(callStructured).toHaveBeenCalledTimes(2);
    expect(verifyPaidMediaPlan).toHaveBeenCalledTimes(2);
    expect(record.sections.positioningPaidMediaPlan?.status).toBe('failed');
    expect(record.sections.positioningPaidMediaPlan?.artifact).toBeNull();
  });

  it('normalizes paid-media wrapped arrays and source-section aliases', async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-engine-'));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ['positioningPaidMediaPlan'],
      now: () => new Date('2026-05-27T04:22:16.000Z'),
    });
    await store.createRun(saaslaunchResearchInput);

    const driftOutput = buildPaidMediaPlanOutput();
    const driftBody = requireRecord(driftOutput.body);
    const driftAngles = driftBody.anglesToTest;
    const driftCreatives = driftBody.creativeFramework;
    const driftMarketingRows = driftBody.competitorMarketingInsights;
    const driftReviewRows = driftBody.competitorReviewInsights;
    const driftFunnelRows = driftBody.funnelIdeation;
    const driftChannelRows = driftBody.channelSuggestions;
    const driftInsights = driftBody.crossSectionInsight;

    if (
      !Array.isArray(driftAngles) ||
      !Array.isArray(driftCreatives) ||
      !Array.isArray(driftMarketingRows) ||
      !Array.isArray(driftReviewRows) ||
      !Array.isArray(driftFunnelRows) ||
      !Array.isArray(driftChannelRows) ||
      !Array.isArray(driftInsights)
    ) {
      throw new Error('Expected paid-media drift arrays.');
    }

    driftAngles.forEach((angle) => {
      requireRecord(angle).sourceSection = 'positioningVoC';
    });
    driftCreatives.forEach((creative) => {
      requireRecord(creative).sourceSection = 'offer diagnostic';
    });
    driftReviewRows.forEach((review) => {
      requireRecord(review).sourceSection = 'competitors';
    });
    driftMarketingRows.forEach((competitor) => {
      requireRecord(competitor).sourceSection = 'competitors';
    });
    driftChannelRows.forEach((channel) => {
      requireRecord(channel).sourceSection = 'demand intent';
    });
    requireRecord(driftInsights[0]).sourceSections = [
      'positioningVoC',
      'offer diagnostic',
      'gtmBrief',
    ];

    driftBody.anglesToTest = { angles: driftAngles };
    driftBody.creativeFramework = { creatives: driftCreatives };
    driftBody.competitorMarketingInsights = { competitors: driftMarketingRows };
    driftBody.competitorReviewInsights = { insights: driftReviewRows };
    driftBody.funnelIdeation = { recommendations: driftFunnelRows };
    driftBody.channelSuggestions = { suggestions: driftChannelRows };

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
        verifyPaidMediaPlan: createPaidMediaVerifierMock(),
        env: { LAB_SECTION_STREAMING: 'false' },
        now: () => new Date('2026-05-27T04:22:16.000Z'),
      },
    );

    const artifactBody = requireRecord(result.artifact.body);
    const anglesToTest = artifactBody.anglesToTest;
    const creativeFramework = artifactBody.creativeFramework;
    const competitorReviewInsights = artifactBody.competitorReviewInsights;
    const competitorMarketingInsights = artifactBody.competitorMarketingInsights;
    const funnelIdeation = artifactBody.funnelIdeation;
    const channelSuggestions = artifactBody.channelSuggestions;
    const crossSectionInsight = artifactBody.crossSectionInsight;

    if (
      !Array.isArray(anglesToTest) ||
      !Array.isArray(creativeFramework) ||
      !Array.isArray(competitorReviewInsights) ||
      !Array.isArray(competitorMarketingInsights) ||
      !Array.isArray(funnelIdeation) ||
      !Array.isArray(channelSuggestions) ||
      !Array.isArray(crossSectionInsight)
    ) {
      throw new Error('Expected normalized lean paid-media arrays.');
    }

    expect(
      anglesToTest.map((item) => requireRecord(item).sourceSection),
    ).toEqual(Array.from({ length: 4 }, () => 'positioningVoiceOfCustomer'));
    expect(
      creativeFramework.map((item) => requireRecord(item).sourceSection),
    ).toEqual(Array.from({ length: 8 }, () => 'positioningOfferDiagnostic'));
    expect(
      competitorReviewInsights.map((item) => requireRecord(item).sourceSection),
    ).toEqual(
      Array.from({ length: 3 }, () => 'positioningCompetitorLandscape'),
    );
    expect(
      competitorMarketingInsights.map((item) => requireRecord(item).sourceSection),
    ).toEqual(
      Array.from({ length: 2 }, () => 'positioningCompetitorLandscape'),
    );
    expect(funnelIdeation).toHaveLength(3);
    expect(
      channelSuggestions.map((item) => requireRecord(item).sourceSection),
    ).toEqual(Array.from({ length: 4 }, () => 'positioningDemandIntent'));
    expect(requireRecord(crossSectionInsight[0]).sourceSections).toEqual([
      'positioningVoiceOfCustomer',
      'positioningOfferDiagnostic',
      'gtmBrief',
    ]);
    expect(callStructured).toHaveBeenCalledTimes(1);
  });
});
