import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";

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
  "unknown",
] as const;

// Mirrors the onboarding snapshot's creativeCapacity enum (artifact-envelope).
export type PaidMediaCreativeCapacity = "lean" | "standard" | "high";

// Brief-derived context threaded in by the runner pre-pass
// (withNormalizedPaidMediaPlanOutput in run-section.ts):
// - creativeCapacity keys the single-writer creative counts.
// - targetCac (raw brief string, e.g. "≤$4,000") bridges the SOP
//   projected-results math when the model honestly reports KPI cost unknown.
export interface NormalizePaidMediaPlanBodyOptions {
  creativeCapacity?: PaidMediaCreativeCapacity;
  targetCac?: string;
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

const campaignPhaseSchema = z.object({
  phaseName: z.string().min(1),
  monthsLabel: z.string().min(1),
  monthlyBudget: z.string().min(1),
  monthlyBudgetValue: paidMediaNumericMoneySchema,
  monthlyBudgetProvenance: z.string().min(1),
  bullets: z.array(z.string().min(1)).describe("4-5 phase bullets"),
});

const audienceTypeSchema = z.object({
  slot: z.string().min(1),
  archetype: z.string().min(1),
  dailyBudget: z.string().min(1),
  dailyBudgetValue: paidMediaNumericMoneySchema,
  dailyBudgetProvenance: z.string().min(1),
  detail: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
});

const angleSchema = z.object({
  shortName: z.string().min(1),
  description: z.string().min(1),
  angleType: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
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
});

const competitorReviewInsightSchema = z.object({
  complaint: z.string().min(1),
  howWeLeverage: z.string().min(1),
  sourceSection: sourceSectionSchema,
  grounding: z.string().min(1),
});

const channelSuggestionSchema = z.object({
  channel: z.string().min(1),
  recommendation: z.string().min(1),
  verdict: channelVerdictSchema,
  sourceSection: sourceSectionSchema,
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
  marginOfErrorPercent: z.number().finite().nonnegative().optional(),
  sourceSection: sourceSectionSchema,
});

const crossSectionInsightSchema = z.object({
  tension: z.string().min(1),
  sourceSections: z.array(sourceSectionSchema).min(2),
  implicationForPlan: z.string().min(1),
  clientBlindSpot: z.string().min(1),
  secondOrderRisk: z.string().min(1),
  contrarianInversion: z.string().min(1),
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
  /(?:\s*\((?:user-supplied|tool-measured|source-reported|model-estimated|unknown|operator-supplied)\))+\s*$/i;

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
    monthlyBudget: getMoneyDisplayString(
      record.monthlyBudget,
      "Budget not provided — enter a monthly budget to compute the spend plan",
    ),
    ...optionalNumericField("monthlyBudgetValue", monthlyBudgetValue),
    monthlyBudgetProvenance,
    dailySpend: getMoneyDisplayString(
      record.dailySpend,
      "Daily spend not provided",
    ),
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
    monthlyBudget: getMoneyDisplayString(
      record.monthlyBudget,
      "Budget not provided",
    ),
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
    dailyBudget: getMoneyDisplayString(
      record.dailyBudget,
      "Daily budget not provided",
    ),
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

  return assets.map(normalizeSalesAsset);
}

function normalizeCompetitorMarketingInsight(
  value: unknown,
  index: number,
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
    sourceSection: normalizeSourceSection(record.sourceSection),
    grounding: getString(record.grounding, "UNVERIFIED"),
  };
}

function normalizeCompetitorReviewInsight(
  value: unknown,
  index: number,
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
    sourceSection: normalizeSourceSection(record.sourceSection),
    grounding: getString(record.grounding, "UNVERIFIED"),
  };
}

const CHANNEL_SUGGESTION_RECOMMENDATION_FALLBACK =
  "Evidence gap: channel recommendation missing.";
