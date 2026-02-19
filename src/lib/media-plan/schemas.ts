// Media Plan Zod Schema for generateObject
// Mirrors types.ts with .describe() hints for AI quality

import { z } from 'zod';

// =============================================================================
// Executive Summary
// =============================================================================

export const executiveSummarySchema = z.object({
  overview: z.string()
    .describe('2-3 sentence high-level strategy overview. Mention the primary platform, campaign approach, and expected outcome.'),

  primaryObjective: z.string()
    .describe('The single most important objective (e.g., "Generate 40 SQLs/month at <$75 CPL via Meta + LinkedIn").'),

  recommendedMonthlyBudget: z.number()
    .describe('Recommended total monthly ad spend in USD. Must align with the client budget from onboarding data.'),

  timelineToResults: z.string()
    .describe('Realistic timeline to first meaningful results (e.g., "4-6 weeks for initial qualified leads, 90 days for steady pipeline").'),

  topPriorities: z.array(z.string())
    .min(2).max(5)
    .describe('Top 3 strategic priorities in order of importance. Be specific and actionable.'),
}).describe('High-level media plan executive summary');

// =============================================================================
// Platform Strategy (enriched)
// =============================================================================

export const platformStrategySchema = z.object({
  platform: z.string()
    .describe('Advertising platform name (e.g., "Meta", "LinkedIn", "Google Ads", "YouTube", "TikTok").'),

  rationale: z.string()
    .describe('Why this platform is recommended for this specific client. Reference ICP data, competitor activity, and offer fit.'),

  budgetPercentage: z.number().min(0).max(100)
    .describe('Percentage of total budget allocated to this platform (0-100). All platforms must sum to 100. Must be derived from QvC scoring — primary platform: 50-65%, secondary: 25-35%, testing: 10-20%.'),

  monthlySpend: z.number()
    .describe('Monthly dollar amount for this platform. Must equal totalBudget * budgetPercentage / 100.'),

  campaignTypes: z.array(z.string())
    .min(1).max(5)
    .describe('Campaign types to run (e.g., "Lead Gen", "Retargeting", "Brand Awareness", "Conversion").'),

  targetingApproach: z.string()
    .describe('How to target the ICP on this platform. Be specific about audiences, interests, job titles, etc.'),

  expectedCplRange: z.object({
    min: z.number().describe('Low end of expected CPL range in USD'),
    max: z.number().describe('High end of expected CPL range in USD'),
  }).describe('Expected cost-per-lead range based on industry benchmarks and platform.'),

  priority: z.enum(['primary', 'secondary', 'testing'])
    .describe('"primary" = main spend allocation. "secondary" = meaningful but smaller budget. "testing" = experimental.'),

  adFormats: z.array(z.string())
    .min(1).max(6)
    .describe('Recommended ad formats for this platform (e.g., "Single Image", "Carousel", "UGC Video 15-30s", "Lead Form Ad", "Responsive Search Ad").'),

  placements: z.array(z.string())
    .min(1).max(6)
    .describe('Recommended placements (e.g., "Facebook News Feed", "Instagram Stories", "LinkedIn Sponsored Content", "Google Search", "YouTube In-Stream").'),

  synergiesWithOtherPlatforms: z.string()
    .describe('How this platform works with others in the media mix (e.g., "Meta retargets LinkedIn traffic that didn\'t convert" or "Google captures high-intent searches driven by Meta awareness campaigns").'),

  competitiveDensity: z.number().min(1).max(10).optional()
    .describe('How crowded this platform is for this vertical (1=wide open, 10=extremely saturated). Based on competitor activity and auction pressure.'),

  audienceSaturation: z.enum(['low', 'medium', 'high']).optional()
    .describe('How much of the reachable audience is already being targeted by competitors'),

  platformRiskFactors: z.array(z.string()).min(1).max(3).optional()
    .describe('Key platform-specific risk factors. E.g., "Meta algorithm deprioritizing B2B content", "LinkedIn CPL inflation Q1 2026"'),

  qvcScore: z.number().min(0).max(10).optional()
    .describe('Quality-vs-Cost weighted score (0-10). Computed as: (Targeting x 0.30) + (Quality x 0.25) + (Cost x 0.20) + (Competitor x 0.15) + (Format x 0.10). Used for budget allocation.'),

  qvcBreakdown: z.object({
    targetingPrecision: z.number().min(1).max(10)
      .describe('How precisely this platform can reach the exact ICP (1=broad only, 10=exact job title + company size + industry).'),
    leadQuality: z.number().min(1).max(10)
      .describe('Expected lead quality based on industry data (1=low SQL rates, 10=consistently high SQL rates).'),
    costEfficiency: z.number().min(1).max(10)
      .describe('Inverse of expected CPL relative to budget (1=very expensive, 10=highly cost-efficient).'),
    competitorPresence: z.number().min(1).max(10)
      .describe('Competitor activity level validating this channel (1=no competitors, 10=3+ competitors active).'),
    creativeFormatFit: z.number().min(1).max(10)
      .describe('How well available ad formats match the client content strengths (1=poor fit, 10=perfect format match).'),
  }).optional()
    .describe('Individual QvC factor scores that compose the weighted total.'),

  belowMinimum: z.boolean().optional()
    .describe('True if platform allocation is below recommended minimum budget (Meta $3K, Google $5K, LinkedIn $5K). Signals experimental test only.'),
}).describe('Per-platform advertising strategy with budget, formats, and placements');

