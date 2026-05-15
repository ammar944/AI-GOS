import { z } from 'zod';

import { SourceSchema } from './_shared';

/**
 * Bespoke Section 05 Artifact schema for ADR-0002.
 *
 * Demand & Intent Signals gathers keyword, question, content-gap, trigger,
 * and venue evidence. Cardinality, date, and coverage checks live in
 * validateDemandIntentMinimums because provider structured-output schemas
 * reject Zod cardinality constraints.
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

const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

export const KeywordSignalSchema = z
  .object({
    keyword: z.string().describe('Keyword, query, or phrase with demand evidence.'),
    monthlyVolume: z
      .string()
      .describe('Monthly volume as source text; allow not disclosed when unavailable.'),
    intentType: z
      .enum(INTENT_TYPES)
      .describe('Search intent type: informational, commercial, transactional, or navigational.'),
    top3RankingDomains: z
      .string()
      .array()
      .describe('Top ranking domains observed for the keyword.'),
    sourceTitle: z.string().describe('Named source for the keyword evidence.'),
    sourceUrl: z.string().describe('Source URL supporting the keyword signal.'),
    dateObserved: z
      .string()
      .describe('YYYY-MM-DD date when the keyword volume/ranking evidence was observed.'),
  })
  .describe('Keyword demand signal with volume, intent, ranking reality, and observation date.');

export const BuyerQuestionSchema = z
  .object({
    question: z.string().describe('Verbatim buyer question from PAA, Reddit, Quora, or community.'),
    surface: z
      .enum(QUESTION_SURFACES)
      .describe('Surface where the question was found.'),
    sourceUrl: z.string().describe('Source URL supporting the buyer question.'),
    frequency: z
      .enum(FREQUENCIES)
      .describe('Whether the question appears recurring or occasional in evidence.'),
  })
  .describe('Verbatim buyer question.');

export const ContentGapSchema = z
  .object({
    topic: z.string().describe('Content topic with demand and weak answers.'),
    evidenceOfDemand: z.string().describe('Evidence that buyers ask about or search for this topic.'),
    weakCompetitorAnswerEvidence: z
      .string()
      .describe('Evidence that current competitor answers are weak, generic, or incomplete.'),
    opportunity: z.string().describe('Specific content or positioning opportunity.'),
  })
  .describe('Content gap where demand exists and competitor answers are weak.');

export const IntentSignalSchema = z
  .object({
    signalType: z
      .enum(SIGNAL_TYPES)
      .describe('Intent signal type from hiring, RFPs, news, funding, or leadership changes.'),
    description: z.string().describe('Description of the observable intent signal.'),
    sourceUrl: z.string().describe('Source URL supporting the signal.'),
    exampleCompany: z
      .string()
      .optional()
      .describe('Example company tied to the signal when public.'),
  })
  .describe('Observable intent signal from the wild.');

export const DemandVenueSchema = z
  .object({
    name: z.string().describe('Named venue where demand conversations happen.'),
    venueType: z
      .enum(VENUE_TYPES)
      .describe('Venue type: event, community, newsletter, podcast, or slack.'),
    audienceSize: z
      .string()
      .describe('Audience size as source text; use not disclosed when unavailable.'),
    sourceUrl: z.string().describe('Source URL supporting the venue.'),
  })
  .describe('Event, community, newsletter, podcast, or Slack venue with demand signal.');

export const KeywordDemandSchema = z
  .object({
    prose: z.string().describe('Narrative keyword-demand synthesis.'),
    keywords: KeywordSignalSchema.array().describe(
      'Keyword demand cards with volume, intent, ranking domains, source, and observation date.',
    ),
  })
  .describe('Sub-section for keyword demand.');

export const QuestionMiningSchema = z
  .object({
    prose: z.string().describe('Narrative question-mining synthesis.'),
    questions: BuyerQuestionSchema.array().describe(
      'Verbatim buyer questions from PAA, Reddit, Quora, communities, forums, or support threads.',
    ),
  })
  .describe('Sub-section for question mining.');

export const ContentGapsSchema = z
  .object({
    prose: z.string().describe('Narrative content-gap synthesis.'),
    gaps: ContentGapSchema.array().describe(
      'Content gaps with demand evidence and weak competitor-answer evidence.',
    ),
  })
  .describe('Sub-section for content-gap evidence.');

export const IntentSignalsSchema = z
  .object({
    prose: z.string().describe('Narrative synthesis of observable intent signals.'),
    items: IntentSignalSchema.array().describe(
      'Observable intent signals from jobs, RFPs, news triggers, funding, and leadership changes.',
    ),
  })
  .describe('Sub-section for intent signals.');

export const VenueMapSchema = z
  .object({
    prose: z.string().describe('Narrative venue-map synthesis.'),
    venues: DemandVenueSchema.array().describe(
      'Events, communities, newsletters, podcasts, and Slack venues where conversations happen.',
    ),
  })
  .describe('Sub-section for event and community signal map.');

export const DemandIntentArtifactSchema = z
  .object({
    sectionTitle: z.string().describe('Section title, normally Demand & Intent Signals.'),
    verdict: z.string().describe('One-line judgment for Section 05 demand and intent.'),
    statusSummary: z
      .string()
      .describe('Two to four sentence opening summary for the Section.'),
    confidence: z
      .number()
      .describe('0-10 confidence score; range is enforced by runner validation.'),
    sources: SourceSchema.array().describe(
      'Best public sources supporting the Section-level demand judgment.',
    ),
    keywordDemand: KeywordDemandSchema.describe(
      'Keyword demand: volume, intent type, and ranking reality.',
    ),
    questionMining: QuestionMiningSchema.describe(
      'People Also Ask, Reddit, Quora, community, forum, or support questions.',
    ),
    contentGaps: ContentGapsSchema.describe(
      'Topics with demand and weak competitor answers.',
    ),
    intentSignals: IntentSignalsSchema.describe(
      'Job postings, RFPs, news triggers, funding, and leadership-change signals.',
    ),
    venueMap: VenueMapSchema.describe(
      'Events and communities where demand conversations happen.',
    ),
  })
  .describe('Complete Section 05 Demand & Intent Signals Artifact.');

export type DemandIntentArtifact = z.infer<typeof DemandIntentArtifactSchema>;

type ValidationResult = { ok: boolean; errors: string[] };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushMissingText(errors: string[], path: string, value: unknown): void {
  if (!hasText(value)) {
    errors.push(`${path}: required field missing.`);
  }
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function validateUrl(errors: string[], path: string, url: string): void {
  if (!VALID_URL_PATTERN.test(url)) {
    errors.push(`${path}: url is not a valid URL.`);
  }
}

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
    if (hasText(source.url)) validateUrl(errors, `sources[${index}].url`, source.url);
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
      errors.push(`keywordDemand.keywords[${index}].top3RankingDomains: required field missing.`);
    }
    if (hasText(keyword.sourceUrl)) {
      validateUrl(errors, `keywordDemand.keywords[${index}].sourceUrl`, keyword.sourceUrl);
    }
  });

  artifact.questionMining.questions.forEach((question, index) => {
    pushMissingText(errors, `questionMining.questions[${index}].question`, question.question);
    pushMissingText(errors, `questionMining.questions[${index}].sourceUrl`, question.sourceUrl);
    if (hasText(question.sourceUrl)) {
      validateUrl(errors, `questionMining.questions[${index}].sourceUrl`, question.sourceUrl);
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

  const sourceCount = artifact.sources.length;
  if (sourceCount < 5) {
    errors.push(`sources: have ${sourceCount}, need >=5 Section-level sources.`);
  }

  const keywordCount = artifact.keywordDemand.keywords.length;
  if (keywordCount < 10) {
    errors.push(`keywordDemand.keywords: have ${keywordCount}, need >=10 keyword signals.`);
  }

  const questionCount = artifact.questionMining.questions.length;
  if (questionCount < 10) {
    errors.push(`questionMining.questions: have ${questionCount}, need >=10 buyer questions.`);
  }
  const questionSurfaceCount = uniqueCount(
    artifact.questionMining.questions.map((question) => question.surface),
  );
  if (questionSurfaceCount < 2) {
    errors.push(
      `questionMining.questions: need >=2 surface types, have ${questionSurfaceCount}.`,
    );
  }

  const contentGapCount = artifact.contentGaps.gaps.length;
  if (contentGapCount < 3) {
    errors.push(`contentGaps.gaps: have ${contentGapCount}, need >=3 content gaps.`);
  }

  const intentSignalCount = artifact.intentSignals.items.length;
  if (intentSignalCount < 5) {
    errors.push(`intentSignals.items: have ${intentSignalCount}, need >=5 intent signals.`);
  }
  const intentSignalTypeCount = uniqueCount(
    artifact.intentSignals.items.map((item) => item.signalType),
  );
  if (intentSignalTypeCount < 2) {
    errors.push(`intentSignals.items: need >=2 signalTypes, have ${intentSignalTypeCount}.`);
  }

  const venueCount = artifact.venueMap.venues.length;
  if (venueCount < 4) {
    errors.push(`venueMap.venues: have ${venueCount}, need >=4 demand venues.`);
  }
  const venueTypeCount = uniqueCount(
    artifact.venueMap.venues.map((venue) => venue.venueType),
  );
  if (venueTypeCount < 2) {
    errors.push(`venueMap.venues: need >=2 venueTypes, have ${venueTypeCount}.`);
  }

  return { ok: errors.length === 0, errors };
}
