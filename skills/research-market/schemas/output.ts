/**
 * research-market — Output schema
 *
 * Market/category intelligence contract. Facts only. Market-size claims stay
 * as sourced strings with scope labels and caveats; the schema intentionally
 * avoids numeric market-size fields that invite fabricated precision.
 */
import { z } from "zod";

export const MarketSourceSchema = z.object({
  source_id: z.string().min(1).optional(),
  source_url: z.string().url(),
  retrieved_at: z.string().datetime(),
  source_title: z.string().min(1).optional(),
  publisher: z.string().min(1).optional(),
});

export type MarketSource = z.infer<typeof MarketSourceSchema>;

export const SourcedMarketClaimSchema = z
  .object({
    claim: z.string().min(1),
    evidence_quote: z.string().min(1).optional(),
  })
  .merge(MarketSourceSchema);

export type SourcedMarketClaim = z.infer<typeof SourcedMarketClaimSchema>;

export const SourceCompanySchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  declared_category: z.string().min(1).optional(),
  declared_market: z.string().min(1).optional(),
  geography: z.string().min(1).optional(),
});

export type SourceCompany = z.infer<typeof SourceCompanySchema>;

export const MarketScopeSchema = z.object({
  subject_company: z.string().min(1),
  category: z.string().min(1),
  geography: z.string().min(1).optional(),
  buyer_context: z.string().min(1).optional(),
  excluded_scopes: z.array(z.string().min(1)),
});

export type MarketScope = z.infer<typeof MarketScopeSchema>;

export const MarketSizeSignalSchema = z
  .object({
    label: z.enum([
      "sam",
      "estimated_sam",
      "proxy_estimate",
      "tam_context",
    ]),
    market_scope: z.string().min(1),
    value: z.string().min(1),
    geography: z.string().min(1).optional(),
    period: z.string().min(1).optional(),
    basis: z.enum([
      "direct_market_report",
      "company_count_proxy",
      "buyer_count_proxy",
      "spend_proxy",
      "parent_market_context",
    ]),
    caveats: z.array(z.string().min(1)),
  })
  .merge(MarketSourceSchema);

export type MarketSizeSignal = z.infer<typeof MarketSizeSignalSchema>;

export const CategoryDefinitionSchema = SourcedMarketClaimSchema.extend({
  category_name: z.string().min(1),
  definition: z.string().min(1),
  adjacent_categories: z.array(z.string().min(1)),
});

export type CategoryDefinition = z.infer<typeof CategoryDefinitionSchema>;

export const CategoryMaturitySchema = SourcedMarketClaimSchema.extend({
  maturity: z.enum(["emerging", "growing", "mature", "saturated", "unknown"]),
  observable_signals: z.array(z.string().min(1)),
});

export type CategoryMaturity = z.infer<typeof CategoryMaturitySchema>;

export const MarketTimingSignalSchema = SourcedMarketClaimSchema.extend({
  signal_type: z.enum([
    "regulatory",
    "technology_shift",
    "budget_shift",
    "behavior_change",
    "platform_change",
    "macro",
    "other",
  ]),
  direction: z.enum(["rising", "stable", "declining", "unknown"]),
});

export type MarketTimingSignal = z.infer<typeof MarketTimingSignalSchema>;

export const CompetitiveIntensitySchema = z.object({
  intensity: z.enum(["low", "moderate", "high", "unknown"]),
  observable_signals: z.array(SourcedMarketClaimSchema),
  caveats: z.array(z.string().min(1)),
});

export type CompetitiveIntensity = z.infer<typeof CompetitiveIntensitySchema>;

export const CategoryPainPointsSchema = z.object({
  primary: z.array(SourcedMarketClaimSchema),
  secondary: z.array(SourcedMarketClaimSchema),
  triggers: z.array(SourcedMarketClaimSchema),
});

export type CategoryPainPoints = z.infer<typeof CategoryPainPointsSchema>;

export const MarketOpportunityCandidateSchema = SourcedMarketClaimSchema.extend({
  opportunity: z.string().min(1),
  size: z.enum(["small", "medium", "large", "unknown"]),
  timing: z.enum(["now", "3-6 months", "6-12 months", "unknown"]),
  difficulty: z.enum(["low", "medium", "high", "unknown"]),
});

export type MarketOpportunityCandidate = z.infer<
  typeof MarketOpportunityCandidateSchema
>;

export const SourceGapSchema = z.object({
  topic: z.enum([
    "market_size",
    "category_definition",
    "maturity",
    "timing",
    "demand_driver",
    "buying_trigger",
    "barrier",
    "competitive_intensity",
    "pain_point",
    "opportunity",
  ]),
  reason: z.string().min(1),
  attempted_queries: z.array(z.string().min(1)),
  needed_evidence: z.array(z.string().min(1)),
});

export type SourceGap = z.infer<typeof SourceGapSchema>;

