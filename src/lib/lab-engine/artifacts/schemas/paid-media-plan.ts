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
] as const;

export const paidMediaMoneyProvenanceValues = [
  "user-supplied",
  "tool-measured",
  "source-reported",
  "model-estimated",
  "unknown",
] as const;

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
const sourceSectionSchema = z.enum(sourceSectionValues);
const channelVerdictSchema = z.enum(channelVerdictValues);
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

const creativeStrategySchema = z.object({
  prose: z.string().min(1),
  staticCount: z.number(),
  videoCount: z.number(),
  totalPerAudience: z.number(),
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
  marginOfErrorPercent: z.number().finite().nonnegative(),
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
    monthlyBudget: getString(
      record.monthlyBudget,
      "Budget not provided — enter a monthly budget to compute the spend plan",
    ),
    ...optionalNumericField("monthlyBudgetValue", monthlyBudgetValue),
    monthlyBudgetProvenance,
    dailySpend: getString(record.dailySpend, "Daily spend not provided"),
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
    monthlyBudget: getString(record.monthlyBudget, "Budget not provided"),
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
    dailyBudget: getString(record.dailyBudget, "Daily budget not provided"),
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

function normalizeCreativeStrategy(value: unknown): PaidMediaPlanBody["creativeStrategy"] {
  const record = getRecord(value);

  return {
    prose: getString(record.prose, "Creative mix needs review."),
    staticCount: getNumber(record.staticCount) ?? 5,
    videoCount: getNumber(record.videoCount) ?? 3,
    totalPerAudience: getNumber(record.totalPerAudience) ?? 8,
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

  return {
    channel: getString(record.channel, channels[index] ?? `Channel ${index + 1}`),
    recommendation: getString(
      record.recommendation ?? record.observation,
      "Evidence gap: channel recommendation missing.",
    ),
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

function normalizeProjectedResultRow(
  value: unknown,
  index: number,
): PaidMediaPlanBody["projectedResults"][number] {
  const record = getRecord(value);
  const kpiCostProvenance = snapMoneyProvenance(record.kpiCostProvenance);
  const phaseMonthlyBudgetProvenance = snapMoneyProvenance(
    record.phaseMonthlyBudgetProvenance,
  );
  const kpiCostValue =
    kpiCostProvenance === "unknown"
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
    kpi: getString(record.kpi ?? record.metric, "Evidence gap: KPI missing."),
    ...optionalNumericField("kpiCostValue", kpiCostValue),
    kpiCostProvenance,
    objective: getString(record.objective, "Evidence gap: objective missing."),
    durationLabel: getString(
      record.durationLabel ?? record.duration,
      "Evidence gap: duration missing.",
    ),
    ...optionalNumericField("phaseMonthlyBudgetValue", phaseMonthlyBudgetValue),
    phaseMonthlyBudgetProvenance,
    ...(projectedCountValue === undefined
      ? {}
      : {
          projectedCountValue,
          projectedCountProvenance: weakestMoneyProvenance(
            kpiCostProvenance,
            phaseMonthlyBudgetProvenance,
          ),
        }),
    marginOfErrorPercent: SOP_MARGIN_OF_ERROR_PERCENT,
    sourceSection: normalizeSourceSection(record.sourceSection),
  };
}

export function normalizePaidMediaPlanBody(value: unknown): PaidMediaPlanBody {
  const record = getRecord(value);

  return paidMediaPlanBodySchema.parse({
    campaignOverview: normalizeCampaignOverview(record.campaignOverview),
    campaignPhases: getNestedArray(record.campaignPhases, "phases").map(
      normalizeCampaignPhase,
    ),
    audienceTypes: getNestedArray(record.audienceTypes, "audiences").map(
      normalizeAudienceType,
    ),
    anglesToTest: getNestedArray(record.anglesToTest, "angles").map(
      normalizeAngle,
    ),
    creativeStrategy: normalizeCreativeStrategy(record.creativeStrategy),
    creativeFramework: getNestedArray(record.creativeFramework, "creatives").map(
      normalizeCreativeFrameworkSlot,
    ),
    funnelIdeation: getNestedArray(record.funnelIdeation, "recommendations").map(
      normalizeFunnelPath,
    ),
    salesProcess: normalizeSalesProcessAssets(record.salesProcess),
    competitorMarketingInsights: getNestedArray(
      record.competitorMarketingInsights,
      "competitors",
    ).map(normalizeCompetitorMarketingInsight),
    competitorReviewInsights: getNestedArray(
      record.competitorReviewInsights,
      "insights",
    ).map(normalizeCompetitorReviewInsight),
    channelSuggestions: getNestedArray(record.channelSuggestions, "suggestions").map(
      normalizeChannelSuggestion,
    ),
    projectedResults: getNestedArray(record.projectedResults, "rows").map(
      normalizeProjectedResultRow,
    ),
    kpis: getNestedArray(record.kpis, "kpis").map(normalizeKpi),
    crossSectionInsight: getNestedArray(record.crossSectionInsight, "insights").map(
      normalizeCrossSectionInsight,
    ),
    ...(isPlainRecord(record.feasibilityAudit)
      ? { feasibilityAudit: record.feasibilityAudit }
      : {}),
  });
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

  return { ok: errors.length === 0, errors };
}
