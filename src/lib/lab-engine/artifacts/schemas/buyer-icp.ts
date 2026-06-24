import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import { isValidGroundedBuyerUnit } from "../../agents/verification/grounded-buyer-unit";
import type { ValidationResult } from "./market-category";
import {
  acquisitionSufficiencyFieldSchema,
  blockCoverageSchema,
  evidenceBlockGapFieldSchema,
  evidenceBlockGapSchema,
  evidenceTierSchema,
  keyFindingsSchema,
  rowVerificationSchema,
  strategicInsightSchema,
  validateStrategicInsightMinimums,
} from "./strategic-insight";

// Phase 3 (BuyerICP tier pilot): an optional per-row evidence tier. Additive
// and optional — the renderer and the other consumers are unaffected, and a
// row without it behaves exactly as before. A promoted-then-downgraded persona
// carries `directional_signal`; a hard-evidence persona carries `hard_evidence`.
const evidenceTierFieldSchema = evidenceTierSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

// Phase 2/3: the verifier writes this onto a kept-but-downgraded row
// (reach/outcome/method). The BuyerICP row schemas are strict, so they must
// ACCEPT the key or persistence rejects a downgraded row. Additive + optional;
// authored by the verifier, never by the model. `rowVerificationSchema` is the
// shared shape (already .optional()); the field tolerates an explicit null fill.
const rowVerificationFieldSchema = rowVerificationSchema
  .unwrap()
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

// Optional per-block coverage report: distinguishes verifier-stripped/downgraded
// rows (strippedByVerifier) from genuine acquisition voids (acquisitionGaps), so
// "we found it and downgraded it" no longer renders identically to "no tool was
// wired". Additive — absent on every block today, populated only where wired.
const blockCoverageFieldSchema = blockCoverageSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const personaRoles = [
  "champion",
  "economic-buyer",
  "decision-maker",
  "influencer",
  "end-user",
  "gatekeeper",
] as const;

// Option B grounding carrier. A persona need not name a human — a sourced
// ROLE/SEGMENT label is a valid grounded buyer unit. This field name is shared
// with source-liveness.ts (added to its entityFieldNames STRICT set) so the
// schema -> strict-containment wire is a compile-time dependency: a fabricated
// segmentLabel that is not on the live page is dropped by the requiredEntities
// .every() containment, closing the West Elm fabricated-persona class of exploit
// (regression c9bc2056), re-aimed at segments.
export { BUYER_PERSONA_GROUNDING_FIELD } from "./buyer-icp-constants";
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
export const modelEstimateLabel = "[model estimate - not tool-measured]";
export const buyerICPEvidenceGapReason = "insufficient_named_buyer_personas";
const genericIdentityTokens = new Set([
  "account",
  "accounts",
  "buyer",
  "buyers",
  "champion",
  "champions",
  "company",
  "companies",
  "decision",
  "department",
  "departments",
  "director",
  "directors",
  "economic",
  "end",
  "enterprise",
  "executive",
  "executives",
  "finance",
  "finops",
  "founder",
  "founders",
  "gatekeeper",
  "gatekeepers",
  "growth",
  "gtm",
  "head",
  "heads",
  "icp",
  "influencer",
  "influencers",
  "leader",
  "leaders",
  "manager",
  "managers",
  "marketing",
  "midmarket",
  "mid-market",
  "operator",
  "operators",
  "ops",
  "persona",
  "personas",
  "president",
  "problem",
  "product",
  "revenue",
  "revops",
  "sales",
  "saas",
  "segment",
  "segments",
  "senior",
  "seniority",
  "small",
  "smb",
  "solution",
  "startup",
  "startups",
  "team",
  "teams",
  "user",
  "users",
  "vp",
]);
const provenanceSignalPattern =
  /\b(query|search|source|public|fetched|observed|tool|corpus|review|reddit|forum|community|newsletter|survey|interview|call|profile)\b/i;
const blockGapFieldSchema = evidenceBlockGapFieldSchema;

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@._ -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTokens(value: string): string[] {
  return normalizeLabel(value)
    .split(" ")
    .map((token) => token.replace(/^[^a-z0-9@]+|[^a-z0-9]+$/g, ""))
    .filter((token) => token.length > 0);
}

function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 3) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function isGenericIdentityToken(token: string): boolean {
  return genericIdentityTokens.has(token) || genericIdentityTokens.has(singularizeToken(token));
}

function hasAwarenessBasis(
  evidence: string,
  sampleQuery: string | undefined,
  share: string,
): boolean {
  if (
    isModelEstimateLabeled(share) ||
    isModelEstimateLabeled(evidence) ||
    (sampleQuery !== undefined && isModelEstimateLabeled(sampleQuery))
  ) {
    return true;
  }

  return (
    (sampleQuery !== undefined && sampleQuery.trim().length > 0) ||
    provenanceSignalPattern.test(evidence)
  );
}