// =============================================================================
// ICP Targeting (NEW)
// =============================================================================

const audienceSegmentSchema = z.object({
  name: z.string()
    .describe('Descriptive segment name (e.g., "VP Marketing at Mid-Market SaaS", "Ecommerce Founders $1-10M Revenue").'),

  description: z.string()
    .describe('2-3 sentence description of this audience segment — who they are, what they care about, why they are targetable.'),

  targetingParameters: z.array(z.string())
    .min(2).max(8)
    .describe('Platform-specific targeting parameters (e.g., "Job Title: VP Marketing", "Interest: HubSpot", "Company Size: 50-500 employees").'),

  estimatedReach: z.string()
    .describe('Estimated audience size range (e.g., "120K-250K on Meta", "35K-60K on LinkedIn"). Be platform-specific.'),

  funnelPosition: z.enum(['cold', 'warm', 'hot'])
    .describe('"cold" = prospecting/awareness. "warm" = engaged but not converted. "hot" = high-intent, ready to convert.'),

  priorityScore: z.number().min(1).max(10).optional()
    .describe('Segment priority: reachability × ICP relevance (1=lowest, 10=highest). Raw score for ranking.'),

  targetingDifficulty: z.enum(['easy', 'moderate', 'hard']).optional()
    .describe('How difficult to target this segment with paid ads (easy=broad match, hard=requires custom audiences/lookalikes)'),
}).describe('Audience segment with targeting parameters and reach estimates');

const platformTargetingSchema = z.object({
  platform: z.string()
    .describe('Platform name (must match a platform from platformStrategy).'),

  interests: z.array(z.string())
    .max(10)
    .describe('Interest-based targeting options specific to this platform. Be precise — use actual targeting options available on the platform.'),

  jobTitles: z.array(z.string())
    .max(10)
    .describe('Job title targeting (primarily for LinkedIn/Meta B2B). Leave empty array for B2C or irrelevant platforms.'),

  customAudiences: z.array(z.string())
    .max(5)
    .describe('Custom audience recommendations (e.g., "Website visitors last 30 days", "Email list upload", "Video viewers 50%+").'),

  lookalikeAudiences: z.array(z.string())
    .max(3)
    .describe('Lookalike/similar audience recommendations (e.g., "1% Lookalike of converters", "Similar to email list").'),

  exclusions: z.array(z.string())
    .max(5)
    .describe('Audience exclusions (e.g., "Existing customers", "Job seekers", "Competitors employees", "Under 25").'),
}).describe('Platform-specific targeting breakdown');

