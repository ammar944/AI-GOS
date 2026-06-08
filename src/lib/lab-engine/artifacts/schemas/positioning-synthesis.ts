import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
  validateProvesWrongIfMinimums,
  validateStrategicText,
} from "./strategic-insight";

const sourceSectionValues = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "positioningCrossSectionReasoning",
  "gtmBrief",
] as const;

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
  })
  .strict();

const sourcedItemSchema = z
  .object({
    sourceSection: z.enum(sourceSectionValues),
    sourceUrl: z.string().url(),
  })
  .strict();

const sourceRefsSchema = z.array(sourcedItemSchema).min(2);

const strategicThesisSchema = z
  .object({
    thesis: z.string().min(1),
    segment: z.string().min(1),
    awareness: z.string().min(1),
    force: z.string().min(1),
    defensibleDifferentiator: z.string().min(1),
    sourceSections: sourceRefsSchema,
  })
  .strict();

const contradictionReconciliationSchema = z
  .object({
    contradiction: z.string().min(1),
    resolution: z.string().min(1),
    tradeOffAccepted: z.string().min(1),
    sourceSections: sourceRefsSchema,
  })
  .strict();

const provesWrongIfSchema = z
  .object({
    metric: z.string().min(1),
    threshold: z.string().min(1),
    window: z.string().min(1),
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

const orderedMoveSchema = sourcedItemSchema
  .extend({
    rank: z.number(),
    move: z.string().min(1),
    dependsOn: z.array(z.number()),
    learningPriority: z.string().min(1),
    rationale: z.string().min(1),
    thesisTrace: z.string().min(1),
    provesWrongIf: provesWrongIfSchema,
  })
  .strict();

export const positioningSynthesisBodySchema = z
  .object({
    strategicThesis: strategicThesisSchema,
    contradictionReconciliation: contradictionReconciliationSchema,
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
    orderedMoves: z
      .object({
        prose: z.string().min(1),
        moves: z.array(orderedMoveSchema),
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

function validateSourceRefs(
  errors: string[],
  path: string,
  refs: readonly { sourceSection: string }[],
): void {
  const distinctNonGtmSections = new Set(
    refs
      .filter((ref) => ref.sourceSection !== "gtmBrief")
      .map((ref) => ref.sourceSection),
  );
  if (distinctNonGtmSections.size < 2) {
    errors.push(`${path}: need >=2 distinct non-gtmBrief source refs.`);
  }
}

function validateThesis(errors: string[], body: PositioningSynthesisBody): void {
  validateStrategicText(errors, "body.strategicThesis.thesis", body.strategicThesis.thesis);
  validateStrategicText(errors, "body.strategicThesis.force", body.strategicThesis.force);
  validateStrategicText(
    errors,
    "body.strategicThesis.defensibleDifferentiator",
    body.strategicThesis.defensibleDifferentiator,
  );
  validateSourceRefs(
    errors,
    "body.strategicThesis.sourceSections",
    body.strategicThesis.sourceSections,
  );
  validateStrategicText(
    errors,
    "body.contradictionReconciliation.contradiction",
    body.contradictionReconciliation.contradiction,
  );
  validateStrategicText(
    errors,
    "body.contradictionReconciliation.resolution",
    body.contradictionReconciliation.resolution,
  );
  validateStrategicText(
    errors,
    "body.contradictionReconciliation.tradeOffAccepted",
    body.contradictionReconciliation.tradeOffAccepted,
  );
  validateSourceRefs(
    errors,
    "body.contradictionReconciliation.sourceSections",
    body.contradictionReconciliation.sourceSections,
  );
}

function validateOrderedMoves(
  errors: string[],
  body: PositioningSynthesisBody,
): void {
  const moves = body.orderedMoves.moves;
  if (moves.length < 3) {
    errors.push("body.orderedMoves.moves: need >=3 sequenced moves.");
  }

  const ranks = moves.map((move) => move.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== ranks.length) {
    errors.push("body.orderedMoves.moves.rank: ranks must be unique.");
  }
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const ranksAreConsecutive = sortedRanks.every(
    (rank, index) => rank === index + 1,
  );
  if (!ranksAreConsecutive) {
    errors.push("body.orderedMoves.moves.rank: ranks must be consecutive starting at 1.");
  }

  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index];
    const path = `body.orderedMoves.moves[${index}]`;
    const priorRanks = new Set(ranks.filter((rank) => rank < move.rank));
    if (!Number.isInteger(move.rank) || move.rank < 1) {
      errors.push(`${path}.rank: must be a positive integer.`);
    }
    validateStrategicText(errors, `${path}.move`, move.move);
    validateStrategicText(errors, `${path}.learningPriority`, move.learningPriority);
    validateStrategicText(errors, `${path}.rationale`, move.rationale);
    validateStrategicText(errors, `${path}.thesisTrace`, move.thesisTrace);
    validateProvesWrongIfMinimums(
      errors,
      `${path}.provesWrongIf`,
      move.provesWrongIf,
    );
    const invalidDeps = move.dependsOn.filter(
      (rank) => !Number.isInteger(rank) || !priorRanks.has(rank),
    );
    if (invalidDeps.length > 0) {
      errors.push(`${path}.dependsOn: dependencies must point to earlier ranks.`);
    }
    if (move.rank === 1 && move.dependsOn.length > 0) {
      errors.push(`${path}.dependsOn: first move must not depend on another move.`);
    }
    if (move.rank > 1 && move.dependsOn.length === 0) {
      errors.push(`${path}.dependsOn: later moves need at least one dependency.`);
    }
  }
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

  validateThesis(errors, parsedArtifact.body);
  validateOrderedMoves(errors, parsedArtifact.body);

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
