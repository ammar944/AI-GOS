import type {
  AcquisitionGap,
  BlockCoverage,
  EvidenceTier,
} from "../../artifacts/schemas/strategic-insight";
import type { DowngradedRow } from "./source-liveness";

// Verifier-derived coverage reconciliation (§4.6 / Gap B). The model authors a
// best-effort `coverage` block, but it cannot know which rows the liveness gate
// downgraded post-authoring. This rewrites the verifier-owned fields — byTier,
// strippedByVerifier, readiness — from the ACTUAL post-downgrade rows so the
// reader sees "found-and-downgraded" distinctly from "no tool wired", and a
// legacy blockGap is folded into a first-class acquisition gap once real rows
// remain. Pure: returns a fresh body, never mutates the input.

const personaRealityRowPrefix = "body.personaReality.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const evidenceTiers: readonly EvidenceTier[] = [
  "hard_evidence",
  "directional_signal",
  "strategic_inference",
  "operator_input",
];

function effectivePersonaTier(persona: Record<string, unknown>): EvidenceTier {
  const verification = isRecord(persona.verification)
    ? persona.verification
    : null;
  if (verification?.outcome === "downgraded") {
    // A kept-and-downgraded row is directional by definition, regardless of the
    // tier the model authored (often null).
    return "directional_signal";
  }
  if (
    typeof persona.evidenceTier === "string" &&
    (evidenceTiers as readonly string[]).includes(persona.evidenceTier)
  ) {
    return persona.evidenceTier as EvidenceTier;
  }
  // A grounded persona that passed liveness is hard evidence.
  return "hard_evidence";
}

function deriveReadiness(
  byTier: BlockCoverage["byTier"],
): BlockCoverage["readiness"] {
  const total =
    byTier.hard_evidence +
    byTier.directional_signal +
    byTier.strategic_inference +
    byTier.operator_input;
  if (total === 0) {
    return "gap";
  }
  if (byTier.hard_evidence >= 2) {
    return "rich";
  }
  if (byTier.hard_evidence >= 1 || total >= 3) {
    return "adequate";
  }
  return "thin";
}

function blockGapToAcquisitionGap(
  blockGap: Record<string, unknown>,
): AcquisitionGap {
  const summary =
    typeof blockGap.summary === "string" && blockGap.summary.trim().length > 0
      ? blockGap.summary
      : "Coverage gap reported by the section.";
  const sourcingPlan =
    Array.isArray(blockGap.sourcingPlan) &&
    blockGap.sourcingPlan.every((step) => typeof step === "string") &&
    blockGap.sourcingPlan.length > 0
      ? (blockGap.sourcingPlan as string[])
      : ["Source this signal from buyer interviews or closed-won records."];
  return {
    whatWasSought: summary,
    reason: "tool_returned_empty",
    surfacesQueried: [],
    sourcingPlan,
  };
}

export function reconcilePersonaRealityCoverage({
  body,
  downgradedRows,
}: {
  body: Record<string, unknown>;
  downgradedRows: readonly DowngradedRow[];
}): Record<string, unknown> {
  const next = structuredClone(body) as Record<string, unknown>;
  const personaReality = isRecord(next.personaReality)
    ? next.personaReality
    : null;
  if (personaReality === null) {
    return next;
  }

  const personas = Array.isArray(personaReality.personas)
    ? personaReality.personas.filter(isRecord)
    : [];

  // The model authors `coverage` best-effort and may omit it. A downgraded
  // persona block MUST still carry the verifier's strippedByVerifier record, so
  // synthesize the coverage block when it is absent (never silently drop it).
  const coverage = isRecord(personaReality.coverage)
    ? personaReality.coverage
    : ((personaReality.coverage = {
        byTier: {
          hard_evidence: 0,
          directional_signal: 0,
          strategic_inference: 0,
          operator_input: 0,
        },
        acquisitionGaps: [],
        strippedByVerifier: [],
        readiness: "gap",
      }),
      personaReality.coverage as Record<string, unknown>);

  const byTier: BlockCoverage["byTier"] = {
    hard_evidence: 0,
    directional_signal: 0,
    strategic_inference: 0,
    operator_input: 0,
  };
  for (const persona of personas) {
    const tier = effectivePersonaTier(persona);
    byTier[tier] += 1;
    // Backfill the per-row evidenceTier so a downgraded persona is self-labelled
    // directional_signal (the model authors it null/absent; the count alone is
    // not enough — every row that holds real data must carry its honest tier).
    persona.evidenceTier = tier;
  }

  const strippedByVerifier = downgradedRows
    .filter((row) => row.path.startsWith(personaRealityRowPrefix))
    .map((row) => row.strippedRow);

  const acquisitionGaps: AcquisitionGap[] = Array.isArray(
    coverage.acquisitionGaps,
  )
    ? (coverage.acquisitionGaps as AcquisitionGap[])
    : [];

  const blockGap = isRecord(personaReality.blockGap)
    ? personaReality.blockGap
    : null;
  if (blockGap !== null && personas.length > 0) {
    acquisitionGaps.push(blockGapToAcquisitionGap(blockGap));
    delete personaReality.blockGap;
  }

  coverage.byTier = byTier;
  coverage.strippedByVerifier = strippedByVerifier;
  coverage.acquisitionGaps = acquisitionGaps;
  coverage.readiness = deriveReadiness(byTier);

  return next;
}