export const icpTargetingSchema = z.object({
  segments: z.array(audienceSegmentSchema)
    .min(2).max(6)
    .describe('2-4 audience segments ordered by priority. Include at least one cold prospecting and one warm retargeting segment.'),

  platformTargeting: z.array(platformTargetingSchema)
    .min(1).max(5)
    .describe('Platform-specific targeting for each recommended platform. One entry per platform in platformStrategy.'),

  demographics: z.string()
    .describe('Summary of key demographic attributes: age range, geography, income/company revenue, education level if relevant.'),

  psychographics: z.string()
    .describe('Psychographic profile for ad messaging: motivations, pain points, aspirations, objections, buying triggers.'),

  geographicTargeting: z.string()
    .describe('Geographic targeting details (e.g., "US only, excluding Alaska/Hawaii" or "English-speaking countries, weighted 60% US, 25% UK, 15% Canada/Australia").'),

  reachabilityAssessment: z.string()
    .describe('Assessment of how reachable this ICP is via paid channels. Consider platform penetration, targeting precision, and audience scale. Cite blueprint ICP validation data.'),

  overlapWarnings: z.array(z.string()).max(5).optional()
    .describe('Warnings about audience overlap between segments. E.g., "Segments A and B overlap ~40% on LinkedIn — use exclusion lists"'),
}).describe('ICP targeting strategy with audience segments and platform-specific targeting');

// =============================================================================
// Campaign Structure (NEW)
// =============================================================================

const adSetTemplateSchema = z.object({
  name: z.string()
    .describe('Descriptive ad set name (e.g., "VP Marketing - Interest Targeting", "Website Retarget 30d").'),

  targeting: z.string()
    .describe('Targeting description for this ad set. Reference specific audiences from icpTargeting.'),

  adsToTest: z.number().min(1).max(10)
    .describe('Number of ad variants to test initially in this ad set. Recommend 3-5 for new campaigns.'),

  bidStrategy: z.string()
    .describe('Bid strategy (e.g., "Lowest Cost", "Cost Cap $50", "Target CPA $75", "Manual CPC $2.50"). Be specific to platform.'),
}).describe('Ad set template within a campaign');

const campaignTemplateSchema = z.object({
  name: z.string()
    .describe('Campaign name following naming conventions (e.g., "Meta_Cold_VPMarketing_LeadGen").'),

  objective: z.string()
    .describe('Campaign objective matching platform options (e.g., "Lead Generation", "Conversions", "Traffic", "Video Views").'),

  platform: z.string()
    .describe('Platform this campaign runs on (must match platformStrategy).'),

  funnelStage: z.enum(['cold', 'warm', 'hot'])
    .describe('"cold" = top of funnel prospecting. "warm" = mid-funnel retargeting. "hot" = bottom-funnel conversion.'),

  dailyBudget: z.number()
    .describe('Recommended daily budget for this campaign in USD.'),

  adSets: z.array(adSetTemplateSchema)
    .min(1).max(5)
    .describe('1-3 ad sets per campaign. Each ad set tests a different audience or targeting approach.'),
}).describe('Campaign template with objectives, budget, and ad sets');

const namingConventionSchema = z.object({
  campaignPattern: z.string()
    .describe('Campaign naming pattern (e.g., "[Platform]_[Funnel]_[Audience]_[Objective]_[Date]"). Provide actual pattern.'),

  adSetPattern: z.string()
    .describe('Ad set naming pattern (e.g., "[Audience]_[Targeting Type]_[Geo]").'),

  adPattern: z.string()
    .describe('Ad naming pattern (e.g., "[Angle]_[Format]_[Version]_[Date]").'),

  utmStructure: z.object({
    source: z.string().describe('UTM source pattern (e.g., "facebook", "linkedin", "google")'),
    medium: z.string().describe('UTM medium pattern (e.g., "paid_social", "cpc", "paid_video")'),
    campaign: z.string().describe('UTM campaign pattern (e.g., "{{campaign.name}}", "[funnel]_[audience]")'),
    content: z.string().describe('UTM content pattern (e.g., "{{ad.name}}", "[angle]_[format]_[version]")'),
  }).describe('UTM parameter structure for attribution tracking.'),
}).describe('Naming conventions for campaigns, ad sets, and ads');