function looksNumericShare(share: string): boolean {
  return /[\d%]/.test(share);
}

function hasBlockGap(block: { blockGap?: unknown }): boolean {
  return block.blockGap !== undefined;
}

export function isHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:";
}

export function isModelEstimateLabeled(value: string): boolean {
  return value.includes(modelEstimateLabel);
}

export function isLikelyNamedBuyerIdentity(
  name: string,
  context?: {
    company?: string;
    role?: string;
    seniority?: string;
    title?: string;
  },
): boolean {
  const normalizedName = normalizeLabel(name);

  if (normalizedName.length === 0) {
    return false;
  }

  const contextualLabels = [
    context?.role,
    context?.title,
    context?.company,
    context?.seniority,
  ]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeLabel);

  if (contextualLabels.includes(normalizedName)) {
    return false;
  }

  const rawName = name.trim();
  if (
    /^@?[a-z0-9][a-z0-9_.-]{2,}$/i.test(rawName) &&
    /[@_.0-9]/.test(rawName)
  ) {
    return true;
  }

  const tokens = normalizeTokens(name);
  if (tokens.length < 2 || tokens.length > 4) {
    return false;
  }

  if (tokens.some((token) => /\d/.test(token))) {
    return false;
  }

  if (tokens.every(isGenericIdentityToken)) {
    return false;
  }

  return tokens.every(
    (token) =>
      /^[a-z][a-z'-]*$/i.test(token) &&
      token.length >= 2 &&
      !isGenericIdentityToken(token),
  );
}

