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
 * Next.js-side mirror of the worker VoiceOfCustomerArtifactSchema. Source of
 * truth lives in
 * research-worker/src/agents/subagents/schemas/voc-objection-evidence.ts.
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

export const PainQuoteSchema = z.object({
  verbatimText: z.string(),
  source: z.enum(VOC_SOURCE_TYPES),
  sourceUrl: z.string(),
  painTheme: z.string(),
  painIntensity: z.enum(PAIN_INTENSITIES),
});

export const ObjectionSchema = z.object({
  objectionText: z.string(),
  category: z.enum(OBJECTION_CATEGORIES),
  frequency: z.enum(FREQUENCIES),
  howToHandle: z.string(),
  sourceUrl: z.string(),
});

export const SwitchingStorySchema = z.object({
  priorSolution: z.string(),
  reasonToLeave: z.string(),
  decisionPath: z.string(),
  exampleCompany: z.string().optional(),
  sourceUrl: z.string(),
});

export const DecisionCriterionSchema = z.object({
  criterion: z.string(),
  statedBy: z.enum(DECISION_ROLES),
  evidenceQuote: z.string(),
  sourceUrl: z.string(),
});

export const SuccessQuoteSchema = z.object({
  verbatimText: z.string(),
  source: z.enum(VOC_SOURCE_TYPES),
  sourceUrl: z.string(),
  afterStatePattern: z.string(),
});

export const PainLanguageSchema = z.object({
  prose: z.string(),
  quotes: PainQuoteSchema.array(),
});

export const ObjectionsSchema = z.object({
  prose: z.string(),
  items: ObjectionSchema.array(),
});

export const SwitchingStoriesSchema = z.object({
  prose: z.string(),
  stories: SwitchingStorySchema.array(),
});

export const DecisionCriteriaSchema = z.object({
  prose: z.string(),
  criteria: DecisionCriterionSchema.array(),
});

export const SuccessLanguageSchema = z.object({
  prose: z.string(),
  quotes: SuccessQuoteSchema.array(),
});

export const VoiceOfCustomerArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    painLanguage: PainLanguageSchema,
    objections: ObjectionsSchema,
    switchingStories: SwitchingStoriesSchema,
    decisionCriteria: DecisionCriteriaSchema,
    successLanguage: SuccessLanguageSchema,
  })
  .describe('Complete Section 04 Voice of Customer & Objection Evidence Artifact.');

export type VoiceOfCustomerArtifact = z.infer<typeof VoiceOfCustomerArtifactSchema>;

function getSourceKey(sourceUrl: string, fallback: string): string {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return fallback;
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

  artifact.decisionCriteria.criteria.forEach((c, index) => {
    pushMissingText(errors, `decisionCriteria.criteria[${index}].criterion`, c.criterion);
    pushMissingText(errors, `decisionCriteria.criteria[${index}].evidenceQuote`, c.evidenceQuote);
    pushMissingText(errors, `decisionCriteria.criteria[${index}].sourceUrl`, c.sourceUrl);
    if (hasText(c.sourceUrl)) {
      validateUrl(errors, `decisionCriteria.criteria[${index}].sourceUrl`, c.sourceUrl);
    }
  });

  artifact.successLanguage.quotes.forEach((quote, index) => {
    pushMissingText(errors, `successLanguage.quotes[${index}].verbatimText`, quote.verbatimText);
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

  if (artifact.sources.length < 5) {
    errors.push(`sources: have ${artifact.sources.length}, need >=5 Section-level sources.`);
  }

  if (artifact.painLanguage.quotes.length < 10) {
    errors.push(
      `painLanguage.quotes: have ${artifact.painLanguage.quotes.length}, need >=10 verbatim pain quotes.`,
    );
  }
  const painSourceCount = uniqueCount(
    artifact.painLanguage.quotes.map((q) => getSourceKey(q.sourceUrl, q.source)),
  );
  if (painSourceCount < 3) {
    errors.push(`painLanguage.quotes: need >=3 sources, have ${painSourceCount}.`);
  }

  if (artifact.objections.items.length < 5) {
    errors.push(
      `objections.items: have ${artifact.objections.items.length}, need >=5 objections.`,
    );
  }
  const objectionCategoryCount = uniqueCount(
    artifact.objections.items.map((i) => i.category),
  );
  if (objectionCategoryCount < 3) {
    errors.push(
      `objections.items: need objections across >=3 categories, have ${objectionCategoryCount}.`,
    );
  }

  if (artifact.switchingStories.stories.length < 3) {
    errors.push(
      `switchingStories.stories: have ${artifact.switchingStories.stories.length}, need >=3 switching stories.`,
    );
  }
  const priorSolutionCount = uniqueCount(
    artifact.switchingStories.stories.map((s) => s.priorSolution),
  );
  if (priorSolutionCount < 2) {
    errors.push(
      `switchingStories.stories: need >=2 prior solutions, have ${priorSolutionCount}.`,
    );
  }

  if (artifact.decisionCriteria.criteria.length < 5) {
    errors.push(
      `decisionCriteria.criteria: have ${artifact.decisionCriteria.criteria.length}, need >=5 criteria.`,
    );
  }

  if (artifact.successLanguage.quotes.length < 5) {
    errors.push(
      `successLanguage.quotes: have ${artifact.successLanguage.quotes.length}, need >=5 success-state quotes.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