const retargetingSegmentSchema = z.object({
  name: z.string()
    .describe('Retargeting segment name (e.g., "Website Visitors 7d", "Video Viewers 50%+ 30d", "Cart Abandoners 14d").'),

  source: z.string()
    .describe('Audience source (e.g., "Website pixel — all pages", "Facebook Video Viewers 50%+", "Lead Form Openers — Not Submitted").'),

  lookbackDays: z.number().min(1).max(365)
    .describe('Lookback window in days. Shorter windows = warmer audiences. Typical: 7d (hot), 30d (warm), 90d (cold retarget).'),

  messagingApproach: z.string()
    .describe('Recommended messaging for this retargeting segment (e.g., "Social proof + urgency. Address their specific objection since they already know the offer.").'),
}).describe('Retargeting audience segment with lookback window and messaging');

const negativeKeywordSchema = z.object({
  keyword: z.string()
    .describe('Keyword or phrase to exclude from search campaigns.'),

  matchType: z.enum(['exact', 'phrase', 'broad'])
    .describe('"exact" = [keyword]. "phrase" = "keyword". "broad" = keyword.'),

  reason: z.string()
    .describe('Why this keyword is excluded (e.g., "Attracts job seekers, not buyers", "Competitor brand — separate campaign", "Free-tier searchers with low intent").'),
}).describe('Negative keyword for search campaign exclusion');

export const campaignStructureSchema = z.object({
  campaigns: z.array(campaignTemplateSchema)
    .min(2).max(10)
    .describe('3-6 campaign templates covering cold/warm/hot funnel stages across platforms. Include at least one retargeting campaign.'),

  namingConvention: namingConventionSchema
    .describe('Standardized naming conventions for easy reporting and analysis.'),

  retargetingSegments: z.array(retargetingSegmentSchema)
    .min(1).max(6)
    .describe('2-4 retargeting segments. Always include website visitors and engaged users at minimum.'),

  negativeKeywords: z.array(negativeKeywordSchema)
    .max(15)
    .describe('5-10 negative keywords for search campaigns. Skip this section if no search/Google campaigns are recommended. Provide empty array if not applicable.'),
}).describe('Campaign structure with templates, naming conventions, and retargeting');

// =============================================================================
// Creative Strategy (NEW)
// =============================================================================

const creativeAngleSchema = z.object({
  name: z.string()
    .describe('Angle name (e.g., "Pain Agitation", "Social Proof", "Before/After Transformation", "Authority/Expert", "Curiosity Gap").'),

  description: z.string()
    .describe('2-3 sentence description of the angle approach and why it fits this client.'),

  exampleHook: z.string()
    .describe('Example hook or headline for this angle using the client\'s specific data (e.g., "87% of VPs waste $50K/year on tools that don\'t integrate — here\'s the fix").'),

  bestForFunnelStages: z.array(z.enum(['cold', 'warm', 'hot']))
    .min(1).max(3)
    .describe('Which funnel stages this angle works best for.'),

  platforms: z.array(z.string())
    .min(1).max(5)
    .describe('Which platforms this angle suits (e.g., ["Meta", "TikTok"] for emotional angles, ["LinkedIn"] for authority angles).'),
}).describe('Creative angle with example hook and platform fit');

const formatSpecSchema = z.object({
  format: z.string()
    .describe('Ad format type (e.g., "Single Image", "Carousel", "UGC Video 15-30s", "Static Graphic", "Animated GIF", "Lead Form Ad").'),

  dimensions: z.string()
    .describe('Recommended dimensions (e.g., "1080x1080 + 1080x1920", "1200x628 for feed + 1080x1920 for stories").'),

  platform: z.string()
    .describe('Platform this format spec applies to.'),

  copyGuideline: z.string()
    .describe('Copy length and style guidance (e.g., "Primary text: 125-150 chars. Headline: 40 chars max. Use question hooks for cold traffic.").'),
}).describe('Creative format specification with dimensions and copy guidelines');

