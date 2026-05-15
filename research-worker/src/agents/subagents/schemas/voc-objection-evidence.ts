import { z } from 'zod';

import { SourceSchema } from './_shared';

/**
 * Bespoke Section 04 Artifact schema for ADR-0002.
 *
 * Voice of Customer & Objection Evidence is quote-heavy. The schema enforces
 * typed fields and enums, while validateVoiceOfCustomerMinimums enforces
 * cardinality, source coverage, and confidence range after streamObject.
 */

const VOC_SOURCE_TYPES = [
  'g2',
  'reddit',
  'hackernews',
  'sales-call',
  'support-thread',
  'twitter',
  'other',
] as const;

const PAIN_INTENSITIES = ['high', 'medium', 'low'] as const;

const OBJECTION_CATEGORIES = [
  'price',
  'feature',
  'trust',
  'switching-cost',
  'timing',
  'stakeholder',
  'other',
] as const;

const FREQUENCIES = ['recurring', 'occasional', 'one-off'] as const;

const DECISION_ROLES = ['buyer', 'champion', 'influencer', 'blocker'] as const;

const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

export const PainQuoteSchema = z
  .object({
    verbatimText: z
      .string()
      .describe('Verbatim pain quote. Preserve typos, caps, profanity, and slang.'),
    source: z
      .enum(VOC_SOURCE_TYPES)
      .describe('Surface where the quote was found.'),
    sourceUrl: z.string().describe('Public or internal trace URL for the quote.'),
    painTheme: z.string().describe('Pain theme represented by the quote.'),
    painIntensity: z
      .enum(PAIN_INTENSITIES)
      .describe('Intensity of the pain: high, medium, or low.'),
  })
  .describe('Verbatim buyer pain-language quote.');

export const ObjectionSchema = z
  .object({
    objectionText: z.string().describe('Verbatim objection text.'),
    category: z
      .enum(OBJECTION_CATEGORIES)
      .describe('Objection category blocking purchase.'),
    frequency: z
      .enum(FREQUENCIES)
      .describe('How often this objection appears in the evidence.'),
    howToHandle: z
      .string()
      .describe('Recommended response or handling strategy grounded in evidence.'),
    sourceUrl: z.string().describe('Source URL supporting the objection.'),
  })
  .describe('Purchase objection from buyer language.');

export const SwitchingStorySchema = z
  .object({
    priorSolution: z
      .string()
      .describe('Prior solution, status quo, or competitor the buyer left.'),
    reasonToLeave: z
      .string()
      .describe('Reason to leave, verbatim where possible.'),
    decisionPath: z
      .string()
      .describe('How the buyer moved from prior solution to new evaluation.'),
    exampleCompany: z
      .string()
      .optional()
      .describe('Example company or customer story when public.'),
    sourceUrl: z.string().describe('Source URL supporting the switching story.'),
  })
  .describe('Buyer switching story from a prior solution.');

export const DecisionCriterionSchema = z
  .object({
    criterion: z.string().describe('Evaluation criterion buyers say matters.'),
    statedBy: z
      .enum(DECISION_ROLES)
      .describe('Buyer-circle role stating the criterion.'),
    evidenceQuote: z.string().describe('Verbatim or source-close quote supporting the criterion.'),
    sourceUrl: z.string().describe('Source URL supporting the criterion.'),
  })
  .describe('Stated decision criterion from buyer evidence.');

export const SuccessQuoteSchema = z
  .object({
    verbatimText: z
      .string()
      .describe('Verbatim success-state quote. Preserve original wording.'),
    source: z
      .enum(VOC_SOURCE_TYPES)
      .describe('Surface where the success quote was found.'),
    sourceUrl: z.string().describe('Source URL supporting the success quote.'),
    afterStatePattern: z
      .string()
      .describe('After-state pattern represented by the quote.'),
  })
  .describe('Verbatim success-state quote.');

export const PainLanguageSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative synthesis of buyer pain language and themes.'),
    quotes: PainQuoteSchema.array().describe(
      'Verbatim pain quotes from reviews, forums, support threads, and calls.',
    ),
  })
  .describe('Sub-section for pain language.');

export const ObjectionsSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative synthesis of what actually stops purchase.'),
    items: ObjectionSchema.array().describe(
      'Purchase objections phrased how buyers phrase them.',
    ),
  })
  .describe('Sub-section for objection evidence.');

