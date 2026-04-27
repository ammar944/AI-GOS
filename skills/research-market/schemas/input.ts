/**
 * research-market — Input schema
 *
 * Sealed per-run payload. The skill receives the locked GTM Brief snapshot
 * and must not read mutable profile/session state.
 */
import { z } from "zod";

export const GTM_EVIDENCE_SOURCE_TYPES = [
  "url",
  "document",
  "transcript",
  "manual_note",
  "web_research",
  "ad_library",
  "tool_result",
] as const;

export const MarketEvidenceSourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(GTM_EVIDENCE_SOURCE_TYPES),
  label: z.string().min(1),
  url: z.string().url().optional(),
  excerpt: z.string().optional(),
  capturedAt: z.string().datetime(),
});

export type MarketEvidenceSource = z.infer<typeof MarketEvidenceSourceSchema>;

export const GtmBriefFieldSchema = z.object({
  value: z.string(),
  status: z.enum(["missing", "suggested", "needs_review", "confirmed"]),
  confidence: z.enum(["missing", "low", "medium", "high"]),
  sources: z.array(MarketEvidenceSourceSchema),
  updatedBy: z.enum(["ai", "user", "system"]),
  updatedAt: z.string().datetime(),
});

export type GtmBriefField = z.infer<typeof GtmBriefFieldSchema>;

export const GTM_BRIEF_FIELD_GROUPS = {
  companyIdentity: [
    "companyName",
    "companyUrl",
    "category",
    "market",
    "industryVertical",
    "geography",
    "hqLocation",
  ],
  productAndOffer: [
    "productDescription",
    "targetCustomer",
    "coreDeliverables",
    "useCases",
    "corePromise",
    "firstValueMoment",
    "activationEvent",
    "retentionDrivers",
    "cta",
    "packaging",
    "pricingModel",
    "pricingTiers",
    "targetPlan",
  ],
  icp: [
    "primaryIcpDescription",
    "icpSegment",
    "jobTitles",
    "icpRoles",
    "companySize",
    "buyingCommittee",
    "buyingTriggers",
    "icpPains",
    "icpTriggers",
    "currentAlternative",
    "awarenessLevel",
    "icpObjections",
  ],
  gtmMotion: ["salesMotion", "gtmMotion"],
  funnel: [
    "conversionPath",
    "landingPages",
    "salesHandoff",
    "lifecycleConstraints",
  ],
  economics: [
    "avgAcv",
    "acv",
    "avgCustomerLtv",
    "ltv",
    "targetCac",
    "cacTarget",
    "monthlyAdBudget",
    "monthlyBudget",
    "currentCac",
    "monthlyRevenue",
    "salesCycleLength",
    "salesCycle",
    "marginAssumptions",
  ],
  competitive: [
    "topCompetitors",
    "knownCompetitors",
    "alternatives",
    "uniqueEdge",
    "categoryFrames",
    "differentiation",
    "lossReasons",
    "competitorStrengths",
  ],
  proof: [
    "testimonials",
    "caseStudies",
    "logos",
    "metrics",
    "claims",
    "styleReferences",
  ],
  brandAndConstraints: [
    "brandPositioning",
    "tone",
    "forbiddenClaims",
    "compliance",
    "brandGeography",
    "timeline",
  ],
  goal: [
    "goals",
    "pipelineTarget",
    "campaignObjective",
    "expectedOutput",
    "targetMarket",
    "launchUrgency",
  ],
  messaging: ["commonObjections", "keyPromises"],
  currentPerformance: [
    "channels",
    "channelBudgetSplit",
    "whatIsWorking",
    "whatIsNotWorking",
    "visitorToSignupPct",
    "signupToActivationPct",
    "activationToPaidPct",
    "demoToCloseRate",
    "last3to6MoGrowthTrend",
  ],
} as const;

type FlattenGroups<T> = T extends Readonly<
  Record<string, readonly (infer K)[]>
>
  ? K
  : never;

export type GtmBriefFieldKey = FlattenGroups<typeof GTM_BRIEF_FIELD_GROUPS>;

export const GTM_BRIEF_FIELD_KEYS = Object.values(
  GTM_BRIEF_FIELD_GROUPS,
).flat() as readonly GtmBriefFieldKey[];

const marketGtmBriefFieldsShape = GTM_BRIEF_FIELD_KEYS.reduce<
  Record<string, typeof GtmBriefFieldSchema>
>((acc, key) => {
  acc[key] = GtmBriefFieldSchema;
  return acc;
}, {});

export const MarketGtmBriefFieldsSchema = z.object(marketGtmBriefFieldsShape);

export type MarketGtmBriefFields = z.infer<typeof MarketGtmBriefFieldsSchema>;

export const MarketGtmBriefSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  parentBriefId: z.string().min(1),
  fields: MarketGtmBriefFieldsSchema,
  briefCreatedAt: z.string().datetime(),
  briefUpdatedAt: z.string().datetime(),
  snapshotCreatedAt: z.string().datetime(),
});

export type MarketGtmBriefSnapshot = z.infer<
  typeof MarketGtmBriefSnapshotSchema
>;

export const ResearchMarketFocusSchema = z.object({
  geography: z.string().min(1).optional(),
  categoryOverride: z.string().min(1).optional(),
  includeParentMarketContext: z.boolean().default(true),
  maxSourceAgeDays: z.number().int().positive().optional(),
});

export type ResearchMarketFocus = z.infer<typeof ResearchMarketFocusSchema>;

export const IngestIdentitySnapshotSchema = z
  .object({
    canonical_company_name: z.string().min(1),
    canonical_domain: z.string().min(1),
    category: z.string().min(1),
    core_keywords: z.array(z.string().min(1)),
    negative_keywords: z.array(z.string().min(1)),
  })
  .passthrough();

export type IngestIdentitySnapshot = z.infer<
  typeof IngestIdentitySnapshotSchema
>;

export const ResearchMarketPriorOutputsSchema = z
  .object({
    ingest_identity: IngestIdentitySnapshotSchema,
  })
  .passthrough();

export type ResearchMarketPriorOutputs = z.infer<
  typeof ResearchMarketPriorOutputsSchema
>;

export const ResearchMarketInputSchema = z
  .object({
    run_id: z.string().regex(/^[a-z0-9_-]+$/),
    briefSnapshot: MarketGtmBriefSnapshotSchema,
    priorOutputs: ResearchMarketPriorOutputsSchema,
    focus: ResearchMarketFocusSchema.optional(),
  })
  .describe(
    "Sealed research-market input: run id plus locked GTM Brief snapshot.",
  );

export type ResearchMarketInput = z.infer<typeof ResearchMarketInputSchema>;