const creativeTestingPlanSchema = z.object({
  phase: z.string()
    .describe('Testing phase name (e.g., "Week 1-2: Hook Testing", "Week 3-4: Format Testing", "Month 2: Scale Winners").'),

  variantsToTest: z.number().min(2).max(20)
    .describe('Number of creative variants to test in this phase. Start with 4-6, then narrow.'),

  methodology: z.string()
    .describe('Testing methodology (e.g., "A/B test 4 hook variants with same visual. Winner advances. $20/day per variant for 5 days minimum.").'),

  testingBudget: z.number()
    .describe('Budget allocated to this testing phase in USD.'),

  durationDays: z.number().min(3).max(60)
    .describe('Duration of this testing phase in days.'),

  successCriteria: z.string()
    .describe('Measurable criteria for promoting a creative (e.g., "CTR >1.5% AND CPL <$80 after 1000 impressions").'),
}).describe('Creative testing phase with methodology and budget');

const creativeRefreshCadenceSchema = z.object({
  platform: z.string()
    .describe('Platform name.'),

  refreshIntervalDays: z.number().min(7).max(90)
    .describe('Recommended creative refresh interval in days. Meta: 14-21d. LinkedIn: 30-45d. Google: 30-60d. TikTok: 7-14d.'),

  fatigueSignals: z.array(z.string())
    .min(1).max(5)
    .describe('Signals indicating creative fatigue (e.g., "CTR drops >30% from peak", "Frequency >3.0", "CPL increases >25% week-over-week").'),
}).describe('Creative refresh cadence and fatigue signals per platform');

const brandGuidelineSchema = z.object({
  category: z.string()
    .describe('Guideline category (e.g., "Tone of Voice", "Visual Style", "Compliance", "Prohibited Claims", "CTA Style").'),

  guideline: z.string()
    .describe('Specific guideline to follow (e.g., "Avoid fear-based messaging — use aspirational tone", "All claims must include source citation", "Never use red backgrounds per brand guidelines").'),
}).describe('Brand or compliance guideline for creative production');

export const creativeStrategySchema = z.object({
  angles: z.array(creativeAngleSchema)
    .min(3).max(10)
    .describe('3-5 creative angles ordered by priority. Each angle must have a specific example hook using the client\'s data, not generic templates.'),

  formatSpecs: z.array(formatSpecSchema)
    .min(2).max(10)
    .describe('2-4 format specs per platform. Prioritize formats that align with competitor creative gaps identified in the blueprint.'),

  testingPlan: z.array(creativeTestingPlanSchema)
    .min(2).max(5)
    .describe('2-3 phased creative testing plan. Phase 1: hook/message testing. Phase 2: format/visual testing. Phase 3: scale winners.'),

  refreshCadence: z.array(creativeRefreshCadenceSchema)
    .min(1).max(5)
    .describe('One entry per platform in the media mix.'),

  brandGuidelines: z.array(brandGuidelineSchema)
    .min(1).max(8)
    .describe('3-5 brand and compliance guidelines. Include any restrictions from the client brief and compliance section.'),
}).describe('Creative strategy with angles, formats, testing plan, and refresh cadence');

// =============================================================================
// Budget Allocation (enriched)
// =============================================================================

const funnelSplitSchema = z.object({
  stage: z.enum(['cold', 'warm', 'hot'])
    .describe('"cold" = prospecting/awareness (typically 50-70%). "warm" = retargeting/nurture (typically 20-30%). "hot" = conversion/bottom-funnel (typically 10-20%).'),

  percentage: z.number().min(0).max(100)
    .describe('Percentage of total budget for this funnel stage. All stages must sum to 100.'),

  rationale: z.string()
    .describe('Why this split percentage (e.g., "70% cold — new brand, need audience building before retargeting pool is large enough").'),
}).describe('Budget split by funnel stage');

