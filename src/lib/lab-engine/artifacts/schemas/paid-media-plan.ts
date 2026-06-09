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
  sourceSection: z.string().min(1),
  grounding: z.string().min(1),
});

const angleSchema = z.object({
  shortName: z.string().min(1),
  description: z.string().min(1),
  angleType: z.string().min(1),
  sourceSection: z.string().min(1),
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
  sourceSection: z.string().min(1),
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
  sourceSection: z.string().min(1),
  grounding: z.string().min(1),
});

const competitorReviewInsightSchema = z.object({
  complaint: z.string().min(1),
  howWeLeverage: z.string().min(1),
  sourceSection: z.string().min(1),
  grounding: z.string().min(1),
});

const channelSuggestionSchema = z.object({
  channel: z.string().min(1),
  recommendation: z.string().min(1),
  verdict: z.string().min(1),
  sourceSection: z.string().min(1),
});

const kpiSchema = z.object({
  metric: z.string().min(1),
  role: z.string().min(1),
  definition: z.string().min(1),
});

const crossSectionInsightSchema = z.object({
  tension: z.string().min(1),
  sourceSections: z.array(z.string().min(1)),
  implicationForPlan: z.string().min(1),
  clientBlindSpot: z.string().min(1),
  secondOrderRisk: z.string().min(1),
  contrarianInversion: z.string().min(1),
});

