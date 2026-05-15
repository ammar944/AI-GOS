/**
 * Phase 3b: ToolLoopAgent-backed runner for the 6 positioning sections.
 * Replaces the Platform Skills code path in journey-section-synthesis.ts
 * for positioning runners only — deepResearchProgram stays on Platform
 * Skills per design Open Question 7.
 *
 * Signature matches the legacy `runJourneySection` so positioning/index.ts
 * can swap from Platform Skills to subagents with no call-site change.
 * Normalized-table writes (research_artifact_sections + section_runs) flow
 * through the Phase 2 dual-write in writeResearchResult — this runner just
 * produces the ResearchResult envelope. Phase 4 wires mid-stream events to
 * research_section_events via onStepFinish.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { streamObject } from 'ai';

import { emitRunnerProgress, type RunnerProgressReporter } from '../runner';
import { type ResearchResult } from '../supabase';
import { composeAbortSignals } from '../agent-tools/_shared';
import {
  POSITIONING_SUBAGENTS,
  type PositioningSubagentId,
  isPositioningSubagentId,
} from '../agents/subagents';
import {
  BuyerICPArtifactSchema,
  validateBuyerICPMinimums,
  type BuyerICPArtifact,
} from '../agents/subagents/schemas/buyer-icp';
import {
  CompetitorLandscapeArtifactSchema,
  validateCompetitorLandscapeMinimums,
  type CompetitorLandscapeArtifact,
} from '../agents/subagents/schemas/competitor-landscape';
import {
  DemandIntentArtifactSchema,
  validateDemandIntentMinimums,
  type DemandIntentArtifact,
} from '../agents/subagents/schemas/demand-intent-signals';
import {
  MarketCategoryArtifactSchema,
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
} from '../agents/subagents/schemas/market-category';
import {
  OfferPerformanceArtifactSchema,
  validateOfferPerformanceMinimums,
  type OfferPerformanceArtifact,
} from '../agents/subagents/schemas/offer-performance-diagnostic';
import {
  VoiceOfCustomerArtifactSchema,
  validateVoiceOfCustomerMinimums,
  type VoiceOfCustomerArtifact,
} from '../agents/subagents/schemas/voc-objection-evidence';
import {
  buildContextWithRefinement,
  type JourneySectionSpec,
} from './journey-section-synthesis';

const SUBAGENT_MODEL = anthropic('claude-opus-4-6');

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const SUBAGENT_TIMEOUT_MS = 4 * 60 * 1000;

function buildTranscriptFromSteps(stepSnapshots: string[]): string {
  const maxChars = 12_000;
  if (stepSnapshots.length === 0) {
    return 'No evidence transcript was captured before the runner moved to structured emission.';
  }

  const joined = stepSnapshots.join('\n\n');
  if (joined.length <= maxChars) {
    return joined;
  }

  const selected: string[] = [];
  let length = 0;
  for (let index = stepSnapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = stepSnapshots[index];
    const nextLength = length + snapshot.length + 2;
    if (nextLength > maxChars && selected.length > 0) {
      break;
    }
    selected.push(snapshot);
    length = nextLength;
  }

  return selected.reverse().join('\n\n').slice(-maxChars);
}

function buildTypedArtifactClosingInstruction(
  section: PositioningSubagentId,
): string {
  switch (section) {
    case 'positioningMarketCategory':
      return `Run your evidence tools (web_search, firecrawl, pagespeed) and produce a concise evidence brief with concrete source URLs. You are gathering evidence only; the runner converts the accumulated transcript into MarketCategoryArtifactSchema after your loop ends. Cover the four Section 01 sub-sections: category definition and adjacent categories, market size and trajectory signals, structural forces, and the single category maturity classification object. confidence is a 0-10 self-rating; honesty > advocacy.`;
    case 'positioningBuyerICP':
      return `Run your evidence tools (web_search, firecrawl, reviews) and produce a concise evidence brief with concrete source URLs. You are gathering evidence only; the runner converts the accumulated transcript into BuyerICPArtifactSchema after your loop ends. Cover the five Section 02 sub-sections: ICP existence, persona reality, awareness distribution, buying context, and clusters. confidence is a 0-10 self-rating; honesty > advocacy.`;
    case 'positioningCompetitorLandscape':
      return `Run your evidence tools (web_search, spyfu, adlibrary, meta_ads, google_ads, firecrawl) and produce a concise evidence brief with concrete source URLs. You are gathering evidence only; the runner converts the accumulated transcript into CompetitorLandscapeArtifactSchema after your loop ends. Cover the six Section 03 sub-sections: full competitor set, positioning taxonomy, pricing reality, share of voice, public weaknesses, and narrative arcs. Preserve verbatim competitor copy and complaint text. Use not disclosed or gated when pricing is unavailable. confidence is a 0-10 self-rating; honesty > advocacy.`;
    case 'positioningVoiceOfCustomer':
      return `Run your evidence tools (web_search, reviews, firecrawl) and produce a concise evidence brief with concrete source URLs. You are gathering evidence only; the runner converts the accumulated transcript into VoiceOfCustomerArtifactSchema after your loop ends. Cover the five Section 04 sub-sections: pain language, objections, switching stories, decision criteria, and success language. Preserve verbatim buyer language exactly, including typos, caps, profanity, and slang. confidence is a 0-10 self-rating; honesty > advocacy.`;
    case 'positioningDemandIntent':
      return `Run your evidence tools (web_search, keyword_ad_probe, firecrawl) and produce a concise evidence brief with concrete source URLs. You are gathering evidence only; the runner converts the accumulated transcript into DemandIntentArtifactSchema after your loop ends. Cover the five Section 05 sub-sections: keyword demand, question mining, content gaps, intent signals, and venue map. Preserve buyer questions verbatim. Use not disclosed for unavailable keyword volume or venue audience size. Every keyword needs dateObserved. confidence is a 0-10 self-rating; honesty > advocacy.`;
    case 'positioningOfferDiagnostic':
      return `Run your evidence tools (web_search, ga4, pagespeed, reviews, firecrawl) and produce a concise evidence brief with concrete source URLs. You are gathering evidence only; the runner converts the accumulated transcript into OfferPerformanceArtifactSchema after your loop ends. Cover the five Section 06 sub-sections: offer-market fit, funnel diagnosis, channel truth, retention health, and red flags. Use self-data only. Use not disclosed for missing CAC, LTV, conversion, MRR, payback, activation, retention, channel ROI, and first-value timing. A red flag needs claimed motion, actual evidence, and contradiction. confidence is a 0-10 self-rating; honesty > advocacy.`;
    default:
      return assertUnhandledPositioningSection(section);
  }
}

function assertUnhandledPositioningSection(section: never): never {
  throw new Error(`No typed Artifact runner branch exists for positioning section: ${section}`);
}

function normalizeMarketCategoryArtifact(
  artifact: MarketCategoryArtifact,
): MarketCategoryArtifact {
  const confidence = Number.isFinite(artifact.confidence)
    ? Math.max(0, Math.min(10, artifact.confidence))
    : 3;

  return {
    ...artifact,
    sectionTitle: artifact.sectionTitle.trim() || 'Market & Category Intelligence',
    verdict: artifact.verdict.trim() || 'Market Category evidence has gaps',
    statusSummary:
      artifact.statusSummary.trim() ||
      'The Market Category runner produced an Artifact with limited summary detail.',
    confidence,
  };
}

type MarketCategorySubsectionKey =
  | 'categoryDefinition'
  | 'marketSize'
  | 'structuralForces'
  | 'categoryMaturity';

function routeMarketCategoryValidationError(
  error: string,
): MarketCategorySubsectionKey {
  if (
    error.startsWith('adjacentCategories') ||
    error.startsWith('categoryDefinition') ||
    error.startsWith('sources') ||
    error.startsWith('sectionTitle') ||
    error.startsWith('verdict') ||
    error.startsWith('statusSummary') ||
    error.startsWith('confidence')
  ) {
    return 'categoryDefinition';
  }
  if (error.startsWith('marketSize')) {
    return 'marketSize';
  }
  if (error.startsWith('structuralForces')) {
    return 'structuralForces';
  }
  return 'categoryMaturity';
}

function annotateMarketCategoryArtifactWithGaps(
  artifact: MarketCategoryArtifact,
  errors: string[],
): MarketCategoryArtifact {
  const grouped: Record<MarketCategorySubsectionKey, string[]> = {
    categoryDefinition: [],
    marketSize: [],
    structuralForces: [],
    categoryMaturity: [],
  };

  for (const error of errors) {
    grouped[routeMarketCategoryValidationError(error)].push(error);
  }

  return {
    ...artifact,
    confidence: Number.isFinite(artifact.confidence)
      ? Math.max(0, Math.min(5, artifact.confidence))
      : 3,
    categoryDefinition: {
      ...artifact.categoryDefinition,
      prose: appendGapBlock(
        artifact.categoryDefinition.prose,
        grouped.categoryDefinition,
      ),
    },
    marketSize: {
      ...artifact.marketSize,
      prose: appendGapBlock(artifact.marketSize.prose, grouped.marketSize),
    },
    structuralForces: {
      ...artifact.structuralForces,
      prose: appendGapBlock(
        artifact.structuralForces.prose,
        grouped.structuralForces,
      ),
    },
    categoryMaturity: {
      ...artifact.categoryMaturity,
      prose: appendGapBlock(
        artifact.categoryMaturity.prose,
        grouped.categoryMaturity,
      ),
    },
  };
}

function getMarketCategoryPopulatedSubsectionCount(partial: unknown): number {
  if (!isRecord(partial)) {
    return 0;
  }

  const fields = [
    'categoryDefinition',
    'marketSize',
    'structuralForces',
    'categoryMaturity',
  ] as const;

  return fields.filter((field) => {
    const subsection = partial[field];
    if (!isRecord(subsection)) {
      return false;
    }
    if (typeof subsection.prose === 'string' && subsection.prose.trim()) {
      return true;
    }
    if (
      field === 'categoryMaturity' &&
      isRecord(subsection.classification) &&
      typeof subsection.classification.evidenceSummary === 'string' &&
      subsection.classification.evidenceSummary.trim()
    ) {
      return true;
    }
    return Object.values(subsection).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }).length;
}

async function streamMarketCategoryArtifact(args: {
  model: typeof SUBAGENT_MODEL;
  transcript: string;
  businessContext: string;
  feedback?: string[];
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<MarketCategoryArtifact> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: starting', {
    section: 'positioningMarketCategory',
    status: 'drafting',
  });

  const system = [
    'You convert Market & Category Intelligence evidence into one typed Artifact.',
    'Honor MarketCategoryArtifactSchema and every field description exactly.',
    'Use the transcript as evidence. Do not fabricate market size, funding, hiring, search-trend, category, or maturity claims.',
    'If evidence is thin for a field, write the gap into that sub-section prose and continue with the best supported cards.',
    'categoryMaturity.classification is one object, not an array. Confidence is a 0-10 integer-like self-rating.',
  ].join('\n');

  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? [
          '',
          '## Prior validation failures',
          ...args.feedback.map((error) => `- ${error}`),
        ].join('\n')
      : '';

  const prompt = [
    '## Business context',
    args.businessContext,
    '',
    '## Evidence transcript',
    args.transcript,
    feedbackBlock,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: MarketCategoryArtifactSchema,
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const subsectionCount = getMarketCategoryPopulatedSubsectionCount(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] streamObject: subsection ${subsectionCount}/4 partial`,
      {
        section: 'positioningMarketCategory',
        status: 'drafting',
        resultCount: subsectionCount,
      },
    );
  }

  const artifact = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: complete', {
    section: 'positioningMarketCategory',
    status: 'complete',
  });

  return normalizeMarketCategoryArtifact(artifact);
}

function createMarketCategoryFallbackArtifact(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  transcript: string;
}): MarketCategoryArtifact {
  const clippedTranscript = args.transcript.slice(0, 900);
  const gapProse = [
    `The Market Category runner failed before a complete typed Artifact could be emitted: ${args.errorMessage}`,
    clippedTranscript
      ? `Captured evidence snapshot: ${clippedTranscript}`
      : 'No usable evidence snapshot was captured before failure.',
  ].join('\n\n');

  return {
    sectionTitle: args.spec.title,
    verdict: 'Partial - Market Category artifact has validation gaps',
    statusSummary:
      'The Market Category runner preserved a typed fallback Artifact after the section failed before completion. Treat every sub-section as incomplete until the section is rerun.',
    confidence: 2,
    sources: [],
    categoryDefinition: {
      prose: appendGapBlock(gapProse, [
        'adjacentCategories: have 0, need >=2 categories buyers confuse this with.',
        'sources: have 0, need >=3 Section-level sources.',
      ]),
      adjacentCategories: [],
    },
    marketSize: {
      prose: appendGapBlock(gapProse, [
        'marketSize.signals: have 0, need >=3 public trajectory signals.',
      ]),
      signals: [],
    },
    structuralForces: {
      prose: appendGapBlock(gapProse, [
        'structuralForces: have 0, need >=3 forces covering regulation, platform-shift, and buyer-behavior.',
        'structuralForces: missing force types regulation, platform-shift, buyer-behavior.',
      ]),
      forces: [],
    },
    categoryMaturity: {
      prose: appendGapBlock(gapProse, [
        'categoryMaturity.classification.supportingSignals: have 0, need >=2 maturity signals.',
      ]),
      classification: {
        stage: 'emerging',
        evidenceSummary:
          'Fallback classification only. The runner did not capture enough evidence for a reliable maturity judgment.',
        supportingSignals: [],
      },
    },
  };
}

function formatMarketCategoryArtifactMarkdown(
  artifact: MarketCategoryArtifact,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = artifact.sectionTitle.trim() || spec.title;
  const sources =
    artifact.sources.length > 0
      ? artifact.sources
          .map((source) => `- ${source.title} — ${source.url}`)
          .join('\n')
      : '- No Section-level sources captured.';

  return [
    `## ${sectionTitle}`,
    '',
    artifact.statusSummary,
    '',
    `**Verdict:** ${artifact.verdict}  ·  **Confidence:** ${artifact.confidence}/10`,
    '',
    '### Category Definition',
    artifact.categoryDefinition.prose,
    ...artifact.categoryDefinition.adjacentCategories.map(
      (category) =>
        `- ${category.name} — confused because ${category.whyBuyersConfuseIt} — disambiguator: ${category.disambiguatingSignal}`,
    ),
    '',
    '### Market Size And Trajectory',
    artifact.marketSize.prose,
    ...artifact.marketSize.signals.map(
      (signal) =>
        `- ${signal.signalType} (${signal.trajectory}) — ${signal.name} — ${signal.sourceTitle} (${signal.dateObserved})`,
    ),
    '',
    '### Structural Forces',
    artifact.structuralForces.prose,
    ...artifact.structuralForces.forces.map(
      (force) =>
        `- ${force.forceType} — ${force.name} — ${force.implication}`,
    ),
    '',
    '### Category Maturity',
    artifact.categoryMaturity.prose,
    `- Stage: ${artifact.categoryMaturity.classification.stage}`,
    `- Evidence: ${artifact.categoryMaturity.classification.evidenceSummary}`,
    ...artifact.categoryMaturity.classification.supportingSignals.map(
      (signal) => `- ${signal.signalType} — ${signal.evidence}`,
    ),
    '',
    '### Sources',
    sources,
  ].join('\n');
}

function normalizeBuyerIcpArtifact(artifact: BuyerICPArtifact): BuyerICPArtifact {
  const confidence = Number.isFinite(artifact.confidence)
    ? Math.max(0, Math.min(10, artifact.confidence))
    : 3;

  return {
    ...artifact,
    sectionTitle: artifact.sectionTitle.trim() || 'Buyer & ICP Validation',
    verdict: artifact.verdict.trim() || 'BuyerICP evidence has gaps',
    statusSummary:
      artifact.statusSummary.trim() ||
      'The BuyerICP runner produced an Artifact with limited summary detail.',
    confidence,
  };
}

type BuyerIcpSubsectionKey =
  | 'icpExistenceCheck'
  | 'personaReality'
  | 'awarenessDistribution'
  | 'buyingContext'
  | 'clusters';

function routeBuyerIcpValidationError(error: string): BuyerIcpSubsectionKey {
  if (error.startsWith('personas') || error.startsWith('personaReality')) {
    return 'personaReality';
  }
  if (
    error.startsWith('firmographicCuts') ||
    error.startsWith('icpExistenceCheck')
  ) {
    return 'icpExistenceCheck';
  }
  if (error.startsWith('awarenessDistribution')) {
    return 'awarenessDistribution';
  }
  if (error.startsWith('triggers') || error.startsWith('buyingContext')) {
    return 'buyingContext';
  }
  return 'clusters';
}

function appendGapBlock(prose: string, errors: string[]): string {
  if (errors.length === 0) {
    return prose;
  }

  return [
    prose.trim(),
    '',
    'Gaps flagged after retry:',
    ...errors.map((error) => `- ${error}`),
  ].join('\n');
}

function annotateArtifactWithGaps(
  artifact: BuyerICPArtifact,
  errors: string[],
): BuyerICPArtifact {
  const grouped: Record<BuyerIcpSubsectionKey, string[]> = {
    icpExistenceCheck: [],
    personaReality: [],
    awarenessDistribution: [],
    buyingContext: [],
    clusters: [],
  };

  for (const error of errors) {
    grouped[routeBuyerIcpValidationError(error)].push(error);
  }

  return {
    ...artifact,
    confidence: Number.isFinite(artifact.confidence)
      ? Math.max(0, Math.min(5, artifact.confidence))
      : 3,
    icpExistenceCheck: {
      ...artifact.icpExistenceCheck,
      prose: appendGapBlock(
        artifact.icpExistenceCheck.prose,
        grouped.icpExistenceCheck,
      ),
    },
    personaReality: {
      ...artifact.personaReality,
      prose: appendGapBlock(artifact.personaReality.prose, grouped.personaReality),
    },
    awarenessDistribution: {
      ...artifact.awarenessDistribution,
      prose: appendGapBlock(
        artifact.awarenessDistribution.prose,
        grouped.awarenessDistribution,
      ),
    },
    buyingContext: {
      ...artifact.buyingContext,
      prose: appendGapBlock(artifact.buyingContext.prose, grouped.buyingContext),
    },
    clusters: {
      ...artifact.clusters,
      prose: appendGapBlock(artifact.clusters.prose, grouped.clusters),
    },
  };
}

function getBuyerIcpPopulatedSubsectionCount(partial: unknown): number {
  if (!isRecord(partial)) {
    return 0;
  }

  const fields = [
    'icpExistenceCheck',
    'personaReality',
    'awarenessDistribution',
    'buyingContext',
    'clusters',
  ] as const;

  return fields.filter((field) => {
    const subsection = partial[field];
    if (!isRecord(subsection)) {
      return false;
    }
    if (typeof subsection.prose === 'string' && subsection.prose.trim()) {
      return true;
    }
    return Object.values(subsection).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }).length;
}

async function streamBuyerIcpArtifact(args: {
  model: typeof SUBAGENT_MODEL;
  transcript: string;
  businessContext: string;
  feedback?: string[];
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<BuyerICPArtifact> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: starting', {
    section: 'positioningBuyerICP',
    status: 'drafting',
  });

  const system = [
    'You convert Buyer & ICP Validation evidence into one typed Artifact.',
    'Honor BuyerICPArtifactSchema and every field description exactly.',
    'Use the transcript as evidence. Do not fabricate named people, account counts, audience sizes, URLs, or quotes.',
    'If evidence is thin for a field, write the gap into that sub-section prose and continue with the best supported cards.',
    'Keep top-level statusSummary at two to four sentences. Confidence is a 0-10 integer-like self-rating.',
  ].join('\n');

  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? [
          '',
          '## Prior validation failures',
          ...args.feedback.map((error) => `- ${error}`),
        ].join('\n')
      : '';

  const prompt = [
    '## Business context',
    args.businessContext,
    '',
    '## Evidence transcript',
    args.transcript,
    feedbackBlock,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: BuyerICPArtifactSchema,
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const subsectionCount = getBuyerIcpPopulatedSubsectionCount(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] streamObject: subsection ${subsectionCount}/5 partial`,
      {
        section: 'positioningBuyerICP',
        status: 'drafting',
        resultCount: subsectionCount,
      },
    );
  }

  const artifact = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: complete', {
    section: 'positioningBuyerICP',
    status: 'complete',
  });

  return normalizeBuyerIcpArtifact(artifact);
}

function createBuyerIcpFallbackArtifact(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  transcript: string;
}): BuyerICPArtifact {
  const clippedTranscript = args.transcript.slice(0, 900);
  const gapProse = [
    `The BuyerICP runner failed before a complete typed Artifact could be emitted: ${args.errorMessage}`,
    clippedTranscript
      ? `Captured evidence snapshot: ${clippedTranscript}`
      : 'No usable evidence snapshot was captured before failure.',
  ].join('\n\n');

  return {
    sectionTitle: args.spec.title,
    verdict: 'Partial - BuyerICP artifact has validation gaps',
    statusSummary:
      'The BuyerICP runner preserved a typed fallback Artifact after the section failed before completion. Treat every sub-section as incomplete until the section is rerun.',
    confidence: 2,
    sources: [],
    icpExistenceCheck: {
      prose: appendGapBlock(gapProse, [
        'firmographicCuts: have 0, need >=3 typed cuts across distinct cutType values.',
      ]),
      firmographicCuts: [],
    },
    personaReality: {
      prose: appendGapBlock(gapProse, [
        'personas: have 0, need >=5 named real persons at named real ICP companies.',
      ]),
      personas: [],
    },
    awarenessDistribution: {
      prose: appendGapBlock(gapProse, [
        'awarenessDistribution: missing Schwartz levels unaware, problem-aware, solution-aware, product-aware, most-aware.',
      ]),
      levels: [],
    },
    buyingContext: {
      prose: appendGapBlock(gapProse, [
        'triggers: have 0, need >=3 publicly detectable triggers.',
      ]),
      triggers: [],
    },
    clusters: {
      prose: appendGapBlock(gapProse, [
        'clusters: have 0 community venues, need >=2.',
        'clusters: have 0 newsletter venues, need >=2.',
      ]),
      venues: [],
    },
  };
}

function formatBuyerIcpArtifactMarkdown(
  artifact: BuyerICPArtifact,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = artifact.sectionTitle.trim() || spec.title;
  const sources =
    artifact.sources.length > 0
      ? artifact.sources
          .map((source) => `- ${source.title} — ${source.url}`)
          .join('\n')
      : '- No Section-level sources captured.';

  return [
    `## ${sectionTitle}`,
    '',
    artifact.statusSummary,
    '',
    `**Verdict:** ${artifact.verdict}  ·  **Confidence:** ${artifact.confidence}/10`,
    '',
    '### ICP Existence Check',
    artifact.icpExistenceCheck.prose,
    ...artifact.icpExistenceCheck.firmographicCuts.map(
      (cut) =>
        `- ${cut.cutType} — ${cut.value} — ${cut.source} (${cut.dateObserved})`,
    ),
    '',
    '### Persona Reality',
    artifact.personaReality.prose,
    ...artifact.personaReality.personas.map(
      (persona) =>
        `- ${persona.name} (${persona.role}) — ${persona.title} @ ${persona.company} (${persona.sourceUrl})`,
    ),
    '',
    '### Awareness Distribution',
    artifact.awarenessDistribution.prose,
    ...artifact.awarenessDistribution.levels.map(
      (level) => `- ${level.level} (${level.share}) — ${level.evidence}`,
    ),
    '',
    '### Buying Context',
    artifact.buyingContext.prose,
    ...artifact.buyingContext.triggers.map(
      (trigger) =>
        `- ${trigger.name} (${trigger.window}) — ${trigger.detectionSignal}`,
    ),
    '',
    '### Where They Cluster',
    artifact.clusters.prose,
    ...artifact.clusters.venues.map(
      (venue) =>
        `- ${venue.bucketType} — ${venue.name} (${venue.audienceSize}) — ${venue.sourceUrl}`,
    ),
    '',
    '### Sources',
    sources,
  ].join('\n');
}

function normalizeCompetitorLandscapeArtifact(
  artifact: CompetitorLandscapeArtifact,
): CompetitorLandscapeArtifact {
  const confidence = Number.isFinite(artifact.confidence)
    ? Math.max(0, Math.min(10, artifact.confidence))
    : 3;

  return {
    ...artifact,
    sectionTitle:
      artifact.sectionTitle.trim() || 'Competitor Landscape & Positioning',
    verdict: artifact.verdict.trim() || 'Competitive positioning evidence has gaps',
    statusSummary:
      artifact.statusSummary.trim() ||
      'The Competitor Landscape runner produced an Artifact with limited summary detail.',
    confidence,
  };
}

type CompetitorLandscapeSubsectionKey =
  | 'competitorSet'
  | 'positioningTaxonomy'
  | 'pricingReality'
  | 'shareOfVoice'
  | 'publicWeaknesses'
  | 'narrativeArcs';

function routeCompetitorLandscapeValidationError(
  error: string,
): CompetitorLandscapeSubsectionKey {
  if (
    error.startsWith('competitorSet') ||
    error.startsWith('competitors') ||
    error.startsWith('sources') ||
    error.startsWith('sectionTitle') ||
    error.startsWith('verdict') ||
    error.startsWith('statusSummary') ||
    error.startsWith('confidence')
  ) {
    return 'competitorSet';
  }
  if (
    error.startsWith('positioningTaxonomy') ||
    error.startsWith('axes')
  ) {
    return 'positioningTaxonomy';
  }
  if (error.startsWith('pricingReality')) {
    return 'pricingReality';
  }
  if (error.startsWith('shareOfVoice')) {
    return 'shareOfVoice';
  }
  if (error.startsWith('publicWeaknesses')) {
    return 'publicWeaknesses';
  }
  return 'narrativeArcs';
}

function annotateCompetitorLandscapeArtifactWithGaps(
  artifact: CompetitorLandscapeArtifact,
  errors: string[],
): CompetitorLandscapeArtifact {
  const grouped: Record<CompetitorLandscapeSubsectionKey, string[]> = {
    competitorSet: [],
    positioningTaxonomy: [],
    pricingReality: [],
    shareOfVoice: [],
    publicWeaknesses: [],
    narrativeArcs: [],
  };

  for (const error of errors) {
    grouped[routeCompetitorLandscapeValidationError(error)].push(error);
  }

  return {
    ...artifact,
    confidence: Number.isFinite(artifact.confidence)
      ? Math.max(0, Math.min(5, artifact.confidence))
      : 3,
    competitorSet: {
      ...artifact.competitorSet,
      prose: appendGapBlock(artifact.competitorSet.prose, grouped.competitorSet),
    },
    positioningTaxonomy: {
      ...artifact.positioningTaxonomy,
      prose: appendGapBlock(
        artifact.positioningTaxonomy.prose,
        grouped.positioningTaxonomy,
      ),
    },
    pricingReality: {
      ...artifact.pricingReality,
      prose: appendGapBlock(
        artifact.pricingReality.prose,
        grouped.pricingReality,
      ),
    },
    shareOfVoice: {
      ...artifact.shareOfVoice,
      prose: appendGapBlock(artifact.shareOfVoice.prose, grouped.shareOfVoice),
    },
    publicWeaknesses: {
      ...artifact.publicWeaknesses,
      prose: appendGapBlock(
        artifact.publicWeaknesses.prose,
        grouped.publicWeaknesses,
      ),
    },
    narrativeArcs: {
      ...artifact.narrativeArcs,
      prose: appendGapBlock(artifact.narrativeArcs.prose, grouped.narrativeArcs),
    },
  };
}

function getCompetitorLandscapePopulatedSubsectionCount(partial: unknown): number {
  if (!isRecord(partial)) {
    return 0;
  }

  const fields = [
    'competitorSet',
    'positioningTaxonomy',
    'pricingReality',
    'shareOfVoice',
    'publicWeaknesses',
    'narrativeArcs',
  ] as const;

  return fields.filter((field) => {
    const subsection = partial[field];
    if (!isRecord(subsection)) {
      return false;
    }
    if (typeof subsection.prose === 'string' && subsection.prose.trim()) {
      return true;
    }
    return Object.values(subsection).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }).length;
}

async function streamCompetitorLandscapeArtifact(args: {
  model: typeof SUBAGENT_MODEL;
  transcript: string;
  businessContext: string;
  feedback?: string[];
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<CompetitorLandscapeArtifact> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: starting', {
    section: 'positioningCompetitorLandscape',
    status: 'drafting',
  });

  const system = [
    'You convert Competitor Landscape & Positioning evidence into one typed Artifact.',
    'Honor CompetitorLandscapeArtifactSchema and every field description exactly.',
    'Use the transcript as evidence. Do not fabricate competitors, pricing, share-of-voice ownership, complaints, hero copy, or source URLs.',
    'Preserve verbatim competitor copy and weakness quotes exactly where fields require verbatim evidence.',
    'If pricing is unavailable, write not disclosed or gated. If evidence is thin for a field, write the gap into that sub-section prose and continue with the best supported cards.',
    'Keep top-level statusSummary at two to four sentences. Confidence is a 0-10 integer-like self-rating.',
  ].join('\n');

  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? [
          '',
          '## Prior validation failures',
          ...args.feedback.map((error) => `- ${error}`),
        ].join('\n')
      : '';

  const prompt = [
    '## Business context',
    args.businessContext,
    '',
    '## Evidence transcript',
    args.transcript,
    feedbackBlock,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: CompetitorLandscapeArtifactSchema,
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const subsectionCount =
      getCompetitorLandscapePopulatedSubsectionCount(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] streamObject: subsection ${subsectionCount}/6 partial`,
      {
        section: 'positioningCompetitorLandscape',
        status: 'drafting',
        resultCount: subsectionCount,
      },
    );
  }

  const artifact = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: complete', {
    section: 'positioningCompetitorLandscape',
    status: 'complete',
  });

  return normalizeCompetitorLandscapeArtifact(artifact);
}

function createCompetitorLandscapeFallbackArtifact(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  transcript: string;
}): CompetitorLandscapeArtifact {
  const clippedTranscript = args.transcript.slice(0, 900);
  const gapProse = [
    `The Competitor Landscape runner failed before a complete typed Artifact could be emitted: ${args.errorMessage}`,
    clippedTranscript
      ? `Captured evidence snapshot: ${clippedTranscript}`
      : 'No usable evidence snapshot was captured before failure.',
  ].join('\n\n');

  return {
    sectionTitle: args.spec.title,
    verdict: 'Partial - Competitor Landscape artifact has validation gaps',
    statusSummary:
      'The Competitor Landscape runner preserved a typed fallback Artifact after the section failed before completion. Treat every sub-section as incomplete until the section is rerun.',
    confidence: 2,
    sources: [],
    competitorSet: {
      prose: appendGapBlock(gapProse, [
        'competitorSet.competitors: have 0, need >=5 competitors across direct, indirect, status-quo, and diy.',
        'competitorSet.competitors: missing competitor types direct, indirect, status-quo, diy.',
        'sources: have 0, need >=5 Section-level sources.',
      ]),
      competitors: [],
    },
    positioningTaxonomy: {
      prose: appendGapBlock(gapProse, [
        'positioningTaxonomy.axes: have 0, need >=3 axes.',
      ]),
      axes: [],
    },
    pricingReality: {
      prose: appendGapBlock(gapProse, [
        'pricingReality.dataPoints: have 0, need >=3 pricing data points.',
        'pricingReality.dataPoints: need pricing evidence for >=3 distinct competitors, have 0.',
      ]),
      dataPoints: [],
    },
    shareOfVoice: {
      prose: appendGapBlock(gapProse, [
        'shareOfVoice.slices: have 0, need >=3 surfaces.',
      ]),
      slices: [],
    },
    publicWeaknesses: {
      prose: appendGapBlock(gapProse, [
        'publicWeaknesses.items: have 0, need >=4 verbatim weaknesses.',
        'publicWeaknesses.items: need weaknesses across >=2 competitors, have 0.',
      ]),
      items: [],
    },
    narrativeArcs: {
      prose: appendGapBlock(gapProse, [
        'narrativeArcs.arcs: have 0, need >=3 arcs.',
      ]),
      arcs: [],
    },
  };
}

function formatCompetitorLandscapeArtifactMarkdown(
  artifact: CompetitorLandscapeArtifact,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = artifact.sectionTitle.trim() || spec.title;
  const sources =
    artifact.sources.length > 0
      ? artifact.sources
          .map((source) => `- ${source.title} — ${source.url}`)
          .join('\n')
      : '- No Section-level sources captured.';

  return [
    `## ${sectionTitle}`,
    '',
    artifact.statusSummary,
    '',
    `**Verdict:** ${artifact.verdict}  ·  **Confidence:** ${artifact.confidence}/10`,
    '',
    '### Full Competitor Set',
    artifact.competitorSet.prose,
    ...artifact.competitorSet.competitors.map(
      (competitor) =>
        `- ${competitor.competitorType} — ${competitor.name} — ${competitor.oneLinePositioning} (${competitor.sourceUrl})`,
    ),
    '',
    '### Positioning Taxonomy',
    artifact.positioningTaxonomy.prose,
    ...artifact.positioningTaxonomy.axes.map(
      (axis) =>
        `- ${axis.axisName} — ours: ${axis.ourPosition} — evidence: ${axis.evidenceUrl}`,
    ),
    '',
    '### Pricing Reality',
    artifact.pricingReality.prose,
    ...artifact.pricingReality.dataPoints.map(
      (point) =>
        `- ${point.competitor} / ${point.tierName} — ${point.monthlyPrice} — ${point.packagingPattern}`,
    ),
    '',
    '### Share Of Voice',
    artifact.shareOfVoice.prose,
    ...artifact.shareOfVoice.slices.map(
      (slice) =>
        `- ${slice.surface} — winner: ${slice.winner} — ${slice.evidence}`,
    ),
    '',
    '### Public Strengths And Weaknesses',
    artifact.publicWeaknesses.prose,
    ...artifact.publicWeaknesses.items.map(
      (item) =>
        `- ${item.competitor} — "${item.verbatimQuote}" — ${item.whyItMatters}`,
    ),
    '',
    '### Narrative Arcs',
    artifact.narrativeArcs.prose,
    ...artifact.narrativeArcs.arcs.map(
      (arc) =>
        `- ${arc.competitor} — villain: ${arc.villain}; hero: ${arc.hero}; claim: ${arc.transformationClaim}`,
    ),
    '',
    '### Sources',
    sources,
  ].join('\n');
}

function normalizeVoiceOfCustomerArtifact(
  artifact: VoiceOfCustomerArtifact,
): VoiceOfCustomerArtifact {
  const confidence = Number.isFinite(artifact.confidence)
    ? Math.max(0, Math.min(10, artifact.confidence))
    : 3;

  return {
    ...artifact,
    sectionTitle:
      artifact.sectionTitle.trim() || 'Voice of Customer & Objection Evidence',
    verdict: artifact.verdict.trim() || 'Voice-of-customer evidence has gaps',
    statusSummary:
      artifact.statusSummary.trim() ||
      'The Voice of Customer runner produced an Artifact with limited summary detail.',
    confidence,
    painLanguage: {
      ...artifact.painLanguage,
      quotes: artifact.painLanguage.quotes.map((quote) => ({
        ...quote,
        source: normalizeVocSourceFromUrl(quote.source, quote.sourceUrl),
      })),
    },
    successLanguage: {
      ...artifact.successLanguage,
      quotes: artifact.successLanguage.quotes.map((quote) => ({
        ...quote,
        source: normalizeVocSourceFromUrl(quote.source, quote.sourceUrl),
      })),
    },
  };
}

function normalizeVocSourceFromUrl(
  current: VoiceOfCustomerArtifact['painLanguage']['quotes'][number]['source'],
  sourceUrl: string,
): VoiceOfCustomerArtifact['painLanguage']['quotes'][number]['source'] {
  const normalizedUrl = sourceUrl.toLowerCase();
  if (normalizedUrl.includes('g2.com')) {
    return 'g2';
  }
  if (normalizedUrl.includes('reddit.com')) {
    return 'reddit';
  }
  if (
    normalizedUrl.includes('news.ycombinator.com') ||
    normalizedUrl.includes('ycombinator.com/item')
  ) {
    return 'hackernews';
  }
  if (
    normalizedUrl.includes('support.') ||
    normalizedUrl.includes('/support') ||
    normalizedUrl.includes('community.')
  ) {
    return 'support-thread';
  }
  if (
    normalizedUrl.includes('twitter.com') ||
    normalizedUrl.includes('x.com/')
  ) {
    return 'twitter';
  }
  return current;
}

type VoiceOfCustomerSubsectionKey =
  | 'painLanguage'
  | 'objections'
  | 'switchingStories'
  | 'decisionCriteria'
  | 'successLanguage';

function routeVoiceOfCustomerValidationError(
  error: string,
): VoiceOfCustomerSubsectionKey {
  if (
    error.startsWith('painLanguage') ||
    error.startsWith('sources') ||
    error.startsWith('sectionTitle') ||
    error.startsWith('verdict') ||
    error.startsWith('statusSummary') ||
    error.startsWith('confidence')
  ) {
    return 'painLanguage';
  }
  if (error.startsWith('objections')) {
    return 'objections';
  }
  if (error.startsWith('switchingStories')) {
    return 'switchingStories';
  }
  if (error.startsWith('decisionCriteria')) {
    return 'decisionCriteria';
  }
  return 'successLanguage';
}

function annotateVoiceOfCustomerArtifactWithGaps(
  artifact: VoiceOfCustomerArtifact,
  errors: string[],
): VoiceOfCustomerArtifact {
  const grouped: Record<VoiceOfCustomerSubsectionKey, string[]> = {
    painLanguage: [],
    objections: [],
    switchingStories: [],
    decisionCriteria: [],
    successLanguage: [],
  };

  for (const error of errors) {
    grouped[routeVoiceOfCustomerValidationError(error)].push(error);
  }

  return {
    ...artifact,
    confidence: Number.isFinite(artifact.confidence)
      ? Math.max(0, Math.min(5, artifact.confidence))
      : 3,
    painLanguage: {
      ...artifact.painLanguage,
      prose: appendGapBlock(artifact.painLanguage.prose, grouped.painLanguage),
    },
    objections: {
      ...artifact.objections,
      prose: appendGapBlock(artifact.objections.prose, grouped.objections),
    },
    switchingStories: {
      ...artifact.switchingStories,
      prose: appendGapBlock(
        artifact.switchingStories.prose,
        grouped.switchingStories,
      ),
    },
    decisionCriteria: {
      ...artifact.decisionCriteria,
      prose: appendGapBlock(
        artifact.decisionCriteria.prose,
        grouped.decisionCriteria,
      ),
    },
    successLanguage: {
      ...artifact.successLanguage,
      prose: appendGapBlock(
        artifact.successLanguage.prose,
        grouped.successLanguage,
      ),
    },
  };
}

function getVoiceOfCustomerPopulatedSubsectionCount(partial: unknown): number {
  if (!isRecord(partial)) {
    return 0;
  }

  const fields = [
    'painLanguage',
    'objections',
    'switchingStories',
    'decisionCriteria',
    'successLanguage',
  ] as const;

  return fields.filter((field) => {
    const subsection = partial[field];
    if (!isRecord(subsection)) {
      return false;
    }
    if (typeof subsection.prose === 'string' && subsection.prose.trim()) {
      return true;
    }
    return Object.values(subsection).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }).length;
}

async function streamVoiceOfCustomerArtifact(args: {
  model: typeof SUBAGENT_MODEL;
  transcript: string;
  businessContext: string;
  feedback?: string[];
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<VoiceOfCustomerArtifact> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: starting', {
    section: 'positioningVoiceOfCustomer',
    status: 'drafting',
  });

  const system = [
    'You convert Voice of Customer & Objection Evidence into one typed Artifact.',
    'Honor VoiceOfCustomerArtifactSchema and every field description exactly.',
    'Use the transcript as evidence. Do not fabricate quotes, objections, switching stories, decision criteria, success language, source URLs, or frequency.',
    'Preserve verbatim buyer language exactly where fields require verbatim evidence, including typos, caps, profanity, and slang.',
    'painLanguage.quotes must include at least 10 quotes across at least 3 distinct source enum values. Use g2 for G2/review snippets, reddit for Reddit, hackernews for news.ycombinator.com, support-thread for support/community help pages, sales-call only for supplied call transcripts, twitter for Twitter/X, and other for customer stories/blogs/pages when the transcript supports them.',
    'objections.items must include at least 5 objections across at least 3 distinct categories. switchingStories.stories must include at least 3 stories across at least 2 prior solutions.',
    'If evidence is thin for a field, write the gap into that sub-section prose and continue with the best supported cards.',
    'Keep top-level statusSummary at two to four sentences. Confidence is a 0-10 integer-like self-rating.',
  ].join('\n');

  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? [
          '',
          '## Prior validation failures',
          ...args.feedback.map((error) => `- ${error}`),
        ].join('\n')
      : '';

  const prompt = [
    '## Business context',
    args.businessContext,
    '',
    '## Evidence transcript',
    args.transcript,
    feedbackBlock,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: VoiceOfCustomerArtifactSchema,
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const subsectionCount = getVoiceOfCustomerPopulatedSubsectionCount(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] streamObject: subsection ${subsectionCount}/5 partial`,
      {
        section: 'positioningVoiceOfCustomer',
        status: 'drafting',
        resultCount: subsectionCount,
      },
    );
  }

  const artifact = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: complete', {
    section: 'positioningVoiceOfCustomer',
    status: 'complete',
  });

  return normalizeVoiceOfCustomerArtifact(artifact);
}

function createVoiceOfCustomerFallbackArtifact(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  transcript: string;
}): VoiceOfCustomerArtifact {
  const clippedTranscript = args.transcript.slice(0, 900);
  const gapProse = [
    `The Voice of Customer runner failed before a complete typed Artifact could be emitted: ${args.errorMessage}`,
    clippedTranscript
      ? `Captured evidence snapshot: ${clippedTranscript}`
      : 'No usable evidence snapshot was captured before failure.',
  ].join('\n\n');

  return {
    sectionTitle: args.spec.title,
    verdict: 'Partial - Voice of Customer artifact has validation gaps',
    statusSummary:
      'The Voice of Customer runner preserved a typed fallback Artifact after the section failed before completion. Treat every sub-section as incomplete until the section is rerun.',
    confidence: 2,
    sources: [],
    painLanguage: {
      prose: appendGapBlock(gapProse, [
        'painLanguage.quotes: have 0, need >=10 verbatim pain quotes.',
        'painLanguage.quotes: need >=3 source types, have 0.',
        'sources: have 0, need >=5 Section-level sources.',
      ]),
      quotes: [],
    },
    objections: {
      prose: appendGapBlock(gapProse, [
        'objections.items: have 0, need >=5 objections.',
        'objections.items: need objections across >=3 categories, have 0.',
      ]),
      items: [],
    },
    switchingStories: {
      prose: appendGapBlock(gapProse, [
        'switchingStories.stories: have 0, need >=3 switching stories.',
        'switchingStories.stories: need >=2 prior solutions, have 0.',
      ]),
      stories: [],
    },
    decisionCriteria: {
      prose: appendGapBlock(gapProse, [
        'decisionCriteria.criteria: have 0, need >=5 criteria.',
      ]),
      criteria: [],
    },
    successLanguage: {
      prose: appendGapBlock(gapProse, [
        'successLanguage.quotes: have 0, need >=5 success-state quotes.',
      ]),
      quotes: [],
    },
  };
}

function formatVoiceOfCustomerArtifactMarkdown(
  artifact: VoiceOfCustomerArtifact,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = artifact.sectionTitle.trim() || spec.title;
  const sources =
    artifact.sources.length > 0
      ? artifact.sources
          .map((source) => `- ${source.title} — ${source.url}`)
          .join('\n')
      : '- No Section-level sources captured.';

  return [
    `## ${sectionTitle}`,
    '',
    artifact.statusSummary,
    '',
    `**Verdict:** ${artifact.verdict}  ·  **Confidence:** ${artifact.confidence}/10`,
    '',
    '### Pain Language',
    artifact.painLanguage.prose,
    ...artifact.painLanguage.quotes.map(
      (quote) =>
        `- ${quote.source} (${quote.painIntensity}) — "${quote.verbatimText}" — ${quote.painTheme}`,
    ),
    '',
    '### Objection Evidence',
    artifact.objections.prose,
    ...artifact.objections.items.map(
      (item) =>
        `- ${item.category} (${item.frequency}) — "${item.objectionText}" — ${item.howToHandle}`,
    ),
    '',
    '### Switching Stories',
    artifact.switchingStories.prose,
    ...artifact.switchingStories.stories.map(
      (story) =>
        `- ${story.priorSolution} — "${story.reasonToLeave}" — ${story.decisionPath}`,
    ),
    '',
    '### Stated Decision Criteria',
    artifact.decisionCriteria.prose,
    ...artifact.decisionCriteria.criteria.map(
      (criterion) =>
        `- ${criterion.statedBy} — ${criterion.criterion} — "${criterion.evidenceQuote}"`,
    ),
    '',
    '### Success-State Language',
    artifact.successLanguage.prose,
    ...artifact.successLanguage.quotes.map(
      (quote) =>
        `- ${quote.source} — "${quote.verbatimText}" — ${quote.afterStatePattern}`,
    ),
    '',
    '### Sources',
    sources,
  ].join('\n');
}

function normalizeDemandIntentArtifact(
  artifact: DemandIntentArtifact,
): DemandIntentArtifact {
  const confidence = Number.isFinite(artifact.confidence)
    ? Math.max(0, Math.min(10, artifact.confidence))
    : 3;

  return {
    ...artifact,
    sectionTitle: artifact.sectionTitle.trim() || 'Demand & Intent Signals',
    verdict: artifact.verdict.trim() || 'Demand and intent evidence has gaps',
    statusSummary:
      artifact.statusSummary.trim() ||
      'The Demand & Intent runner produced an Artifact with limited summary detail.',
    confidence,
  };
}

type DemandIntentSubsectionKey =
  | 'keywordDemand'
  | 'questionMining'
  | 'contentGaps'
  | 'intentSignals'
  | 'venueMap';

function routeDemandIntentValidationError(
  error: string,
): DemandIntentSubsectionKey {
  if (
    error.startsWith('keywordDemand') ||
    error.startsWith('sources') ||
    error.startsWith('sectionTitle') ||
    error.startsWith('verdict') ||
    error.startsWith('statusSummary') ||
    error.startsWith('confidence')
  ) {
    return 'keywordDemand';
  }
  if (error.startsWith('questionMining')) return 'questionMining';
  if (error.startsWith('contentGaps')) return 'contentGaps';
  if (error.startsWith('intentSignals')) return 'intentSignals';
  return 'venueMap';
}

function annotateDemandIntentArtifactWithGaps(
  artifact: DemandIntentArtifact,
  errors: string[],
): DemandIntentArtifact {
  const grouped: Record<DemandIntentSubsectionKey, string[]> = {
    keywordDemand: [],
    questionMining: [],
    contentGaps: [],
    intentSignals: [],
    venueMap: [],
  };

  for (const error of errors) {
    grouped[routeDemandIntentValidationError(error)].push(error);
  }

  return {
    ...artifact,
    confidence: Number.isFinite(artifact.confidence)
      ? Math.max(0, Math.min(5, artifact.confidence))
      : 3,
    keywordDemand: {
      ...artifact.keywordDemand,
      prose: appendGapBlock(artifact.keywordDemand.prose, grouped.keywordDemand),
    },
    questionMining: {
      ...artifact.questionMining,
      prose: appendGapBlock(artifact.questionMining.prose, grouped.questionMining),
    },
    contentGaps: {
      ...artifact.contentGaps,
      prose: appendGapBlock(artifact.contentGaps.prose, grouped.contentGaps),
    },
    intentSignals: {
      ...artifact.intentSignals,
      prose: appendGapBlock(artifact.intentSignals.prose, grouped.intentSignals),
    },
    venueMap: {
      ...artifact.venueMap,
      prose: appendGapBlock(artifact.venueMap.prose, grouped.venueMap),
    },
  };
}

function getDemandIntentPopulatedSubsectionCount(partial: unknown): number {
  if (!isRecord(partial)) return 0;

  const fields = [
    'keywordDemand',
    'questionMining',
    'contentGaps',
    'intentSignals',
    'venueMap',
  ] as const;

  return fields.filter((field) => {
    const subsection = partial[field];
    if (!isRecord(subsection)) return false;
    if (typeof subsection.prose === 'string' && subsection.prose.trim()) {
      return true;
    }
    return Object.values(subsection).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }).length;
}

async function streamDemandIntentArtifact(args: {
  model: typeof SUBAGENT_MODEL;
  transcript: string;
  businessContext: string;
  feedback?: string[];
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<DemandIntentArtifact> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: starting', {
    section: 'positioningDemandIntent',
    status: 'drafting',
  });

  const system = [
    'You convert Demand & Intent Signals evidence into one typed Artifact.',
    'Honor DemandIntentArtifactSchema and every field description exactly.',
    'Use the transcript as evidence. Do not fabricate keyword volumes, ranking domains, buyer questions, intent signals, venue audience sizes, or source URLs.',
    'Every keyword needs monthlyVolume, intentType, top3RankingDomains, sourceTitle, sourceUrl, and dateObserved. Use not disclosed when volume is unavailable.',
    'Questions must remain verbatim. Audience sizes can be not disclosed. If evidence is thin for a field, write the gap into that sub-section prose and continue with the best supported cards.',
    'Keep top-level statusSummary at two to four sentences. Confidence is a 0-10 integer-like self-rating.',
  ].join('\n');

  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? [
          '',
          '## Prior validation failures',
          ...args.feedback.map((error) => `- ${error}`),
        ].join('\n')
      : '';

  const prompt = [
    '## Business context',
    args.businessContext,
    '',
    '## Evidence transcript',
    args.transcript,
    feedbackBlock,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: DemandIntentArtifactSchema,
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const subsectionCount = getDemandIntentPopulatedSubsectionCount(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] streamObject: subsection ${subsectionCount}/5 partial`,
      {
        section: 'positioningDemandIntent',
        status: 'drafting',
        resultCount: subsectionCount,
      },
    );
  }

  const artifact = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: complete', {
    section: 'positioningDemandIntent',
    status: 'complete',
  });

  return normalizeDemandIntentArtifact(artifact);
}

function createDemandIntentFallbackArtifact(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  transcript: string;
}): DemandIntentArtifact {
  const clippedTranscript = args.transcript.slice(0, 900);
  const gapProse = [
    `The Demand & Intent runner failed before a complete typed Artifact could be emitted: ${args.errorMessage}`,
    clippedTranscript
      ? `Captured evidence snapshot: ${clippedTranscript}`
      : 'No usable evidence snapshot was captured before failure.',
  ].join('\n\n');

  return {
    sectionTitle: args.spec.title,
    verdict: 'Partial - Demand & Intent artifact has validation gaps',
    statusSummary:
      'The Demand & Intent runner preserved a typed fallback Artifact after the section failed before completion. Treat every sub-section as incomplete until the section is rerun.',
    confidence: 2,
    sources: [],
    keywordDemand: {
      prose: appendGapBlock(gapProse, [
        'keywordDemand.keywords: have 0, need >=10 keyword signals.',
        'sources: have 0, need >=5 Section-level sources.',
      ]),
      keywords: [],
    },
    questionMining: {
      prose: appendGapBlock(gapProse, [
        'questionMining.questions: have 0, need >=10 buyer questions.',
        'questionMining.questions: need >=2 surface types, have 0.',
      ]),
      questions: [],
    },
    contentGaps: {
      prose: appendGapBlock(gapProse, [
        'contentGaps.gaps: have 0, need >=3 content gaps.',
      ]),
      gaps: [],
    },
    intentSignals: {
      prose: appendGapBlock(gapProse, [
        'intentSignals.items: have 0, need >=5 intent signals.',
        'intentSignals.items: need >=2 signalTypes, have 0.',
      ]),
      items: [],
    },
    venueMap: {
      prose: appendGapBlock(gapProse, [
        'venueMap.venues: have 0, need >=4 demand venues.',
        'venueMap.venues: need >=2 venueTypes, have 0.',
      ]),
      venues: [],
    },
  };
}

function formatDemandIntentArtifactMarkdown(
  artifact: DemandIntentArtifact,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = artifact.sectionTitle.trim() || spec.title;
  const sources =
    artifact.sources.length > 0
      ? artifact.sources
          .map((source) => `- ${source.title} — ${source.url}`)
          .join('\n')
      : '- No Section-level sources captured.';

  return [
    `## ${sectionTitle}`,
    '',
    artifact.statusSummary,
    '',
    `**Verdict:** ${artifact.verdict}  ·  **Confidence:** ${artifact.confidence}/10`,
    '',
    '### Keyword Demand',
    artifact.keywordDemand.prose,
    ...artifact.keywordDemand.keywords.map(
      (keyword) =>
        `- ${keyword.intentType} — ${keyword.keyword} — volume: ${keyword.monthlyVolume} — observed: ${keyword.dateObserved}`,
    ),
    '',
    '### Question Mining',
    artifact.questionMining.prose,
    ...artifact.questionMining.questions.map(
      (question) =>
        `- ${question.surface} (${question.frequency}) — ${question.question}`,
    ),
    '',
    '### Content Gaps',
    artifact.contentGaps.prose,
    ...artifact.contentGaps.gaps.map(
      (gap) => `- ${gap.topic} — ${gap.opportunity}`,
    ),
    '',
    '### Intent Signals',
    artifact.intentSignals.prose,
    ...artifact.intentSignals.items.map(
      (item) => `- ${item.signalType} — ${item.description}`,
    ),
    '',
    '### Venue Map',
    artifact.venueMap.prose,
    ...artifact.venueMap.venues.map(
      (venue) =>
        `- ${venue.venueType} — ${venue.name} (${venue.audienceSize}) — ${venue.sourceUrl}`,
    ),
    '',
    '### Sources',
    sources,
  ].join('\n');
}

function normalizeOfferPerformanceArtifact(
  artifact: OfferPerformanceArtifact,
): OfferPerformanceArtifact {
  const confidence = Number.isFinite(artifact.confidence)
    ? Math.max(0, Math.min(10, artifact.confidence))
    : 3;

  return {
    ...artifact,
    sectionTitle: artifact.sectionTitle.trim() || 'Offer & Performance Diagnostic',
    verdict:
      artifact.verdict.trim() || 'Offer and performance evidence has gaps',
    statusSummary:
      artifact.statusSummary.trim() ||
      'The Offer & Performance runner produced an Artifact with limited summary detail.',
    confidence,
  };
}

type OfferPerformanceSubsectionKey =
  | 'offerMarketFit'
  | 'funnelDiagnosis'
  | 'channelTruth'
  | 'retentionHealth'
  | 'redFlags';

function routeOfferPerformanceValidationError(
  error: string,
): OfferPerformanceSubsectionKey {
  if (
    error.startsWith('offerMarketFit') ||
    error.startsWith('sources') ||
    error.startsWith('sectionTitle') ||
    error.startsWith('verdict') ||
    error.startsWith('statusSummary') ||
    error.startsWith('confidence')
  ) {
    return 'offerMarketFit';
  }
  if (error.startsWith('funnelDiagnosis')) return 'funnelDiagnosis';
  if (error.startsWith('channelTruth')) return 'channelTruth';
  if (error.startsWith('retentionHealth')) return 'retentionHealth';
  return 'redFlags';
}

function annotateOfferPerformanceArtifactWithGaps(
  artifact: OfferPerformanceArtifact,
  errors: string[],
): OfferPerformanceArtifact {
  const grouped: Record<OfferPerformanceSubsectionKey, string[]> = {
    offerMarketFit: [],
    funnelDiagnosis: [],
    channelTruth: [],
    retentionHealth: [],
    redFlags: [],
  };

  for (const error of errors) {
    grouped[routeOfferPerformanceValidationError(error)].push(error);
  }

  return {
    ...artifact,
    confidence: Number.isFinite(artifact.confidence)
      ? Math.max(0, Math.min(5, artifact.confidence))
      : 3,
    offerMarketFit: {
      ...artifact.offerMarketFit,
      prose: appendGapBlock(
        artifact.offerMarketFit.prose,
        grouped.offerMarketFit,
      ),
    },
    funnelDiagnosis: {
      ...artifact.funnelDiagnosis,
      prose: appendGapBlock(
        artifact.funnelDiagnosis.prose,
        grouped.funnelDiagnosis,
      ),
    },
    channelTruth: {
      ...artifact.channelTruth,
      prose: appendGapBlock(artifact.channelTruth.prose, grouped.channelTruth),
    },
    retentionHealth: {
      ...artifact.retentionHealth,
      prose: appendGapBlock(
        artifact.retentionHealth.prose,
        grouped.retentionHealth,
      ),
    },
    redFlags: {
      ...artifact.redFlags,
      prose: appendGapBlock(artifact.redFlags.prose, grouped.redFlags),
    },
  };
}

function getOfferPerformancePopulatedSubsectionCount(partial: unknown): number {
  if (!isRecord(partial)) return 0;

  const fields = [
    'offerMarketFit',
    'funnelDiagnosis',
    'channelTruth',
    'retentionHealth',
    'redFlags',
  ] as const;

  return fields.filter((field) => {
    const subsection = partial[field];
    if (!isRecord(subsection)) return false;
    if (typeof subsection.prose === 'string' && subsection.prose.trim()) {
      return true;
    }
    return Object.values(subsection).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }).length;
}

async function streamOfferPerformanceArtifact(args: {
  model: typeof SUBAGENT_MODEL;
  transcript: string;
  businessContext: string;
  feedback?: string[];
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<OfferPerformanceArtifact> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: starting', {
    section: 'positioningOfferDiagnostic',
    status: 'drafting',
  });

  const system = [
    'You convert Offer & Performance Diagnostic evidence into one typed Artifact.',
    'Honor OfferPerformanceArtifactSchema and every field description exactly.',
    'Use the transcript as evidence. Do not fabricate CAC, LTV, cycle length, conversion, MRR, payback, channel ROI, activation, retention, first-value timing, or source URLs.',
    'Self-data only: use company-owned, analytics, review, page-performance, and directly attributable public evidence. External benchmarks are context only, not company metrics.',
    'Use not disclosed for every missing metric value or magnitude. A red flag must include claimedMotion, actualEvidence, and a specific contradiction.',
    'Keep top-level statusSummary at two to four sentences. Confidence is a 0-10 integer-like self-rating.',
  ].join('\n');

  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? [
          '',
          '## Prior validation failures',
          ...args.feedback.map((error) => `- ${error}`),
        ].join('\n')
      : '';

  const prompt = [
    '## Business context',
    args.businessContext,
    '',
    '## Evidence transcript',
    args.transcript,
    feedbackBlock,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: OfferPerformanceArtifactSchema,
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const subsectionCount = getOfferPerformancePopulatedSubsectionCount(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] streamObject: subsection ${subsectionCount}/5 partial`,
      {
        section: 'positioningOfferDiagnostic',
        status: 'drafting',
        resultCount: subsectionCount,
      },
    );
  }

  const artifact = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: complete', {
    section: 'positioningOfferDiagnostic',
    status: 'complete',
  });

  return normalizeOfferPerformanceArtifact(artifact);
}

function createOfferPerformanceFallbackArtifact(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  transcript: string;
}): OfferPerformanceArtifact {
  const clippedTranscript = args.transcript.slice(0, 900);
  const gapProse = [
    `The Offer & Performance runner failed before a complete typed Artifact could be emitted: ${args.errorMessage}`,
    clippedTranscript
      ? `Captured evidence snapshot: ${clippedTranscript}`
      : 'No usable evidence snapshot was captured before failure.',
  ].join('\n\n');

  return {
    sectionTitle: args.spec.title,
    verdict: 'Partial - Offer & Performance artifact has validation gaps',
    statusSummary:
      'The Offer & Performance runner preserved a typed fallback Artifact after the section failed before completion. Treat every sub-section as incomplete until the section is rerun.',
    confidence: 2,
    sources: [],
    offerMarketFit: {
      prose: appendGapBlock(gapProse, [
        'offerMarketFit.proofPoints: have 0, need >=3 proof points.',
        'sources: have 0, need >=5 Section-level sources.',
      ]),
      proofPoints: [],
    },
    funnelDiagnosis: {
      prose: appendGapBlock(gapProse, [
        'funnelDiagnosis.breaks: have 0, need >=2 funnel breaks.',
      ]),
      breaks: [],
    },
    channelTruth: {
      prose: appendGapBlock(gapProse, [
        'channelTruth.channels: have 0, need >=3 channels.',
        'channelTruth.channels: need >=3 distinct channels, have 0.',
      ]),
      channels: [],
    },
    retentionHealth: {
      prose: appendGapBlock(gapProse, [
        'retentionHealth.signals: have 0, need >=3 retention signals.',
        'retentionHealth.signals: need >=2 signalTypes, have 0.',
      ]),
      signals: [],
    },
    redFlags: {
      prose: appendGapBlock(gapProse, [
        'redFlags.items: have 0, need >=3 red flags.',
      ]),
      items: [],
    },
  };
}

function formatOfferPerformanceArtifactMarkdown(
  artifact: OfferPerformanceArtifact,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = artifact.sectionTitle.trim() || spec.title;
  const sources =
    artifact.sources.length > 0
      ? artifact.sources
          .map((source) => `- ${source.title} — ${source.url}`)
          .join('\n')
      : '- No Section-level sources captured.';

  return [
    `## ${sectionTitle}`,
    '',
    artifact.statusSummary,
    '',
    `**Verdict:** ${artifact.verdict}  ·  **Confidence:** ${artifact.confidence}/10`,
    '',
    '### Offer-Market Fit',
    artifact.offerMarketFit.prose,
    ...artifact.offerMarketFit.proofPoints.map(
      (point) =>
        `- ${point.metric} — ${point.value} (${point.reportedBy}, ${point.confidence}) — ${point.sourceUrl}`,
    ),
    '',
    '### Funnel Diagnosis',
    artifact.funnelDiagnosis.prose,
    ...artifact.funnelDiagnosis.breaks.map(
      (item) =>
        `- ${item.stageName} — ${item.metric}: ${item.magnitude} — ${item.hypothesis}`,
    ),
    '',
    '### Channel Truth',
    artifact.channelTruth.prose,
    ...artifact.channelTruth.channels.map(
      (channel) =>
        `- ${channel.channelName} — ${channel.hasWorked} — ${channel.quantifiedEvidence} — ${channel.sourceUrl}`,
    ),
    '',
    '### Retention Health',
    artifact.retentionHealth.prose,
    ...artifact.retentionHealth.signals.map(
      (signal) =>
        `- ${signal.signalType} — ${signal.metric}: ${signal.value} — ${signal.sourceUrl}`,
    ),
    '',
    '### Red Flags',
    artifact.redFlags.prose,
    ...artifact.redFlags.items.map(
      (item) =>
        `- ${item.severity} — ${item.claimedMotion} vs ${item.actualEvidence}: ${item.contradiction}`,
    ),
    '',
    '### Sources',
    sources,
  ].join('\n');
}

export async function runJourneySectionViaSubagent(
  spec: JourneySectionSpec,
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  externalAbortSignal?: AbortSignal,
): Promise<ResearchResult> {
  const startTime = Date.now();

  if (!isPositioningSubagentId(spec.section)) {
    return {
      status: 'error',
      section: spec.section,
      error: `Subagent runner called with non-positioning section: ${spec.section}`,
      durationMs: Date.now() - startTime,
    };
  }

  const agent = POSITIONING_SUBAGENTS[spec.section];
  const refinedContext = buildContextWithRefinement(context, chatRefinement);

  await emitRunnerProgress(onProgress, 'runner', `${spec.title} starting (subagent)`, {
    toolName: spec.skill,
  });

  // ADR-0002: positioning sections gather evidence in the ToolLoopAgent, then
  // this runner emits typed Artifacts through streamObject(SectionSchema).
  const closingInstruction = buildTypedArtifactClosingInstruction(spec.section);

  const prompt = `Specialist agent: ${spec.title}
Mission: ${spec.mission}
Output emphasis: ${spec.outputEmphasis.join(', ')}

${closingInstruction}

CONTEXT:
${refinedContext}`;

  // P2 fix: AbortController so the timeout actually cancels the in-flight
  // agent.generate() (and its tool calls). Previously Promise.race resolved
  // the timeout but the agent kept running, burning Anthropic quota until
  // the model returned.
  //
  // Phase 5: compose the timeout signal with the worker's external signal
  // (heartbeat self-termination or /abort route) so EITHER source can stop
  // the run.
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(
    () => timeoutController.abort(new Error(`Subagent timeout after ${SUBAGENT_TIMEOUT_MS / 1000}s`)),
    SUBAGENT_TIMEOUT_MS,
  );

  const composedSignal: AbortSignal = composeAbortSignals(
    externalAbortSignal
      ? [timeoutController.signal, externalAbortSignal]
      : [timeoutController.signal],
  );

  // Track step snapshots so we can recover partial output if the tool
  // loop fails before emitting a final envelope. Per codex review
  // 2026-05-13: capture text + tool calls + tool results, not just text —
  // step-cap failures often have tool-only steps with empty text.
  const stepSnapshots: string[] = [];
  let stepCount = 0;
  const MAX_EXPECTED_STEPS = 6;

  try {
    await agent.generate({
      prompt,
      abortSignal: composedSignal,
      onStepFinish: async (step: {
        text?: string;
        toolCalls?: Array<{ toolName?: string; input?: unknown }>;
        toolResults?: Array<{ toolName?: string; output?: unknown }>;
      }) => {
        stepCount += 1;
        const parts: string[] = [];
        const toolNames: string[] = [];
        if (typeof step.text === 'string' && step.text.trim().length > 0) {
          parts.push(step.text.trim());
        }
        if (Array.isArray(step.toolCalls)) {
          for (const call of step.toolCalls) {
            if (!call?.toolName) continue;
            toolNames.push(call.toolName);
            const args =
              call.input !== undefined ? JSON.stringify(call.input).slice(0, 400) : '';
            parts.push(`[tool:${call.toolName}] ${args}`);
          }
        }
        if (Array.isArray(step.toolResults)) {
          for (const tr of step.toolResults) {
            if (!tr?.toolName) continue;
            const out =
              tr.output !== undefined ? JSON.stringify(tr.output).slice(0, 400) : '';
            parts.push(`[result:${tr.toolName}] ${out}`);
          }
        }
        if (parts.length > 0) {
          stepSnapshots.push(parts.join('\n'));
        }
        // P2a — agent-activity feed: forward each step to onProgress so the
        // orchestrator emits it as a research_section_events row. The
        // frontend (audit-state route + ZoneActivity component) reads these
        // and renders a Claude.ai-style live activity feed under each
        // section while the run is in flight.
        const message =
          toolNames.length > 0
            ? `Step ${stepCount}: ${toolNames.join(', ')}`
            : `Step ${stepCount}`;
        await emitRunnerProgress(onProgress, 'runner', message, {
          stepNumber: stepCount,
          toolNames,
          textPreview:
            typeof step.text === 'string'
              ? step.text.trim().slice(0, 280)
              : undefined,
        });
      },
    });

    clearTimeout(timeoutHandle);

    if (spec.section === 'positioningMarketCategory') {
      const transcript = buildTranscriptFromSteps(stepSnapshots);
      let artifact = await streamMarketCategoryArtifact({
        model: SUBAGENT_MODEL,
        transcript,
        businessContext: refinedContext,
        onProgress,
        abortSignal: composedSignal,
      });

      let validation = validateMarketCategoryMinimums(artifact);

      if (!validation.ok) {
        await emitRunnerProgress(
          onProgress,
          'runner',
          'Post-validate failed: retrying once with feedback',
          {
            section: spec.section,
            status: 'drafting',
            resultCount: validation.errors.length,
          },
        );

        artifact = await streamMarketCategoryArtifact({
          model: SUBAGENT_MODEL,
          transcript,
          businessContext: refinedContext,
          feedback: validation.errors,
          onProgress,
          abortSignal: composedSignal,
        });
        validation = validateMarketCategoryMinimums(artifact);
      }

      if (!validation.ok) {
        artifact = annotateMarketCategoryArtifactWithGaps(
          artifact,
          validation.errors,
        );
      }

      const markdown = formatMarketCategoryArtifactMarkdown(artifact, spec);
      await emitRunnerProgress(onProgress, 'output', `${artifact.sectionTitle} complete`);

      return {
        status: 'complete',
        section: spec.section,
        data: artifact,
        artifact: { title: artifact.sectionTitle || spec.title, markdown },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningBuyerICP') {
      const transcript = buildTranscriptFromSteps(stepSnapshots);
      let artifact = await streamBuyerIcpArtifact({
        model: SUBAGENT_MODEL,
        transcript,
        businessContext: refinedContext,
        onProgress,
        abortSignal: composedSignal,
      });

      let validation = validateBuyerICPMinimums(artifact);

      if (!validation.ok) {
        await emitRunnerProgress(
          onProgress,
          'runner',
          'Post-validate failed: retrying once with feedback',
          {
            section: spec.section,
            status: 'drafting',
            resultCount: validation.errors.length,
          },
        );

        artifact = await streamBuyerIcpArtifact({
          model: SUBAGENT_MODEL,
          transcript,
          businessContext: refinedContext,
          feedback: validation.errors,
          onProgress,
          abortSignal: composedSignal,
        });
        validation = validateBuyerICPMinimums(artifact);
      }

      if (!validation.ok) {
        artifact = annotateArtifactWithGaps(artifact, validation.errors);
      }

      const markdown = formatBuyerIcpArtifactMarkdown(artifact, spec);
      await emitRunnerProgress(onProgress, 'output', `${artifact.sectionTitle} complete`);

      return {
        status: 'complete',
        section: spec.section,
        data: artifact,
        artifact: { title: artifact.sectionTitle || spec.title, markdown },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningCompetitorLandscape') {
      const transcript = buildTranscriptFromSteps(stepSnapshots);
      let artifact = await streamCompetitorLandscapeArtifact({
        model: SUBAGENT_MODEL,
        transcript,
        businessContext: refinedContext,
        onProgress,
        abortSignal: composedSignal,
      });

      let validation = validateCompetitorLandscapeMinimums(artifact);

      if (!validation.ok) {
        await emitRunnerProgress(
          onProgress,
          'runner',
          'Post-validate failed: retrying once with feedback',
          {
            section: spec.section,
            status: 'drafting',
            resultCount: validation.errors.length,
          },
        );

        artifact = await streamCompetitorLandscapeArtifact({
          model: SUBAGENT_MODEL,
          transcript,
          businessContext: refinedContext,
          feedback: validation.errors,
          onProgress,
          abortSignal: composedSignal,
        });
        validation = validateCompetitorLandscapeMinimums(artifact);
      }

      if (!validation.ok) {
        artifact = annotateCompetitorLandscapeArtifactWithGaps(
          artifact,
          validation.errors,
        );
      }

      const markdown = formatCompetitorLandscapeArtifactMarkdown(artifact, spec);
      await emitRunnerProgress(onProgress, 'output', `${artifact.sectionTitle} complete`);

      return {
        status: 'complete',
        section: spec.section,
        data: artifact,
        artifact: { title: artifact.sectionTitle || spec.title, markdown },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningVoiceOfCustomer') {
      const transcript = buildTranscriptFromSteps(stepSnapshots);
      let artifact = await streamVoiceOfCustomerArtifact({
        model: SUBAGENT_MODEL,
        transcript,
        businessContext: refinedContext,
        onProgress,
        abortSignal: composedSignal,
      });

      let validation = validateVoiceOfCustomerMinimums(artifact);

      if (!validation.ok) {
        await emitRunnerProgress(
          onProgress,
          'runner',
          'Post-validate failed: retrying once with feedback',
          {
            section: spec.section,
            status: 'drafting',
            resultCount: validation.errors.length,
          },
        );

        artifact = await streamVoiceOfCustomerArtifact({
          model: SUBAGENT_MODEL,
          transcript,
          businessContext: refinedContext,
          feedback: validation.errors,
          onProgress,
          abortSignal: composedSignal,
        });
        validation = validateVoiceOfCustomerMinimums(artifact);
      }

      if (!validation.ok) {
        artifact = annotateVoiceOfCustomerArtifactWithGaps(
          artifact,
          validation.errors,
        );
      }

      const markdown = formatVoiceOfCustomerArtifactMarkdown(artifact, spec);
      await emitRunnerProgress(onProgress, 'output', `${artifact.sectionTitle} complete`);

      return {
        status: 'complete',
        section: spec.section,
        data: artifact,
        artifact: { title: artifact.sectionTitle || spec.title, markdown },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningDemandIntent') {
      const transcript = buildTranscriptFromSteps(stepSnapshots);
      let artifact = await streamDemandIntentArtifact({
        model: SUBAGENT_MODEL,
        transcript,
        businessContext: refinedContext,
        onProgress,
        abortSignal: composedSignal,
      });

      let validation = validateDemandIntentMinimums(artifact);

      if (!validation.ok) {
        await emitRunnerProgress(
          onProgress,
          'runner',
          'Post-validate failed: retrying once with feedback',
          {
            section: spec.section,
            status: 'drafting',
            resultCount: validation.errors.length,
          },
        );

        artifact = await streamDemandIntentArtifact({
          model: SUBAGENT_MODEL,
          transcript,
          businessContext: refinedContext,
          feedback: validation.errors,
          onProgress,
          abortSignal: composedSignal,
        });
        validation = validateDemandIntentMinimums(artifact);
      }

      if (!validation.ok) {
        artifact = annotateDemandIntentArtifactWithGaps(
          artifact,
          validation.errors,
        );
      }

      const markdown = formatDemandIntentArtifactMarkdown(artifact, spec);
      await emitRunnerProgress(onProgress, 'output', `${artifact.sectionTitle} complete`);

      return {
        status: 'complete',
        section: spec.section,
        data: artifact,
        artifact: { title: artifact.sectionTitle || spec.title, markdown },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningOfferDiagnostic') {
      const transcript = buildTranscriptFromSteps(stepSnapshots);
      let artifact = await streamOfferPerformanceArtifact({
        model: SUBAGENT_MODEL,
        transcript,
        businessContext: refinedContext,
        onProgress,
        abortSignal: composedSignal,
      });

      let validation = validateOfferPerformanceMinimums(artifact);

      if (!validation.ok) {
        await emitRunnerProgress(
          onProgress,
          'runner',
          'Post-validate failed: retrying once with feedback',
          {
            section: spec.section,
            status: 'drafting',
            resultCount: validation.errors.length,
          },
        );

        artifact = await streamOfferPerformanceArtifact({
          model: SUBAGENT_MODEL,
          transcript,
          businessContext: refinedContext,
          feedback: validation.errors,
          onProgress,
          abortSignal: composedSignal,
        });
        validation = validateOfferPerformanceMinimums(artifact);
      }

      if (!validation.ok) {
        artifact = annotateOfferPerformanceArtifactWithGaps(
          artifact,
          validation.errors,
        );
      }

      const markdown = formatOfferPerformanceArtifactMarkdown(artifact, spec);
      await emitRunnerProgress(onProgress, 'output', `${artifact.sectionTitle} complete`);

      return {
        status: 'complete',
        section: spec.section,
        data: artifact,
        artifact: { title: artifact.sectionTitle || spec.title, markdown },
        durationMs: Date.now() - startTime,
      };
    }

    return assertUnhandledPositioningSection(spec.section);
  } catch (err) {
    clearTimeout(timeoutHandle);
    const message = err instanceof Error ? err.message : String(err);
    const capturedTranscript = buildTranscriptFromSteps(stepSnapshots);

    if (spec.section === 'positioningMarketCategory') {
      const partialAt =
        stepSnapshots.length > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;
      const fallbackArtifact = createMarketCategoryFallbackArtifact({
        spec,
        errorMessage: message,
        transcript: capturedTranscript,
      });
      const fallbackMarkdown = formatMarketCategoryArtifactMarkdown(
        fallbackArtifact,
        spec,
      );

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (Market Category typed fallback preserved at ${partialAt}%)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: fallbackArtifact,
        artifact: {
          title: fallbackArtifact.sectionTitle || spec.title,
          markdown: fallbackMarkdown,
        },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningBuyerICP') {
      const partialAt =
        stepSnapshots.length > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;
      const fallbackArtifact = createBuyerIcpFallbackArtifact({
        spec,
        errorMessage: message,
        transcript: capturedTranscript,
      });
      const fallbackMarkdown = formatBuyerIcpArtifactMarkdown(fallbackArtifact, spec);

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (BuyerICP typed fallback preserved at ${partialAt}%)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: fallbackArtifact,
        artifact: {
          title: fallbackArtifact.sectionTitle || spec.title,
          markdown: fallbackMarkdown,
        },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningCompetitorLandscape') {
      const partialAt =
        stepSnapshots.length > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;
      const fallbackArtifact = createCompetitorLandscapeFallbackArtifact({
        spec,
        errorMessage: message,
        transcript: capturedTranscript,
      });
      const fallbackMarkdown = formatCompetitorLandscapeArtifactMarkdown(
        fallbackArtifact,
        spec,
      );

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (Competitor Landscape typed fallback preserved at ${partialAt}%)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: fallbackArtifact,
        artifact: {
          title: fallbackArtifact.sectionTitle || spec.title,
          markdown: fallbackMarkdown,
        },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningVoiceOfCustomer') {
      const partialAt =
        stepSnapshots.length > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;
      const fallbackArtifact = createVoiceOfCustomerFallbackArtifact({
        spec,
        errorMessage: message,
        transcript: capturedTranscript,
      });
      const fallbackMarkdown = formatVoiceOfCustomerArtifactMarkdown(
        fallbackArtifact,
        spec,
      );

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (Voice of Customer typed fallback preserved at ${partialAt}%)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: fallbackArtifact,
        artifact: {
          title: fallbackArtifact.sectionTitle || spec.title,
          markdown: fallbackMarkdown,
        },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningDemandIntent') {
      const partialAt =
        stepSnapshots.length > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;
      const fallbackArtifact = createDemandIntentFallbackArtifact({
        spec,
        errorMessage: message,
        transcript: capturedTranscript,
      });
      const fallbackMarkdown = formatDemandIntentArtifactMarkdown(
        fallbackArtifact,
        spec,
      );

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (Demand & Intent typed fallback preserved at ${partialAt}%)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: fallbackArtifact,
        artifact: {
          title: fallbackArtifact.sectionTitle || spec.title,
          markdown: fallbackMarkdown,
        },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    if (spec.section === 'positioningOfferDiagnostic') {
      const partialAt =
        stepSnapshots.length > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;
      const fallbackArtifact = createOfferPerformanceFallbackArtifact({
        spec,
        errorMessage: message,
        transcript: capturedTranscript,
      });
      const fallbackMarkdown = formatOfferPerformanceArtifactMarkdown(
        fallbackArtifact,
        spec,
      );

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (Offer & Performance typed fallback preserved at ${partialAt}%)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: fallbackArtifact,
        artifact: {
          title: fallbackArtifact.sectionTitle || spec.title,
          markdown: fallbackMarkdown,
        },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    await emitRunnerProgress(onProgress, 'error', message);
    return {
      status: 'error',
      section: spec.section,
      error: message,
      durationMs: Date.now() - startTime,
    };
  }
}
