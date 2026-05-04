import { z } from "zod";
import {
  sourceGapSchema,
  type SourceGap,
} from "@/lib/types/source-gap";

export const pageTypeSchema = z.enum([
  "homepage",
  "pricing",
  "product",
  "customers",
  "case_study",
  "about",
  "demo",
  "other",
]);

export const sourcedClaimSchema = z
  .object({
    value: z.string().min(1),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const discoveredPageSchema = z
  .object({
    url: z.string().url(),
    page_type: pageTypeSchema,
    title: sourcedClaimSchema.optional(),
    excerpt: sourcedClaimSchema.optional(),
  })
  .strict();

export const prefilledFieldSchema = z
  .object({
    field_key: z.string().min(1),
    label: z.string().min(1),
    value: z.string().min(1),
    confidence: z.enum(["low", "medium", "high"]),
    evidence: z.array(sourcedClaimSchema).min(1),
    reason: z.string().min(1),
  })
  .strict();

export const ingestUrlOutputSchema = z
  .object({
    run_id: z.string().min(1),
    stage: z.literal("discover-url"),
    input_url: z.string().url(),
    canonical_url: sourcedClaimSchema,
    company_name: sourcedClaimSchema,
    discovered_pages: z.array(discoveredPageSchema),
    prefilled_fields: z.array(prefilledFieldSchema),
    unresolved_fields: z.array(z.string().min(1)),
    source_gaps: z.array(sourceGapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export const lighthouseSkillSchema = z.enum([
  "ingest-url",
  "ingest-identity",
  "research-market",
  "research-competitor",
  "research-icp",
]);

export const identitySourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
    describes: z.string().min(1),
  })
  .strict();

export const ingestIdentityOutputSchema = z
  .object({
    run_id: z.string().min(1),
    stage: z.literal("ingest-identity"),
    company_name: z.string().min(1),
    domain: z.string().min(1),
    category: z.string().min(1),
    core_keywords: z.array(z.string().min(1)),
    negative_keywords: z.array(z.string().min(1)),
    sources: z.array(identitySourceSchema),
    source_gaps: z.array(sourceGapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export const genericInsightSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    evidence: z.array(sourcedClaimSchema),
  })
  .strict();

export const genericSkillOutputSchema = z
  .object({
    run_id: z.string().min(1),
    stage: lighthouseSkillSchema,
    generated_at: z.string().datetime(),
    source_gaps: z.array(sourceGapSchema),
    insights: z.array(genericInsightSchema),
    key_facts: z.record(z.string(), sourcedClaimSchema),
  })
  .strict();

export const gtmSourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
    source_title: z.string().min(1).optional(),
    publisher: z.string().min(1).optional(),
  })
  .strict();

export const sourcedMarketClaimSchema = gtmSourceSchema
  .extend({
    claim: z.string().min(1),
    evidence_quote: z.string().min(1).optional(),
  })
  .strict();

export const sourceCompanySchema = z
  .object({
    name: z.string().min(1),
    url: z.string().url().optional(),
    declared_category: z.string().min(1).optional(),
    declared_market: z.string().min(1).optional(),
    geography: z.string().min(1).optional(),
  })
  .strict();

export const marketScopeSchema = z
  .object({
    subject_company: z.string().min(1),
    category: z.string().min(1),
    geography: z.string().min(1).optional(),
    buyer_context: z.string().min(1).optional(),
    excluded_scopes: z.array(z.string().min(1)),
  })
  .strict();

export const marketSizeSignalSchema = gtmSourceSchema
  .extend({
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
  .strict();

export const categoryDefinitionSchema = sourcedMarketClaimSchema
  .extend({
    category_name: z.string().min(1),
    status: z
      .enum(["direct_sized", "borrowed_from_parent", "no_data"])
      .describe("Data-quality flag for category sizing evidence."),
    definition: z.string().min(1),
    adjacent_categories: z.array(z.string().min(1)),
  })
  .strict();

export const categoryMaturitySchema = sourcedMarketClaimSchema
  .extend({
    maturity: z.enum(["emerging", "growing", "mature", "saturated", "unknown"]),
    observable_signals: z.array(z.string().min(1)),
  })
  .strict();

export const marketTimingSignalSchema = sourcedMarketClaimSchema
  .extend({
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
  })
  .strict();

export const competitiveIntensitySchema = z
  .object({
    intensity: z.enum(["low", "moderate", "high", "unknown"]),
    observable_signals: z.array(sourcedMarketClaimSchema),
    caveats: z.array(z.string().min(1)),
  })
  .strict();

export const categoryPainPointsSchema = z
  .object({
    primary: z.array(sourcedMarketClaimSchema),
    secondary: z.array(sourcedMarketClaimSchema),
    triggers: z.array(sourcedMarketClaimSchema),
  })
  .strict();

export const marketOpportunityCandidateSchema = sourcedMarketClaimSchema
  .extend({
    opportunity: z.string().min(1),
    size: z.enum(["small", "medium", "large", "unknown"]),
    timing: z.enum(["now", "3-6 months", "6-12 months", "unknown"]),
    difficulty: z.enum(["low", "medium", "high", "unknown"]),
  })
  .strict();

export const researchMarketOutputSchema = z
  .object({
    run_id: z.string().min(1),
    stage: z.literal("research-market"),
    source_company_name: z.string().min(1),
    source_company: sourceCompanySchema,
    market_scope: marketScopeSchema,
    category_definition: categoryDefinitionSchema,
    market_size_signals: z.array(marketSizeSignalSchema),
    category_maturity: categoryMaturitySchema,
    timing_signals: z.array(marketTimingSignalSchema),
    demand_drivers: z.array(sourcedMarketClaimSchema),
    buying_triggers: z.array(sourcedMarketClaimSchema),
    adoption_barriers: z.array(sourcedMarketClaimSchema),
    category_pain_points: categoryPainPointsSchema,
    competitive_intensity: competitiveIntensitySchema,
    opportunity_candidates: z.array(marketOpportunityCandidateSchema),
    summary: z.string().min(1),
    key_findings: z.array(z.string().min(1)),
    source_gaps: z.array(sourceGapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export const competitorTypeSchema = z.enum([
  "subject",
  "direct",
  "indirect",
  "status_quo",
  "diy",
]);

export const competitorRefSchema = gtmSourceSchema
  .extend({
    name: z.string().min(1),
    type: competitorTypeSchema,
  })
  .strict();

export const positioningTaxonomySchema = gtmSourceSchema
  .extend({
    name: z.string().min(1),
    problem_framing_verbatim: z.string().min(1),
    solution_framing_verbatim: z.string().min(1),
  })
  .strict();

export const pricingRealitySchema = gtmSourceSchema
  .extend({
    name: z.string().min(1),
    public_prices: z.array(z.string().min(1)),
    gated_pricing_signals: z.array(z.string().min(1)),
    packaging_notes: z.string().min(1),
  })
  .strict();

export const shareOfVoiceSchema = gtmSourceSchema
  .extend({
    search_terms_owned: z.array(z.string().min(1)),
    communities_owned: z.array(
      z
        .object({
          name: z.string().min(1),
          url: z.string().url().optional(),
          evidence: z.string().min(1).optional(),
        })
        .strict()
    ),
    publications_owned: z.array(
      z
        .object({
          name: z.string().min(1),
          url: z.string().url().optional(),
          evidence: z.string().min(1).optional(),
        })
        .strict()
    ),
    evidence_per_claim: z.array(
      z
        .object({
          claim: z.string().min(1),
          evidence_url: z.string().url(),
        })
        .strict()
    ),
  })
  .strict();

export const maybeSourceSchema = z
  .object({
    source_url: z.string().url().optional(),
    retrieved_at: z.string().datetime().optional(),
  })
  .strict();

export const reviewMinedFeedbackSchema = maybeSourceSchema
  .extend({
    name: z.string().min(1),
    verbatim_quote: z.string().min(1),
    source_site: z.enum([
      "g2",
      "capterra",
      "trustradius",
      "getapp",
      "softwareadvice",
      "other",
    ]),
    review_date: z.string().min(1).optional(),
    polarity: z.enum(["positive", "negative", "mixed"]),
  })
  .strict();

export const competitorNarrativeArcSchema = gtmSourceSchema
  .extend({
    name: z.string().min(1),
    villain: z.string().min(1),
    hero: z.string().min(1),
    transformation_claim: z.string().min(1),
    evidence_verbatim: z.string().min(1),
  })
  .strict();

export const paidSocialAdInventorySchema = gtmSourceSchema
  .extend({
    name: z.string().min(1),
    active_ad_count: z
      .number()
      .describe("Observed active ad count. Use 0 only when access failed."),
    run_duration_range: z.string().min(1),
    formats: z.array(
      z.enum(["image", "video", "carousel", "collection", "other"])
    ),
    hook_strings_verbatim: z.array(z.string().min(1)),
    cta_patterns: z.array(z.string().min(1)),
    ad_library_url: z.string().url(),
  })
  .strict();

export const paidSearchAdInventorySchema = gtmSourceSchema
  .extend({
    name: z.string().min(1),
    keyword: z.string().min(1),
    headline_verbatim: z.string().min(1),
    body_verbatim: z.string().min(1),
    destination_url: z.string().url(),
    captured_at: z.string().datetime(),
  })
  .strict();

export const adActivitySignalsSchema = maybeSourceSchema
  .extend({
    name: z.string().min(1),
    always_on_vs_burst: z.enum(["always_on", "burst", "mixed", "unknown"]),
    refresh_cadence_days: z
      .number()
      .describe("Approximate observed refresh cadence in days."),
    geo_targeting_visible: z.array(z.string().min(1)),
    spend_magnitude_estimate_if_available: z.string().min(1).optional(),
  })
  .strict();

export const organicVsPaidNarrativeDeltaSchema = gtmSourceSchema
  .extend({
    name: z.string().min(1),
    homepage_positioning: z.string().min(1),
    dominant_ad_hook: z.string().min(1),
    delta_description: z.string().min(1),
    evidence_urls: z.array(z.string().url()),
  })
  .strict();

export const researchCompetitorOutputSchema = z
  .object({
    run_id: z.string().min(1),
    stage: z.literal("research-competitor"),
    source_company_name: z.string().min(1),
    competitor_set: z.array(competitorRefSchema),
    positioning_taxonomy: z.array(positioningTaxonomySchema),
    pricing_reality: z.array(pricingRealitySchema),
    share_of_voice: shareOfVoiceSchema,
    review_mined_feedback: z.array(reviewMinedFeedbackSchema),
    competitor_narrative_arc: z.array(competitorNarrativeArcSchema),
    paid_social_ad_inventory: z.array(paidSocialAdInventorySchema),
    paid_search_ad_inventory: z.array(paidSearchAdInventorySchema),
    ad_activity_signals: z.array(adActivitySignalsSchema),
    organic_vs_paid_narrative_delta: z.array(
      organicVsPaidNarrativeDeltaSchema
    ),
    tool_calls_used: z.array(z.string().min(1)).optional(),
    source_gaps: z.array(sourceGapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export const icpSourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const icpSourcedClaimSchema = icpSourceSchema
  .extend({
    claim: z.string().min(1),
  })
  .strict();

export const personaAnchorSchema = z
  .object({
    persona_name: z.string().min(1),
    role_family: z.string().min(1),
    seniority: z.string().min(1).optional(),
    company_context: z.array(icpSourcedClaimSchema),
    pains: z.array(icpSourcedClaimSchema),
    triggers: z.array(icpSourcedClaimSchema),
    objections: z.array(icpSourcedClaimSchema),
    current_alternatives: z.array(icpSourcedClaimSchema),
  })
  .strict();

export const awarenessStageSchema = z
  .object({
    stage: z.enum([
      "unaware",
      "problem_aware",
      "solution_aware",
      "product_aware",
      "most_aware",
    ]),
    evidence: z.array(icpSourcedClaimSchema),
    message_implication: z.string().min(1),
  })
  .strict();

export const jobTitleSchema = icpSourceSchema
  .extend({
    title: z.string().min(1),
    department: z.string().min(1).optional(),
    seniority: z.string().min(1).optional(),
    buying_role: z.enum([
      "economic_buyer",
      "champion",
      "user",
      "technical_evaluator",
      "procurement",
      "influencer",
    ]),
  })
  .strict();

export const searchIntentSchema = icpSourceSchema
  .extend({
    query_pattern: z.string().min(1),
    intent: z.enum([
      "problem",
      "solution",
      "category",
      "competitor",
      "implementation",
      "pricing",
    ]),
    likely_persona: z.string().min(1),
  })
  .strict();

export const researchIcpOutputSchema = z
  .object({
    run_id: z.string().min(1),
    stage: z.literal("research-icp"),
    company_name: z.string().min(1),
    category: z.string().min(1),
    persona_anchors: z.array(personaAnchorSchema),
    awareness_stages: z.array(awarenessStageSchema),
    job_titles: z.array(jobTitleSchema),
    search_intent: z.array(searchIntentSchema),
    buying_committee_notes: z.array(icpSourcedClaimSchema),
    exclusions: z.array(icpSourcedClaimSchema),
    source_gaps: z.array(sourceGapSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export type PageType = z.infer<typeof pageTypeSchema>;
export type SourcedClaim = z.infer<typeof sourcedClaimSchema>;
export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;
export type PrefilledField = z.infer<typeof prefilledFieldSchema>;
export type IngestUrlOutput = z.infer<typeof ingestUrlOutputSchema>;
export type LighthouseSkill = z.infer<typeof lighthouseSkillSchema>;
export type IdentitySource = z.infer<typeof identitySourceSchema>;
export type IngestIdentityOutput = z.infer<typeof ingestIdentityOutputSchema>;
export type GenericInsight = z.infer<typeof genericInsightSchema>;
export type GenericSkillOutput = z.infer<typeof genericSkillOutputSchema>;
export type GtmSource = z.infer<typeof gtmSourceSchema>;
export type SourcedMarketClaim = z.infer<typeof sourcedMarketClaimSchema>;
export type SourceCompany = z.infer<typeof sourceCompanySchema>;
export type MarketScope = z.infer<typeof marketScopeSchema>;
export type MarketSizeSignal = z.infer<typeof marketSizeSignalSchema>;
export type CategoryDefinition = z.infer<typeof categoryDefinitionSchema>;
export type CategoryMaturity = z.infer<typeof categoryMaturitySchema>;
export type MarketTimingSignal = z.infer<typeof marketTimingSignalSchema>;
export type CompetitiveIntensity = z.infer<typeof competitiveIntensitySchema>;
export type CategoryPainPoints = z.infer<typeof categoryPainPointsSchema>;
export type MarketOpportunityCandidate = z.infer<
  typeof marketOpportunityCandidateSchema
>;
export type ResearchMarketOutput = z.infer<typeof researchMarketOutputSchema>;
export type CompetitorType = z.infer<typeof competitorTypeSchema>;
export type CompetitorRef = z.infer<typeof competitorRefSchema>;
export type PositioningTaxonomy = z.infer<typeof positioningTaxonomySchema>;
export type PricingReality = z.infer<typeof pricingRealitySchema>;
export type ShareOfVoice = z.infer<typeof shareOfVoiceSchema>;
export type ReviewMinedFeedback = z.infer<typeof reviewMinedFeedbackSchema>;
export type CompetitorNarrativeArc = z.infer<
  typeof competitorNarrativeArcSchema
>;
export type PaidSocialAdInventory = z.infer<
  typeof paidSocialAdInventorySchema
>;
export type PaidSearchAdInventory = z.infer<
  typeof paidSearchAdInventorySchema
>;
export type AdActivitySignals = z.infer<typeof adActivitySignalsSchema>;
export type OrganicVsPaidNarrativeDelta = z.infer<
  typeof organicVsPaidNarrativeDeltaSchema
>;
export type ResearchCompetitorOutput = z.infer<
  typeof researchCompetitorOutputSchema
>;
export type IcpSourcedClaim = z.infer<typeof icpSourcedClaimSchema>;
export type PersonaAnchor = z.infer<typeof personaAnchorSchema>;
export type AwarenessStage = z.infer<typeof awarenessStageSchema>;
export type JobTitle = z.infer<typeof jobTitleSchema>;
export type SearchIntent = z.infer<typeof searchIntentSchema>;
export type ResearchIcpOutput = z.infer<typeof researchIcpOutputSchema>;
export type { SourceGap };
