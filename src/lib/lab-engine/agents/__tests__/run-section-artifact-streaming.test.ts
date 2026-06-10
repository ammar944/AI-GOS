import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, it, vi } from 'vitest';

import type { ResearchInput } from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { MarketCategorySectionOutput } from '@/lib/lab-engine/artifacts/schemas/market-category';
import type { VoiceOfCustomerSectionOutput } from '@/lib/lab-engine/artifacts/schemas/voice-of-customer';
import type { SectionId } from '@/lib/lab-engine/events/activity-event';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { voiceOfCustomerFixtureArtifact } from '@/lib/lab-engine/fixtures/voice-of-customer-artifact';
import { demandIntentFixtureArtifact } from '@/lib/lab-engine/fixtures/demand-intent-artifact';
import { offerDiagnosticFixtureArtifact } from '@/lib/lab-engine/fixtures/offer-diagnostic-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { createRunStore } from '@/lib/lab-engine/runs/run-store';
import type { SectionPartialPublishFn } from '@/lib/research-v2/section-partial-broadcaster';
import {
  applySectionPartialPayload,
  type SectionPartialsByZone,
} from '@/lib/research-v2/use-section-partials';

import { runSection } from '../run-section';
import type { AnswerToolRunner, StructuredStreamer } from '../section-agent';

async function makeStore(
  defaultSectionIds: SectionId[] = ['positioningMarketCategory'],
  researchInput: ResearchInput = saaslaunchResearchInput,
): Promise<ReturnType<typeof createRunStore>> {
  const rootDir = await mkdtemp(join(tmpdir(), 'aigos-lab-streaming-'));
  const store = createRunStore({
    rootDir,
    defaultSectionIds,
    now: () => new Date('2026-06-01T00:00:00.000Z'),
  });
  await store.createRun(researchInput);
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

function buildRedactedMarketCategoryFixtureBody(): typeof marketCategoryFixtureArtifact.body {
  const body = structuredClone(marketCategoryFixtureArtifact.body);
  const bottomUpTam = body.marketSize.bottomUpTam;

  bottomUpTam.inputs = bottomUpTam.inputs.map((input) => ({
    ...input,
    value: input.value
      .replace('40%', '40% [unverified]')
      .replace('2%', '2% [unverified]')
      .replace('$6,000', '$6,000 [unverified]'),
  }));
  bottomUpTam.reachableRevenueEstimate = bottomUpTam.reachableRevenueEstimate
    .replace('$1.09M', '$1.09M [unverified]')
    .replace('40% commercial-intent', '40% [unverified] commercial-intent')
    .replace('2% conversion', '2% [unverified] conversion')
    .replace('$6,000 ACV', '$6,000 [unverified] ACV');

  return body;
}

interface ModelSourceDraft {
  title: string;
  url: string;
  publisher?: string;
}

interface MarketCategoryDraft {
  verdict: string;
  statusSummary: string;
  sources: ModelSourceDraft[];
  body: Record<string, unknown>;
}

function buildMarketCategoryDraft({
  body = marketCategoryFixtureArtifact.body as Record<string, unknown>,
  sources = marketCategoryFixtureArtifact.sources.map((source) => ({
    title: source.title,
    url: source.url,
    ...(source.publisher ? { publisher: source.publisher } : {}),
  })),
  statusSummary =
    'Authored status: evidence points to an emerging category with clear maturity signals.',
  verdict =
    'Authored verdict: lead with lifecycle orchestration, not generic project management.',
}: Partial<MarketCategoryDraft> = {}): MarketCategoryDraft {
  return {
    body,
    sources,
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

function emitFixtureEvidenceStep(
  params: Parameters<StructuredStreamer>[0],
  body: unknown = marketCategoryFixtureArtifact.body,
): void {
  params.onStepFinish?.({
    stepNumber: 1,
    finishReason: 'stop',
    text: 'Fixture evidence supplied for structured body verification.',
    toolCalls: [],
    toolResults: Array.from(new Set(collectFixtureSourceUrls(body))).map(
      (sourceUrl) => ({
        toolName: 'fixture_evidence',
        output: {
          sourceUrl,
          text: `Fixture source evidence for ${sourceUrl}`,
        },
      }),
    ),
  });
}


function collapseSourceUrls(
  value: Record<string, unknown>,
  urls: readonly string[],
): Record<string, unknown> {
  const cloned = structuredClone(value) as Record<string, unknown>;
  let index = 0;

  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item));
      return;
    }

    if (typeof current !== 'object' || current === null) {
      return;
    }

    const record = current as Record<string, unknown>;
    if (typeof record.sourceUrl === 'string') {
      record.sourceUrl = urls[index % urls.length] ?? record.sourceUrl;
      index += 1;
    }

    Object.values(record).forEach((child) => visit(child));
  };

  visit(cloned);

  return cloned;
}

