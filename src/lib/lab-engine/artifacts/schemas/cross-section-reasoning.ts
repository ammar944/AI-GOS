import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import { validateStrategicText } from "./strategic-insight";

export const crossSectionSourceSectionValues = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
] as const;

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
  })
  .strict();

const crossSectionSourceSectionSchema = z.enum(
  crossSectionSourceSectionValues,
);

const sourceSectionRefSchema = z
  .object({
    sectionId: crossSectionSourceSectionSchema,
    sourceUrl: z.string().url(),
    sourceTitle: z.string().min(1).optional(),
  })
  .strict();

const crossSectionThreadSchema = z
  .object({
    claim: z.string().min(1),
    sourceSections: z.array(sourceSectionRefSchema),
    whyNonObvious: z.string().min(1),
  })
  .strict();

const groundedStrategicClaimSchema = z
  .object({
    claim: z.string().min(1),
    sourceSections: z.array(sourceSectionRefSchema),
    whyItMatters: z.string().min(1),
  })
  .strict();

const namedTensionSchema = z
  .object({
    tension: z.string().min(1),
    side: z.string().min(1),
    costAccepted: z.string().min(1),
    sourceSections: z.array(sourceSectionRefSchema),
  })
  .strict();

export const crossSectionReasoningBodySchema = z
  .object({
    crossSectionThreads: z.array(crossSectionThreadSchema),
    clientBlindSpot: groundedStrategicClaimSchema,
    namedTension: namedTensionSchema,
    secondOrderRisk: groundedStrategicClaimSchema,
    contrarianInversion: groundedStrategicClaimSchema,
    belowFloor: z.boolean().optional(),
  })
  .strict();

export const crossSectionReasoningSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number(),
    sources: z.array(modelSourceSchema).min(1),
    body: crossSectionReasoningBodySchema,
  })
  .strict();

export type CrossSectionReasoningBody = z.infer<
  typeof crossSectionReasoningBodySchema
>;
export type CrossSectionReasoningSectionOutput = z.infer<
  typeof crossSectionReasoningSectionOutputSchema
>;
export type CrossSectionReasoningArtifact = ArtifactEnvelope & {
  body: CrossSectionReasoningBody;
};

function distinctSectionCount(
  refs: readonly z.infer<typeof sourceSectionRefSchema>[],
): number {
  return new Set(refs.map((ref) => ref.sectionId)).size;
}

function collectReferencedSections(
  body: CrossSectionReasoningBody,
): ReadonlySet<string> {
  return new Set([
    ...body.crossSectionThreads.flatMap((thread) =>
      thread.sourceSections.map((ref) => ref.sectionId),
    ),
    ...body.clientBlindSpot.sourceSections.map((ref) => ref.sectionId),
    ...body.namedTension.sourceSections.map((ref) => ref.sectionId),
    ...body.secondOrderRisk.sourceSections.map((ref) => ref.sectionId),
    ...body.contrarianInversion.sourceSections.map((ref) => ref.sectionId),
  ]);
}

function validateSourceSectionRefs(
  errors: string[],
  path: string,
  refs: readonly z.infer<typeof sourceSectionRefSchema>[],
): void {
  if (distinctSectionCount(refs) < 2) {
    errors.push(`${path}: need >=2 distinct committed section refs.`);
  }
}

function validateGroundedClaim(
  errors: string[],
  path: string,
  claim: z.infer<typeof groundedStrategicClaimSchema>,
): void {
  validateStrategicText(errors, `${path}.claim`, claim.claim);
  validateStrategicText(
    errors,
    `${path}.whyItMatters`,
    claim.whyItMatters,
  );
  validateSourceSectionRefs(errors, `${path}.sourceSections`, claim.sourceSections);
}

export function validateCrossSectionReasoningMinimums(
  artifact: ArtifactEnvelope & { body: CrossSectionReasoningBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: crossSectionReasoningBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  if (parsedArtifact.sources.length < 5) {
    errors.push(`sources: have ${parsedArtifact.sources.length}, need >=5.`);
  }

  if (parsedArtifact.confidence < 0 || parsedArtifact.confidence > 1) {
    errors.push("confidence: must be between 0 and 1.");
  }

  if (parsedArtifact.body.crossSectionThreads.length < 1) {
    errors.push("body.crossSectionThreads: need >=1 cross-section thread.");
  }

  if (parsedArtifact.body.crossSectionThreads.length > 6) {
    errors.push("body.crossSectionThreads: need <=6 focused threads.");
  }

  parsedArtifact.body.crossSectionThreads.forEach((thread, index) => {
    const path = `body.crossSectionThreads[${index}]`;

    validateStrategicText(errors, `${path}.claim`, thread.claim);
    validateStrategicText(
      errors,
      `${path}.whyNonObvious`,
      thread.whyNonObvious,
    );
    validateSourceSectionRefs(
      errors,
      `${path}.sourceSections`,
      thread.sourceSections,
    );
  });

  validateGroundedClaim(
    errors,
    "body.clientBlindSpot",
    parsedArtifact.body.clientBlindSpot,
  );
  validateStrategicText(
    errors,
    "body.namedTension.tension",
    parsedArtifact.body.namedTension.tension,
  );
  validateStrategicText(
    errors,
    "body.namedTension.side",
    parsedArtifact.body.namedTension.side,
  );
  validateStrategicText(
    errors,
    "body.namedTension.costAccepted",
    parsedArtifact.body.namedTension.costAccepted,
  );
  validateSourceSectionRefs(
    errors,
    "body.namedTension.sourceSections",
    parsedArtifact.body.namedTension.sourceSections,
  );
  validateGroundedClaim(
    errors,
    "body.secondOrderRisk",
    parsedArtifact.body.secondOrderRisk,
  );
  validateGroundedClaim(
    errors,
    "body.contrarianInversion",
    parsedArtifact.body.contrarianInversion,
  );

  if (collectReferencedSections(parsedArtifact.body).size < 4) {
    errors.push(
      "body: cross-section reasoning must cover at least four of the six committed sections.",
    );
  }

  return { ok: errors.length === 0, errors };
}