const monthlyRoadmapSchema = z.object({
  month: z.number().min(1).max(12)
    .describe('Month number (1-based). Cover at least 3 months.'),

  budget: z.number()
    .describe('Total budget for this month in USD. May increase over time as winners are identified.'),

  focus: z.string()
    .describe('Primary focus for this month (e.g., "Month 1: Testing — validate audiences and hooks", "Month 2: Scale — double down on winning ad sets").'),

  scalingTriggers: z.array(z.string())
    .min(1).max(4)
    .describe('Conditions that trigger scaling up spend (e.g., "CPL <$60 sustained 7+ days", "ROAS >2.5x", "SQL rate >12%").'),
}).describe('Monthly budget plan with focus and scaling triggers');

export const budgetAllocationSchema = z.object({
  totalMonthlyBudget: z.number()
    .describe('Total monthly ad spend in USD. Must match the client budget from onboarding.'),

  platformBreakdown: z.array(z.object({
    platform: z.string().describe('Platform name'),
    monthlyBudget: z.number().describe('Monthly spend for this platform in USD'),
    percentage: z.number().describe('Percentage of total budget (0-100)'),
  })).min(1).max(5)
    .describe('Budget breakdown by platform. Must sum to totalMonthlyBudget.'),

  dailyCeiling: z.number()
    .describe('Maximum daily spend across all platforms in USD.'),

  rampUpStrategy: z.string()
    .describe('How to ramp up spend over the first 30 days. Be specific about daily budget progression.'),

  funnelSplit: z.array(funnelSplitSchema)
    .min(2).max(3)
    .describe('Budget split by funnel stage (cold/warm/hot). Must sum to 100%.'),

  monthlyRoadmap: z.array(monthlyRoadmapSchema)
    .min(3).max(6)
    .describe('Monthly budget roadmap for first 3-6 months. Show how spend evolves as campaigns mature.'),
}).describe('Overall budget allocation with funnel split and monthly roadmap');

// =============================================================================
// Campaign Phases (unchanged)
// =============================================================================

export const campaignPhaseSchema = z.object({
  name: z.string()
    .describe('Phase name (e.g., "Foundation & Testing", "Scale Winners", "Optimize & Expand").'),

  phase: z.number().min(1).max(6)
    .describe('Phase number (1-based sequential).'),

  durationWeeks: z.number().min(1).max(12)
    .describe('Duration of this phase in weeks.'),

  objective: z.string()
    .describe('Primary objective for this phase. Be specific about what success looks like.'),

  activities: z.array(z.string())
    .min(2).max(8)
    .describe('Key activities during this phase. Concrete actions the media buyer should take.'),

  successCriteria: z.array(z.string())
    .min(1).max(5)
    .describe('Measurable criteria for moving to the next phase.'),

  estimatedBudget: z.number()
    .describe('Total estimated budget for this entire phase in USD.'),

  goNoGoDecision: z.string().optional()
    .describe('What happens if success criteria are NOT met. E.g., "Reduce daily budget by 30% and extend testing 2 more weeks" or "Pivot to Google if Meta CPL exceeds $150"'),

  scenarioAdjustment: z.string().optional()
    .describe('How to adjust this phase if worst-case sensitivity scenario materializes. Reference specific contingency actions.'),
}).describe('Campaign phase with objectives, activities, and success criteria');

// =============================================================================
// KPI Targets (enriched)
// =============================================================================

