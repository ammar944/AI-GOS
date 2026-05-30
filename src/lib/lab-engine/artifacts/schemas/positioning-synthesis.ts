import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";

const sourceSectionValues = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "gtmBrief",
] as const;

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
  })
  .strict();

const sourcedItemSchema = z
  .object({
    sourceSection: z.enum(sourceSectionValues),
    sourceUrl: z.string().url(),
  })
  .strict();

// A single divergent positioning option. `angle` is the one-line positioning
// statement the option leads with; the recommended move points at exactly one
// of these angles (see validator IRON LAW).
const positioningOptionSchema = sourcedItemSchema
  .extend({
    optionName: z.string().min(1),
    angle: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

const messagingDirectionSchema = sourcedItemSchema
  .extend({
    direction: z.string().min(1),
    copyPoint: z.string().min(1),
  })
  .strict();

const recommendedMoveSchema = z
  .object({
    // Must equal one of positioningOptions.options[].angle — enforced in the
    // validator, not the schema, so the model is not over-constrained.
    optionAngle: z.string().min(1),
    rationale: z.string().min(1),
    nextSteps: z.string().min(1),
  })
  .strict();

export const positioningSynthesisBodySchema = z
  .object({
    situationThesis: z
      .object({ prose: z.string().min(1) })
      .strict(),
    positioningOptions: z
      .object({
        prose: z.string().min(1),
        options: z.array(positioningOptionSchema),
      })
      .strict(),
    recommendedMove: recommendedMoveSchema,
    messagingDirections: z
      .object({
        prose: z.string().min(1),
        directions: z.array(messagingDirectionSchema),
      })
      .strict(),
  })
  .strict();

export const positioningSynthesisSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: positioningSynthesisBodySchema,
  })
  .strict();

export type PositioningSynthesisBody = z.infer<
  typeof positioningSynthesisBodySchema
>;
export type PositioningSynthesisSectionOutput = z.infer<
  typeof positioningSynthesisSectionOutputSchema
>;
export type PositioningSynthesisArtifact = ArtifactEnvelope & {
  body: PositioningSynthesisBody;
};

function countNonGtmGrounded<T extends { sourceSection: string }>(
  items: readonly T[],
): number {
  return items.filter((item) => item.sourceSection !== "gtmBrief").length;
}

export function validatePositioningSynthesisMinimums(
  artifact: ArtifactEnvelope & { body: PositioningSynthesisBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: positioningSynthesisBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  if (parsedArtifact.sources.length < 5) {
    errors.push(`sources: have ${parsedArtifact.sources.length}, need >=5.`);
  }

  const optionCount = parsedArtifact.body.positioningOptions.options.length;
  if (![2, 3].includes(optionCount)) {
    errors.push(
      `body.positioningOptions.options: have ${optionCount}, need 2 or 3 divergent options.`,
    );
  }

  if (parsedArtifact.body.messagingDirections.directions.length < 2) {
    errors.push("body.messagingDirections.directions: need >=2.");
  }

  // IRON LAW: the recommended move must point at one of the candidate angles.
  const optionAngles = parsedArtifact.body.positioningOptions.options.map(
    (option) => option.angle,
  );
  if (!optionAngles.includes(parsedArtifact.body.recommendedMove.optionAngle)) {
    errors.push(
      "body.recommendedMove.optionAngle: must match one of body.positioningOptions.options[].angle.",
    );
  }

  // IRON LAW: synthesis must lean on the six positioning sections, not just the
  // frozen GTM brief. Require >=2 section-grounded (non-gtmBrief) synthesized
  // items across options + messaging directions.
  const synthesizedGroundingCount =
    countNonGtmGrounded(parsedArtifact.body.positioningOptions.options) +
    countNonGtmGrounded(parsedArtifact.body.messagingDirections.directions);
  if (synthesizedGroundingCount < 2) {
    errors.push(
      "synthesized items: need >=2 section-grounded (non-gtmBrief) sourceSection values.",
    );
  }

  return { ok: errors.length === 0, errors };
}