const firmographicCutSchema = z
  .object({
    cutType: z.enum(cutTypes),
    value: z.string().min(1),
    accountCount: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    source: z.string().min(1),
    sourceUrl: z.string().min(1),
    dateObserved: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
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
    teamSize: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    // Option B grounding carrier (BUYER_PERSONA_GROUNDING_FIELD): a sourced
    // role/segment label, e.g. "Finance leaders at mid-market SaaS, 200-1000
    // employees". When present it MUST appear verbatim on the live sourceUrl
    // page (source-liveness strict requiredEntities). Optional — a named-human
    // persona grounds on its name instead.
    segmentLabel: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    evidence: z.string().min(1),
    // Derived by the runner normalizer (derive-don't-ask): true when the
    // persona's sourceUrl registrable domain equals the audited company's.
    // Vendor-sourced personas still count toward the floor — they are real
    // buyers — they're just labeled for the reader.
    vendorSourced: z.boolean().nullable().transform((value) => value ?? undefined).optional(),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const awarenessLevelSchema = z
  .object({
    level: z.enum(awarenessLevels),
    share: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    evidence: z.string().min(1),
    sampleQuery: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const triggerSchema = z
  .object({
    name: z.string().min(1),
    detectionSignal: z.string().min(1),
    window: z.enum(triggerWindows),
    evidence: z.string().min(1),
    sourceUrl: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const clusterVenueSchema = z
  .object({
    bucketType: z.enum(clusterBuckets),
    name: z.string().min(1),
    audienceSize: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    sourceUrl: z.string().min(1),
    whyItMatters: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const evidenceGapReportSchema = z
  .object({
    reason: z.literal(buyerICPEvidenceGapReason),
    summary: z.string().min(1),
    foundNamedPersonaCount: z.number().int().nonnegative(),
    requiredNamedPersonaCount: z.number().int().positive(),
    rejectedPersonaLabels: z.array(z.string().min(1)),
    // Acquisition ledger (Wave 2): the bounded persona/source discovery trail behind
    // this section. Perplexity/web discovery surfaces candidate named buyers; DeepSeek
    // remains the writer/repair authority. Each row records a searched source, the
    // candidate found, whether it was promoted into personaReality or rejected, and the
    // rejection reason. Sparse acquisition must produce honest rejected rows here, never
    // fabricated personas. Mirrors the VoC acquisitionLedger contract.
    acquisitionLedger: z
      .array(
        z
          .object({
            // Optional for query-level attempt rows (a venue pass that surfaced
            // no candidate has no source URL/domain — honest, not a floor dodge)
            // and for segment-evidence rows (mined from corpus, not searched).
            sourceUrl: z.string().min(1).optional(),
            domain: z.string().min(1).optional(),
            // Optional for segment-evidence rows (mined from corpus, not searched
            // — the segmentLabel is the carrier, not a query). Required for
            // Perplexity/case-study venue rows.
            query: z.string().min(1).optional(),
            source: z.string().min(1),
            candidateLabel: z.string().min(1).optional(),
            promotionStatus: z.enum(["promoted", "rejected", "not_applicable"]),
            // Candidate-classification reason (candidate rows only).
            rejectionReason: z
              .enum([
                "not_named_individual",
                "not_buyer_role",
                "unverifiable_source",
                "duplicate",
                "insufficient_evidence",
                "not_selected",
              ])
              .optional(),
            // Lookup-outcome reason for query-level attempt rows.
            toolGapReason: z
              .enum(["missing_credential", "no_named_individuals", "no_result"])
              .optional(),
            observedAt: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    sufficiency: acquisitionSufficiencyFieldSchema,
    sourcingPlan: z.array(z.string().min(1)).min(1),
  })
  .strict();

// Populated DETERMINISTICALLY by the provenance gate at commit time (Gate E), NEVER by the model — model self-certification here would launder past the trust ceiling.
const evidenceVerdictSchema = z
  .object({
    outcome: z.enum(["clean", "unverified-directional", "overclaim", "refuted"]),
    verifiedRowCount: z.number().int().nonnegative(),
    unsupportedRowCount: z.number().int().nonnegative(),
    rowsMissingRealSource: z.number().int().nonnegative(),
    note: z.string().min(1).optional(),
  })
  .optional();

export const buyerICPBodySchema = z
  .object({
    keyFindings: keyFindingsSchema.nullable().transform((value) => value ?? undefined).optional(),
    strategicInsight: strategicInsightSchema,
    icpExistenceCheck: z
      .object({
        prose: z.string().min(1),
        firmographicCuts: z.array(firmographicCutSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    personaReality: z
      .object({
        prose: z.string().min(1),
        personas: z.array(personaSchema),
        blockGap: blockGapFieldSchema,
        // Phase 3: when the verifier downgrades a persona row (uncontained /
        // unreachable re-fetch), the kept-but-demoted record is reported here —
        // distinct from an acquisition gap. Optional + additive.
        coverage: blockCoverageFieldSchema,
      })
      .strict(),
    awarenessDistribution: z
      .object({
        prose: z.string().min(1),
        dominantLevel: z.enum(awarenessLevels).nullable().transform((value) => value ?? undefined).optional(),
        levels: z.array(awarenessLevelSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    buyingContext: z
      .object({
        prose: z.string().min(1),
        triggers: z.array(triggerSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    clusters: z
      .object({
        prose: z.string().min(1),
        venues: z.array(clusterVenueSchema),
        blockGap: blockGapFieldSchema,
        // Phase 3: the clusters block has NO venue-discovery tool wired, so an
        // empty venues array is an ACQUISITION GAP (not stripped data). The
        // coverage carries the acquisitionGaps entry; distinct boilerplate from
        // a verifier-stripped block. Optional + additive.
        coverage: blockCoverageFieldSchema,
      })
      .strict(),
    evidenceGap: z.literal(true).nullable().transform((value) => value ?? undefined).optional(),
    evidenceGapReport: evidenceGapReportSchema.nullable().transform((value) => value ?? undefined).optional(),
    // Populated DETERMINISTICALLY by the provenance gate at commit time (Gate E), NEVER by the model — model self-certification here would launder past the trust ceiling.
    evidenceVerdict: evidenceVerdictSchema,
    // §4.1 (RAW un-caged GLM) — GLM's un-thinned research markdown, carried on
    // the typed body so it survives strict persist-time re-validation and renders
    // as the primary card body. Additive, optional, backward compatible. Present
    // on every PROJECTABLE section so the agentic path can attach it uniformly.
    narrativeMarkdown: z
      .string()
      .min(1)
      .nullable()
      .transform((value) => value ?? undefined)
      .optional(),
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
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
  const personaEvidenceGap =
    parsedArtifact.body.evidenceGap === true &&
    parsedArtifact.body.evidenceGapReport?.reason === buyerICPEvidenceGapReason;

  validateStrategicInsightMinimums(
    errors,
    "body.strategicInsight",
    parsedArtifact.body.strategicInsight,
    {
      comparisonTexts: [parsedArtifact.verdict, parsedArtifact.statusSummary],
    },
  );

  if (parsedArtifact.body.evidenceGap === true && !personaEvidenceGap) {
    errors.push(
      `body.evidenceGapReport: required when body.evidenceGap=true for ${buyerICPEvidenceGapReason}.`,
    );
  }

  // Floor 1, quality-aware (was 3): a real promoted champion — even ONE — must
  // clear the floor. We count personas that pass isValidGroundedBuyerUnit (a
  // live source URL + a named human OR a sourced role/segment), so the bar is
  // grounded quality, not a raw row count. With zero grounded personas and no
  // gap/blockGap, the structured evidence-gap path is the honest exit.
  const groundedPersonaCount = personas.filter((persona) =>
    isValidGroundedBuyerUnit(persona as unknown as Record<string, unknown>),
  ).length;
  if (
    !personaEvidenceGap &&
    groundedPersonaCount < 1 &&
    !hasBlockGap(parsedArtifact.body.personaReality)
  ) {
    errors.push(
      `body.personaReality.personas: have ${groundedPersonaCount} grounded, need >=1.`,
    );
  }

  personas.forEach((persona, index) => {
    // Option B: a persona is a valid grounded buyer unit when it carries a live
    // source URL AND a grounded claim — EITHER a named human OR a sourced
    // role/segment label (segmentLabel). The bare role enum is not grounding;
    // the free-text segmentLabel is strict-contained on the live page by
    // source-liveness before this gate runs. Generic name labels with no
    // segmentLabel still fail (no human, no grounded segment).
    if (!isValidGroundedBuyerUnit(persona as Record<string, unknown>)) {
      errors.push(
        `body.personaReality.personas[${index}].name: must be a named person, public reviewer handle, or a sourced role/segment buyer unit (segmentLabel grounded on the live source); a bare generic role/segment/company label with no grounding does not qualify.`,
      );
    }

    if (!isHttpUrl(persona.sourceUrl)) {
      errors.push(
        `body.personaReality.personas[${index}].sourceUrl: url is not a valid URL.`,
      );
    }
  });

  const firmographicCuts =
    parsedArtifact.body.icpExistenceCheck.firmographicCuts;
  if (
    firmographicCuts.length < 3 &&
    !hasBlockGap(parsedArtifact.body.icpExistenceCheck)
  ) {
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
  if (
    uniqueCount(cutTypeValues) < 3 &&
    !hasBlockGap(parsedArtifact.body.icpExistenceCheck)
  ) {
    errors.push(
      `body.icpExistenceCheck.firmographicCuts: need >=3 distinct cutType values.`,
    );
  }

  firmographicCuts.forEach((cut, index) => {
    if (!isHttpUrl(cut.sourceUrl)) {
      errors.push(
        `body.icpExistenceCheck.firmographicCuts[${index}].sourceUrl: url is not a valid URL.`,
      );
    }
  });

  const awarenessLevelsObserved = parsedArtifact.body.awarenessDistribution.levels;
  const observedAwarenessLevels = awarenessLevelsObserved.map((level) => level.level);
  if (
    awarenessLevelsObserved.length === 0 &&
    parsedArtifact.body.awarenessDistribution.dominantLevel === undefined &&
    !hasBlockGap(parsedArtifact.body.awarenessDistribution)
  ) {
    errors.push(
      "body.awarenessDistribution: include at least one evidenced awareness level, dominantLevel, or body.awarenessDistribution.blockGap.",
    );
  }
  for (const duplicate of findDuplicates(observedAwarenessLevels)) {
    errors.push(
      `body.awarenessDistribution.levels: duplicate level ${duplicate}.`,
    );
  }

  awarenessLevelsObserved.forEach((level, index) => {
    if (
      level.share !== undefined &&
      !hasAwarenessBasis(level.evidence, level.sampleQuery, level.share)
    ) {
      const reason = looksNumericShare(level.share)
        ? "numeric-looking shares require sampleQuery, provenance-bearing evidence, or the exact [model estimate - not tool-measured] label."
        : "shares require evidence/sampleQuery basis or the exact [model estimate - not tool-measured] label.";
      errors.push(
        `body.awarenessDistribution.levels[${index}].share: ${reason}`,
      );
    }
  });

  const triggers = parsedArtifact.body.buyingContext.triggers;
  const triggerCount = triggers.length;
  if (triggerCount < 3 && !hasBlockGap(parsedArtifact.body.buyingContext)) {
    errors.push(`body.buyingContext.triggers: have ${triggerCount}, need >=3.`);
  }

  triggers.forEach((trigger, index) => {
    if (trigger.sourceUrl !== undefined && !isHttpUrl(trigger.sourceUrl)) {
      errors.push(
        `body.buyingContext.triggers[${index}].sourceUrl: url is not a valid URL.`,
      );
    }
  });

  const venues = parsedArtifact.body.clusters.venues;
  if (venues.length < 1 && !hasBlockGap(parsedArtifact.body.clusters)) {
    errors.push(
      `body.clusters.venues: have ${venues.length}, need >=1 real venue or body.clusters.blockGap.`,
    );
  }

  venues.forEach((venue, index) => {
    if (!isHttpUrl(venue.sourceUrl)) {
      errors.push(
        `body.clusters.venues[${index}].sourceUrl: url is not a valid URL.`,
      );
    }
  });

  return { ok: errors.length === 0, errors };
}
