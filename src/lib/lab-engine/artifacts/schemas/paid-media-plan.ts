import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
  blockCoverageSchema,
  evidenceTierSchema,
  rowVerificationSchema,
} from "./strategic-insight";

export const sourceSectionValues = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "gtmBrief",
  // Honest fallback for model-emitted provenance outside the known set:
  // never silently re-attribute to gtmBrief (fabricated attribution), never
  // crash at persistence (run d838ed4e). Renders as an "Unattributed" chip.
  "unattributed",
] as const;

export const paidMediaMoneyProvenanceValues = [
  "user-supplied",
  "tool-measured",
  "source-reported",
  "model-estimated",
  "derived",
  "unknown",
] as const;

// Mirrors the onboarding snapshot's creativeCapacity enum (artifact-envelope).
export type PaidMediaCreativeCapacity = "lean" | "standard" | "high";

// Brief-derived context threaded in by the runner pre-pass
// (withNormalizedPaidMediaPlanOutput in run-section.ts):
// - creativeCapacity keys the single-writer creative counts.
// - targetCac (raw brief string, e.g. "≤$4,000") bridges the SOP
//   projected-results math when the model honestly reports KPI cost unknown.
// Funnel conversion rates from onboarding economics, parsed to fractions
// (e.g. "3%" -> 0.03). Drives the FORWARD demand projection so the projected
// count is computed from spend -> clicks -> conversions, never back-solved from
// the target CAC (which made implied CAC == target CAC by construction and hid
// the real shortfall).
export interface PaidMediaCvrChain {
  visitorToSignup?: number;
  signupToActivation?: number;
  activationToPaid?: number;
}

export interface NormalizePaidMediaPlanBodyOptions {
  creativeCapacity?: PaidMediaCreativeCapacity;
  targetCac?: string;
  // The buyer's funnel-stage goal (e.g. "120") — when set, the projected count
  // is compared against it and an honest shortfall note is surfaced.
  targetTrialsPerMonth?: string;
  cvrChain?: PaidMediaCvrChain;
  // Primary platform/channel hint for the stated-default CPC lookup.
  channelHint?: string;
  // True when the sibling Voice-of-Customer section declared an evidence gap
  // (body.evidenceGap === true OR it produced zero usable quotes). When set,
  // any competitor review/marketing insight that claims sourceSection
  // 'positioningVoiceOfCustomer' is re-stamped to 'unattributed' — the plan must
  // not launder customer-voice proof from a VoC that produced nothing usable
  // (run 3b568ea0 VOC-LAUNDERING).
  voiceOfCustomerEvidenceGap?: boolean;
}

const channelVerdictValues = [
  "FIX",
  "REWORK",
  "REVIEW",
  "KEEP",
  "ADD",
  "KILL",
  "SCALE",
] as const;

const paidMediaNumericMoneySchema = z.number().finite().nonnegative().optional();
const sourceSectionSchema = z.enum(sourceSectionValues).catch("unattributed");
const channelVerdictSchema = z.enum(channelVerdictValues).catch("REVIEW");
type SourceSection = z.infer<typeof sourceSectionSchema>;
type ChannelVerdict = z.infer<typeof channelVerdictSchema>;

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z
      .string()
      .min(1)
      .nullable()
      .transform((value) => value ?? undefined)
      .optional(),
  })
  .strict();

const campaignOverviewSchema = z.object({
  prose: z.string().min(1),
  platform: z.string().min(1),
  monthlyBudget: z.string().min(1),
  monthlyBudgetValue: paidMediaNumericMoneySchema,
  monthlyBudgetProvenance: z.string().min(1),
  dailySpend: z.string().min(1),
  dailySpendValue: paidMediaNumericMoneySchema,
  dailySpendProvenance: z.string().min(1),
  totalMonths: z.number(),
  phaseCount: z.number(),
  primaryKpi: z.string().min(1),
});

const evidenceTierFieldSchema = evidenceTierSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const rowVerificationFieldSchema = rowVerificationSchema
  .unwrap()
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const campaignPhaseSchema = z.object({
  phaseName: z.string().min(1),
  monthsLabel: z.string().min(1),
  monthlyBudget: z.string().min(1),
  monthlyBudgetValue: paidMediaNumericMoneySchema,
  monthlyBudgetProvenance: z.string().min(1),
  bullets: z.array(z.string().min(1)).describe("4-5 phase bullets"),
});

// Row-level evidence pack (Wave 2C). DETERMINISTICALLY built post-commit by
// withPaidMediaEvidencePack (paid-media-evidence-pack.ts), never model-authored.
// Each ref ties a synthesized row to the EXACT upstream committed row(s) it was
// composed from via a real anchor-token match; an honest gap when none matched.
// Optional + additive: legacy payloads (and the normalize* fallbacks) parse
// unchanged.
const paidMediaEvidenceRefSchema = z
  .object({
    sourceSection: z.string().min(1),
    evidenceKind: z.string().min(1),
    locator: z.string().min(1),
    excerpt: z.string().min(1),
  })
  .strict();

const paidMediaEvidencePackSchema = z
  .object({
    status: z.enum(["grounded", "gap"]),
    refs: z.array(paidMediaEvidenceRefSchema),
    note: z.string().min(1).optional(),
  })
  .strict();

export interface PaidMediaEvidenceRef {
  sourceSection: string;
  evidenceKind: string;
  locator: string;
  excerpt: string;
}

export interface PaidMediaEvidencePack {
  status: "grounded" | "gap";
  refs: PaidMediaEvidenceRef[];
  note?: string;
}

const audienceTypeSchema = z.object({
  slot: z.string().min(1),
  archetype: z.string().min(1),
  dailyBudget: z.string().min(1),
  dailyBudgetValue: paidMediaNumericMoneySchema,
  dailyBudgetProvenance: z.string().min(1),
  detail: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
  evidencePack: paidMediaEvidencePackSchema.optional(),
  evidenceTier: evidenceTierFieldSchema,
  verification: rowVerificationFieldSchema,
});

const angleSchema = z.object({
  shortName: z.string().min(1),
  description: z.string().min(1),
  angleType: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
  evidencePack: paidMediaEvidencePackSchema.optional(),
  evidenceTier: evidenceTierFieldSchema,
  verification: rowVerificationFieldSchema,
});

// staticCount/videoCount/totalPerAudience are COMPUTED by the runner
// (normalizeCreativeStrategy) — the model's values are always overwritten.
// They stay schema-optional only so model outputs that omit them (per the
// updated prompt guidance) and legacy payloads both parse.
const creativeStrategySchema = z.object({
  prose: z.string().min(1),
  staticCount: z.number().optional(),
  videoCount: z.number().optional(),
  totalPerAudience: z.number().optional(),
});

const creativeFrameworkSlotSchema = z.object({
  label: z.string().min(1),
  angleType: z.string().min(1),
  hook: z.string().min(1),
  executesAngle: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
  evidencePack: paidMediaEvidencePackSchema.optional(),
  evidenceTier: evidenceTierFieldSchema,
  verification: rowVerificationFieldSchema,
});

const funnelIdeationSchema = z.object({
  rank: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  whatItProves: z.string().min(1),
});

const salesProcessAssetSchema = z.object({
  label: z.string().min(1),
  assetType: z.string().min(1),
  url: z.string(),
  note: z.string().min(1),
});

const competitorMarketingInsightSchema = z.object({
  competitor: z.string().min(1),
  messaging: z.string().min(1),
  adPlatforms: z.string().min(1),
  estSpendProvenance: z.string().min(1),
  icp: z.string().min(1),
  angles: z.string().min(1),
  positioning: z.string().min(1),
  offer: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
  evidencePack: paidMediaEvidencePackSchema.optional(),
  evidenceTier: evidenceTierFieldSchema,
  verification: rowVerificationFieldSchema,
});

const competitorReviewInsightSchema = z.object({
  complaint: z.string().min(1),
  howWeLeverage: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
  evidencePack: paidMediaEvidencePackSchema.optional(),
  evidenceTier: evidenceTierFieldSchema,
  verification: rowVerificationFieldSchema,
});

const channelSuggestionSchema = z.object({
  channel: z.string().min(1),
  recommendation: z.string().min(1),
  verdict: channelVerdictSchema,
  sourceSection: sourceSectionSchema,
  evidencePack: paidMediaEvidencePackSchema.optional(),
  evidenceTier: evidenceTierFieldSchema,
  verification: rowVerificationFieldSchema,
});

const kpiSchema = z.object({
  metric: z.string().min(1),
  role: z.string().min(1),
  definition: z.string().min(1),
});

// SOP projected-results row: Target ICP / KPI / KPI cost / Objective /
// Duration / Budget / Projected Results (±20%). The MODEL never does the
// math — normalizeProjectedResultRow computes projectedCountValue =
// floor(budget / kpiCost), pins marginOfErrorPercent to the SOP constant,
// and derives the count's provenance from the WEAKEST input. kpiCost
// unknown/zero -> the count is omitted, never invented.
// marginOfErrorPercent is OPTIONAL and only present alongside
// projectedCountValue — a ±20% on a number that does not exist is dishonest.
const projectedResultRowSchema = z.object({
  targetIcp: z.string().min(1),
  kpi: z.string().min(1),
  kpiCostValue: paidMediaNumericMoneySchema,
  kpiCostProvenance: z.string().min(1),
  objective: z.string().min(1),
  durationLabel: z.string().min(1),
  phaseMonthlyBudgetValue: paidMediaNumericMoneySchema,
  phaseMonthlyBudgetProvenance: z.string().min(1),
  projectedCountValue: z.number().finite().nonnegative().optional(),
  projectedCountProvenance: z.string().min(1).optional(),
  countBasis: z.string().min(1).optional(),
  marginOfErrorPercent: z.number().finite().nonnegative().optional(),
  // Forward-demand projection inputs/outputs (all provenance 'derived'):
  // spend ÷ CPC = clicks; clicks × blended CVR = projected count;
  // spend ÷ projected count = implied CAC. impliedCac is the HONEST cost the
  // plan actually buys — compared against the brief target CAC, not equal to it.
  cpcValue: z.number().finite().nonnegative().optional(),
  cpcProvenance: z.string().min(1).optional(),
  projectedClicks: z.number().finite().nonnegative().optional(),
  blendedCvrPercent: z.number().finite().nonnegative().optional(),
  impliedCacValue: z.number().finite().nonnegative().optional(),
  impliedCacProvenance: z.string().min(1).optional(),
  // TRIAL->PAID BRIDGE. impliedCac on a funnel-stage row (trials/leads/signups)
  // is the cost per TRIAL SIGNUP, NOT a paid-customer CAC — comparing it to a
  // paid-customer target CAC understates true CAC by the trial->paid multiple.
  // When the brief discloses signup->activation->paid rates we roll the trial
  // cost up to a modeled customer CAC (single value); when it does not, we
  // surface an honest sensitivity BAND instead of a fake-precise number.
  // costPerTrialLabel makes the unit explicit so the reader never conflates the
  // two. All customer-CAC fields are provenance 'derived' (code-computed).
  costPerTrialLabel: z.string().min(1).optional(),
  customerCacValue: z.number().finite().nonnegative().optional(),
  customerCacProvenance: z.string().min(1).optional(),
  customerCacBasis: z.string().min(1).optional(),
  customerCacBandLowValue: z.number().finite().nonnegative().optional(),
  customerCacBandHighValue: z.number().finite().nonnegative().optional(),
  customerCacBandBasis: z.string().min(1).optional(),
  // Honest gap vs the brief's target CAC / funnel-stage goal. Surfaced to the
  // reader; never hard-fails the section.
  goalGapNote: z.string().min(1).optional(),
  sourceSection: sourceSectionSchema,
});

const crossSectionInsightSchema = z.object({
  tension: z.string().min(1),
  sourceSections: z.array(sourceSectionSchema).min(2),
  implicationForPlan: z.string().min(1),
  clientBlindSpot: z.string().min(1),
  secondOrderRisk: z.string().min(1),
  contrarianInversion: z.string().min(1),
  evidenceTier: evidenceTierFieldSchema,
  verification: rowVerificationFieldSchema,
});

