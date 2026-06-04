import type {
  StrategicCritique,
} from "./artifact-envelope";
import type { CrossSectionReasoningArtifact } from "./schemas/cross-section-reasoning";
import type { PaidMediaPlanArtifact } from "./schemas/paid-media-plan";
import type { PositioningSynthesisArtifact } from "./schemas/positioning-synthesis";

export const STRATEGIC_KNEW_THAT_PASS_FLOOR = 0.4;
export const STRATEGIC_RUBRIC_MAX_SCORE = 10;
export const STRATEGIC_RUBRIC_9_OF_10_FLOOR = 9;

export const STRATEGIC_RUBRIC_PROPERTIES = [
  {
    id: "contrarian_thesis",
    label: "Contrarian thesis",
    description:
      "Names a thesis that is not a generic category summary and can be argued against.",
  },
  {
    id: "cross_section_thread",
    label: "Cross-section thread",
    description:
      "Includes at least one insight that depends on evidence from two or more committed sections.",
  },
  {
    id: "named_tension_with_side",
    label: "Named tension with a side",
    description:
      "Names the strategic tension, chooses a side, and states the cost accepted.",
  },
  {
    id: "second_order_implication",
    label: "Second-order implication",
    description:
      "Explains what happens after the obvious first move succeeds or fails.",
  },
  {
    id: "sequenced_moves",
    label: "Sequenced moves",
    description:
      "Orders moves by dependency and learning value, not just by confidence.",
  },
  {
    id: "kill_criteria",
    label: "Kill criteria",
    description:
      "Every major bet includes falsifiable metric, threshold, and window.",
  },
  {
    id: "knew_that_pass_rate",
    label: "Knew-that pass rate",
    description:
      "At least 40% of reviewed strategic sentences pass the senior-marketer 'I knew that' sweep.",
  },
  {
    id: "conviction_without_false_certainty",
    label: "Conviction without false certainty",
    description:
      "Takes a clear position while labeling evidence gaps, hypotheses, and estimates honestly.",
  },
] as const;

export const STRATEGIC_RUBRIC_DISQUALIFIERS = [
  {
    id: "reads_like_wikipedia_brief",
    label: "Reads like Wikipedia plus brief",
    maxScore: 5,
    description:
      "If the output mostly restates company/category facts, its ceiling is 5.",
  },
  {
    id: "no_cross_section_thread",
    label: "No cross-section insight",
    maxScore: 6,
    description:
      "If no claim requires multiple sections to see, its ceiling is 6.",
  },
  {
    id: "hedges_everything",
    label: "Hedges everything",
    maxScore: 6,
    description:
      "If it refuses to take a side after evidence is available, its ceiling is 6.",
  },
] as const;

export type StrategicRubricPropertyId =
  (typeof STRATEGIC_RUBRIC_PROPERTIES)[number]["id"];

export type StrategicRubricDisqualifierId =
  (typeof STRATEGIC_RUBRIC_DISQUALIFIERS)[number]["id"];

export interface StrategicRubricKnewThatInput {
  passingSentences: number;
  totalSentences: number;
}

export interface StrategicRubricEvaluationInput {
  properties: Partial<Record<StrategicRubricPropertyId, boolean>>;
  disqualifiers?: Partial<Record<StrategicRubricDisqualifierId, boolean>>;
  evidencePointers?: Partial<Record<StrategicRubricPropertyId, readonly string[]>>;
  knewThat?: StrategicRubricKnewThatInput;
  notes?: Partial<Record<StrategicRubricPropertyId, string>>;
}

export interface StrategicRubricArtifactInput {
  crossSectionReasoning?: CrossSectionReasoningArtifact | null;
  positioningSynthesis?: PositioningSynthesisArtifact | null;
  positioningPaidMediaPlan?: PaidMediaPlanArtifact | null;
  strategicCritique?: StrategicCritique | null;
}

export interface StrategicRubricPropertyResult {
  id: StrategicRubricPropertyId;
  label: string;
  description: string;
  evidencePointers: readonly string[];
  note?: string;
  passed: boolean;
}

export interface StrategicRubricDisqualifierResult {
  id: StrategicRubricDisqualifierId;
  label: string;
  description: string;
  maxScore: number;
  active: boolean;
}

