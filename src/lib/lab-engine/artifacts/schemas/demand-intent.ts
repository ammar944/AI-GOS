import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";

const intentTypes = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
] as const;
const questionSurfaces = [
  "paa",
  "reddit",
  "quora",
  "community",
  "forum",
  "support-thread",
] as const;
const frequencies = ["recurring", "occasional"] as const;
const signalTypes = [
  "job-posting",
  "rfp",
  "news-trigger",
  "funding",
  "leadership-change",
] as const;
const venueTypes = ["event", "community", "newsletter", "podcast", "slack"] as const;

const keywordSignalSchema = z
  .object({
    keyword: z.string().min(1),
    monthlyVolume: z.string().min(1),
    intentType: z.enum(intentTypes),
    top3RankingDomains: z.array(z.string().min(1)),
    sourceTitle: z.string().min(1),
    sourceUrl: z.string().min(1),
    dateObserved: z.string().min(1),
  })
  .strict();

const buyerQuestionSchema = z
  .object({
    question: z.string().min(1),
    surface: z.enum(questionSurfaces),
    sourceUrl: z.string().min(1),
    frequency: z.enum(frequencies),
  })
  .strict();

const contentGapSchema = z
  .object({
    topic: z.string().min(1),
    evidenceOfDemand: z.string().min(1),
    weakCompetitorAnswerEvidence: z.string().min(1),
    opportunity: z.string().min(1),
  })
  .strict();

const intentSignalSchema = z
  .object({
    signalType: z.enum(signalTypes),
    description: z.string().min(1),
    sourceUrl: z.string().min(1),
    exampleCompany: z.string().min(1).optional(),
  })
  .strict();

const demandVenueSchema = z
  .object({
    name: z.string().min(1),
    venueType: z.enum(venueTypes),
    audienceSize: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

export const demandIntentBodySchema = z
  .object({
    keywordDemand: z
      .object({ prose: z.string().min(1), keywords: z.array(keywordSignalSchema) })
      .strict(),
    questionMining: z
      .object({ prose: z.string().min(1), questions: z.array(buyerQuestionSchema) })
      .strict(),
    contentGaps: z
      .object({ prose: z.string().min(1), gaps: z.array(contentGapSchema) })
      .strict(),
    intentSignals: z
      .object({ prose: z.string().min(1), items: z.array(intentSignalSchema) })
      .strict(),
    venueMap: z
      .object({ prose: z.string().min(1), venues: z.array(demandVenueSchema) })
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

export const demandIntentSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: demandIntentBodySchema,
  })
  .strict();

export type DemandIntentBody = z.infer<typeof demandIntentBodySchema>;
export type DemandIntentSectionOutput = z.infer<
  typeof demandIntentSectionOutputSchema
>;
export type DemandIntentArtifact = ArtifactEnvelope & {
  body: DemandIntentBody;
};

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

export function validateDemandIntentMinimums(
  artifact: ArtifactEnvelope & { body: DemandIntentBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: demandIntentBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  if (parsedArtifact.sources.length < 5) {
    errors.push(`sources: have ${parsedArtifact.sources.length}, need >=5.`);
  }

  const keywordCount = parsedArtifact.body.keywordDemand.keywords.length;
  if (keywordCount < 10) {
    errors.push(`body.keywordDemand.keywords: have ${keywordCount}, need >=10.`);
  }

  const questions = parsedArtifact.body.questionMining.questions;
  if (questions.length < 10) {
    errors.push(`body.questionMining.questions: have ${questions.length}, need >=10.`);
  }
  const questionSurfaceCount = uniqueCount(
    questions.map((question) => question.surface),
  );
  if (questionSurfaceCount < 2) {
    errors.push(
      `body.questionMining.questions: need >=2 surface types, have ${questionSurfaceCount}.`,
    );
  }

  const gapCount = parsedArtifact.body.contentGaps.gaps.length;
  if (gapCount < 3) {
    errors.push(`body.contentGaps.gaps: have ${gapCount}, need >=3.`);
  }

  const intentSignals = parsedArtifact.body.intentSignals.items;
  if (intentSignals.length < 5) {
    errors.push(`body.intentSignals.items: have ${intentSignals.length}, need >=5.`);
  }
  const signalTypeCount = uniqueCount(
    intentSignals.map((signal) => signal.signalType),
  );
  if (signalTypeCount < 2) {
    errors.push(
      `body.intentSignals.items: need >=2 signalTypes, have ${signalTypeCount}.`,
    );
  }

  const venues = parsedArtifact.body.venueMap.venues;
  if (venues.length < 4) {
    errors.push(`body.venueMap.venues: have ${venues.length}, need >=4.`);
  }
  const venueTypeCount = uniqueCount(venues.map((venue) => venue.venueType));
  if (venueTypeCount < 2) {
    errors.push(
      `body.venueMap.venues: need >=2 venueTypes, have ${venueTypeCount}.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