export const kpiTargetSchema = z.object({
  metric: z.string()
    .describe('KPI metric name (e.g., "Cost Per Lead", "SQL Rate", "ROAS", "Demo Booking Rate").'),

  target: z.string()
    .describe('Target value with units (e.g., "<$75", "15%", "3.5x", "80/month").'),

  timeframe: z.string()
    .describe('When this target should be achieved (e.g., "Month 2", "By end of Phase 2", "Ongoing").'),

  measurementMethod: z.string()
    .describe('How to measure this KPI. Be specific about tools and attribution (e.g., "HubSpot CRM pipeline tracking").'),

  type: z.enum(['primary', 'secondary'])
    .describe('"primary" = critical metrics the campaign is optimized for (CPL, ROAS, SQL volume). "secondary" = supporting metrics that inform optimization (CTR, CPC, frequency).'),

  benchmark: z.string()
    .describe('Industry benchmark for context (e.g., "Industry avg CPL: $85-120 for B2B SaaS", "Typical Meta CTR for this vertical: 0.8-1.2%"). Cite the data source when possible.'),

  benchmarkRange: z.object({
    low: z.string(),
    mid: z.string(),
    high: z.string(),
  }).optional()
    .describe('Low/mid/high benchmark range from industry data. Mid should match the target.'),

  sourceConfidence: z.number().min(1).max(5).optional()
    .describe('Confidence in benchmark source (1=anecdotal, 3=industry report, 5=platform-verified data)'),

  scenarioThresholds: z.object({
    best: z.string(),
    base: z.string(),
    worst: z.string(),
  }).optional()
    .describe('Scenario-linked thresholds from sensitivity analysis. Best=aggressive target, base=plan target, worst=minimum acceptable.'),
}).describe('KPI target with type classification and industry benchmark');

// =============================================================================
// Performance Model (NEW)
// =============================================================================

const cacModelSchema = z.object({
  targetCAC: z.number()
    .describe('Target customer acquisition cost in USD. Must be achievable given the funnel math below.'),

  targetCPL: z.number()
    .describe('Target cost per lead in USD. Derived from platform benchmarks and budget constraints.'),

  leadToSqlRate: z.number().min(0).max(100)
    .describe('Expected lead-to-SQL conversion rate as percentage (e.g., 15 means 15%). Use industry benchmarks for the vertical.'),

  sqlToCustomerRate: z.number().min(0).max(100)
    .describe('Expected SQL-to-customer close rate as percentage (e.g., 25 means 25%). Base on industry norms or client data.'),

  expectedMonthlyLeads: z.number()
    .describe('Expected monthly leads at target spend. Formula: monthlyBudget / targetCPL.'),

  expectedMonthlySQLs: z.number()
    .describe('Expected monthly SQLs. Formula: expectedMonthlyLeads * leadToSqlRate / 100.'),

  expectedMonthlyCustomers: z.number()
    .describe('Expected monthly new customers. Formula: expectedMonthlySQLs * sqlToCustomerRate / 100.'),

  estimatedLTV: z.number()
    .describe('Estimated customer lifetime value in USD. Use offer price and typical retention for the pricing model.'),

  ltvToCacRatio: z.string()
    .describe('Projected LTV:CAC ratio (e.g., "5.2:1"). Healthy is >3:1. Include brief assessment.'),
}).describe('CAC funnel math model with conversion rates and unit economics');

const monitoringScheduleSchema = z.object({
  daily: z.array(z.string())
    .min(2).max(6)
    .describe('Daily monitoring tasks (e.g., "Check spend pacing vs daily ceiling", "Review any ad disapprovals", "Monitor CPL by campaign").'),

  weekly: z.array(z.string())
    .min(2).max(6)
    .describe('Weekly review tasks (e.g., "Analyze creative performance — pause <0.5% CTR ads", "Review search term reports", "Check frequency caps").'),

  monthly: z.array(z.string())
    .min(2).max(6)
    .describe('Monthly strategic reviews (e.g., "Full funnel analysis — CPL to CAC to LTV", "Budget reallocation based on platform ROAS", "Creative refresh planning").'),
}).describe('Monitoring schedule with daily, weekly, and monthly tasks');

export const performanceModelSchema = z.object({
  cacModel: cacModelSchema
    .describe('CAC funnel math model. All numbers must be internally consistent (leads * rate = SQLs, etc.).'),

  monitoringSchedule: monitoringScheduleSchema
    .describe('Practical monitoring schedule for the media buying team.'),
}).describe('Performance model with CAC funnel math and monitoring schedule');

// =============================================================================
// Risk Monitoring (NEW)
// =============================================================================