const feasibilityAuditSchema = z
  .object({
    summary: z.string().min(1),
    verdicts: z.array(
      z
        .object({
          audience: z.string().min(1),
          allocation: z.number().finite().nonnegative().optional(),
          allocationBasis: z.string().min(1),
          measuredVolume: z.number().finite().nonnegative().optional(),
          volumeBasis: z.string().min(1),
          verdict: z.enum(["fits", "exceeds", "unknown"]),
          math: z.array(z.string().min(1)),
          targetCostPerConversion: z.number().finite().nonnegative().optional(),
          matchedKeywords: z.array(
            z
              .object({
                keyword: z.string().min(1),
                monthlyVolume: z.number().finite().nonnegative(),
                cpc: z.number().finite().nonnegative().optional(),
              })
              .strict(),
          ),
          ceiling: z
            .object({
              min: z.number().finite().nonnegative(),
              max: z.number().finite().nonnegative(),
              basis: z.string().min(1),
            })
            .strict()
            .optional(),
          cpcRange: z
            .object({
              min: z.number().finite().nonnegative(),
              max: z.number().finite().nonnegative(),
              basis: z.string().min(1),
            })
            .strict()
            .optional(),
          ctrRange: z
            .object({
              min: z.number().finite().nonnegative(),
              max: z.number().finite().nonnegative(),
              basis: z.string().min(1),
            })
            .strict()
            .optional(),
          cvrRange: z
            .object({
              min: z.number().finite().nonnegative(),
              max: z.number().finite().nonnegative(),
              basis: z.string().min(1),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const paidMediaPlanBodySchema = z.object({
  campaignOverview: campaignOverviewSchema,
  campaignPhases: z
    .array(campaignPhaseSchema)
    .min(1)
    .max(3)
    .describe("1-3 campaign phases; no filler rows"),
  audienceTypes: z
    .array(audienceTypeSchema)
    .min(1)
    .max(4)
    .describe("1-4 audience types tested in parallel; no filler rows"),
  anglesToTest: z
    .array(angleSchema)
    .min(2)
    .max(6)
    .describe("2-6 evidence-backed creative angles; no filler rows"),
  creativeStrategy: creativeStrategySchema,
  creativeFramework: z
    .array(creativeFrameworkSlotSchema)
    .min(3)
    .max(12)
    .describe("3-12 creative slots; no filler rows"),
  funnelIdeation: z
    .array(funnelIdeationSchema)
    .min(1)
    .max(3)
    .describe("1-3 funnel paths; no filler rows"),
  salesProcess: z
    .array(salesProcessAssetSchema)
    .min(1)
    .max(4)
    .describe("1-4 supplied sales assets, or one explicit gap object"),
  competitorMarketingInsights: z
    .array(competitorMarketingInsightSchema)
    .describe("Competitor marketing teardown (>=2)"),
  competitorReviewInsights: z
    .array(competitorReviewInsightSchema)
    .describe("3 competitor-review complaints + leverage (EXACTLY 3)"),
  channelSuggestions: z
    .array(channelSuggestionSchema)
    .min(1)
    .max(6)
    .describe("1-6 current-funnel suggestion cards; no filler rows"),
  projectedResults: z
    .array(projectedResultRowSchema)
    .min(1)
    .describe(
      "SOP projected-results table: one row per target ICP x phase; the runner computes counts (>=1 row)",
    ),
  kpis: z.array(kpiSchema).min(2).max(5).describe("2-5 KPIs; no filler rows"),
  crossSectionInsight: z
    .array(crossSectionInsightSchema)
    .min(1)
    .max(3)
    .describe("1-3 cross-section tensions that drove the plan"),
  feasibilityAudit: feasibilityAuditSchema.optional(),
});

export const paidMediaPlanSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: paidMediaPlanBodySchema,
  })
  .strict();

export type PaidMediaPlanBody = z.infer<typeof paidMediaPlanBodySchema>;
export type PaidMediaPlanSectionOutput = z.infer<
  typeof paidMediaPlanSectionOutputSchema
>;
export type PaidMediaPlanArtifact = ArtifactEnvelope & {
  body: PaidMediaPlanBody;
};

function slugify(value: unknown): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function snapSourceSection(value: unknown): string {
  if (
    typeof value === "string" &&
    (sourceSectionValues as readonly string[]).includes(value)
  ) {
    return value;
  }

  const slug = slugify(value);
  const aliases: Record<string, string> = {
    buyericp: "positioningBuyerICP",
    "buyer-icp": "positioningBuyerICP",
    competitor: "positioningCompetitorLandscape",
    "competitor-landscape": "positioningCompetitorLandscape",
    competitors: "positioningCompetitorLandscape",
    demand: "positioningDemandIntent",
    "demand-intent": "positioningDemandIntent",
    gtm: "gtmBrief",
    "gtm-brief": "gtmBrief",
    market: "positioningMarketCategory",
    "market-category": "positioningMarketCategory",
    offer: "positioningOfferDiagnostic",
    "offer-diagnostic": "positioningOfferDiagnostic",
    "positioning-buyer-icp": "positioningBuyerICP",
    "positioning-competitor-landscape": "positioningCompetitorLandscape",
    "positioning-demand-intent": "positioningDemandIntent",
    "positioning-market-category": "positioningMarketCategory",
    "positioning-offer-diagnostic": "positioningOfferDiagnostic",
    positioningvoc: "positioningVoiceOfCustomer",
    "positioning-voc": "positioningVoiceOfCustomer",
    voiceofcustomer: "positioningVoiceOfCustomer",
    "positioning-voice-of-customer": "positioningVoiceOfCustomer",
    voc: "positioningVoiceOfCustomer",
    "voice-of-customer": "positioningVoiceOfCustomer",
  };
  const alias = aliases[slug];

  if (alias !== undefined) {
    return alias;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return "unknown-source-section";
}

function snapMoneyProvenance(value: unknown): string {
  if (typeof value === "string" && slugify(value) === "derived") {
    return "model-estimated";
  }

  if (
    typeof value === "string" &&
    (paidMediaMoneyProvenanceValues as readonly string[]).includes(value)
  ) {
    return value;
  }

  const slug = slugify(value);
  const aliases: Record<string, string> = {
    customer: "user-supplied",
    derived: "model-estimated",
    estimate: "model-estimated",
    estimated: "model-estimated",
    explicit: "user-supplied",
    measured: "tool-measured",
    model: "model-estimated",
    "model-estimated": "model-estimated",
    reported: "source-reported",
    scenario: "model-estimated",
    source: "source-reported",
    "source-reported": "source-reported",
    tool: "tool-measured",
    "tool-measured": "tool-measured",
    unknown: "unknown",
    user: "user-supplied",
    "user-supplied": "user-supplied",
  };

  return aliases[slug] ?? "unknown";
}

function snapChannelVerdict(value: unknown): string {
  if (
    typeof value === "string" &&
    (channelVerdictValues as readonly string[]).includes(value.toUpperCase())
  ) {
    return value.toUpperCase();
  }

  const slug = slugify(value);
  const aliases: Record<string, string> = {
    cut: "KILL",
    fix: "FIX",
    keep: "KEEP",
    kill: "KILL",
    rework: "REWORK",
    review: "REVIEW",
    scale: "SCALE",
    start: "ADD",
    test: "ADD",
  };
  const alias = aliases[slug];

  if (alias !== undefined) {
    return alias;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().toUpperCase();
  }

  return "UNKNOWN";
}

function normalizeSourceSection(value: unknown): SourceSection {
  return sourceSectionSchema.parse(snapSourceSection(value));
}

function normalizeChannelVerdict(value: unknown): ChannelVerdict {
  return channelVerdictSchema.parse(snapChannelVerdict(value));
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Unsubstituted budget template literals ("$[Budget]", "[Budget]", "{budget}",
// "$ [ Budget ]") leaked into a live client plan when the brief budget was
// blank — see B3. Brackets are REQUIRED so honest strings like "Budget not
// provided" never match. A field carrying template residue is untrustworthy as
// a whole, so it drops to its honest fallback instead of committing.
const BUDGET_PLACEHOLDER_PATTERN = /\$?\s*[[{]\s*budget\s*[\]}]/i;

function isBudgetPlaceholder(value: unknown): boolean {
  return typeof value === "string" && BUDGET_PLACEHOLDER_PATTERN.test(value);
}

// A money string carrying template residue ("$[Budget] / Month") poisons its
// whole stat: the claimed provenance and any numeric sibling are fabrications
// around an unsubstituted token. Snap provenance to "unknown" so
// normalizeMoneyValue drops the number through the one existing mechanism.
function snapMoneyProvenanceForLabel(
  label: unknown,
  provenance: unknown,
): string {
  return isBudgetPlaceholder(label)
    ? "unknown"
    : snapMoneyProvenance(provenance);
}

function getString(value: unknown, fallback: string): string {
  if (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !BUDGET_PLACEHOLDER_PATTERN.test(value)
  ) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return fallback;
}

// Provenance has exactly ONE writer — the provenance enum field. Models keep
// baking "(user-supplied)"-style parentheticals into money display strings
// ("$300/day (60% of search budget) (user-supplied)", run d838ed4e), so the
// reader renders provenance twice — once raw, once as the enum chip. Strip
// trailing provenance parentheticals at the source; the reader's defensive
// strip stays, but committed data must already be clean.
const TRAILING_PROVENANCE_PARENTHETICAL_PATTERN =
  /(?:\s*\((?:user-supplied|tool-measured|source-reported|model-estimated|derived|unknown|operator-supplied)\))+\s*$/i;

function getMoneyDisplayString(value: unknown, fallback: string): string {
  const display = getString(value, fallback);

  if (display === fallback) {
    return display;
  }

  const stripped = display
    .replace(TRAILING_PROVENANCE_PARENTHETICAL_PATTERN, "")
    .trim();

  return stripped.length > 0 ? stripped : fallback;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  })}`;
}

function formatMonthlyMoneyDisplay(value: number): string {
  return `${formatUsd(value)}/month`;
}

function formatDailyMoneyDisplay(value: number): string {
  return `${formatUsd(value)}/day`;
}

function getMoneyDisplayFromValue({
  fallback,
  rawDisplay,
  unit,
  value,
}: {
  fallback: string;
  rawDisplay: unknown;
  unit: "day" | "month";
  value: number | undefined;
}): string {
  if (value !== undefined) {
    return unit === "day"
      ? formatDailyMoneyDisplay(value)
      : formatMonthlyMoneyDisplay(value);
  }

  return getMoneyDisplayString(rawDisplay, fallback);
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getNestedArray(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  return getArray(getRecord(value)[key]);
}

function normalizeStringArray(value: unknown): string[] {
  return getArray(value).map((item) => getString(item, "")).filter(Boolean);
}

function normalizeMoneyValue({
  provenance,
  value,
}: {
  provenance: string;
  value: unknown;
}): number | undefined {
  return provenance === "unknown" ? undefined : getNumber(value);
}

function optionalNumericField<Key extends string>(
  key: Key,
  value: number | undefined,
): Partial<Record<Key, number>> {
  return value === undefined ? {} : { [key]: value } as Partial<Record<Key, number>>;
}

function optionalStringField<Key extends string>(
  key: Key,
  value: string | undefined,
): Partial<Record<Key, string>> {
  return value === undefined ? {} : { [key]: value } as Partial<Record<Key, string>>;
}

function normalizeCampaignOverview(value: unknown): PaidMediaPlanBody["campaignOverview"] {
  const record = getRecord(value);
  const monthlyBudgetProvenance = snapMoneyProvenanceForLabel(
    record.monthlyBudget,
    record.monthlyBudgetProvenance,
  );
  const dailySpendProvenance = snapMoneyProvenanceForLabel(
    record.dailySpend,
    record.dailySpendProvenance,
  );
  const monthlyBudgetValue = normalizeMoneyValue({
    provenance: monthlyBudgetProvenance,
    value: record.monthlyBudgetValue,
  });
  const dailySpendValue = normalizeMoneyValue({
    provenance: dailySpendProvenance,
    value: record.dailySpendValue,
  });

  return {
    prose: getString(record.prose, "Paid media plan overview needs review."),
    platform: getString(record.platform, "Meta Ads"),
    monthlyBudget: getMoneyDisplayFromValue({
      fallback: "Budget not provided — enter a monthly budget to compute the spend plan",
      rawDisplay: record.monthlyBudget,
      unit: "month",
      value: monthlyBudgetValue,
    }),
    ...optionalNumericField("monthlyBudgetValue", monthlyBudgetValue),
    monthlyBudgetProvenance,
    dailySpend: getMoneyDisplayFromValue({
      fallback: "Daily spend not provided",
      rawDisplay: record.dailySpend,
      unit: "day",
      value: dailySpendValue,
    }),
    ...optionalNumericField("dailySpendValue", dailySpendValue),
    dailySpendProvenance,
    totalMonths: getNumber(record.totalMonths) ?? 4,
    phaseCount: getNumber(record.phaseCount) ?? 2,
    primaryKpi: getString(record.primaryKpi, "MQLs / Signups"),
  };
}

function normalizeCampaignPhase(
  value: unknown,
  index: number,
): PaidMediaPlanBody["campaignPhases"][number] {
  const record = getRecord(value);
  const monthlyBudgetProvenance = snapMoneyProvenanceForLabel(
    record.monthlyBudget,
    record.monthlyBudgetProvenance,
  );
  const monthlyBudgetValue = normalizeMoneyValue({
    provenance: monthlyBudgetProvenance,
    value: record.monthlyBudgetValue,
  });

  return {
    phaseName: getString(
      record.phaseName,
      index === 0 ? "Phase 1 - Testing" : "Phase 2 - Optimization & Scale",
    ),
    monthsLabel: getString(
      record.monthsLabel,
      index === 0 ? "Months 1-2" : "Months 3-4",
    ),
    monthlyBudget: getMoneyDisplayFromValue({
      fallback: "Budget not provided",
      rawDisplay: record.monthlyBudget,
      unit: "month",
      value: monthlyBudgetValue,
    }),
    ...optionalNumericField("monthlyBudgetValue", monthlyBudgetValue),
    monthlyBudgetProvenance,
    bullets:
      normalizeStringArray(record.bullets).length > 0
        ? normalizeStringArray(record.bullets).slice(0, 5)
        : [
            index === 0
              ? "Test multiple audience types in parallel."
              : "Scale winning audience and creative combinations.",
          ],
  };
}

function normalizeAudienceType(
  value: unknown,
  index: number,
): PaidMediaPlanBody["audienceTypes"][number] {
  const record = getRecord(value);
  const dailyBudgetProvenance = snapMoneyProvenanceForLabel(
    record.dailyBudget,
    record.dailyBudgetProvenance,
  );
  const dailyBudgetValue = normalizeMoneyValue({
    provenance: dailyBudgetProvenance,
    value: record.dailyBudgetValue,
  });
  // Platform-NEUTRAL fallbacks only. The old defaults were Meta-branded
  // ("1% Lookalike", "Advantage+"), so a model that omitted an archetype label
  // shipped a Meta mechanism name on plans whose SOP channel policy forbids
  // Meta (Anura rerun: correct LinkedIn/Google targeting under a leaked
  // "Advantage+" label). The skill names the platform-native trios; the
  // fallback must not re-brand the slot.
  const defaults = [
    {
      archetype: "Broad Prospecting",
      slot: "01",
    },
    {
      archetype: "High Intent",
      slot: "02",
    },
    {
      archetype: "AI Optimized",
      slot: "03",
    },
  ];

  return {
    slot: getString(record.slot, defaults[index]?.slot ?? `0${index + 1}`),
    archetype: getString(
      record.archetype,
      defaults[index]?.archetype ?? "Audience slot needs review",
    ),
    dailyBudget: getMoneyDisplayFromValue({
      fallback: "Daily budget not provided",
      rawDisplay: record.dailyBudget,
      unit: "day",
      value: dailyBudgetValue,
    }),
    ...optionalNumericField("dailyBudgetValue", dailyBudgetValue),
    dailyBudgetProvenance,
    detail: getString(record.detail, "Evidence gap: targeting detail missing."),
    sourceSection: normalizeSourceSection(record.sourceSection),
    grounding: getString(record.grounding, "UNVERIFIED"),
  };
}

function normalizeAngle(
  value: unknown,
  index: number,
): PaidMediaPlanBody["anglesToTest"][number] {
  const record = getRecord(value);

  return {
    shortName: getString(record.shortName ?? record.angleName, `Angle ${index + 1}`),
    description: getString(
      record.description ?? record.primaryText ?? record.supportingLine,
      "Evidence gap: creative angle description missing.",
    ),
    angleType: getString(record.angleType, "REVIEW"),
    sourceSection: normalizeSourceSection(record.sourceSection),
    grounding: getString(record.grounding ?? record.insight, "UNVERIFIED"),
  };
}

// SOP creative-production constants (SaaSLaunch 13-slide deck: 5 static +
// 3 video per audience). The brief's creativeCapacity scales the mix when
// supplied; "standard" mirrors the SOP constants.
const SOP_STATIC_CREATIVE_COUNT = 5;
const SOP_VIDEO_CREATIVE_COUNT = 3;
const CREATIVE_CAPACITY_COUNTS: Record<
  PaidMediaCreativeCapacity,
  { staticCount: number; videoCount: number }
> = {
  lean: { staticCount: 3, videoCount: 1 },
  standard: {
    staticCount: SOP_STATIC_CREATIVE_COUNT,
    videoCount: SOP_VIDEO_CREATIVE_COUNT,
  },
  high: { staticCount: 8, videoCount: 5 },
};

const VIDEO_SLOT_LABEL_PATTERN = /\b(ugc|video|vsl|reel|motion)\b/i;
const STATIC_SLOT_LABEL_PATTERN = /\b(static|headline|image|carousel|banner)\b/i;

function classifyCreativeSlotLabel(label: string): "video" | "static" | null {
  if (VIDEO_SLOT_LABEL_PATTERN.test(label)) {
    return "video";
  }

  if (STATIC_SLOT_LABEL_PATTERN.test(label)) {
    return "static";
  }

  return null;
}

// Single-writer creative counts: the runner derives them, the model's values
// are ALWAYS overwritten (run d838ed4e shipped free-invented 9/6/5 against a
// 6-slot framework; the old `?? 5/3/8` defaults silently fabricated counts
// when the model omitted them). Priority: framework slot labels when every
// slot is classifiable -> brief creativeCapacity policy -> SOP constants.
function deriveCreativeCounts({
  creativeCapacity,
  creativeFramework,
}: {
  creativeCapacity?: PaidMediaCreativeCapacity;
  creativeFramework: PaidMediaPlanBody["creativeFramework"];
}): { staticCount: number; videoCount: number } {
  const classified = creativeFramework.map((slot) =>
    classifyCreativeSlotLabel(slot.label),
  );

  if (classified.length > 0 && classified.every((kind) => kind !== null)) {
    return {
      staticCount: classified.filter((kind) => kind === "static").length,
      videoCount: classified.filter((kind) => kind === "video").length,
    };
  }

  if (creativeCapacity !== undefined) {
    return CREATIVE_CAPACITY_COUNTS[creativeCapacity];
  }

  return {
    staticCount: SOP_STATIC_CREATIVE_COUNT,
    videoCount: SOP_VIDEO_CREATIVE_COUNT,
  };
}

function normalizeCreativeStrategy({
  creativeCapacity,
  creativeFramework,
  value,
}: {
  creativeCapacity?: PaidMediaCreativeCapacity;
  creativeFramework: PaidMediaPlanBody["creativeFramework"];
  value: unknown;
}): PaidMediaPlanBody["creativeStrategy"] {
  const record = getRecord(value);
  const counts = deriveCreativeCounts({ creativeCapacity, creativeFramework });

  return {
    prose: getString(record.prose, "Creative mix needs review."),
    staticCount: counts.staticCount,
    videoCount: counts.videoCount,
    totalPerAudience: counts.staticCount + counts.videoCount,
  };
}

function normalizeCreativeFrameworkSlot(
  value: unknown,
  index: number,
): PaidMediaPlanBody["creativeFramework"][number] {
  const record = getRecord(value);
  const labels = [
    "PST 1",
    "PST 2",
    "PST 3",
    "Objection 1",
    "Objection 2",
    "USP",
    "Demo + Objection",
    "Before / After",
  ];

  return {
    label: getString(record.label ?? record.creativeType, labels[index] ?? `Slot ${index + 1}`),
    angleType: getString(record.angleType ?? record.creativeType, "REVIEW"),
    hook: getString(
      record.hook ??
        record.uspSentence ??
        record.problem ??
        record.objectionAnswer ??
        record.transformation,
      "Evidence gap: hook copy missing.",
    ),
    executesAngle: getString(record.executesAngle, `Angle ${Math.min(index + 1, 4)}`),
    sourceSection: normalizeSourceSection(record.sourceSection),
    grounding: getString(record.grounding, "UNVERIFIED"),
  };
}

function normalizeFunnelPath(
  value: unknown,
  index: number,
): PaidMediaPlanBody["funnelIdeation"][number] {
  const record = getRecord(value);
  const ranks = ["1 - PRIMARY", "2 - SECONDARY", "3 - TEST"];

  return {
    rank: getString(record.rank, ranks[index] ?? `${index + 1} - TEST`),
    name: getString(record.name ?? record.funnelType, "Funnel path needs review"),
    description: getString(
      record.description ?? record.recommendation,
      "Evidence gap: funnel description missing.",
    ),
    whatItProves: getString(
      record.whatItProves ?? record.optInToBookedCall,
      "Evidence gap: funnel proof metric missing.",
    ),
  };
}

function normalizeSalesAsset(
  value: unknown,
  index: number,
): PaidMediaPlanBody["salesProcess"][number] {
  const record = getRecord(value);
  const defaults = [
    "Sales Process Overview",
    "SDR Opt-In Flow",
    "Personalization Playbook",
    "Loom Walkthrough",
  ];

  return {
    label: getString(record.label, defaults[index] ?? `Sales Asset ${index + 1}`),
    assetType: getString(record.assetType, index === 3 ? "loom" : "sop-doc"),
    url: getString(record.url, ""),
    note: getString(record.note, "Evidence gap: asset was not provided."),
  };
}

function normalizeSalesProcessAssets(
  value: unknown,
): PaidMediaPlanBody["salesProcess"] {
  const assets = getNestedArray(value, "assets");

  if (assets.length === 0) {
    return [
      normalizeSalesAsset(
        {
          assetType: "gap",
          label: "Sales assets not supplied",
          note: "Client did not supply sales assets; upload sales deck, call recording, process doc, or Loom walkthrough.",
          url: "",
        },
        0,
      ),
    ];
  }

  // Ceiling clamp mirrors funnelIdeation/channelSuggestions/kpis: overshoot
  // truncates (schema max 4), never rejects (live kill on run f3993043 rerun).
  return assets.slice(0, 4).map(normalizeSalesAsset);
}

// Re-stamp a customer-voice-sourced insight to 'unattributed' when the sibling
// VoC section declared an evidence gap. Citing VoC as the proof source when VoC
// produced nothing usable is laundering (run 3b568ea0 VOC-LAUNDERING); the chip
// becomes "Unattributed" rather than a false VoC attribution.
function restampVocSourceSection(
  sourceSection: SourceSection,
  options: NormalizePaidMediaPlanBodyOptions | undefined,
): SourceSection {
  return options?.voiceOfCustomerEvidenceGap === true &&
    sourceSection === "positioningVoiceOfCustomer"
    ? "unattributed"
    : sourceSection;
}

function normalizeCompetitorMarketingInsight(
  value: unknown,
  index: number,
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody["competitorMarketingInsights"][number] {
  const record = getRecord(value);
  const adPlatforms = Array.isArray(record.adPlatforms)
    ? normalizeStringArray(record.adPlatforms).join("; ")
    : getString(record.adPlatforms, "UNVERIFIED");

  return {
    competitor: getString(record.competitor, `Competitor ${index + 1}`),
    messaging: getString(record.messaging, "Evidence gap: messaging missing."),
    adPlatforms,
    estSpendProvenance: snapMoneyProvenance(record.estSpendProvenance),
    icp: getString(record.icp ?? record.icpTargeted, "Evidence gap: ICP missing."),
    angles: getString(record.angles ?? record.anglesTested, "Evidence gap: angles missing."),
    positioning: getString(
      record.positioning ?? record.positioningClaim,
      "Evidence gap: positioning missing.",
    ),
    offer: getString(record.offer, "Evidence gap: offer missing."),
    sourceSection: restampVocSourceSection(
      normalizeSourceSection(record.sourceSection),
      options,
    ),
    grounding: getString(record.grounding, "UNVERIFIED"),
  };
}

function normalizeCompetitorReviewInsight(
  value: unknown,
  index: number,
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody["competitorReviewInsights"][number] {
  const record = getRecord(value);

  return {
    complaint: getString(
      record.complaint ?? record.verbatimComplaint,
      `Evidence gap: competitor complaint ${index + 1} missing.`,
    ),
    howWeLeverage: getString(
      record.howWeLeverage ?? record.adLeverage,
      "Evidence gap: ad leverage missing.",
    ),
    sourceSection: restampVocSourceSection(
      normalizeSourceSection(record.sourceSection),
      options,
    ),
    grounding: getString(record.grounding, "UNVERIFIED"),
  };
}

const CHANNEL_SUGGESTION_RECOMMENDATION_FALLBACK =
  "Evidence gap: channel recommendation missing.";
const CHANNEL_SUGGESTION_KNOWN_KEYS = new Set([
  "channel",
  "detail",
  "note",
  "observation",
  "rationale",
  "recommendation",
  "sourceSection",
  "verdict",
]);

function normalizeChannelSuggestion(
  value: unknown,
  index: number,
): PaidMediaPlanBody["channelSuggestions"][number] {
  const record = getRecord(value);
  const channels = [
    "Website",
    "Content / Organic",
    "Other Ad Platforms",
    "Email / Nurture",
  ];
  // Key drift observed live (runs d838ed4e + f3993043): the model writes the
  // recommendation text under detail/rationale/note. Accept the aliases.
  const recommendation = getString(
    record.recommendation ??
      record.observation ??
      record.detail ??
      record.rationale ??
      record.note,
    CHANNEL_SUGGESTION_RECOMMENDATION_FALLBACK,
  );

  if (recommendation === CHANNEL_SUGGESTION_RECOMMENDATION_FALLBACK) {
    // Key drift visibility: the model emitted recommendation text under an
    // unexpected key (run d838ed4e shipped a 100%-placeholder channel table
    // this way). Surface the stray keys so the drift is debuggable.
    const strayStringKeys = Object.entries(record)
      .filter(
        ([key, entryValue]) =>
          !CHANNEL_SUGGESTION_KNOWN_KEYS.has(key) &&
          typeof entryValue === "string" &&
          entryValue.trim().length > 0,
      )
      .map(([key]) => key);

    if (strayStringKeys.length > 0) {
      console.warn(
        "[paid-media-plan] channelSuggestions row fell back to the placeholder despite carrying string-valued keys — possible key drift",
        { index, strayStringKeys },
      );
    }
  }

  return {
    channel: getString(record.channel, channels[index] ?? `Channel ${index + 1}`),
    recommendation,
    verdict: normalizeChannelVerdict(record.verdict),
    sourceSection: normalizeSourceSection(record.sourceSection),
  };
}

function normalizeKpi(value: unknown, index: number): PaidMediaPlanBody["kpis"][number] {
  const record = getRecord(value);
  const defaults = [
    ["MQLs / Signups", "Primary outcome"],
    ["CTR", "Creative health"],
    ["CPL", "Efficiency"],
  ];

  return {
    metric: getString(record.metric, defaults[index]?.[0] ?? `KPI ${index + 1}`),
    role: getString(record.role, defaults[index]?.[1] ?? "Measurement role"),
    definition: getString(record.definition, "Evidence gap: KPI definition missing."),
  };
}

function normalizeCrossSectionInsight(
  value: unknown,
  index: number,
): PaidMediaPlanBody["crossSectionInsight"][number] {
  const record = getRecord(value);
  const sourceSections = normalizeStringArray(record.sourceSections)
    .map(normalizeSourceSection);

  return {
    tension: getString(record.tension, `Cross-section tension ${index + 1} needs review.`),
    sourceSections,
    implicationForPlan: getString(
      record.implicationForPlan,
      "Evidence gap: plan implication missing.",
    ),
    clientBlindSpot: getString(record.clientBlindSpot, "Evidence gap: blind spot missing."),
    secondOrderRisk: getString(
      record.secondOrderRisk,
      "Evidence gap: second-order risk missing.",
    ),
    contrarianInversion: getString(
      record.contrarianInversion,
      "Evidence gap: contrarian inversion missing.",
    ),
  };
}

// Accepts numeric strings ("$450", "10,000") for the SOP math — DeepSeek's
// compat mode emits them; the display formatting is the UI's job.
function getMoneyNumber(value: unknown): number | undefined {
  const fromNumber = getNumber(value);

  if (fromNumber !== undefined) {
    return fromNumber;
  }

  if (typeof value === "string") {
    const cleaned = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(cleaned) && cleaned >= 0 ? cleaned : undefined;
  }

  return undefined;
}

// paidMediaMoneyProvenanceValues is ordered strongest -> weakest; the count
// inherits the WEAKEST of its two inputs (a model-estimated kpiCost makes the
// count model-estimated no matter how solid the budget is).
function weakestMoneyProvenance(left: string, right: string): string {
  const order = paidMediaMoneyProvenanceValues as readonly string[];
  return order.indexOf(left) >= order.indexOf(right) ? left : right;
}

const SOP_MARGIN_OF_ERROR_PERCENT = 20;

// CAC-unit KPIs: acquisition rows bridge exactly; funnel-stage rows bridge
// conservatively at the same target CAC without inventing stage conversion.
const ACQUISITION_UNIT_PATTERN =
  /\b(customers?|acquisitions?|sign[\s-]?ups?|sales?)\b/i;
const FUNNEL_STAGE_UNIT_PATTERN =
  /\b(trials?|demos?|mqls?|sqls?|leads?|meetings?|bookings?|opportunit(?:y|ies)|pipeline|installs?|subscriptions?|activations?)\b/i;

function getTargetCacBridgeUnit(
  kpi: string,
): "acquisition" | "funnel-stage" | null {
  // Funnel-stage wins when a KPI matches BOTH patterns: "free trial signups"
  // carries the acquisition token "signups" AND the funnel token "trial". A
  // trial/lead/signup-as-funnel KPI is NOT a paid customer, so it must bridge
  // through a trial->paid step rather than be treated as an acquisition (which
  // would equate the per-trial cost to a paid-customer CAC — the c9bc2056 bug).
  if (FUNNEL_STAGE_UNIT_PATTERN.test(kpi)) {
    return "funnel-stage";
  }

  if (ACQUISITION_UNIT_PATTERN.test(kpi)) {
    return "acquisition";
  }

  return null;
}

// Stated industry-average CPC by platform (USD). No CPC field exists in
// onboarding and demand-intent SpyFu CPC is not threaded into this boundary,
// so the forward projection uses a conservative modeled CPC, always tagged
// 'derived'. A blended/unknown platform falls back to the cross-channel mean.
// Longer keys first so "google search" wins over "google".
const STATED_DEFAULT_CPC_BY_PLATFORM: ReadonlyArray<readonly [string, number]> = [
  ["linkedin", 10],
  ["google search", 4],
  ["google ads", 4],
  ["search", 4],
  ["google", 4],
  ["youtube", 2],
  ["twitter", 2],
  ["reddit", 1.5],
  ["instagram", 1.5],
  ["facebook", 1.5],
  ["meta", 1.5],
  ["tiktok", 1],
];
const DEFAULT_BLENDED_CPC = 2.5;

function resolveStatedCpc(channelHint: string | undefined): number {
  if (typeof channelHint === "string" && channelHint.trim().length > 0) {
    const hint = channelHint.toLowerCase();
    for (const [key, cpc] of STATED_DEFAULT_CPC_BY_PLATFORM) {
      if (hint.includes(key)) return cpc;
    }
  }
  return DEFAULT_BLENDED_CPC;
}

// "3%" / "3" / "0.03" -> 0.03. A literal "%" or a bare number > 1 reads as a
// percent; a bare number <= 1 is already a fraction. Out-of-range -> undefined.
export function parsePaidMediaPercentToFraction(
  value: string | undefined,
): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (match === null) return undefined;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  const fraction = value.includes("%") || raw > 1 ? raw / 100 : raw;
  return fraction > 0 && fraction <= 1 ? fraction : undefined;
}

// Blended click->conversion rate for the row's KPI unit. Funnel-stage KPIs
// (trials/leads/signups) convert a click (visitor) to a signup. Acquisition
// KPIs (customers/sales) carry through activation and paid. Returns undefined
// when no stage rate is available -> the projection degrades to an honest gap
// rather than back-solving from the target CAC.
function blendedCvrForUnit(
  unit: "acquisition" | "funnel-stage",
  chain: PaidMediaCvrChain | undefined,
): number | undefined {
  if (chain === undefined) return undefined;
  const stages =
    unit === "acquisition"
      ? [chain.visitorToSignup, chain.signupToActivation, chain.activationToPaid]
      : [chain.visitorToSignup];
  const present = stages.filter(
    (rate): rate is number => typeof rate === "number" && rate > 0,
  );
  if (present.length === 0) return undefined;
  return present.reduce((product, rate) => product * rate, 1);
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function formatPercent(fraction: number | undefined): string {
  return fraction === undefined ? "—" : `${roundTo(fraction * 100, 2)}%`;
}

// When the brief does not disclose a trial->paid (signup->activation->paid)
// conversion, a funnel-stage cost-per-trial cannot collapse to a single
// customer CAC. Rather than assert a fake-precise number or (worse) compare a
// cost-per-trial directly against a paid-customer CAC target, surface a band
// over a conservative, explicitly-labeled trial->paid range.
const DEFAULT_TRIAL_TO_PAID_LOW = 0.1;
const DEFAULT_TRIAL_TO_PAID_HIGH = 0.25;

const COST_PER_TRIAL_LABEL = "Cost per qualified trial (signup) — not customer CAC";

export interface CustomerCacBridge {
  costPerTrialLabel?: string;
  customerCacValue?: number;
  customerCacProvenance?: string;
  customerCacBasis?: string;
  customerCacBandLowValue?: number;
  customerCacBandHighValue?: number;
  customerCacBandBasis?: string;
}

// Roll a forward-projected cost figure up to a paid-customer CAC the buyer can
// honestly compare to their target. Acquisition-unit KPIs already run the funnel
// through to paid, so impliedCac IS the customer CAC. Funnel-stage KPIs
// (trials/leads/signups) need a trial->paid bridge: with disclosed rates we emit
// a single modeled customer CAC; without them, an honest sensitivity band — and
// either way an explicit cost-per-trial label so the units are never conflated.
export function computeCustomerCacBridge(input: {
  bridgeUnit: "acquisition" | "funnel-stage" | null;
  impliedCacValue: number | undefined;
  cvrChain: PaidMediaCvrChain | undefined;
}): CustomerCacBridge {
  const { bridgeUnit, impliedCacValue, cvrChain } = input;

  if (impliedCacValue === undefined || impliedCacValue <= 0) {
    return {};
  }

  if (bridgeUnit === "acquisition") {
    return {
      customerCacValue: impliedCacValue,
      customerCacProvenance: "derived",
      customerCacBasis:
        "Acquisition-unit KPI: the modeled cost already carries a click through activation to a paid customer, so it is the customer CAC.",
    };
  }

  if (bridgeUnit !== "funnel-stage") {
    return {};
  }

  const signupToActivation = cvrChain?.signupToActivation;
  const activationToPaid = cvrChain?.activationToPaid;

  if (
    typeof signupToActivation === "number" &&
    signupToActivation > 0 &&
    typeof activationToPaid === "number" &&
    activationToPaid > 0
  ) {
    const trialToPaid = signupToActivation * activationToPaid;
    const customerCacValue = roundTo(impliedCacValue / trialToPaid, 2);

    return {
      costPerTrialLabel: COST_PER_TRIAL_LABEL,
      customerCacValue,
      customerCacProvenance: "derived",
      customerCacBasis: `${formatUsd(impliedCacValue)} per trial signup ÷ ${formatPercent(trialToPaid)} trial→paid (signup→active ${formatPercent(signupToActivation)} × active→paid ${formatPercent(activationToPaid)}) = ${formatUsd(customerCacValue)} modeled customer CAC.`,
    };
  }

  // No disclosed trial->paid rate: honest band, never a fake point CAC. A higher
  // trial->paid rate yields a LOWER customer CAC, so HIGH rate -> low CAC.
  const bandLow = roundTo(impliedCacValue / DEFAULT_TRIAL_TO_PAID_HIGH, 2);
  const bandHigh = roundTo(impliedCacValue / DEFAULT_TRIAL_TO_PAID_LOW, 2);

  return {
    costPerTrialLabel: COST_PER_TRIAL_LABEL,
    customerCacBandLowValue: bandLow,
    customerCacBandHighValue: bandHigh,
    customerCacBandBasis: `${formatUsd(impliedCacValue)} is cost per free-trial signup, NOT customer CAC. The brief did not disclose a trial→paid rate; at a ${formatPercent(DEFAULT_TRIAL_TO_PAID_LOW)}–${formatPercent(DEFAULT_TRIAL_TO_PAID_HIGH)} trial→paid assumption, modeled customer CAC = ${formatUsd(bandLow)}–${formatUsd(bandHigh)} (confirm with client).`,
  };
}

// Honest gap note: projected count vs an explicit funnel-stage goal, or modeled
// CAC vs target CAC (only for acquisition KPIs, where the units are
// apples-to-apples). Never invents a count from the target CAC.
function buildProjectedGoalGapNote(input: {
  countMethod: "forward" | "cost" | "cost-window" | null;
  bridgeUnit: "acquisition" | "funnel-stage" | null;
  projectedCountValue: number | undefined;
  impliedCacValue: number | undefined;
  customerCacValue: number | undefined;
  customerCacBandHighValue: number | undefined;
  targetCacValue: number | undefined;
  targetTrials: number | undefined;
  hasBudget: boolean;
}): string | undefined {
  const {
    countMethod,
    bridgeUnit,
    projectedCountValue,
    customerCacValue,
    customerCacBandHighValue,
    targetCacValue,
    targetTrials,
    hasBudget,
  } = input;

  if (countMethod === null) {
    // Could not project demand — say so honestly instead of back-solving.
    if (hasBudget && bridgeUnit !== null) {
      return "Projected volume needs a funnel conversion rate (visitor → signup) from the brief; target CAC alone can’t forecast demand.";
    }
    return undefined;
  }
  // A window-total projection divides phase spend by the GOAL cost — the count
  // only lands IF the channel actually buys results at that cost, so flag the
  // assumption rather than presenting it as forecast demand.
  if (countMethod === "cost-window") {
    if (projectedCountValue === undefined) {
      return undefined;
    }
    return `Projects ~${projectedCountValue.toLocaleString("en-US")} over the phase at your goal cost per result — actuals depend on hitting that cost; supply a funnel conversion rate to forecast demand independently.`;
  }
  // A single-cost projection against a FUNNEL-STAGE KPI: the goal cost is per
  // funnel action (e.g. free-trial signup), NOT a paid-customer CAC. Name the
  // gap explicitly so the buyer never reads the per-trial cost as customer CAC.
  if (countMethod === "cost") {
    if (bridgeUnit === "funnel-stage" && customerCacBandHighValue !== undefined) {
      return "This goal cost is per funnel-stage result (e.g. a free-trial signup), not a paid-customer CAC — see the modeled customer-CAC band. Confirm the trial→paid rate to forecast paid customers.";
    }
    return undefined;
  }
  if (countMethod !== "forward" || projectedCountValue === undefined) {
    return undefined;
  }

  if (
    targetTrials !== undefined &&
    targetTrials > 0 &&
    projectedCountValue < targetTrials
  ) {
    const multiple = targetTrials / Math.max(projectedCountValue, 1);
    return `Projects ~${projectedCountValue.toLocaleString("en-US")}/mo against your ~${targetTrials.toLocaleString("en-US")}/mo goal — about ${roundTo(multiple, 1)}× short at this budget and conversion rate.`;
  }

  // Compare the PAID-CUSTOMER CAC (not a funnel-stage trial cost) to the target.
  // For acquisition KPIs customerCac == impliedCac; for funnel-stage it is the
  // trial->paid-bridged value. A bare cost-per-trial is NEVER compared to a
  // customer-CAC target — that conflation is what flattered the plan ~22x.
  if (
    customerCacValue !== undefined &&
    targetCacValue !== undefined &&
    customerCacValue > targetCacValue
  ) {
    const multiple = customerCacValue / Math.max(targetCacValue, 1);
    return `Modeled customer CAC ${formatUsd(customerCacValue)} runs ~${roundTo(multiple, 1)}× your ${formatUsd(targetCacValue)} target — tighten conversion or budget to close it.`;
  }

  if (
    bridgeUnit === "funnel-stage" &&
    customerCacValue === undefined &&
    customerCacBandHighValue !== undefined &&
    targetCacValue !== undefined &&
    customerCacBandHighValue > targetCacValue
  ) {
    return `The projected cost is per free-trial signup, not customer CAC. Confirm the trial→paid rate: at conservative assumptions modeled customer CAC can exceed your ${formatUsd(targetCacValue)} target.`;
  }

  return undefined;
}

// Parse the brief's target CAC string ("≤$4,000", "$4k", "4000") into a
// number. First numeric token wins; zero/negative parses are rejected.
export function parsePaidMediaTargetCacValue(
  value: string | undefined,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([km])?/i);

  if (match === null) {
    return undefined;
  }

  const base = Number(match[1]);

  if (!Number.isFinite(base) || base <= 0) {
    return undefined;
  }

  const suffix = match[2]?.toLowerCase();

  return suffix === "k" ? base * 1000 : suffix === "m" ? base * 1_000_000 : base;
}

// Number of months a projected-results row runs, parsed from its durationLabel.
// "Months 1-2" -> 2, "Month 3" -> 1, "Months 1-3" -> 3. The window length lets
// a phase budget × months ÷ KPI cost project the TOTAL results over the phase,
// not just a single month. A month RANGE parses to (end - start + 1); a single
// month index parses to 1. Labels NOT denominated in months ("Days 1-60",
// "Weeks 1-4", or an unparseable / placeholder label) return 1 so the budget×
// months math degrades to a conservative single-month projection rather than
// mistaking a day/week index for a month count.
export function parsePaidMediaDurationMonths(value: string | undefined): number {
  if (value === undefined || BUDGET_PLACEHOLDER_PATTERN.test(value)) {
    return 1;
  }

  // Only a month-denominated label may span more than one month.
  if (!/\bmonths?\b/i.test(value)) {
    return 1;
  }

  const numbers = value
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((candidate) => Number.isFinite(candidate) && candidate > 0);

  if (numbers === undefined || numbers.length < 2) {
    // "Month 3" (single index) or "Month" (no index) spans one month.
    return 1;
  }

  const start = numbers[0];
  const end = numbers[numbers.length - 1];
  const span = Math.floor(end - start) + 1;
  return span > 0 ? span : 1;
}

function normalizeProjectedResultRow(
  value: unknown,
  index: number,
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody["projectedResults"][number] {
  const record = getRecord(value);
  const kpi = getString(record.kpi ?? record.metric, "Evidence gap: KPI missing.");
  const snappedKpiCostProvenance = snapMoneyProvenance(record.kpiCostProvenance);
  const targetCacBridgeUnit = getTargetCacBridgeUnit(kpi);
  const targetCacValue = parsePaidMediaTargetCacValue(options?.targetCac);

  const phaseMonthlyBudgetProvenance = snapMoneyProvenance(
    record.phaseMonthlyBudgetProvenance,
  );
  const phaseMonthlyBudgetValue =
    phaseMonthlyBudgetProvenance === "unknown"
      ? undefined
      : getMoneyNumber(
          record.phaseMonthlyBudgetValue ??
            record.phaseBudget ??
            record.monthlyBudgetValue,
        );
  const hasBudget =
    phaseMonthlyBudgetValue !== undefined && phaseMonthlyBudgetValue > 0;

  // KPI-COST column: a genuine model/tool cost when present, else the brief's
  // target CAC shown as the GOAL reference. The target CAC is NEVER used to
  // back-solve the projected count — doing so made implied CAC == target CAC
  // by construction and hid the real (~18x) shortfall.
  const hasModelKpiCost = snappedKpiCostProvenance !== "unknown";
  const modelKpiCost = hasModelKpiCost
    ? getMoneyNumber(record.kpiCostValue ?? record.kpiCost)
    : undefined;
  const useTargetReference =
    !hasModelKpiCost &&
    targetCacValue !== undefined &&
    targetCacBridgeUnit !== null;
  const kpiCostValue = hasModelKpiCost
    ? modelKpiCost
    : useTargetReference
      ? targetCacValue
      : undefined;
  const kpiCostProvenance = hasModelKpiCost
    ? snappedKpiCostProvenance
    : useTargetReference
      ? "user-supplied"
      : "unknown";

  // FORWARD demand projection: spend -> CPC -> clicks -> blended CVR -> count.
  const cpcValue = resolveStatedCpc(options?.channelHint);
  const blendedCvr =
    targetCacBridgeUnit !== null
      ? blendedCvrForUnit(targetCacBridgeUnit, options?.cvrChain)
      : undefined;
  const canForwardProject =
    hasBudget && blendedCvr !== undefined && blendedCvr > 0 && cpcValue > 0;
  const projectedClicks = canForwardProject
    ? Math.floor(phaseMonthlyBudgetValue! / cpcValue)
    : undefined;

  let projectedCountValue =
    canForwardProject && projectedClicks !== undefined
      ? Math.floor(projectedClicks * blendedCvr!)
      : undefined;
  let countMethod: "forward" | "cost" | "cost-window" | null =
    projectedCountValue !== undefined ? "forward" : null;

  // Legitimate cost-based count ONLY when the model gave a REAL KPI cost and we
  // could not forward-project. Never back-solve from a target-CAC reference.
  if (
    projectedCountValue === undefined &&
    hasModelKpiCost &&
    modelKpiCost !== undefined &&
    modelKpiCost > 0 &&
    hasBudget
  ) {
    projectedCountValue = Math.floor(phaseMonthlyBudgetValue! / modelKpiCost);
    countMethod = "cost";
  }

  // WINDOW-TOTAL fallback: when neither a forward demand projection nor a real
  // model KPI cost is available but the row carries a budget AND a usable KPI
  // cost (e.g. the brief target-CAC reference), the buyer must still be able to
  // read "$X budget × N months ÷ $Y cost = projected results" rather than an
  // empty cell. durationMonths spreads the projection across the phase window;
  // the goalGapNote flags that the count only lands at the GOAL cost (not a
  // hidden CAC == target identity — implied CAC is never shown for this path).
  const durationMonths = parsePaidMediaDurationMonths(
    getString(record.durationLabel ?? record.duration, ""),
  );
  if (
    projectedCountValue === undefined &&
    hasBudget &&
    kpiCostValue !== undefined &&
    kpiCostValue > 0
  ) {
    const windowCount = Math.floor(
      (phaseMonthlyBudgetValue! * durationMonths) / kpiCostValue,
    );
    if (windowCount > 0) {
      projectedCountValue = windowCount;
      countMethod = "cost-window";
    }
  }

  const impliedCacValue =
    countMethod === "forward" &&
    projectedCountValue !== undefined &&
    projectedCountValue > 0
      ? roundTo(phaseMonthlyBudgetValue! / projectedCountValue, 2)
      : undefined;

  // Bridge the forward cost to a paid-customer CAC the buyer can compare to the
  // target. Funnel-stage rows get an explicit cost-per-trial label + a customer
  // CAC (point estimate when trial->paid disclosed, else a sensitivity band).
  const customerBridge =
    countMethod === "forward"
      ? computeCustomerCacBridge({
          bridgeUnit: targetCacBridgeUnit,
          impliedCacValue,
          cvrChain: options?.cvrChain,
        })
      : // Funnel-stage cost / cost-window rows have no forward implied CAC, but
        // their kpiCostValue IS the cost-per-funnel-action (e.g. cost per free-
        // trial signup). Bridge from that so a per-trial cost is shown with its
        // honest modeled-customer-CAC band, never as a flat paid-customer CAC.
        targetCacBridgeUnit === "funnel-stage" &&
          countMethod !== null &&
          kpiCostValue !== undefined
        ? computeCustomerCacBridge({
            bridgeUnit: targetCacBridgeUnit,
            impliedCacValue: kpiCostValue,
            cvrChain: options?.cvrChain,
          })
        : {};

  const targetTrials = parsePaidMediaTargetCacValue(
    options?.targetTrialsPerMonth,
  );
  const goalGapNote = buildProjectedGoalGapNote({
    countMethod,
    bridgeUnit: targetCacBridgeUnit,
    projectedCountValue,
    impliedCacValue,
    customerCacValue: customerBridge.customerCacValue,
    customerCacBandHighValue: customerBridge.customerCacBandHighValue,
    targetCacValue,
    targetTrials,
    hasBudget,
  });

  const windowMonths = durationMonths;
  const countBasis =
    countMethod === "forward"
      ? `Projected from spend ÷ $${cpcValue} CPC × ${formatPercent(blendedCvr)} funnel conversion (modeled).`
      : countMethod === "cost"
        ? "At the reported KPI cost."
        : countMethod === "cost-window"
          ? `Budget × ${windowMonths} month${windowMonths === 1 ? "" : "s"} ÷ goal cost per result.`
          : undefined;

  return {
    targetIcp: getString(
      record.targetIcp ?? record.icp,
      `Evidence gap: target ICP missing for projected-results row ${index + 1}.`,
    ),
    kpi,
    ...optionalNumericField("kpiCostValue", kpiCostValue),
    kpiCostProvenance,
    objective: getString(record.objective, "Evidence gap: objective missing."),
    durationLabel: getString(
      record.durationLabel ?? record.duration,
      "Evidence gap: duration missing.",
    ),
    ...optionalNumericField("phaseMonthlyBudgetValue", phaseMonthlyBudgetValue),
    phaseMonthlyBudgetProvenance,
    // The SOP margin only qualifies a count that exists — no ±20% on nothing.
    ...(projectedCountValue === undefined
      ? {}
      : {
          projectedCountValue,
          // Forward-projected and window-total counts are both DERIVED (the
          // math is code-computed from budget/cost/window), written directly;
          // a model-cost count inherits its weakest input.
          projectedCountProvenance:
            countMethod === "forward" || countMethod === "cost-window"
              ? "derived"
              : weakestMoneyProvenance(
                  kpiCostProvenance,
                  phaseMonthlyBudgetProvenance,
                ),
          ...optionalStringField("countBasis", countBasis),
          marginOfErrorPercent: SOP_MARGIN_OF_ERROR_PERCENT,
        }),
    // Forward-funnel exhibits — only when the count was demand-projected.
    ...(countMethod === "forward"
      ? {
          cpcValue,
          cpcProvenance: "derived",
          ...optionalNumericField("projectedClicks", projectedClicks),
          ...optionalNumericField(
            "blendedCvrPercent",
            blendedCvr === undefined ? undefined : roundTo(blendedCvr * 100, 2),
          ),
          ...optionalNumericField("impliedCacValue", impliedCacValue),
          ...(impliedCacValue === undefined
            ? {}
            : { impliedCacProvenance: "derived" }),
          ...bridgeToRowFields(customerBridge),
        }
      : {}),
    // Funnel-stage cost / cost-window rows carry the customer-CAC bridge too, so
    // a per-trial cost is shown with its honest modeled-CAC band rather than as a
    // flat paid-customer CAC. (Forward rows already include it in the block above;
    // non-funnel / acquisition rows get an empty bridge, so this is a no-op.)
    ...(countMethod !== "forward" ? bridgeToRowFields(customerBridge) : {}),
    ...optionalStringField("goalGapNote", goalGapNote),
    sourceSection: normalizeSourceSection(record.sourceSection),
  };
}

// Class rule learned across runs d838ed4e/f3993043: every hard array bound
// in this body schema is a section-killer under model drift. The normalizer
// snaps to the bound (truncate overshoot, synthesize-from-own-numbers or
// honest-gap on undershoot) — the schema bounds then document the contract
// instead of enforcing it against the model.
function synthesizeProjectedResultsFromPhases(
  phases: PaidMediaPlanBody["campaignPhases"],
  overview: PaidMediaPlanBody["campaignOverview"],
  options?: NormalizePaidMediaPlanBodyOptions,
): unknown[] {
  const rows = phases
    .filter((phase) => phase.monthlyBudgetValue !== undefined)
    .map((phase) => ({
      targetIcp: "See audience types (slots 01-03)",
      kpi: overview.primaryKpi,
      kpiCostProvenance: "unknown",
      objective: phase.phaseName,
      durationLabel: phase.monthsLabel,
      phaseMonthlyBudgetValue: phase.monthlyBudgetValue,
      phaseMonthlyBudgetProvenance: phase.monthlyBudgetProvenance,
      sourceSection: "gtmBrief",
    }));
  return rows.map((row, index) =>
    normalizeProjectedResultRow(row, index, options),
  );
}

// ---- Honest-gap-row synthesis (mirrors normalizeSalesProcessAssets pattern) --
// When the model undershoots a schema floor (e.g. BuyerICP is thin → 0
// audienceTypes), synthesize honest rows whose load-bearing text is prefixed
// "Evidence gap:" so isGapText / rowIsHonestGap in paid-media-evidence-pack.ts
// correctly flags them as amber-probe cards instead of confident grounded blocks.
// The schema .min(N) floors are NOT weakened — these rows satisfy them honestly.

function synthesizeAudienceTypeGapRows(
  rows: PaidMediaPlanBody["audienceTypes"],
  floor: number,
): PaidMediaPlanBody["audienceTypes"] {
  if (rows.length >= floor) {
    return rows;
  }
  const filled = [...rows];
  const slotLabels = ["01", "02", "03", "04"];
  while (filled.length < floor) {
    const index = filled.length;
    filled.push({
      slot: slotLabels[index] ?? `0${index + 1}`,
      archetype: `Evidence gap: audience slot ${index + 1} not grounded`,
      dailyBudget: "Daily budget not provided",
      dailyBudgetProvenance: "unknown",
      detail: "Evidence gap: no buyer audience data from upstream BuyerICP.",
      sourceSection: "unattributed",
      grounding: "Evidence gap: no upstream evidence to ground this row.",
    });
  }
  return filled;
}

function synthesizeAngleGapRows(
  rows: PaidMediaPlanBody["anglesToTest"],
  floor: number,
): PaidMediaPlanBody["anglesToTest"] {
  if (rows.length >= floor) {
    return rows;
  }
  const filled = [...rows];
  while (filled.length < floor) {
    const index = filled.length;
    filled.push({
      shortName: `Evidence gap: angle ${index + 1}`,
      description: `Evidence gap: creative angle ${index + 1} not grounded from upstream evidence.`,
      angleType: "REVIEW",
      sourceSection: "unattributed",
      grounding: "Evidence gap: no upstream evidence to ground this angle.",
    });
  }
  return filled;
}

function synthesizeCreativeFrameworkGapRows(
  rows: PaidMediaPlanBody["creativeFramework"],
  floor: number,
): PaidMediaPlanBody["creativeFramework"] {
  if (rows.length >= floor) {
    return rows;
  }
  const filled = [...rows];
  const slotLabels = ["PST 1", "PST 2", "PST 3", "Objection 1", "Objection 2", "USP"];
  while (filled.length < floor) {
    const index = filled.length;
    filled.push({
      label: slotLabels[index] ?? `Slot ${index + 1}`,
      angleType: "REVIEW",
      hook: `Evidence gap: hook for slot ${index + 1} not grounded from upstream.`,
      executesAngle: `Angle ${Math.min(index + 1, 4)}`,
      sourceSection: "unattributed",
      grounding: "Evidence gap: no upstream evidence to ground this creative slot.",
    });
  }
  return filled;
}

function synthesizeKpiGapRows(
  rows: PaidMediaPlanBody["kpis"],
  floor: number,
): PaidMediaPlanBody["kpis"] {
  if (rows.length >= floor) {
    return rows;
  }
  const filled = [...rows];
  const defaults = [
    { metric: "Evidence gap: primary KPI", role: "Primary outcome" },
    { metric: "Evidence gap: secondary KPI", role: "Efficiency" },
  ];
  while (filled.length < floor) {
    const index = filled.length;
    filled.push({
      metric: defaults[index]?.metric ?? `Evidence gap: KPI ${index + 1}`,
      role: defaults[index]?.role ?? "Measurement role",
      definition: `Evidence gap: KPI definition ${index + 1} not grounded from upstream evidence.`,
    });
  }
  return filled;
}

export function normalizePaidMediaPlanBody(
  value: unknown,
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody {
  const record = getRecord(value);
  const creativeFramework = synthesizeCreativeFrameworkGapRows(
    getNestedArray(record.creativeFramework, "creatives").map(
      normalizeCreativeFrameworkSlot,
    ),
    3,
  );
  const campaignOverview = normalizeCampaignOverview(record.campaignOverview);
  const campaignPhases = getNestedArray(record.campaignPhases, "phases").map(
    normalizeCampaignPhase,
  );
  const projectedResults = getNestedArray(record.projectedResults, "rows").map(
    (row, index) => normalizeProjectedResultRow(row, index, options),
  );
  // An omitted SOP table is derivable from the plan's own cascade: one row
  // per budgeted phase, KPI cost honestly unknown unless the brief-CAC
  // bridge fills it (run f3993043 died on the empty-array floor).
  const projectedResultsOrSynthesized =
    projectedResults.length > 0
      ? projectedResults
      : synthesizeProjectedResultsFromPhases(
          campaignPhases,
          campaignOverview,
          options,
        );
  const crossSectionInsights = getNestedArray(
    record.crossSectionInsight,
    "insights",
  ).map(normalizeCrossSectionInsight);
  // Insights citing fewer than two sections are not cross-section; drop
  // them. If none survive, keep the first with the brief added as the
  // second leg (the brief feeds every cross-section tension by design).
  const crossSectionWithTwoLegs = crossSectionInsights.filter(
    (insight) => insight.sourceSections.length >= 2,
  );
  const crossSectionInsight = (crossSectionWithTwoLegs.length > 0
    ? crossSectionWithTwoLegs
    : crossSectionInsights.slice(0, 1).map((insight) => ({
        ...insight,
        sourceSections: [
          ...new Set([...insight.sourceSections, "gtmBrief" as const]),
        ],
      }))
  ).slice(0, 3);
  const parsed = paidMediaPlanBodySchema.parse({
    campaignOverview,
    campaignPhases,
    audienceTypes: synthesizeAudienceTypeGapRows(
      getNestedArray(record.audienceTypes, "audiences").map(normalizeAudienceType),
      1,
    ),
    anglesToTest: synthesizeAngleGapRows(
      getNestedArray(record.anglesToTest, "angles").map(normalizeAngle),
      2,
    ),
    creativeStrategy: normalizeCreativeStrategy({
      creativeCapacity: options?.creativeCapacity,
      creativeFramework,
      value: record.creativeStrategy,
    }),
    creativeFramework,
    // Models overshoot the 1-3 funnel ceiling under load; keep the first
    // three (rank labels are positional: 1 - PRIMARY / 2 - SECONDARY /
    // 3 - TEST) instead of rejecting the section (run f3993043).
    funnelIdeation: getNestedArray(record.funnelIdeation, "recommendations")
      .map(normalizeFunnelPath)
      .slice(0, 3),
    salesProcess: normalizeSalesProcessAssets(record.salesProcess),
    competitorMarketingInsights: getNestedArray(
      record.competitorMarketingInsights,
      "competitors",
    ).map((insight, index) =>
      normalizeCompetitorMarketingInsight(insight, index, options),
    ),
    competitorReviewInsights: getNestedArray(
      record.competitorReviewInsights,
      "insights",
    ).map((insight, index) =>
      normalizeCompetitorReviewInsight(insight, index, options),
    ),
    channelSuggestions: getNestedArray(record.channelSuggestions, "suggestions")
      .map(normalizeChannelSuggestion)
      .slice(0, 6),
    projectedResults: projectedResultsOrSynthesized,
    kpis: synthesizeKpiGapRows(
      getNestedArray(record.kpis, "kpis").map(normalizeKpi).slice(0, 5),
      2,
    ),
    crossSectionInsight,
    ...(isPlainRecord(record.feasibilityAudit)
      ? { feasibilityAudit: record.feasibilityAudit }
      : {}),
  });

  const partitioned = reconcileProjectedResultsBudgetPartition(parsed, options);
  return reconcilePaidMediaBudgetCascade(partitioned);
}

// The budget cascade reconciliation contract (section-prompt-guidance.ts $5
// rule), enforced in CODE: when the optional numeric siblings are emitted,
// (a) the audience daily budgets must sum to the overview daily spend within
// $5, (b) dailySpendValue*30 must equal monthlyBudgetValue within $25, and
// (c) no single phase may budget more per month than the plan's monthly
// budget (phases may overlap, so there is deliberately NO phase-sum check).
const AUDIENCE_DAILY_SUM_TOLERANCE_USD = 5;
const DAILY_TIMES_30_TOLERANCE_USD = 25;
// Projected-results rows that share a durationLabel run CONCURRENTLY, so their
// per-move monthly budgets must PARTITION (sum to, not exceed) the plan's
// monthly budget. Rows on different durations are sequential/overlapping phases
// and are deliberately not summed. Run c77ff0e1 summed 25000+5000+5000=$35,000
// against a $25,000 plan — phantom spend that inflated the trial projection.
const PROJECTED_PARTITION_TOLERANCE_USD = 50;

export type PaidMediaBudgetCascadeViolation =
  | { kind: "audience-sum"; message: string }
  | { kind: "daily-vs-monthly"; message: string }
  | { kind: "phase-exceeds-monthly"; message: string; phaseIndex: number }
  | { kind: "projected-partition"; message: string; durationLabel: string };

type AudienceBudgetRepair = {
  derivedIndexes: ReadonlySet<number>;
  values: number[];
};

// Repair-prompt-facing dollar formatting: cents precision, no float artifacts.
function formatUsdForError(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export function collectPaidMediaBudgetCascadeViolations(
  body: PaidMediaPlanBody,
): PaidMediaBudgetCascadeViolation[] {
  const violations: PaidMediaBudgetCascadeViolation[] = [];
  const { dailySpendValue, monthlyBudgetValue } = body.campaignOverview;
  const audienceValues = body.audienceTypes.map(
    (audience) => audience.dailyBudgetValue,
  );

  if (
    dailySpendValue !== undefined &&
    audienceValues.length > 0 &&
    audienceValues.every((value) => value !== undefined)
  ) {
    const audienceSum = audienceValues.reduce(
      (sum, value) => sum + (value ?? 0),
      0,
    );

    if (Math.abs(audienceSum - dailySpendValue) > AUDIENCE_DAILY_SUM_TOLERANCE_USD) {
      violations.push({
        kind: "audience-sum",
        message: `body.audienceTypes: sum of dailyBudgetValue ($${formatUsdForError(audienceSum)}) must equal body.campaignOverview.dailySpendValue ($${formatUsdForError(dailySpendValue)}) within $${AUDIENCE_DAILY_SUM_TOLERANCE_USD}; fix the audience split or omit the numeric siblings.`,
      });
    }
  }

  if (dailySpendValue !== undefined && monthlyBudgetValue !== undefined) {
    const projectedMonthly = dailySpendValue * 30;

    if (
      Math.abs(projectedMonthly - monthlyBudgetValue) >
      DAILY_TIMES_30_TOLERANCE_USD
    ) {
      violations.push({
        kind: "daily-vs-monthly",
        message: `body.campaignOverview: dailySpendValue * 30 ($${formatUsdForError(projectedMonthly)}) must equal monthlyBudgetValue ($${formatUsdForError(monthlyBudgetValue)}) within $${DAILY_TIMES_30_TOLERANCE_USD}; recompute dailySpendValue = monthlyBudgetValue / 30 or omit the numeric sibling.`,
      });
    }
  }

  if (monthlyBudgetValue !== undefined) {
    body.campaignPhases.forEach((phase, phaseIndex) => {
      if (
        phase.monthlyBudgetValue !== undefined &&
        phase.monthlyBudgetValue > monthlyBudgetValue
      ) {
        violations.push({
          kind: "phase-exceeds-monthly",
          message: `body.campaignPhases[${phaseIndex}]: monthlyBudgetValue ($${formatUsdForError(phase.monthlyBudgetValue)}) exceeds body.campaignOverview.monthlyBudgetValue ($${formatUsdForError(monthlyBudgetValue)}); a single phase cannot budget more than the plan's monthly budget.`,
          phaseIndex,
        });
      }
    });

    // TWO OR MORE concurrent projected-results rows (same durationLabel) must
    // partition, not exceed, the monthly budget — otherwise the trial
    // projection sums phantom spend (run c77ff0e1: 25000+5000+5000=$35,000 vs a
    // $25,000 plan). A single row is left to its own (possibly larger) budget;
    // one row cannot double-count against itself.
    const concurrentByDuration = new Map<string, { sum: number; count: number }>();
    body.projectedResults.forEach((row) => {
      if (
        row.phaseMonthlyBudgetValue !== undefined &&
        isSubstantiveProjectedResultRow(row)
      ) {
        const entry = concurrentByDuration.get(row.durationLabel) ?? {
          sum: 0,
          count: 0,
        };
        entry.sum += row.phaseMonthlyBudgetValue;
        entry.count += 1;
        concurrentByDuration.set(row.durationLabel, entry);
      }
    });
    concurrentByDuration.forEach((entry, durationLabel) => {
      if (
        entry.count >= 2 &&
        entry.sum > monthlyBudgetValue + PROJECTED_PARTITION_TOLERANCE_USD
      ) {
        violations.push({
          kind: "projected-partition",
          durationLabel,
          message: `body.projectedResults: ${entry.count} concurrent rows for "${durationLabel}" budget $${formatUsdForError(entry.sum)} total against a $${formatUsdForError(monthlyBudgetValue)} monthly plan; per-move budgets in one window must partition the monthly budget, not exceed it.`,
        });
      }
    });
  }

  return violations;
}

