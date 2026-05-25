import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";

const personaRoles = [
  "champion",
  "economic-buyer",
  "decision-maker",
  "influencer",
  "end-user",
  "gatekeeper",
] as const;
const cutTypes = [
  "industry",
  "employeeBands",
  "revenueBands",
  "geography",
  "techStack",
] as const;
const awarenessLevels = [
  "unaware",
  "problem-aware",
  "solution-aware",
  "product-aware",
  "most-aware",
] as const;
const triggerWindows = ["immediate", "weeks", "quarters"] as const;
const clusterBuckets = [
  "community",
  "newsletter",
  "conference",
  "podcast",
  "slack-group",
  "event",
] as const;
const validUrlPattern = /^https?:\/\/\S+\.\S+/;

const firmographicCutSchema = z
  .object({
    cutType: z.enum(cutTypes),
    value: z.string().min(1),
    accountCount: z.string().min(1).optional(),
    source: z.string().min(1),
    sourceUrl: z.string().min(1),
    dateObserved: z.string().min(1),
  })
  .strict();

const personaSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().min(1),
    company: z.string().min(1),
    sourceUrl: z.string().min(1),
    role: z.enum(personaRoles),
    seniority: z.string().min(1),
    teamSize: z.string().min(1).optional(),
    evidence: z.string().min(1),
  })
  .strict();

const awarenessLevelSchema = z
  .object({
    level: z.enum(awarenessLevels),
    share: z.string().min(1),
    evidence: z.string().min(1),
    sampleQuery: z.string().min(1).optional(),
  })
  .strict();

const triggerSchema = z
  .object({
    name: z.string().min(1),
    detectionSignal: z.string().min(1),
    window: z.enum(triggerWindows),
    evidence: z.string().min(1),
    sourceUrl: z.string().min(1).optional(),
  })
  .strict();

const clusterVenueSchema = z
  .object({
    bucketType: z.enum(clusterBuckets),
    name: z.string().min(1),
    audienceSize: z.string().min(1),
    sourceUrl: z.string().min(1),
    whyItMatters: z.string().min(1),
  })
  .strict();

export const buyerICPBodySchema = z
  .object({
    icpExistenceCheck: z
      .object({
        prose: z.string().min(1),
        firmographicCuts: z.array(firmographicCutSchema),
      })
      .strict(),
    personaReality: z
      .object({
        prose: z.string().min(1),
        personas: z.array(personaSchema),
      })
      .strict(),
    awarenessDistribution: z
      .object({
        prose: z.string().min(1),
        levels: z.array(awarenessLevelSchema),
      })
      .strict(),
    buyingContext: z
      .object({
        prose: z.string().min(1),
        triggers: z.array(triggerSchema),
      })
      .strict(),
    clusters: z
      .object({
        prose: z.string().min(1),
        venues: z.array(clusterVenueSchema),
      })
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

export const buyerICPSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: buyerICPBodySchema,
  })
  .strict();

export type BuyerICPBody = z.infer<typeof buyerICPBodySchema>;
export type BuyerICPSectionOutput = z.infer<
  typeof buyerICPSectionOutputSchema
>;
export type BuyerICPArtifact = ArtifactEnvelope & { body: BuyerICPBody };

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return Array.from(duplicates);
}

export function validateBuyerICPMinimums(
  artifact: ArtifactEnvelope & { body: BuyerICPBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: buyerICPBodySchema })
    .parse(artifact);
  const errors: string[] = [];
  const personas = parsedArtifact.body.personaReality.personas;

  if (personas.length < 5) {
    errors.push(`body.personaReality.personas: have ${personas.length}, need >=5.`);
  }

  personas.forEach((persona, index) => {
    if (!validUrlPattern.test(persona.sourceUrl)) {
      errors.push(
        `body.personaReality.personas[${index}].sourceUrl: url is not a valid URL.`,
      );
    }
  });

  const firmographicCuts =
    parsedArtifact.body.icpExistenceCheck.firmographicCuts;
  if (firmographicCuts.length < 3) {
    errors.push(
      `body.icpExistenceCheck.firmographicCuts: have ${firmographicCuts.length}, need >=3.`,
    );
  }

  const cutTypeValues = firmographicCuts.map((cut) => cut.cutType);
  for (const duplicate of findDuplicates(cutTypeValues)) {
    errors.push(
      `body.icpExistenceCheck.firmographicCuts: duplicate cutType ${duplicate}.`,
    );
  }
  if (uniqueCount(cutTypeValues) < 3) {
    errors.push(
      `body.icpExistenceCheck.firmographicCuts: need >=3 distinct cutType values.`,
    );
  }

  const observedAwarenessLevels =
    parsedArtifact.body.awarenessDistribution.levels.map((level) => level.level);
  const missingAwarenessLevels = awarenessLevels.filter(
    (level) => !observedAwarenessLevels.includes(level),
  );
  if (missingAwarenessLevels.length > 0) {
    errors.push(
      `body.awarenessDistribution.levels: missing levels ${missingAwarenessLevels.join(", ")}.`,
    );
  }
  for (const duplicate of findDuplicates(observedAwarenessLevels)) {
    errors.push(
      `body.awarenessDistribution.levels: duplicate level ${duplicate}.`,
    );
  }

  const triggerCount = parsedArtifact.body.buyingContext.triggers.length;
  if (triggerCount < 3) {
    errors.push(`body.buyingContext.triggers: have ${triggerCount}, need >=3.`);
  }

  const venues = parsedArtifact.body.clusters.venues;
  const communityCount = venues.filter(
    (venue) => venue.bucketType === "community",
  ).length;
  const newsletterCount = venues.filter(
    (venue) => venue.bucketType === "newsletter",
  ).length;

  if (communityCount < 2) {
    errors.push(
      `body.clusters.venues: have ${communityCount} community venues, need >=2.`,
    );
  }
  if (newsletterCount < 2) {
    errors.push(
      `body.clusters.venues: have ${newsletterCount} newsletter venues, need >=2.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
