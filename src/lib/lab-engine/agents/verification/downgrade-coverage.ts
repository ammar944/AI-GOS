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

// Phase 4 §4.7 — Voice of Customer per-block default tiers.
// painLanguage → hard+directional; objections/switching → directional;
// decisionCriteria/successLanguage → directional (gaps when no tool).
export function reconcileVoiceOfCustomerCoverage({
  body,
  downgradedRows,
}: {
  body: Record<string, unknown>;
  downgradedRows: readonly DowngradedRow[];
}): Record<string, unknown> {
  const next = structuredClone(body) as Record<string, unknown>;
  const blocks: Array<{ key: string; rowsKey: string; defaultTier: EvidenceTier }> = [
    { key: "painLanguage", rowsKey: "quotes", defaultTier: "directional_signal" },
    { key: "objections", rowsKey: "items", defaultTier: "directional_signal" },
    { key: "switchingStories", rowsKey: "stories", defaultTier: "directional_signal" },
    { key: "decisionCriteria", rowsKey: "criteria", defaultTier: "directional_signal" },
    { key: "successLanguage", rowsKey: "quotes", defaultTier: "directional_signal" },
  ];
  for (const { key, rowsKey, defaultTier } of blocks) {
    const block = isRecord(next[key]) ? next[key] : null;
    if (block === null) continue;
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

// Phase 4 §4.7 — Demand Intent per-block default tiers.
// keywordDemand → hard; contentGaps → strategic_inference;
// questionMining/intentSignals/venueMap → directional (gaps when no tool).
export function reconcileDemandIntentCoverage({
  body,
  downgradedRows,
}: {
  body: Record<string, unknown>;
  downgradedRows: readonly DowngradedRow[];
}): Record<string, unknown> {
  const next = structuredClone(body) as Record<string, unknown>;
  const blocks: Array<{ key: string; rowsKey: string; defaultTier: EvidenceTier }> = [
    { key: "keywordDemand", rowsKey: "keywords", defaultTier: "hard_evidence" },
    { key: "questionMining", rowsKey: "questions", defaultTier: "directional_signal" },
    { key: "contentGaps", rowsKey: "gaps", defaultTier: "strategic_inference" },
    { key: "intentSignals", rowsKey: "items", defaultTier: "directional_signal" },
    { key: "venueMap", rowsKey: "venues", defaultTier: "directional_signal" },
  ];
  for (const { key, rowsKey, defaultTier } of blocks) {
    const block = isRecord(next[key]) ? next[key] : null;
    if (block === null) continue;
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

// Phase 4 §4.7 — Market Category per-block default tiers.
// categoryDefinition → directional+inference; marketSize → directional (TAM gap);
// structuralForces → directional+inference; categoryMaturity → strategic_inference.
export function reconcileMarketCategoryCoverage({
  body,
  downgradedRows,
}: {
  body: Record<string, unknown>;
  downgradedRows: readonly DowngradedRow[];
}): Record<string, unknown> {
  const next = structuredClone(body) as Record<string, unknown>;
  const blocks: Array<{ key: string; rowsKey: string; defaultTier: EvidenceTier }> = [
    { key: "categoryDefinition", rowsKey: "adjacentCategories", defaultTier: "directional_signal" },
    { key: "marketSize", rowsKey: "signals", defaultTier: "directional_signal" },
    { key: "structuralForces", rowsKey: "forces", defaultTier: "directional_signal" },
    { key: "categoryMaturity", rowsKey: "classification.supportingSignals", defaultTier: "strategic_inference" },
  ];
  for (const { key, rowsKey, defaultTier } of blocks) {
    const block = isRecord(next[key]) ? next[key] : null;
    if (block === null) continue;
    // categoryMaturity has nested supportingSignals under classification.
    if (key === "categoryMaturity") {
      const classification = isRecord(block.classification)
        ? block.classification
        : null;
      if (classification === null) continue;
      const supportingSignals = Array.isArray(classification.supportingSignals)
        ? classification.supportingSignals.filter(isRecord)
        : [];
      const byTier: BlockCoverage["byTier"] = {
        hard_evidence: 0,
        directional_signal: 0,
        strategic_inference: 0,
        operator_input: 0,
      };
      for (const row of supportingSignals) {
        const tier = effectiveRowTier(row, defaultTier);
        byTier[tier] += 1;
        row.evidenceTier = tier;
      }
      const coverage = isRecord(block.coverage)
        ? block.coverage
        : {
            byTier: { hard_evidence: 0, directional_signal: 0, strategic_inference: 0, operator_input: 0 },
            acquisitionGaps: [],
            strippedByVerifier: [],
            readiness: "gap",
          };
      (coverage as Record<string, unknown>).byTier = byTier;
      (coverage as Record<string, unknown>).readiness = deriveReadiness(byTier);
      (coverage as Record<string, unknown>).acquisitionGaps = Array.isArray(
        (coverage as Record<string, unknown>).acquisitionGaps,
      )
        ? (coverage as Record<string, unknown>).acquisitionGaps
        : [];
      (coverage as Record<string, unknown>).strippedByVerifier =
        downgradedRows
          .filter((r) => r.path.startsWith("body.categoryMaturity."))
          .map((r) => r.strippedRow);
      block.coverage = coverage;
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

// Phase 4 §4.7 — Offer Diagnostic per-block default tiers.
// offerMarketFit/funnelDiagnosis/channelTruth/retentionHealth → directional (+hard);
// redFlags → strategic_inference.
export function reconcileOfferDiagnosticCoverage({
  body,
  downgradedRows,
}: {
  body: Record<string, unknown>;
  downgradedRows: readonly DowngradedRow[];
}): Record<string, unknown> {
  const next = structuredClone(body) as Record<string, unknown>;
  const blocks: Array<{ key: string; rowsKey: string; defaultTier: EvidenceTier }> = [
    { key: "offerMarketFit", rowsKey: "proofPoints", defaultTier: "directional_signal" },
    { key: "funnelDiagnosis", rowsKey: "breaks", defaultTier: "directional_signal" },
    { key: "channelTruth", rowsKey: "channels", defaultTier: "directional_signal" },
    { key: "retentionHealth", rowsKey: "signals", defaultTier: "directional_signal" },
    { key: "redFlags", rowsKey: "items", defaultTier: "strategic_inference" },
  ];
  for (const { key, rowsKey, defaultTier } of blocks) {
    const block = isRecord(next[key]) ? next[key] : null;
    if (block === null) continue;
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

// Phase 4 §4.7 — Paid Media Plan tier backfill for inference-class arrays.
// Audience types/angles/creative framework/competitor insights/channel suggestions/
// cross-section insights are strategic_inference by §4.7 (composed from sibling
// sections, not directly cited). Budget/KPI/projected rows are derived/operator
// and exempt. PaidMedia has no blockGap pattern — tiers land on rows directly.
export function reconcilePaidMediaPlanCoverage({
  body,
}: {
  body: Record<string, unknown>;
}): Record<string, unknown> {
  const next = structuredClone(body) as Record<string, unknown>;
  const inferenceArrays: Array<{ key: string; defaultTier: EvidenceTier }> = [
    { key: "audienceTypes", defaultTier: "strategic_inference" },
    { key: "anglesToTest", defaultTier: "strategic_inference" },
    { key: "creativeFramework", defaultTier: "strategic_inference" },
    { key: "competitorMarketingInsights", defaultTier: "strategic_inference" },
    { key: "competitorReviewInsights", defaultTier: "strategic_inference" },
    { key: "channelSuggestions", defaultTier: "strategic_inference" },
    { key: "crossSectionInsight", defaultTier: "strategic_inference" },
  ];
  for (const { key, defaultTier } of inferenceArrays) {
    const rows = Array.isArray(next[key]) ? (next[key] as unknown[]).filter(isRecord) : [];
    for (const row of rows) {
      if (!isEvidenceTier(row.evidenceTier)) {
        row.evidenceTier = defaultTier;
      }
    }
  }
  return next;
}