function sumNumbers(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function allocateWholeDollarsByLargestRemainder(
  rawValues: readonly number[],
  targetValue: number,
): number[] {
  if (rawValues.length === 0) {
    return [];
  }

  const target = Math.max(0, Math.round(targetValue));
  const nonnegativeValues = rawValues.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 0,
  );
  const rawTotal = sumNumbers(nonnegativeValues);
  const weights =
    rawTotal > 0 ? nonnegativeValues : rawValues.map(() => 1);
  const weightTotal = rawTotal > 0 ? rawTotal : rawValues.length;
  const quotas = weights.map((value) => (value / weightTotal) * target);
  const allocations = quotas.map((quota) => Math.floor(quota));
  const remainders = quotas
    .map((quota, index) => ({
      fraction: quota - Math.floor(quota),
      index,
    }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  const remainingDollars = target - sumNumbers(allocations);

  for (let index = 0; index < remainingDollars; index += 1) {
    const remainder = remainders[index];

    if (remainder !== undefined) {
      allocations[remainder.index] += 1;
    }
  }

  return allocations;
}

function getAudienceBudgetRepair(
  audienceTypes: PaidMediaPlanBody["audienceTypes"],
  dailySpendValue: number | undefined,
): AudienceBudgetRepair | null {
  if (dailySpendValue === undefined || audienceTypes.length === 0) {
    return null;
  }

  const values = audienceTypes.map((audience) => audience.dailyBudgetValue);
  const presentEntries = values
    .map((value, index) => ({ index, value }))
    .filter(
      (entry): entry is { index: number; value: number } =>
        entry.value !== undefined,
    );
  const missingIndexes = values
    .map((value, index) => (value === undefined ? index : null))
    .filter((index): index is number => index !== null);

  if (presentEntries.length === audienceTypes.length) {
    const presentValues = presentEntries.map((entry) => entry.value);
    const presentSum = sumNumbers(presentValues);

    if (
      Math.abs(presentSum - dailySpendValue) <=
      AUDIENCE_DAILY_SUM_TOLERANCE_USD
    ) {
      return null;
    }

    return {
      derivedIndexes: new Set(values.map((_value, index) => index)),
      values: allocateWholeDollarsByLargestRemainder(
        presentValues,
        dailySpendValue,
      ),
    };
  }

  if (presentEntries.length === 0) {
    return {
      derivedIndexes: new Set(values.map((_value, index) => index)),
      values: allocateWholeDollarsByLargestRemainder(
        values.map(() => 1),
        dailySpendValue,
      ),
    };
  }

  const presentSum = sumNumbers(presentEntries.map((entry) => entry.value));
  const remainingBudget = dailySpendValue - presentSum;

  if (remainingBudget > 0) {
    const missingAllocations = allocateWholeDollarsByLargestRemainder(
      missingIndexes.map(() => 1),
      remainingBudget,
    );
    const repairedValues = values.map((value) => value ?? 0);

    missingIndexes.forEach((audienceIndex, allocationIndex) => {
      repairedValues[audienceIndex] = missingAllocations[allocationIndex] ?? 0;
    });

    return {
      derivedIndexes: new Set(missingIndexes),
      values: repairedValues,
    };
  }

  const fallbackMissingRawValue =
    presentEntries.length > 0 ? presentSum / presentEntries.length : 1;

  return {
    derivedIndexes: new Set(values.map((_value, index) => index)),
    values: allocateWholeDollarsByLargestRemainder(
      values.map((value) => value ?? fallbackMissingRawValue),
      dailySpendValue,
    ),
  };
}

function normalizeCampaignOverviewMoneyDisplays(
  overview: PaidMediaPlanBody["campaignOverview"],
): PaidMediaPlanBody["campaignOverview"] {
  return {
    ...overview,
    ...(overview.monthlyBudgetValue === undefined
      ? {}
      : { monthlyBudget: formatMonthlyMoneyDisplay(overview.monthlyBudgetValue) }),
    ...(overview.dailySpendValue === undefined
      ? {}
      : { dailySpend: formatDailyMoneyDisplay(overview.dailySpendValue) }),
  };
}

function normalizeCampaignPhaseMoneyDisplay(
  phase: PaidMediaPlanBody["campaignPhases"][number],
): PaidMediaPlanBody["campaignPhases"][number] {
  return phase.monthlyBudgetValue === undefined
    ? phase
    : {
        ...phase,
        monthlyBudget: formatMonthlyMoneyDisplay(phase.monthlyBudgetValue),
      };
}

function normalizeAudienceMoneyDisplay(
  audience: PaidMediaPlanBody["audienceTypes"][number],
): PaidMediaPlanBody["audienceTypes"][number] {
  return audience.dailyBudgetValue === undefined
    ? audience
    : {
        ...audience,
        dailyBudget: formatDailyMoneyDisplay(audience.dailyBudgetValue),
      };
}

// Single-source mapping from a CustomerCacBridge to the optional row fields so
// the row normalizer and the partition reconciler can never diverge.
function bridgeToRowFields(
  bridge: CustomerCacBridge,
): Partial<PaidMediaPlanBody["projectedResults"][number]> {
  return {
    ...optionalStringField("costPerTrialLabel", bridge.costPerTrialLabel),
    ...optionalNumericField("customerCacValue", bridge.customerCacValue),
    ...optionalStringField(
      "customerCacProvenance",
      bridge.customerCacProvenance,
    ),
    ...optionalStringField("customerCacBasis", bridge.customerCacBasis),
    ...optionalNumericField(
      "customerCacBandLowValue",
      bridge.customerCacBandLowValue,
    ),
    ...optionalNumericField(
      "customerCacBandHighValue",
      bridge.customerCacBandHighValue,
    ),
    ...optionalStringField("customerCacBandBasis", bridge.customerCacBandBasis),
  };
}

// Rebuild one projected-results row's forward funnel + customer-CAC bridge at a
// partition-corrected budget. cost-per-trial and customer CAC are budget-
// invariant ratios, but clicks/count scale with spend; we re-derive the bridge
// (and its basis string) so no stale value survives. Cost-based rows (no
// forward CPC) just rescale their count.
function recomputeProjectedRowForBudget(
  row: PaidMediaPlanBody["projectedResults"][number],
  newBudget: number,
  options: NormalizePaidMediaPlanBodyOptions | undefined,
): PaidMediaPlanBody["projectedResults"][number] {
  const {
    costPerTrialLabel: _label,
    customerCacValue: _cac,
    customerCacProvenance: _cacProv,
    customerCacBasis: _cacBasis,
    customerCacBandLowValue: _bandLow,
    customerCacBandHighValue: _bandHigh,
    customerCacBandBasis: _bandBasis,
    goalGapNote: _goalGapNote,
    ...rowWithoutDerived
  } = row;
  const base = { ...rowWithoutDerived, phaseMonthlyBudgetValue: newBudget };

  if (
    row.cpcValue !== undefined &&
    row.cpcValue > 0 &&
    row.blendedCvrPercent !== undefined &&
    row.blendedCvrPercent > 0
  ) {
    const projectedClicks = Math.floor(newBudget / row.cpcValue);
    const projectedCountValue = Math.floor(
      projectedClicks * (row.blendedCvrPercent / 100),
    );

    if (projectedCountValue > 0) {
      const impliedCacValue = roundTo(newBudget / projectedCountValue, 2);
      const bridgeUnit = getTargetCacBridgeUnit(row.kpi);
      const bridge = computeCustomerCacBridge({
        bridgeUnit,
        impliedCacValue,
        cvrChain: options?.cvrChain,
      });
      const goalGapNote = buildProjectedGoalGapNote({
        countMethod: "forward",
        bridgeUnit,
        projectedCountValue,
        impliedCacValue,
        customerCacValue: bridge.customerCacValue,
        customerCacBandHighValue: bridge.customerCacBandHighValue,
        targetCacValue: parsePaidMediaTargetCacValue(options?.targetCac),
        targetTrials: parsePaidMediaTargetCacValue(
          options?.targetTrialsPerMonth,
        ),
        hasBudget: true,
      });

      return {
        ...base,
        projectedClicks,
        projectedCountValue,
        impliedCacValue,
        ...bridgeToRowFields(bridge),
        ...optionalStringField("goalGapNote", goalGapNote),
      };
    }

    return { ...base, projectedClicks };
  }

  if (
    row.kpiCostValue !== undefined &&
    row.kpiCostValue > 0 &&
    row.projectedCountValue !== undefined
  ) {
    const projectedCountValue = Math.floor(newBudget / row.kpiCostValue);
    if (projectedCountValue > 0) {
      return { ...base, projectedCountValue };
    }
  }

  return base;
}

// Deterministically partition the monthly budget across concurrent (same
// durationLabel) projected-results rows so per-move budgets SUM to the plan's
// monthly budget instead of exceeding it, then re-derive each row's forward
// funnel at the corrected budget. Rows on distinct durations are sequential /
// overlapping phases and are deliberately left untouched.
function reconcileProjectedResultsBudgetPartition(
  body: PaidMediaPlanBody,
  options: NormalizePaidMediaPlanBodyOptions | undefined,
): PaidMediaPlanBody {
  const monthlyBudgetValue = body.campaignOverview.monthlyBudgetValue;

  if (monthlyBudgetValue === undefined || monthlyBudgetValue <= 0) {
    return body;
  }

  const indexesByDuration = new Map<string, number[]>();
  body.projectedResults.forEach((row, index) => {
    if (
      row.phaseMonthlyBudgetValue !== undefined &&
      isSubstantiveProjectedResultRow(row)
    ) {
      const list = indexesByDuration.get(row.durationLabel) ?? [];
      list.push(index);
      indexesByDuration.set(row.durationLabel, list);
    }
  });

  const rows = [...body.projectedResults];
  let changed = false;

  indexesByDuration.forEach((indexes) => {
    // One concurrent row cannot double-count against itself; only partition a
    // window with two or more competing per-move budgets.
    if (indexes.length < 2) {
      return;
    }

    const budgets = indexes.map(
      (index) => rows[index].phaseMonthlyBudgetValue as number,
    );
    const sum = sumNumbers(budgets);

    if (sum <= monthlyBudgetValue + PROJECTED_PARTITION_TOLERANCE_USD) {
      return;
    }

    const partitioned = allocateWholeDollarsByLargestRemainder(
      budgets,
      monthlyBudgetValue,
    );
    indexes.forEach((rowIndex, allocationIndex) => {
      rows[rowIndex] = recomputeProjectedRowForBudget(
        rows[rowIndex],
        partitioned[allocationIndex] ?? 0,
        options,
      );
    });
    changed = true;
  });

  if (!changed) {
    return body;
  }

  console.warn(
    "[paid-media-plan] projected-results budget partition repaired deterministically",
    { monthlyBudgetValue },
  );

  return { ...body, projectedResults: rows };
}

// Normalize-time repair for a cascade the model failed to reconcile. Monthly
// budget is the anchor when present; code repairs daily spend, audience split,
// and phase caps before validation instead of dropping buyer-usable numbers.
export function reconcilePaidMediaBudgetCascade(
  body: PaidMediaPlanBody,
): PaidMediaPlanBody {
  const violations = collectPaidMediaBudgetCascadeViolations(body);
  const monthlyBudgetValue = body.campaignOverview.monthlyBudgetValue;
  const shouldDeriveDailySpend =
    monthlyBudgetValue !== undefined &&
    (body.campaignOverview.dailySpendValue === undefined ||
      violations.some((violation) => violation.kind === "daily-vs-monthly"));
  const dailySpendValue = shouldDeriveDailySpend
    ? Math.round(monthlyBudgetValue / 30)
    : body.campaignOverview.dailySpendValue;

  const campaignOverview = normalizeCampaignOverviewMoneyDisplays({
    ...body.campaignOverview,
    ...(dailySpendValue === undefined
      ? {}
      : { dailySpendValue }),
    ...(shouldDeriveDailySpend ? { dailySpendProvenance: "derived" } : {}),
  });
  const phaseIndexesToClamp = new Set(
    violations.flatMap((violation) =>
      violation.kind === "phase-exceeds-monthly" ? [violation.phaseIndex] : [],
    ),
  );
  const campaignPhases = body.campaignPhases.map((phase, phaseIndex) => {
    const shouldClampPhase =
      monthlyBudgetValue !== undefined && phaseIndexesToClamp.has(phaseIndex);
    const repairedPhase = shouldClampPhase
      ? {
          ...phase,
          monthlyBudgetValue: monthlyBudgetValue,
          monthlyBudgetProvenance: "derived",
        }
      : phase;

    return normalizeCampaignPhaseMoneyDisplay(repairedPhase);
  });
  const audienceRepair = getAudienceBudgetRepair(
    body.audienceTypes,
    dailySpendValue,
  );
  const audienceTypes =
    audienceRepair === null
      ? body.audienceTypes.map(normalizeAudienceMoneyDisplay)
      : body.audienceTypes.map((audience, index) =>
          normalizeAudienceMoneyDisplay({
            ...audience,
            dailyBudgetValue: audienceRepair.values[index] ?? 0,
            ...(audienceRepair.derivedIndexes.has(index)
              ? { dailyBudgetProvenance: "derived" }
              : {}),
          }),
        );
  const repaired = { ...body, audienceTypes, campaignOverview, campaignPhases };
  const remainingViolations = collectPaidMediaBudgetCascadeViolations(repaired);

  if (violations.length > 0 || remainingViolations.length > 0) {
    console.warn(
      "[paid-media-plan] budget cascade repaired deterministically",
      {
        before: violations.map((violation) => violation.message),
        after: remainingViolations.map((violation) => violation.message),
      },
    );
  }

  return repaired;
}

// A substantive SOP row names its own plan facts (ICP, KPI, objective,
// duration come from the model's own slides, never external evidence). The
// Explicit gap rows must NOT satisfy the floor — otherwise an omitted table
// can sail through with zero repair pressure.
function isSubstantiveProjectedResultRow(
  row: PaidMediaPlanBody["projectedResults"][number],
): boolean {
  const gapPattern = /^evidence gap/i;

  return (
    !gapPattern.test(row.targetIcp) &&
    !gapPattern.test(row.kpi) &&
    !gapPattern.test(row.objective) &&
    !gapPattern.test(row.durationLabel)
  );
}

// Mirrors isSubstantiveProjectedResultRow for the channel table: a row whose
// recommendation is the normalizer's own placeholder is bookkeeping, not a
// suggestion — a 100%-placeholder table must fail into repair, never ship
// (run d838ed4e shipped four verdicts with zero recommendations).
function isSubstantiveChannelSuggestion(
  row: PaidMediaPlanBody["channelSuggestions"][number],
): boolean {
  const recommendation = row.recommendation.trim();

  return recommendation.length > 0 && !/^evidence gap/i.test(recommendation);
}

export function validatePaidMediaPlanMinimums(
  artifact: ArtifactEnvelope & { body: PaidMediaPlanBody },
): ValidationResult {
  const parsed = artifactEnvelopeSchema
    .extend({ body: paidMediaPlanBodySchema })
    .parse(artifact);
  const errors: string[] = [];
  const substantiveRows = parsed.body.projectedResults.filter(
    isSubstantiveProjectedResultRow,
  );

  if (substantiveRows.length < 1) {
    errors.push(
      `body.projectedResults: need >=1 substantive SOP row (own-plan targetIcp/kpi/objective/durationLabel; KPI cost may honestly be unknown), have ${substantiveRows.length}.`,
    );
  }

  const substantiveChannelRows = parsed.body.channelSuggestions.filter(
    isSubstantiveChannelSuggestion,
  );

  if (substantiveChannelRows.length < 1) {
    errors.push(
      `body.channelSuggestions: need >=1 substantive recommendation (a verdict with an "Evidence gap:" placeholder recommendation does not count), have ${substantiveChannelRows.length}.`,
    );
  }

  errors.push(
    ...collectPaidMediaBudgetCascadeViolations(parsed.body).map(
      (violation) => violation.message,
    ),
  );

  return { ok: errors.length === 0, errors };
}
