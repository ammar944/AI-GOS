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

function isEvidenceTier(value: unknown): value is EvidenceTier {
  return (
    typeof value === "string" &&
    (evidenceTiers as readonly string[]).includes(value)
  );
}

function effectivePersonaTier(persona: Record<string, unknown>): EvidenceTier {
  const verification = isRecord(persona.verification)
    ? persona.verification
    : null;
  if (verification?.outcome === "downgraded") {
    // A kept-and-downgraded row is directional by definition, regardless of the
    // tier the model authored (often null).
    return "directional_signal";
  }
  if (isEvidenceTier(persona.evidenceTier)) {
    return persona.evidenceTier;
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

// A row's effective tier: downgraded → directional_signal; else the model's
// authored tier if valid; else the block's default tier (the §4.7 dominant tier
// for that block — passed in by the caller because only the section knows it).
function effectiveRowTier(
  row: Record<string, unknown>,
  defaultTier: EvidenceTier,
): EvidenceTier {
  const verification = isRecord(row.verification) ? row.verification : null;
  if (verification?.outcome === "downgraded") {
    return "directional_signal";
  }
  if (isEvidenceTier(row.evidenceTier)) {
    return row.evidenceTier;
  }
  return defaultTier;
}

// Shared reconciliation core (§4.7 rollout): counts byTier, backfills per-row
// evidenceTier, fills strippedByVerifier from the downgraded rows whose path
// belongs to this block, folds a cleared legacy blockGap into an acquisition
// gap when real rows remain, and derives readiness. Pure — clones the block.
export function reconcileBlockCoverage({
  block,
  rowsKey,
  blockPath,
  defaultTier,
  downgradedRows,
}: {
  block: Record<string, unknown>;
  rowsKey: string;
  blockPath: string;
  defaultTier: EvidenceTier;
  downgradedRows: readonly DowngradedRow[];
}): Record<string, unknown> {
  const next = structuredClone(block) as Record<string, unknown>;
  const rows = Array.isArray(next[rowsKey])
    ? (next[rowsKey] as unknown[]).filter(isRecord)
    : [];

  const coverage = isRecord(next.coverage)
    ? next.coverage
    : ((next.coverage = {
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
      next.coverage as Record<string, unknown>);

  const byTier: BlockCoverage["byTier"] = {
    hard_evidence: 0,
    directional_signal: 0,
    strategic_inference: 0,
    operator_input: 0,
  };
  for (const row of rows) {
    const tier = effectiveRowTier(row, defaultTier);
    byTier[tier] += 1;
    row.evidenceTier = tier;
  }

  const rowPrefix = `${blockPath}.`;
  const strippedByVerifier = downgradedRows
    .filter((row) => row.path.startsWith(rowPrefix))
    .map((row) => row.strippedRow);

  const acquisitionGaps: AcquisitionGap[] = Array.isArray(
    coverage.acquisitionGaps,
  )
    ? (coverage.acquisitionGaps as AcquisitionGap[])
    : [];

  const blockGap = isRecord(next.blockGap) ? next.blockGap : null;
  if (blockGap !== null && rows.length > 0) {
    acquisitionGaps.push(blockGapToAcquisitionGap(blockGap));
    delete next.blockGap;
  }

  coverage.byTier = byTier;
  coverage.strippedByVerifier = strippedByVerifier;
  coverage.acquisitionGaps = acquisitionGaps;
  coverage.readiness = deriveReadiness(byTier);

  next.coverage = coverage;
  return next;
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

  next.personaReality = reconcileBlockCoverage({
    block: personaReality,
    rowsKey: "personas",
    blockPath: "body.personaReality",
    defaultTier: "hard_evidence",
    downgradedRows,
  });
  return next;
}

// Phase 4 §4.7 — Competitor Landscape per-block default tiers.
// competitorSet / publicWeaknesses → directional (+ some hard);
// positioningTaxonomy / narrativeArcs → strategic_inference;
// pricingReality / shareOfVoice → directional (gaps when no tool);
// adPresence → hard_evidence (tool-measured ad creatives).
export function reconcileCompetitorLandscapeCoverage({
  body,
  downgradedRows,
}: {
  body: Record<string, unknown>;
  downgradedRows: readonly DowngradedRow[];
}): Record<string, unknown> {
  const next = structuredClone(body) as Record<string, unknown>;

  const blocks: Array<{
    key: string;
    rowsKey: string;
    defaultTier: EvidenceTier;
  }> = [
    { key: "competitorSet", rowsKey: "competitors", defaultTier: "directional_signal" },
    { key: "positioningTaxonomy", rowsKey: "axes", defaultTier: "strategic_inference" },
    { key: "pricingReality", rowsKey: "dataPoints", defaultTier: "directional_signal" },
    { key: "shareOfVoice", rowsKey: "slices", defaultTier: "directional_signal" },
    { key: "publicWeaknesses", rowsKey: "items", defaultTier: "directional_signal" },
    { key: "narrativeArcs", rowsKey: "arcs", defaultTier: "strategic_inference" },
    { key: "adPresence", rowsKey: "signals", defaultTier: "hard_evidence" },
  ];

  for (const { key, rowsKey, defaultTier } of blocks) {
    const block = isRecord(next[key]) ? next[key] : null;
    if (block === null) {
      continue;
    }
    next[key] = reconcileBlockCoverage({
      block,
      rowsKey,
      blockPath: `body.${key}`,
      defaultTier,
      downgradedRows,
    });
  }

  return next;
}