export const SwitchingStoriesSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative synthesis of switching stories and reasons to leave prior solutions.'),
    stories: SwitchingStorySchema.array().describe(
      'Stories explaining what made buyers leave prior solutions.',
    ),
  })
  .describe('Sub-section for switching stories.');

export const DecisionCriteriaSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative synthesis of stated decision criteria.'),
    criteria: DecisionCriterionSchema.array().describe(
      'Decision criteria buyers say matter in evaluation.',
    ),
  })
  .describe('Sub-section for stated decision criteria.');

export const SuccessLanguageSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative synthesis of success-state language.'),
    quotes: SuccessQuoteSchema.array().describe(
      'Verbatim quotes describing the buyer after-state.',
    ),
  })
  .describe('Sub-section for success-state language.');

export const VoiceOfCustomerArtifactSchema = z
  .object({
    sectionTitle: z
      .string()
      .describe('Section title, normally Voice of Customer & Objection Evidence.'),
    verdict: z
      .string()
      .describe('One-line judgment for Section 04 buyer language and objections.'),
    statusSummary: z
      .string()
      .describe('Two to four sentence opening summary for the Section.'),
    confidence: z
      .number()
      .describe('0-10 confidence score; range is enforced by runner validation.'),
    sources: SourceSchema.array().describe(
      'Best public sources supporting the Section-level VoC judgment.',
    ),
    painLanguage: PainLanguageSchema.describe(
      'Verbatim buyer pain language from reviews, forums, support threads, and calls.',
    ),
    objections: ObjectionsSchema.describe(
      'Objection evidence showing what stops purchase.',
    ),
    switchingStories: SwitchingStoriesSchema.describe(
      'Stories showing why buyers leave prior solutions.',
    ),
    decisionCriteria: DecisionCriteriaSchema.describe(
      'Stated decision criteria buyers say matter.',
    ),
    successLanguage: SuccessLanguageSchema.describe(
      'Success-state language describing the after-state.',
    ),
  })
  .describe('Complete Section 04 Voice of Customer & Objection Evidence Artifact.');

export type VoiceOfCustomerArtifact = z.infer<typeof VoiceOfCustomerArtifactSchema>;

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

function getSourceKey(sourceUrl: string, fallback: string): string {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return fallback;
  }
}

function validateUrl(errors: string[], path: string, url: string): void {
  if (!VALID_URL_PATTERN.test(url)) {
    errors.push(`${path}: url is not a valid URL.`);
  }
}

