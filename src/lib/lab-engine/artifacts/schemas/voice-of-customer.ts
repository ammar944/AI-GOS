import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";

const vocSourceTypes = [
  "g2",
  "reddit",
  "hackernews",
  "sales-call",
  "support-thread",
  "twitter",
  "other",
] as const;
const painIntensities = ["high", "medium", "low"] as const;
const objectionCategories = [
  "price",
  "feature",
  "trust",
  "switching-cost",
  "timing",
  "stakeholder",
  "other",
] as const;
const frequencies = ["recurring", "occasional", "one-off"] as const;
const decisionRoles = ["buyer", "champion", "influencer", "blocker"] as const;

const painQuoteSchema = z
  .object({
    verbatimText: z.string().min(1),
    source: z.enum(vocSourceTypes),
    sourceUrl: z.string().min(1),
    painTheme: z.string().min(1),
    painIntensity: z.enum(painIntensities),
  })
  .strict();

const objectionSchema = z
  .object({
    objectionText: z.string().min(1),
    category: z.enum(objectionCategories),
    frequency: z.enum(frequencies),
    howToHandle: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const switchingStorySchema = z
  .object({
    priorSolution: z.string().min(1),
    reasonToLeave: z.string().min(1),
    decisionPath: z.string().min(1),
    exampleCompany: z.string().min(1).optional(),
    sourceUrl: z.string().min(1),
  })
  .strict();

const decisionCriterionSchema = z
  .object({
    criterion: z.string().min(1),
    statedBy: z.enum(decisionRoles),
    evidenceQuote: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const successQuoteSchema = z
  .object({
    verbatimText: z.string().min(1),
    source: z.enum(vocSourceTypes),
    sourceUrl: z.string().min(1),
    afterStatePattern: z.string().min(1),
  })
  .strict();

export const voiceOfCustomerBodySchema = z
  .object({
    painLanguage: z
      .object({ prose: z.string().min(1), quotes: z.array(painQuoteSchema) })
      .strict(),
    objections: z
      .object({ prose: z.string().min(1), items: z.array(objectionSchema) })
      .strict(),
    switchingStories: z
      .object({
        prose: z.string().min(1),
        stories: z.array(switchingStorySchema),
      })
      .strict(),
    decisionCriteria: z
      .object({
        prose: z.string().min(1),
        criteria: z.array(decisionCriterionSchema),
      })
      .strict(),
    successLanguage: z
      .object({ prose: z.string().min(1), quotes: z.array(successQuoteSchema) })
      .strict(),
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
  })
  .strict();

export const voiceOfCustomerSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: voiceOfCustomerBodySchema,
  })
  .strict();

export type VoiceOfCustomerBody = z.infer<typeof voiceOfCustomerBodySchema>;
export type VoiceOfCustomerSectionOutput = z.infer<
  typeof voiceOfCustomerSectionOutputSchema
>;
export type VoiceOfCustomerArtifact = ArtifactEnvelope & {
  body: VoiceOfCustomerBody;
};

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function getSourceKey(sourceUrl: string, fallback: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

export function validateVoiceOfCustomerMinimums(
  artifact: ArtifactEnvelope & { body: VoiceOfCustomerBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: voiceOfCustomerBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  if (parsedArtifact.sources.length < 5) {
    errors.push(`sources: have ${parsedArtifact.sources.length}, need >=5.`);
  }

  const painQuotes = parsedArtifact.body.painLanguage.quotes;
  if (painQuotes.length < 10) {
    errors.push(
      `body.painLanguage.quotes: have ${painQuotes.length}, need >=10.`,
    );
  }
  const painSourceCount = uniqueCount(
    painQuotes.map((quote) => getSourceKey(quote.sourceUrl, quote.source)),
  );
  if (painSourceCount < 3) {
    errors.push(
      `body.painLanguage.quotes: need >=3 distinct sources, have ${painSourceCount}.`,
    );
  }

  const objections = parsedArtifact.body.objections.items;
  if (objections.length < 5) {
    errors.push(`body.objections.items: have ${objections.length}, need >=5.`);
  }
  const categoryCount = uniqueCount(
    objections.map((objection) => objection.category),
  );
  if (categoryCount < 3) {
    errors.push(
      `body.objections.items: need >=3 objection categories, have ${categoryCount}.`,
    );
  }

  const stories = parsedArtifact.body.switchingStories.stories;
  if (stories.length < 3) {
    errors.push(
      `body.switchingStories.stories: have ${stories.length}, need >=3.`,
    );
  }
  const priorSolutionCount = uniqueCount(
    stories.map((story) => story.priorSolution),
  );
  if (priorSolutionCount < 2) {
    errors.push(
      `body.switchingStories.stories: need >=2 prior solutions, have ${priorSolutionCount}.`,
    );
  }

  const criteriaCount = parsedArtifact.body.decisionCriteria.criteria.length;
  if (criteriaCount < 5) {
    errors.push(
      `body.decisionCriteria.criteria: have ${criteriaCount}, need >=5.`,
    );
  }

  const successCount = parsedArtifact.body.successLanguage.quotes.length;
  if (successCount < 5) {
    errors.push(
      `body.successLanguage.quotes: have ${successCount}, need >=5.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
