import { z } from 'zod';

import {
  SourceSchema,
  type ValidationResult,
  hasText,
  pushMissingText,
  uniqueCount,
  validateUrl,
} from './_shared';

/**
 * Next.js-side mirror of the worker DemandIntentArtifactSchema. Source of
 * truth lives in
 * research-worker/src/agents/subagents/schemas/demand-intent-signals.ts.
 */

const INTENT_TYPES = [
  'informational',
  'commercial',
  'transactional',
  'navigational',
] as const;

const QUESTION_SURFACES = [
  'paa',
  'reddit',
  'quora',
  'community',
  'forum',
  'support-thread',
] as const;

const FREQUENCIES = ['recurring', 'occasional'] as const;

const SIGNAL_TYPES = [
  'job-posting',
  'rfp',
  'news-trigger',
  'funding',
  'leadership-change',
] as const;

const VENUE_TYPES = [
  'event',
  'community',
  'newsletter',
  'podcast',
  'slack',
] as const;

export const KeywordSignalSchema = z.object({
  keyword: z.string(),
  monthlyVolume: z.string(),
  intentType: z.enum(INTENT_TYPES),
  top3RankingDomains: z.string().array(),
  sourceTitle: z.string(),
  sourceUrl: z.string(),
  dateObserved: z.string(),
});

export const BuyerQuestionSchema = z.object({
  question: z.string(),
  surface: z.enum(QUESTION_SURFACES),
  sourceUrl: z.string(),
  frequency: z.enum(FREQUENCIES),
});

export const ContentGapSchema = z.object({
  topic: z.string(),
  evidenceOfDemand: z.string(),
  weakCompetitorAnswerEvidence: z.string(),
  opportunity: z.string(),
});

export const IntentSignalSchema = z.object({
  signalType: z.enum(SIGNAL_TYPES),
  description: z.string(),
  sourceUrl: z.string(),
  exampleCompany: z.string().optional(),
});

export const DemandVenueSchema = z.object({
  name: z.string(),
  venueType: z.enum(VENUE_TYPES),
  audienceSize: z.string(),
  sourceUrl: z.string(),
});

export const KeywordDemandSchema = z.object({
  prose: z.string(),
  keywords: KeywordSignalSchema.array(),
});

export const QuestionMiningSchema = z.object({
  prose: z.string(),
  questions: BuyerQuestionSchema.array(),
});

export const ContentGapsSchema = z.object({
  prose: z.string(),
  gaps: ContentGapSchema.array(),
});

export const IntentSignalsSchema = z.object({
  prose: z.string(),
  items: IntentSignalSchema.array(),
});

export const VenueMapSchema = z.object({
  prose: z.string(),
  venues: DemandVenueSchema.array(),
});

export const DemandIntentArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    keywordDemand: KeywordDemandSchema,
    questionMining: QuestionMiningSchema,
    contentGaps: ContentGapsSchema,
    intentSignals: IntentSignalsSchema,
    venueMap: VenueMapSchema,
  })
  .describe('Complete Section 05 Demand & Intent Signals Artifact.');

export type DemandIntentArtifact = z.infer<typeof DemandIntentArtifactSchema>;