function validateRequiredFields(
  artifact: VoiceOfCustomerArtifact,
  errors: string[],
): void {
  pushMissingText(errors, 'sectionTitle', artifact.sectionTitle);
  pushMissingText(errors, 'verdict', artifact.verdict);
  pushMissingText(errors, 'statusSummary', artifact.statusSummary);
  if (typeof artifact.confidence !== 'number' || Number.isNaN(artifact.confidence)) {
    errors.push('confidence: required numeric field missing.');
  }

  pushMissingText(errors, 'painLanguage.prose', artifact.painLanguage.prose);
  pushMissingText(errors, 'objections.prose', artifact.objections.prose);
  pushMissingText(errors, 'switchingStories.prose', artifact.switchingStories.prose);
  pushMissingText(errors, 'decisionCriteria.prose', artifact.decisionCriteria.prose);
  pushMissingText(errors, 'successLanguage.prose', artifact.successLanguage.prose);

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    if (hasText(source.url)) {
      validateUrl(errors, `sources[${index}] (${source.title})`, source.url);
    }
  });

  artifact.painLanguage.quotes.forEach((quote, index) => {
    pushMissingText(errors, `painLanguage.quotes[${index}].verbatimText`, quote.verbatimText);
    pushMissingText(errors, `painLanguage.quotes[${index}].sourceUrl`, quote.sourceUrl);
    pushMissingText(errors, `painLanguage.quotes[${index}].painTheme`, quote.painTheme);
    if (hasText(quote.sourceUrl)) {
      validateUrl(errors, `painLanguage.quotes[${index}].sourceUrl`, quote.sourceUrl);
    }
  });

  artifact.objections.items.forEach((item, index) => {
    pushMissingText(errors, `objections.items[${index}].objectionText`, item.objectionText);
    pushMissingText(errors, `objections.items[${index}].howToHandle`, item.howToHandle);
    pushMissingText(errors, `objections.items[${index}].sourceUrl`, item.sourceUrl);
    if (hasText(item.sourceUrl)) {
      validateUrl(errors, `objections.items[${index}].sourceUrl`, item.sourceUrl);
    }
  });

  artifact.switchingStories.stories.forEach((story, index) => {
    pushMissingText(
      errors,
      `switchingStories.stories[${index}].priorSolution`,
      story.priorSolution,
    );
    pushMissingText(
      errors,
      `switchingStories.stories[${index}].reasonToLeave`,
      story.reasonToLeave,
    );
    pushMissingText(
      errors,
      `switchingStories.stories[${index}].decisionPath`,
      story.decisionPath,
    );
    pushMissingText(errors, `switchingStories.stories[${index}].sourceUrl`, story.sourceUrl);
    if (hasText(story.sourceUrl)) {
      validateUrl(errors, `switchingStories.stories[${index}].sourceUrl`, story.sourceUrl);
    }
  });

  artifact.decisionCriteria.criteria.forEach((criterion, index) => {
    pushMissingText(
      errors,
      `decisionCriteria.criteria[${index}].criterion`,
      criterion.criterion,
    );
    pushMissingText(
      errors,
      `decisionCriteria.criteria[${index}].evidenceQuote`,
      criterion.evidenceQuote,
    );
    pushMissingText(
      errors,
      `decisionCriteria.criteria[${index}].sourceUrl`,
      criterion.sourceUrl,
    );
    if (hasText(criterion.sourceUrl)) {
      validateUrl(errors, `decisionCriteria.criteria[${index}].sourceUrl`, criterion.sourceUrl);
    }
  });

  artifact.successLanguage.quotes.forEach((quote, index) => {
    pushMissingText(
      errors,
      `successLanguage.quotes[${index}].verbatimText`,
      quote.verbatimText,
    );
    pushMissingText(errors, `successLanguage.quotes[${index}].sourceUrl`, quote.sourceUrl);
    pushMissingText(
      errors,
      `successLanguage.quotes[${index}].afterStatePattern`,
      quote.afterStatePattern,
    );
    if (hasText(quote.sourceUrl)) {
      validateUrl(errors, `successLanguage.quotes[${index}].sourceUrl`, quote.sourceUrl);
    }
  });
}

export function validateVoiceOfCustomerMinimums(
  artifact: VoiceOfCustomerArtifact,
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

  const painQuoteCount = artifact.painLanguage.quotes.length;
  if (painQuoteCount < 10) {
    errors.push(
      `painLanguage.quotes: have ${painQuoteCount}, need >=10 verbatim pain quotes.`,
    );
  }
  const painSourceCount = uniqueCount(
    artifact.painLanguage.quotes.map((quote) =>
      getSourceKey(quote.sourceUrl, quote.source),
    ),
  );
  if (painSourceCount < 3) {
    errors.push(
      `painLanguage.quotes: need >=3 sources, have ${painSourceCount}.`,
    );
  }

  const objectionCount = artifact.objections.items.length;
  if (objectionCount < 5) {
    errors.push(`objections.items: have ${objectionCount}, need >=5 objections.`);
  }
  const objectionCategoryCount = uniqueCount(
    artifact.objections.items.map((item) => item.category),
  );
  if (objectionCategoryCount < 3) {
    errors.push(
      `objections.items: need objections across >=3 categories, have ${objectionCategoryCount}.`,
    );
  }

  const switchingStoryCount = artifact.switchingStories.stories.length;
  if (switchingStoryCount < 3) {
    errors.push(
      `switchingStories.stories: have ${switchingStoryCount}, need >=3 switching stories.`,
    );
  }
  const priorSolutionCount = uniqueCount(
    artifact.switchingStories.stories.map((story) => story.priorSolution),
  );
  if (priorSolutionCount < 2) {
    errors.push(
      `switchingStories.stories: need >=2 prior solutions, have ${priorSolutionCount}.`,
    );
  }

  const decisionCriteriaCount = artifact.decisionCriteria.criteria.length;
  if (decisionCriteriaCount < 5) {
    errors.push(
      `decisionCriteria.criteria: have ${decisionCriteriaCount}, need >=5 criteria.`,
    );
  }

  const successQuoteCount = artifact.successLanguage.quotes.length;
  if (successQuoteCount < 5) {
    errors.push(
      `successLanguage.quotes: have ${successQuoteCount}, need >=5 success-state quotes.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