export const paidMediaPlanBodySchema = z.object({
  campaignOverview: campaignOverviewSchema,
  campaignPhases: z
    .array(campaignPhaseSchema)
    .describe("Phase 1 Testing -> Phase 2 Optimize & Scale (EXACTLY 2)"),
  audienceTypes: z
    .array(audienceTypeSchema)
    .describe("3 fixed archetypes tested in parallel (EXACTLY 3)"),
  anglesToTest: z
    .array(angleSchema)
    .describe("4 distinct creative angles, diversity-enforced (EXACTLY 4)"),
  creativeStrategy: creativeStrategySchema,
  creativeFramework: z
    .array(creativeFrameworkSlotSchema)
    .describe("5 static + 3 UGC fixed slots (EXACTLY 8)"),
  funnelIdeation: z
    .array(funnelIdeationSchema)
    .describe("3 funnel paths: PRIMARY / SECONDARY / TEST (EXACTLY 3)"),
  salesProcess: z
    .array(salesProcessAssetSchema)
    .describe("3 sales docs + 1 Loom; state gaps, never fabricate URLs"),
  competitorMarketingInsights: z
    .array(competitorMarketingInsightSchema)
    .describe("Competitor marketing teardown (>=2)"),
  competitorReviewInsights: z
    .array(competitorReviewInsightSchema)
    .describe("3 competitor-review complaints + leverage (EXACTLY 3)"),
  channelSuggestions: z
    .array(channelSuggestionSchema)
    .describe("4 current-funnel suggestion cards (EXACTLY 4)"),
  kpis: z.array(kpiSchema).describe("3 fixed KPIs (EXACTLY 3)"),
  crossSectionInsight: z
    .array(crossSectionInsightSchema)
    .describe("1-3 cross-section tensions that drove the plan"),
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

  return aliases[slug] ?? "gtmBrief";
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

  return aliases[slug] ?? "REVIEW";
}

function getRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
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

function withCount<T>({
  fallback,
  max,
  min,
  normalize,
  value,
}: {
  fallback: (index: number) => T;
  max?: number;
  min: number;
  normalize: (item: unknown, index: number) => T;
  value: unknown;
}): T[] {
  const normalized = getArray(value).map((item, index) => normalize(item, index));
  const capped = max === undefined ? normalized : normalized.slice(0, max);
  const padded = [...capped];

  while (padded.length < min) {
    padded.push(fallback(padded.length));
  }

  return padded;
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
  const monthlyBudgetProvenance = snapMoneyProvenance(
    record.monthlyBudgetProvenance,
  );
  const dailySpendProvenance = snapMoneyProvenance(record.dailySpendProvenance);
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
    monthlyBudget: getString(record.monthlyBudget, "Budget not provided"),
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
  const monthlyBudgetProvenance = snapMoneyProvenance(
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
  const dailyBudgetProvenance = snapMoneyProvenance(record.dailyBudgetProvenance);
  const dailyBudgetValue = normalizeMoneyValue({
    provenance: dailyBudgetProvenance,
    value: record.dailyBudgetValue,
  });
  const defaults = [
    {
      archetype: "Broad Prospecting - Interest Stack",
      slot: "01",
    },
    {
      archetype: "High Intent - ABM ICP List + 1% Lookalike",
      slot: "02",
    },
    {
      archetype: "AI Optimized - Advantage+",
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
    sourceSection: snapSourceSection(record.sourceSection),
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
    sourceSection: snapSourceSection(record.sourceSection),
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
    sourceSection: snapSourceSection(record.sourceSection),
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
    sourceSection: snapSourceSection(record.sourceSection),
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
    sourceSection: snapSourceSection(record.sourceSection),
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
    verdict: snapChannelVerdict(record.verdict),
    sourceSection: snapSourceSection(record.sourceSection),
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
    .map(snapSourceSection)
    .filter((section) => section !== "gtmBrief");

  return {
    tension: getString(record.tension, `Cross-section tension ${index + 1} needs review.`),
    sourceSections:
      sourceSections.length >= 2
        ? sourceSections
        : ["positioningVoiceOfCustomer", "positioningOfferDiagnostic"],
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

export function normalizePaidMediaPlanBody(value: unknown): PaidMediaPlanBody {
  const record = getRecord(value);

  return paidMediaPlanBodySchema.parse({
    campaignOverview: normalizeCampaignOverview(record.campaignOverview),
    campaignPhases: withCount({
      fallback: (index) => normalizeCampaignPhase({}, index),
      max: 2,
      min: 2,
      normalize: normalizeCampaignPhase,
      value: getNestedArray(record.campaignPhases, "phases"),
    }),
    audienceTypes: withCount({
      fallback: (index) => normalizeAudienceType({}, index),
      max: 3,
      min: 3,
      normalize: normalizeAudienceType,
      value: getNestedArray(record.audienceTypes, "audiences"),
    }),
    anglesToTest: withCount({
      fallback: (index) => normalizeAngle({}, index),
      max: 4,
      min: 4,
      normalize: normalizeAngle,
      value: getNestedArray(record.anglesToTest, "angles"),
    }),
    creativeStrategy: normalizeCreativeStrategy(record.creativeStrategy),
    creativeFramework: withCount({
      fallback: (index) => normalizeCreativeFrameworkSlot({}, index),
      max: 8,
      min: 8,
      normalize: normalizeCreativeFrameworkSlot,
      value: getNestedArray(record.creativeFramework, "creatives"),
    }),
    funnelIdeation: withCount({
      fallback: (index) => normalizeFunnelPath({}, index),
      max: 3,
      min: 3,
      normalize: normalizeFunnelPath,
      value: getNestedArray(record.funnelIdeation, "recommendations"),
    }),
    salesProcess: withCount({
      fallback: (index) => normalizeSalesAsset({}, index),
      max: 4,
      min: 4,
      normalize: normalizeSalesAsset,
      value: getNestedArray(record.salesProcess, "assets"),
    }),
    competitorMarketingInsights: withCount({
      fallback: (index) => normalizeCompetitorMarketingInsight({}, index),
      min: 2,
      normalize: normalizeCompetitorMarketingInsight,
      value: getNestedArray(record.competitorMarketingInsights, "competitors"),
    }),
    competitorReviewInsights: withCount({
      fallback: (index) => normalizeCompetitorReviewInsight({}, index),
      max: 3,
      min: 3,
      normalize: normalizeCompetitorReviewInsight,
      value: getNestedArray(record.competitorReviewInsights, "insights"),
    }),
    channelSuggestions: withCount({
      fallback: (index) => normalizeChannelSuggestion({}, index),
      max: 4,
      min: 4,
      normalize: normalizeChannelSuggestion,
      value: getNestedArray(record.channelSuggestions, "suggestions"),
    }),
    kpis: withCount({
      fallback: (index) => normalizeKpi({}, index),
      max: 3,
      min: 3,
      normalize: normalizeKpi,
      value: getNestedArray(record.kpis, "kpis"),
    }),
    crossSectionInsight: withCount({
      fallback: (index) => normalizeCrossSectionInsight({}, index),
      max: 3,
      min: 1,
      normalize: normalizeCrossSectionInsight,
      value: record.crossSectionInsight,
    }),
  });
}

export function validatePaidMediaPlanMinimums(
  artifact: ArtifactEnvelope & { body: PaidMediaPlanBody },
): ValidationResult {
  artifactEnvelopeSchema.extend({ body: paidMediaPlanBodySchema }).parse(artifact);

  return { ok: true, errors: [] };
}