export const LegacyCategorySnapshotSchema = z.object({
  category: z.string().min(1),
  marketSize: z.string().min(1).optional(),
  marketMaturity: z
    .enum(["early", "growing", "saturated", "unknown"])
    .optional(),
  awarenessLevel: z.enum(["low", "medium", "high", "unknown"]).optional(),
  buyingBehavior: z
    .enum(["impulsive", "committee_driven", "roi_based", "mixed", "unknown"])
    .optional(),
  averageSalesCycle: z.string().min(1).optional(),
  seasonality: z.string().min(1).optional(),
});

export type LegacyCategorySnapshot = z.infer<
  typeof LegacyCategorySnapshotSchema
>;

export const LegacyPainPointsSchema = z.object({
  primary: z.array(z.string().min(1)),
  secondary: z.array(z.string().min(1)),
  triggers: z.array(z.string().min(1)),
});

export type LegacyPainPoints = z.infer<typeof LegacyPainPointsSchema>;

export const LegacyMarketDynamicsSchema = z.object({
  demandDrivers: z.array(z.string().min(1)),
  buyingTriggers: z.array(z.string().min(1)),
  barriersToPurchase: z.array(z.string().min(1)),
  macroRisks: z
    .object({
      regulatoryConcerns: z.string().min(1).optional(),
      marketDownturnRisks: z.string().min(1).optional(),
      industryConsolidation: z.string().min(1).optional(),
    })
    .optional(),
});

export type LegacyMarketDynamics = z.infer<
  typeof LegacyMarketDynamicsSchema
>;

export const LegacyTrendSignalSchema = z.object({
  trend: z.string().min(1),
  direction: z.enum(["rising", "declining", "stable", "unknown"]),
  evidence: z.string().min(1),
});

export type LegacyTrendSignal = z.infer<typeof LegacyTrendSignalSchema>;

export const LegacyMessagingOpportunitiesSchema = z.object({
  summaryRecommendations: z.array(z.string().min(1)),
});

export type LegacyMessagingOpportunities = z.infer<
  typeof LegacyMessagingOpportunitiesSchema
>;

export const LegacyMarketOpportunitySchema = z.object({
  opportunity: z.string().min(1),
  size: z.enum(["small", "medium", "large", "unknown"]),
  timing: z.enum(["now", "3-6 months", "6-12 months", "unknown"]),
  difficulty: z.enum(["low", "medium", "high", "unknown"]),
  evidence: z.string().min(1),
});

export type LegacyMarketOpportunity = z.infer<
  typeof LegacyMarketOpportunitySchema
>;

export const ResearchMarketOutputSchema = z.object({
  run_id: z.string().regex(/^[a-z0-9_-]+$/),
  brief_snapshot_id: z.string().min(1),
  stage: z.literal("research-market-category"),
  source_company_name: z.string().min(1),
  source_company: SourceCompanySchema,
  generated_at: z.string().datetime(),
  tool_calls_used: z.array(z.string().min(1)),
  summary: z.string().min(1),
  keyFindings: z.array(z.string().min(1)),
  evidenceIds: z.array(z.string().min(1)),
  assumptions: z.array(z.string().min(1)),
  market_scope: MarketScopeSchema,
  category_definition: CategoryDefinitionSchema,
  market_size_signals: z.array(MarketSizeSignalSchema),
  category_maturity: CategoryMaturitySchema,
  timing_signals: z.array(MarketTimingSignalSchema),
  demand_drivers: z.array(SourcedMarketClaimSchema),
  buying_triggers: z.array(SourcedMarketClaimSchema),
  adoption_barriers: z.array(SourcedMarketClaimSchema),
  category_pain_points: CategoryPainPointsSchema,
  competitive_intensity: CompetitiveIntensitySchema,
  opportunity_candidates: z.array(MarketOpportunityCandidateSchema),
  source_gaps: z.array(SourceGapSchema),
  categorySnapshot: LegacyCategorySnapshotSchema,
  painPoints: LegacyPainPointsSchema,
  marketDynamics: LegacyMarketDynamicsSchema,
  trendSignals: z.array(LegacyTrendSignalSchema),
  messagingOpportunities: LegacyMessagingOpportunitiesSchema,
  marketOpportunities: z.array(LegacyMarketOpportunitySchema),
});

export type ResearchMarketOutput = z.infer<typeof ResearchMarketOutputSchema>;

const MARKET_RESEARCH_FRAGMENT_FIELDS = [
  "stage",
  "source_company_name",
  "source_company",
  "market_scope",
  "category_definition",
  "market_size_signals",
  "category_maturity",
  "timing_signals",
  "demand_drivers",
  "buying_triggers",
  "adoption_barriers",
  "category_pain_points",
  "competitive_intensity",
  "opportunity_candidates",
  "source_gaps",
  "categorySnapshot",
  "painPoints",
  "marketDynamics",
  "trendSignals",
  "messagingOpportunities",
  "marketOpportunities",
] as const satisfies readonly (keyof ResearchMarketOutput)[];

export const MarketResearchFragmentSchema = ResearchMarketOutputSchema.partial()
  .refine((fragment) => {
    return MARKET_RESEARCH_FRAGMENT_FIELDS.some(
      (field) => fragment[field] !== undefined,
    );
  }, {
    message: "Market research fragment must include at least one mergeable field",
  });

export type MarketResearchFragment = z.infer<typeof MarketResearchFragmentSchema>;