const CHANNEL_SUGGESTION_KNOWN_KEYS = new Set([
  "channel",
  "observation",
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
  const recommendation = getString(
    record.recommendation ?? record.observation,
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

// CAC-unit KPIs: rows whose KPI denotes an acquisition (signup/customer) may
// honestly borrow the brief's target CAC as their KPI cost. MQL/SQL/CTR-style
// units must NOT be costed with a CAC — that would overstate efficiency.
const CAC_UNIT_KPI_PATTERN = /\b(sign[\s-]?ups?|customers?|acquisitions?)\b/i;

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

function normalizeProjectedResultRow(
  value: unknown,
  index: number,
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody["projectedResults"][number] {
  const record = getRecord(value);
  const kpi = getString(record.kpi ?? record.metric, "Evidence gap: KPI missing.");
  const snappedKpiCostProvenance = snapMoneyProvenance(record.kpiCostProvenance);
  // Brief-CAC bridge: when the model honestly reports the KPI cost unknown
  // and the brief supplied a target CAC whose unit matches the row's KPI,
  // the runner sets the cost from the brief (provenance 'user-supplied' —
  // it IS the client's own number) so the SOP floor() math below can run.
  const targetCacValue = parsePaidMediaTargetCacValue(options?.targetCac);
  const bridgeKpiCostFromTargetCac =
    snappedKpiCostProvenance === "unknown" &&
    targetCacValue !== undefined &&
    CAC_UNIT_KPI_PATTERN.test(kpi);
  const kpiCostProvenance = bridgeKpiCostFromTargetCac
    ? "user-supplied"
    : snappedKpiCostProvenance;
  const phaseMonthlyBudgetProvenance = snapMoneyProvenance(
    record.phaseMonthlyBudgetProvenance,
  );
  const kpiCostValue = bridgeKpiCostFromTargetCac
    ? targetCacValue
    : kpiCostProvenance === "unknown"
      ? undefined
      : getMoneyNumber(record.kpiCostValue ?? record.kpiCost);
  const phaseMonthlyBudgetValue =
    phaseMonthlyBudgetProvenance === "unknown"
      ? undefined
      : getMoneyNumber(
          record.phaseMonthlyBudgetValue ??
            record.phaseBudget ??
            record.monthlyBudgetValue,
        );
  // The model never does the math: any model-authored count is overwritten,
  // and an uncostable row carries NO count rather than an invented one.
  const projectedCountValue =
    kpiCostValue !== undefined &&
    kpiCostValue > 0 &&
    phaseMonthlyBudgetValue !== undefined &&
    phaseMonthlyBudgetValue > 0
      ? Math.floor(phaseMonthlyBudgetValue / kpiCostValue)
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
          projectedCountProvenance: weakestMoneyProvenance(
            kpiCostProvenance,
            phaseMonthlyBudgetProvenance,
          ),
          marginOfErrorPercent: SOP_MARGIN_OF_ERROR_PERCENT,
        }),
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

export function normalizePaidMediaPlanBody(
  value: unknown,
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody {
  const record = getRecord(value);
  const creativeFramework = getNestedArray(
    record.creativeFramework,
    "creatives",
  ).map(normalizeCreativeFrameworkSlot);
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
    audienceTypes: getNestedArray(record.audienceTypes, "audiences").map(
      normalizeAudienceType,
    ),
    anglesToTest: getNestedArray(record.anglesToTest, "angles").map(
      normalizeAngle,
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
    ).map(normalizeCompetitorMarketingInsight),
    competitorReviewInsights: getNestedArray(
      record.competitorReviewInsights,
      "insights",
    ).map(normalizeCompetitorReviewInsight),
    channelSuggestions: getNestedArray(record.channelSuggestions, "suggestions")
      .map(normalizeChannelSuggestion)
      .slice(0, 6),
    projectedResults: projectedResultsOrSynthesized,
    kpis: getNestedArray(record.kpis, "kpis").map(normalizeKpi).slice(0, 5),
    crossSectionInsight,
    ...(isPlainRecord(record.feasibilityAudit)
      ? { feasibilityAudit: record.feasibilityAudit }
      : {}),
  });

  return reconcilePaidMediaBudgetCascade(parsed);
}

// The budget cascade reconciliation contract (section-prompt-guidance.ts $5
// rule), enforced in CODE: when the optional numeric siblings are emitted,
// (a) the audience daily budgets must sum to the overview daily spend within
// $5, (b) dailySpendValue*30 must equal monthlyBudgetValue within $25, and
// (c) no single phase may budget more per month than the plan's monthly
// budget (phases may overlap, so there is deliberately NO phase-sum check).
const AUDIENCE_DAILY_SUM_TOLERANCE_USD = 5;
const DAILY_TIMES_30_TOLERANCE_USD = 25;

type PaidMediaBudgetCascadeViolation =
  | { kind: "audience-sum"; message: string }
  | { kind: "daily-vs-monthly"; message: string }
  | { kind: "phase-exceeds-monthly"; message: string; phaseIndex: number };

// Repair-prompt-facing dollar formatting: cents precision, no float artifacts.
function formatUsdForError(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function collectPaidMediaBudgetCascadeViolations(
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
  }

  return violations;
}

// Normalize-time fallback for a cascade the model failed to reconcile: drop
// the OFFENDING numeric *Value siblings and snap their provenance to
// "unknown" (the same mechanism normalizeMoneyValue uses to hide numbers),
// so a committed artifact can NEVER carry a non-reconciling cascade. The
// anchor is monthlyBudgetValue (typically the brief's own number): the daily
// spend is validated against it, and the audience split against the daily
// spend — whichever leg disagrees with its anchor is the one dropped.
export function reconcilePaidMediaBudgetCascade(
  body: PaidMediaPlanBody,
): PaidMediaPlanBody {
  const violations = collectPaidMediaBudgetCascadeViolations(body);

  if (violations.length === 0) {
    return body;
  }

  console.warn(
    "[paid-media-plan] budget cascade did not reconcile; dropping offending numeric siblings",
    { messages: violations.map((violation) => violation.message) },
  );

  const dropDailySpend = violations.some(
    (violation) => violation.kind === "daily-vs-monthly",
  );
  const dropAudienceBudgets = violations.some(
    (violation) => violation.kind === "audience-sum",
  );
  const phaseIndexesToDrop = new Set(
    violations.flatMap((violation) =>
      violation.kind === "phase-exceeds-monthly" ? [violation.phaseIndex] : [],
    ),
  );

  const campaignOverview = dropDailySpend
    ? (() => {
        const { dailySpendValue: _dropped, ...rest } = body.campaignOverview;
        return { ...rest, dailySpendProvenance: "unknown" };
      })()
    : body.campaignOverview;
  const audienceTypes = dropAudienceBudgets
    ? body.audienceTypes.map((audience) => {
        const { dailyBudgetValue: _dropped, ...rest } = audience;
        return { ...rest, dailyBudgetProvenance: "unknown" };
      })
    : body.audienceTypes;
  const campaignPhases = body.campaignPhases.map((phase, phaseIndex) => {
    if (!phaseIndexesToDrop.has(phaseIndex)) {
      return phase;
    }

    const { monthlyBudgetValue: _dropped, ...rest } = phase;
    return { ...rest, monthlyBudgetProvenance: "unknown" };
  });

  return { ...body, audienceTypes, campaignOverview, campaignPhases };
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