function validateRequiredFields(
  artifact: DemandIntentArtifact,
  errors: string[],
): void {
  pushMissingText(errors, 'sectionTitle', artifact.sectionTitle);
  pushMissingText(errors, 'verdict', artifact.verdict);
  pushMissingText(errors, 'statusSummary', artifact.statusSummary);
  if (typeof artifact.confidence !== 'number' || Number.isNaN(artifact.confidence)) {
    errors.push('confidence: required numeric field missing.');
  }

  pushMissingText(errors, 'keywordDemand.prose', artifact.keywordDemand.prose);
  pushMissingText(errors, 'questionMining.prose', artifact.questionMining.prose);
  pushMissingText(errors, 'contentGaps.prose', artifact.contentGaps.prose);
  pushMissingText(errors, 'intentSignals.prose', artifact.intentSignals.prose);
  pushMissingText(errors, 'venueMap.prose', artifact.venueMap.prose);

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    if (hasText(source.url)) {
      validateUrl(errors, `sources[${index}].url`, source.url);
    }
  });

  artifact.keywordDemand.keywords.forEach((keyword, index) => {
    pushMissingText(errors, `keywordDemand.keywords[${index}].keyword`, keyword.keyword);
    pushMissingText(
      errors,
      `keywordDemand.keywords[${index}].monthlyVolume`,
      keyword.monthlyVolume,
    );
    pushMissingText(
      errors,
      `keywordDemand.keywords[${index}].sourceTitle`,
      keyword.sourceTitle,
    );
    pushMissingText(errors, `keywordDemand.keywords[${index}].sourceUrl`, keyword.sourceUrl);
    pushMissingText(
      errors,
      `keywordDemand.keywords[${index}].dateObserved`,
      keyword.dateObserved,
    );
    if (keyword.top3RankingDomains.length === 0) {
      errors.push(
        `keywordDemand.keywords[${index}].top3RankingDomains: required field missing.`,
      );
    }
    if (hasText(keyword.sourceUrl)) {
      validateUrl(
        errors,
        `keywordDemand.keywords[${index}].sourceUrl`,
        keyword.sourceUrl,
      );
    }
  });

  artifact.questionMining.questions.forEach((q, index) => {
    pushMissingText(errors, `questionMining.questions[${index}].question`, q.question);
    pushMissingText(errors, `questionMining.questions[${index}].sourceUrl`, q.sourceUrl);
    if (hasText(q.sourceUrl)) {
      validateUrl(errors, `questionMining.questions[${index}].sourceUrl`, q.sourceUrl);
    }
  });

  artifact.contentGaps.gaps.forEach((gap, index) => {
    pushMissingText(errors, `contentGaps.gaps[${index}].topic`, gap.topic);
    pushMissingText(
      errors,
      `contentGaps.gaps[${index}].evidenceOfDemand`,
      gap.evidenceOfDemand,
    );
    pushMissingText(
      errors,
      `contentGaps.gaps[${index}].weakCompetitorAnswerEvidence`,
      gap.weakCompetitorAnswerEvidence,
    );
    pushMissingText(errors, `contentGaps.gaps[${index}].opportunity`, gap.opportunity);
  });

  artifact.intentSignals.items.forEach((item, index) => {
    pushMissingText(errors, `intentSignals.items[${index}].description`, item.description);
    pushMissingText(errors, `intentSignals.items[${index}].sourceUrl`, item.sourceUrl);
    if (hasText(item.sourceUrl)) {
      validateUrl(errors, `intentSignals.items[${index}].sourceUrl`, item.sourceUrl);
    }
  });

  artifact.venueMap.venues.forEach((venue, index) => {
    pushMissingText(errors, `venueMap.venues[${index}].name`, venue.name);
    pushMissingText(errors, `venueMap.venues[${index}].audienceSize`, venue.audienceSize);
    pushMissingText(errors, `venueMap.venues[${index}].sourceUrl`, venue.sourceUrl);
    if (hasText(venue.sourceUrl)) {
      validateUrl(errors, `venueMap.venues[${index}].sourceUrl`, venue.sourceUrl);
    }
  });
}

export function validateDemandIntentMinimums(
  artifact: DemandIntentArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  if (artifact.sources.length < 5) {
    errors.push(`sources: have ${artifact.sources.length}, need >=5 Section-level sources.`);
  }

  if (artifact.keywordDemand.keywords.length < 10) {
    errors.push(
      `keywordDemand.keywords: have ${artifact.keywordDemand.keywords.length}, need >=10 keyword signals.`,
    );
  }

  if (artifact.questionMining.questions.length < 10) {
    errors.push(
      `questionMining.questions: have ${artifact.questionMining.questions.length}, need >=10 buyer questions.`,
    );
  }
  const questionSurfaceCount = uniqueCount(
    artifact.questionMining.questions.map((q) => q.surface),
  );
  if (questionSurfaceCount < 2) {
    errors.push(
      `questionMining.questions: need >=2 surface types, have ${questionSurfaceCount}.`,
    );
  }

  if (artifact.contentGaps.gaps.length < 3) {
    errors.push(
      `contentGaps.gaps: have ${artifact.contentGaps.gaps.length}, need >=3 content gaps.`,
    );
  }

  if (artifact.intentSignals.items.length < 5) {
    errors.push(
      `intentSignals.items: have ${artifact.intentSignals.items.length}, need >=5 intent signals.`,
    );
  }
  const intentSignalTypeCount = uniqueCount(
    artifact.intentSignals.items.map((i) => i.signalType),
  );
  if (intentSignalTypeCount < 2) {
    errors.push(
      `intentSignals.items: need >=2 signalTypes, have ${intentSignalTypeCount}.`,
    );
  }

  if (artifact.venueMap.venues.length < 4) {
    errors.push(
      `venueMap.venues: have ${artifact.venueMap.venues.length}, need >=4 demand venues.`,
    );
  }
  const venueTypeCount = uniqueCount(artifact.venueMap.venues.map((v) => v.venueType));
  if (venueTypeCount < 2) {
    errors.push(`venueMap.venues: need >=2 venueTypes, have ${venueTypeCount}.`);
  }

  return { ok: errors.length === 0, errors };
}