const riskSchema = z.object({
  risk: z.string()
    .describe('Specific risk description (e.g., "Meta CPL exceeds $120 in first 30 days due to narrow B2B audience", not generic "costs may be high").'),

  category: z.enum(['budget', 'creative', 'audience', 'platform', 'compliance', 'market'])
    .describe('"budget" = overspend/underspend. "creative" = fatigue/low performance. "audience" = too narrow/wrong ICP. "platform" = policy/algorithm changes. "compliance" = regulatory. "market" = competitive/seasonal shifts.'),

  severity: z.enum(['low', 'medium', 'high'])
    .describe('Impact severity if the risk materializes.'),

  likelihood: z.enum(['low', 'medium', 'high'])
    .describe('Probability of this risk occurring.'),

  probability: z.number().min(1).max(5).optional()
    .describe('Probability of risk occurring (1=rare, 5=almost certain). Raw score — do not compute P×I, the system does that.'),

  impact: z.number().min(1).max(5).optional()
    .describe('Impact if risk materializes (1=negligible, 5=catastrophic). Raw score — do not compute P×I, the system does that.'),

  score: z.number().optional()
    .describe('Computed P×I score (system-generated, do not provide)'),

  classification: z.enum(['low', 'medium', 'high', 'critical']).optional()
    .describe('System-computed risk classification based on P×I score'),

  mitigation: z.string()
    .describe('Proactive mitigation strategy (e.g., "Start with $50/day cap and scale only after 7 days of <$100 CPL").'),

  contingency: z.string()
    .describe('Contingency plan if the risk materializes (e.g., "Shift 30% of Meta budget to Google Search if CPL exceeds $120 for 14 consecutive days").'),

  earlyWarningIndicator: z.string().optional()
    .describe('Specific metric threshold that signals this risk is materializing. E.g., "CPL exceeds $120 for 5+ consecutive days"'),

  monitoringFrequency: z.enum(['daily', 'weekly', 'monthly']).optional()
    .describe('How often to check this risk indicator'),
}).describe('Identified risk with mitigation and contingency plan');

export const riskMonitoringSchema = z.object({
  risks: z.array(riskSchema)
    .min(4).max(10)
    .describe('5-8 risks covering at least 4 of the 6 categories (budget, creative, audience, platform, compliance, market). Be specific to this client — no generic risks.'),

  assumptions: z.array(z.string())
    .min(2).max(6)
    .describe('3-5 key assumptions this plan depends on (e.g., "Client can provide CRM data for custom audiences within 2 weeks", "Landing page converts at >2% for cold traffic", "No major platform policy changes in next 90 days").'),
}).describe('Risk identification and monitoring with assumptions');

// =============================================================================
// Complete Media Plan Schema (excludes metadata — populated post-generation)
// =============================================================================

export const mediaPlanSchema = z.object({
  executiveSummary: executiveSummarySchema
    .describe('High-level strategy overview and priorities'),

  platformStrategy: z.array(platformStrategySchema)
    .min(1).max(5)
    .describe('Per-platform strategy. Include 2-4 platforms ordered by priority. Primary platform first.'),

  icpTargeting: icpTargetingSchema
    .describe('ICP targeting strategy with audience segments and per-platform targeting details'),

  campaignStructure: campaignStructureSchema
    .describe('Campaign templates, naming conventions, retargeting segments, and negative keywords'),

  creativeStrategy: creativeStrategySchema
    .describe('Creative angles, format specs, testing plan, refresh cadence, and brand guidelines'),

  budgetAllocation: budgetAllocationSchema
    .describe('Budget allocation across platforms with funnel split and monthly roadmap'),

  campaignPhases: z.array(campaignPhaseSchema)
    .min(2).max(6)
    .describe('3-4 phased campaign rollout. Start with testing/foundation, then scale, then optimize.'),

  kpiTargets: z.array(kpiTargetSchema)
    .min(3).max(12)
    .describe('5-8 KPI targets covering cost efficiency, volume, quality, and ROI metrics. Include both primary and secondary KPIs.'),

  performanceModel: performanceModelSchema
    .describe('CAC funnel math model and practical monitoring schedule'),

  riskMonitoring: riskMonitoringSchema
    .describe('Risk identification with mitigation plans and key assumptions'),
}).describe('Complete media plan for paid advertising campaign — 10 sections');