export interface StrategicRubricScore {
  activeDisqualifiers: readonly StrategicRubricDisqualifierResult[];
  gate: "passes_9_of_10_gate" | "below_9_of_10_gate";
  knewThatPassShare: number | null;
  maxAllowedScore: number;
  passedCount: number;
  propertyResults: readonly StrategicRubricPropertyResult[];
  score: number;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function computeKnewThatPassShare(
  input: StrategicRubricKnewThatInput | undefined,
): number | null {
  if (input === undefined || input.totalSentences <= 0) {
    return null;
  }

  return input.passingSentences / input.totalSentences;
}

function isPropertyPassed(input: {
  id: StrategicRubricPropertyId;
  evaluation: StrategicRubricEvaluationInput;
  knewThatPassShare: number | null;
}): boolean {
  if (input.id === "knew_that_pass_rate" && input.knewThatPassShare !== null) {
    return input.knewThatPassShare >= STRATEGIC_KNEW_THAT_PASS_FLOOR;
  }

  return input.evaluation.properties[input.id] === true;
}

function getActiveDisqualifiers(input: {
  evaluation: StrategicRubricEvaluationInput;
  propertyResults: readonly StrategicRubricPropertyResult[];
}): readonly StrategicRubricDisqualifierResult[] {
  const crossSectionThread = input.propertyResults.find(
    (result) => result.id === "cross_section_thread",
  );

  return STRATEGIC_RUBRIC_DISQUALIFIERS.map((disqualifier) => ({
    ...disqualifier,
    active:
      input.evaluation.disqualifiers?.[disqualifier.id] === true ||
      (disqualifier.id === "no_cross_section_thread" &&
        crossSectionThread?.passed === false),
  })).filter((result) => result.active);
}

export function scoreStrategicRubric(
  evaluation: StrategicRubricEvaluationInput,
): StrategicRubricScore {
  const knewThatPassShare = computeKnewThatPassShare(evaluation.knewThat);
  const propertyResults = STRATEGIC_RUBRIC_PROPERTIES.map((property) => ({
    ...property,
    evidencePointers: evaluation.evidencePointers?.[property.id] ?? [],
    ...(evaluation.notes?.[property.id] === undefined
      ? {}
      : { note: evaluation.notes[property.id] }),
    passed: isPropertyPassed({
      evaluation,
      id: property.id,
      knewThatPassShare,
    }),
  }));
  const passedCount = propertyResults.filter((result) => result.passed).length;
  const uncappedScore = Math.floor(
    (passedCount / STRATEGIC_RUBRIC_PROPERTIES.length) *
      STRATEGIC_RUBRIC_MAX_SCORE,
  );
  const activeDisqualifiers = getActiveDisqualifiers({
    evaluation,
    propertyResults,
  });
  const maxAllowedScore =
    activeDisqualifiers.length === 0
      ? STRATEGIC_RUBRIC_MAX_SCORE
      : Math.min(
          ...activeDisqualifiers.map((disqualifier) => disqualifier.maxScore),
        );
  const score = Math.min(uncappedScore, maxAllowedScore);

  return {
    activeDisqualifiers,
    gate:
      score >= STRATEGIC_RUBRIC_9_OF_10_FLOOR
        ? "passes_9_of_10_gate"
        : "below_9_of_10_gate",
    knewThatPassShare,
    maxAllowedScore,
    passedCount,
    propertyResults,
    score,
  };
}

function distinctCrossSectionRefCount(
  refs: readonly { sectionId: string }[],
): number {
  return new Set(refs.map((ref) => ref.sectionId)).size;
}

function hasCrossSectionThread(
  artifact: CrossSectionReasoningArtifact | null | undefined,
): boolean {
  return (
    artifact?.body.crossSectionThreads.some(
      (thread) => distinctCrossSectionRefCount(thread.sourceSections) >= 2,
    ) === true
  );
}

function hasSequencedMoves(
  moves: readonly { rank: number; dependsOn: readonly number[] }[] | undefined,
): boolean {
  if (moves === undefined || moves.length < 3) {
    return false;
  }

  const ranks = moves.map((move) => move.rank);
  const ranksAreConsecutive = [...ranks]
    .sort((a, b) => a - b)
    .every((rank, index) => rank === index + 1);

  return (
    ranksAreConsecutive &&
    moves.every((move) =>
      move.rank === 1
        ? move.dependsOn.length === 0
        : move.dependsOn.some((dependency) => dependency < move.rank),
    )
  );
}

function hasConcreteKillCriteria(
  moves:
    | readonly {
        provesWrongIf: { metric: string; threshold: string; window: string };
      }[]
    | undefined,
): boolean {
  return (
    moves !== undefined &&
    moves.length > 0 &&
    moves.every(
      (move) =>
        nonEmptyString(move.provesWrongIf.metric) &&
        nonEmptyString(move.provesWrongIf.threshold) &&
        nonEmptyString(move.provesWrongIf.window),
    )
  );
}

function buildKnewThatInput(
  strategicCritique: StrategicCritique | null | undefined,
): StrategicRubricKnewThatInput | undefined {
  if (strategicCritique === null || strategicCritique === undefined) {
    return undefined;
  }

  return {
    passingSentences: strategicCritique.items.filter(
      (item) => item.action !== "cut" && item.verdict === "passes",
    ).length,
    totalSentences: strategicCritique.items.length,
  };
}

export function scoreStrategicRubricArtifacts(
  input: StrategicRubricArtifactInput,
): StrategicRubricScore {
  const synthesisMoves = input.positioningSynthesis?.body.orderedMoves.moves;
  const paidMediaMoves = input.positioningPaidMediaPlan?.body.orderedMoves.moves;
  const hasAnySequencedMoves =
    hasSequencedMoves(synthesisMoves) || hasSequencedMoves(paidMediaMoves);
  const hasAnyKillCriteria =
    hasConcreteKillCriteria(synthesisMoves) ||
    hasConcreteKillCriteria(paidMediaMoves);
  const critique = input.strategicCritique ?? input.crossSectionReasoning?.strategicCritique;
  const knewThat = buildKnewThatInput(critique);

  return scoreStrategicRubric({
    evidencePointers: {
      contrarian_thesis: ["positioningCrossSectionReasoning.body.contrarianInversion"],
      cross_section_thread: ["positioningCrossSectionReasoning.body.crossSectionThreads"],
      named_tension_with_side: ["positioningCrossSectionReasoning.body.namedTension"],
      second_order_implication: ["positioningCrossSectionReasoning.body.secondOrderRisk"],
      sequenced_moves: [
        "positioningSynthesis.body.orderedMoves",
        "positioningPaidMediaPlan.body.orderedMoves",
      ],
      kill_criteria: [
        "positioningSynthesis.body.orderedMoves.moves[].provesWrongIf",
        "positioningPaidMediaPlan.body.orderedMoves.moves[].provesWrongIf",
      ],
      knew_that_pass_rate: ["positioningCrossSectionReasoning.strategicCritique"],
      conviction_without_false_certainty: [
        "positioningSynthesis.body.strategicThesis",
        "positioningSynthesis.body.contradictionReconciliation",
      ],
    },
    knewThat,
    notes: {
      ...(knewThat === undefined
        ? {
            knew_that_pass_rate:
              "No strategicCritique metadata available; mark the live checklist unknown/fail rather than blocking artifact commit.",
          }
        : {}),
      ...(input.crossSectionReasoning === null ||
      input.crossSectionReasoning === undefined
        ? {
            cross_section_thread:
              "Missing cross-section reasoning artifact caps the score at 6.",
          }
        : {}),
    },
    properties: {
      contrarian_thesis:
        nonEmptyString(input.crossSectionReasoning?.body.contrarianInversion.claim) ||
        nonEmptyString(input.positioningSynthesis?.body.strategicThesis.thesis),
      cross_section_thread: hasCrossSectionThread(input.crossSectionReasoning),
      named_tension_with_side:
        nonEmptyString(input.crossSectionReasoning?.body.namedTension.side) &&
        nonEmptyString(input.crossSectionReasoning?.body.namedTension.costAccepted),
      second_order_implication: nonEmptyString(
        input.crossSectionReasoning?.body.secondOrderRisk.claim,
      ),
      sequenced_moves: hasAnySequencedMoves,
      kill_criteria: hasAnyKillCriteria,
      conviction_without_false_certainty:
        nonEmptyString(input.positioningSynthesis?.body.strategicThesis.thesis) &&
        nonEmptyString(
          input.positioningSynthesis?.body.contradictionReconciliation
            .tradeOffAccepted,
        ),
    },
  });
}

export function buildStrategicRubricChecklistMarkdown(): string {
  const properties = STRATEGIC_RUBRIC_PROPERTIES.map(
    (property) => `- [ ] ${property.label}: ${property.description}`,
  ).join("\n");
  const disqualifiers = STRATEGIC_RUBRIC_DISQUALIFIERS.map(
    (disqualifier) =>
      `- ${disqualifier.label} -> ceiling ${disqualifier.maxScore}: ${disqualifier.description}`,
  ).join("\n");

  return [
    "# 9/10 Strategic Rubric",
    "",
    "Honesty and source support are prerequisites. This checklist scores strategic quality after truthgate review.",
    "",
    "## Properties",
    properties,
    "",
    "## Disqualifiers",
    disqualifiers,
    "",
    `Knew-that sweep: at least ${Math.round(
      STRATEGIC_KNEW_THAT_PASS_FLOOR * 100,
    )}% of reviewed strategic sentences must pass.`,
  ].join("\n");
}

export function buildStrategicRubricPromptBlock(): string {
  const propertyLines = STRATEGIC_RUBRIC_PROPERTIES.map(
    (property) => `- ${property.label}: ${property.description}`,
  ).join("\n");
  const disqualifierLines = STRATEGIC_RUBRIC_DISQUALIFIERS.map(
    (disqualifier) =>
      `- ${disqualifier.label}: cap score at ${disqualifier.maxScore}. ${disqualifier.description}`,
  ).join("\n");

  return [
    "9/10 strategic rubric:",
    propertyLines,
    "",
    "Disqualifier ceilings:",
    disqualifierLines,
    "",
    `A sentence passes the knew-that sweep only when a senior GTM consultant would not dismiss it as obvious; at least ${Math.round(
      STRATEGIC_KNEW_THAT_PASS_FLOOR * 100,
    )}% of reviewed strategic sentences must pass.`,
  ].join("\n");
}