type VoiceOfCustomerDraft = Omit<
  VoiceOfCustomerSectionOutput,
  'sectionTitle' | 'confidence'
>;

function buildVoiceOfCustomerDraftWithCollapsedBodySources(): VoiceOfCustomerDraft {
  const collapsedBody = collapseSourceUrls(voiceOfCustomerFixtureArtifact.body, [
    'https://independent-voc-one.example/pain',
    'https://independent-voc-two.example/pain',
    'https://independent-voc-three.example/pain',
  ]);

  return {
    verdict: voiceOfCustomerFixtureArtifact.verdict,
    statusSummary: voiceOfCustomerFixtureArtifact.statusSummary,
    sources: voiceOfCustomerFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    body: collapsedBody as VoiceOfCustomerSectionOutput['body'],
  };
}

function buildSaaslaunchInputWithVoiceOfCustomerCandidates(): ResearchInput {
  const observedAt = '2026-06-01T00:00:00.000Z';
  const vocExcerpts = [
    ['g2-one', 'https://www.g2.com/products/saaslaunch/reviews/one'],
    ['g2-two', 'https://www.g2.com/products/saaslaunch/reviews/two'],
    ['reddit-one', 'https://www.reddit.com/r/sales/comments/saaslaunch-one'],
    ['reddit-two', 'https://www.reddit.com/r/sales/comments/saaslaunch-two'],
    ['capterra-one', 'https://www.capterra.com/p/saaslaunch/reviews/one'],
    ['community-one', 'https://community.revops.example/t/saaslaunch-handoff'],
  ].map(([id, sourceUrl], index) => ({
    id: `voc_candidate_${id}`,
    observedAt,
    sourceId: `source_voc_candidate_${index + 1}`,
    sourceUrl,
    text: `Independent buyer-language candidate ${
      index + 1
    }: account context and founder-led follow-up work still fall through the cracks.`,
    title: `VoC Candidate ${index + 1}`,
  }));

  return {
    ...saaslaunchResearchInput,
    runId: 'run_saaslaunch_voc_candidates',
    corpus: {
      ...saaslaunchResearchInput.corpus,
      sectionExcerpts: {
        positioningMarketCategory: [],
        positioningBuyerICP: [],
        positioningCompetitorLandscape: [],
        positioningVoiceOfCustomer: vocExcerpts,
        positioningDemandIntent: [],
        positioningOfferDiagnostic: [],
        positioningPaidMediaPlan: [],
      },
    },
  };
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
    expect(result.artifact.body).toEqual(
      buildRedactedMarketCategoryFixtureBody(),
    );
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

  it('counts authored VoC draft sources before body-harvested source URLs', async (): Promise<void> => {
    const researchInput = buildSaaslaunchInputWithVoiceOfCustomerCandidates();
    const store = await makeStore(['positioningVoiceOfCustomer'], researchInput);
    const finalDraft = buildVoiceOfCustomerDraftWithCollapsedBodySources();
    const bodySourceUrlCount = new Set(collectFixtureSourceUrls(finalDraft.body)).size;
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitFixtureEvidenceStep(params, finalDraft.body);

      expect(params.schema.safeParse(finalDraft).success).toBe(true);
      expect(bodySourceUrlCount).toBeLessThan(5);

      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(finalDraft),
        partialOutputStream: partials([]),
      };
    });

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: 'positioningVoiceOfCustomer',
      },
      {
        store,
        loadSkill: async () => 'Use streamed structured VoC output.',
        allowedTools: [],
        streamStructured,
        now: () => new Date('2026-06-01T00:10:00.000Z'),
      },
    );

    const record = await store.readRun(researchInput.runId);
    const validationIssues = record.events.flatMap((event) => {
      if (typeof event.metadata !== 'object' || event.metadata === null) {
        return [];
      }

      const issues = (event.metadata as { issues?: unknown }).issues;
      return Array.isArray(issues) ? issues : [];
    });

    expect(streamStructured).toHaveBeenCalled();
    expect(result.artifact.sources.map((source) => source.url).slice(0, 5)).toEqual(
      voiceOfCustomerFixtureArtifact.sources.map((source) => source.url),
    );
    expect(result.artifact.sources).toHaveLength(8);
    expect(validationIssues).not.toContain('sources: have 3, need >=5.');
    expect(record.sections.positioningVoiceOfCustomer?.status).toBe('completed');
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
    expect(result.artifact.body).toEqual(
      buildRedactedMarketCategoryFixtureBody(),
    );
    expect(record.sections.positioningMarketCategory?.status).toBe(
      'completed',
    );
  });

  // T2a: DemandIntent under a SpyFu (keyword_volume) ToolGap must COMMIT a
  // softened needs_review artifact (artifact !== null) instead of throwing a
  // terminal SectionRunnerError that stalls the run < 6/6.
  it('commits a softened DemandIntent artifact under a SpyFu ToolGap (T2a)', async (): Promise<void> => {
    const store = await makeStore(['positioningDemandIntent']);
    const draft = {
      verdict: demandIntentFixtureArtifact.verdict,
      statusSummary: demandIntentFixtureArtifact.statusSummary,
      sources: demandIntentFixtureArtifact.sources.map(({ title, url }) => ({
        title,
        url,
      })),
      body: demandIntentFixtureArtifact.body as Record<string, unknown>,
    };
    // No keyword_volume tool result is emitted -> keywordVolumeKeywords() is
    // empty -> SpyFu ToolGap. The fixture's SpyFu-claimed rows would otherwise
    // hard-fail provenance.
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitFixtureEvidenceStep(params, demandIntentFixtureArtifact.body);
      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(draft),
        partialOutputStream: partials([]),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningDemandIntent',
      },
      {
        store,
        loadSkill: async () => 'Demand intent under SpyFu ToolGap.',
        allowedTools: [],
        streamStructured,
        broadcastPartial: vi.fn<SectionPartialPublishFn>(async () => undefined),
        now: () => new Date('2026-06-01T00:00:00.000Z'),
      },
    );

    // Committed, not thrown.
    expect(result.artifact).not.toBeNull();
    expect(result.artifact.sectionId).toBe('positioningDemandIntent');

    // Every SpyFu-claimed row is relabeled to the explicit data gap, and the
    // SpyFu-only numeric siblings are dropped.
    const keywords = (
      result.artifact.body as typeof demandIntentFixtureArtifact.body
    ).keywordDemand.keywords;
    keywords.forEach((keyword) => {
      expect(/spyfu[\s-]*estimat/i.test(keyword.monthlyVolume)).toBe(false);
      expect(keyword.monthlyVolumeValue).toBeUndefined();
      expect(keyword.difficulty).toBeUndefined();
    });

    const record = await store.readRun(saaslaunchResearchInput.runId);
    expect(record.sections.positioningDemandIntent?.status).toBe('completed');
  });

  // T2b: OfferDiagnostic with a restated orderedMoves[i].move survives the
  // 2-attempt repair, then commits an evidence-gap (needs_review) artifact
  // (artifact !== null) instead of throwing terminally.
  it('commits an OfferDiagnostic evidence-gap artifact on a restated move (T2b)', async (): Promise<void> => {
    const store = await makeStore(['positioningOfferDiagnostic']);
    const failingBody = {
      ...offerDiagnosticFixtureArtifact.body,
      orderedMoves: offerDiagnosticFixtureArtifact.body.orderedMoves.map(
        (move, index) =>
          index === 0
            ? {
                ...move,
                // Vacuous restatement -> fails validateStrategicText.
                move: 'Improve messaging and clarify positioning for the company.',
              }
            : move,
      ),
    } as Record<string, unknown>;
    const draft = {
      verdict: offerDiagnosticFixtureArtifact.verdict,
      statusSummary: offerDiagnosticFixtureArtifact.statusSummary,
      sources: offerDiagnosticFixtureArtifact.sources.map(({ title, url }) => ({
        title,
        url,
      })),
      body: failingBody,
    };
    // The model keeps emitting the same failing body across repairs.
    const streamStructured = vi.fn<StructuredStreamer>((params) => {
      emitFixtureEvidenceStep(params, offerDiagnosticFixtureArtifact.body);
      return {
        consumeStream: () => Promise.resolve(),
        output: Promise.resolve(draft),
        partialOutputStream: partials([]),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: 'positioningOfferDiagnostic',
      },
      {
        store,
        loadSkill: async () => 'Offer diagnostic restated move.',
        allowedTools: [],
        streamStructured,
        broadcastPartial: vi.fn<SectionPartialPublishFn>(async () => undefined),
        now: () => new Date('2026-06-01T00:00:00.000Z'),
      },
    );

    // Committed an evidence-gap artifact, not thrown.
    expect(result.artifact).not.toBeNull();
    expect(result.artifact.sectionId).toBe('positioningOfferDiagnostic');
    const move = (
      result.artifact.body as typeof offerDiagnosticFixtureArtifact.body
    ).orderedMoves[0].move;
    expect(move.startsWith('evidence gap:')).toBe(true);

    const record = await store.readRun(saaslaunchResearchInput.runId);
    expect(record.sections.positioningOfferDiagnostic?.status).toBe('completed');
  });
});
