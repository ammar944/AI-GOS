// Media Plan Output Types
// Canonical types for the media plan generation pipeline

import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';

// =============================================================================
// Executive Summary
// =============================================================================

export interface MediaPlanExecutiveSummary {
  /** High-level strategy overview */
  overview: string;
  /** Primary objective */
  primaryObjective: string;
  /** Recommended total monthly budget */
  recommendedMonthlyBudget: number;
  /** Expected timeline to first results */
  timelineToResults: string;
  /** Top 3 strategic priorities */
  topPriorities: string[];
}

// =============================================================================
// Platform Strategy
// =============================================================================

export interface PlatformStrategy {
  /** Platform name (e.g., "Meta", "LinkedIn", "Google") */
  platform: string;
  /** Why this platform for this client */
  rationale: string;
  /** Budget allocation percentage (0-100) */
  budgetPercentage: number;
  /** Monthly spend for this platform */
  monthlySpend: number;
  /** Campaign types to run */
  campaignTypes: string[];
  /** Target audience description for this platform */
  targetingApproach: string;
  /** Expected CPL range */
  expectedCplRange: { min: number; max: number };
  /** Priority level */
  priority: 'primary' | 'secondary' | 'testing';
  /** Recommended ad formats for this platform */
  adFormats: string[];
  /** Recommended placements on this platform */
  placements: string[];
  /** How this platform works with other platforms in the mix */
  synergiesWithOtherPlatforms: string;
  /** How crowded this platform is for this vertical (1=wide open, 10=saturated) */
  competitiveDensity?: number;
  /** How much of the reachable audience is already being targeted by competitors */
  audienceSaturation?: 'low' | 'medium' | 'high';
  /** Key platform-specific risk factors */
  platformRiskFactors?: string[];
}

// =============================================================================
// ICP Targeting (NEW)
// =============================================================================

export interface AudienceSegment {
  /** Segment name */
  name: string;
  /** Description of this segment */
  description: string;
  /** Platform-specific targeting parameters */
  targetingParameters: string[];
  /** Estimated audience size range */
  estimatedReach: string;
  /** Funnel position: cold (prospecting), warm (retargeting), hot (conversion) */
  funnelPosition: 'cold' | 'warm' | 'hot';
  /** Segment priority: reachability x ICP relevance (1=lowest, 10=highest) */
  priorityScore?: number;
  /** How difficult to target this segment with paid ads */
  targetingDifficulty?: 'easy' | 'moderate' | 'hard';
}

export interface PlatformTargeting {
  /** Platform this targeting applies to */
  platform: string;
  /** Interest-based targeting options */
  interests: string[];
  /** Job title / role targeting (B2B) */
  jobTitles: string[];
  /** Custom audience recommendations */
  customAudiences: string[];
  /** Lookalike audience recommendations */
  lookalikeAudiences: string[];
  /** Exclusion criteria */
  exclusions: string[];
}

export interface ICPTargeting {
  /** Audience segments ordered by priority */
  segments: AudienceSegment[];
  /** Per-platform targeting breakdown */
  platformTargeting: PlatformTargeting[];
  /** Demographic summary */
  demographics: string;
  /** Psychographic profile for ad messaging */
  psychographics: string;
  /** Geographic targeting details */
  geographicTargeting: string;
  /** How reachable is this ICP via paid channels */
  reachabilityAssessment: string;
  /** Warnings about audience overlap between segments */
  overlapWarnings?: string[];
}

// =============================================================================
// Campaign Structure (NEW)
// =============================================================================

export interface CampaignTemplate {
  /** Campaign name */
  name: string;
  /** Campaign objective (e.g., "Lead Generation", "Conversions", "Traffic") */
  objective: string;
  /** Platform this campaign runs on */
  platform: string;
  /** Funnel stage */
  funnelStage: 'cold' | 'warm' | 'hot';
  /** Daily budget recommendation */
  dailyBudget: number;
  /** Ad sets within this campaign */
  adSets: AdSetTemplate[];
}

export interface AdSetTemplate {
  /** Ad set name */
  name: string;
  /** Targeting description */
  targeting: string;
  /** Number of ads to test initially */
  adsToTest: number;
  /** Bid strategy recommendation */
  bidStrategy: string;
}

export interface NamingConvention {
  /** Campaign naming pattern (e.g., "[Platform]_[Funnel]_[Audience]_[Date]") */
  campaignPattern: string;
  /** Ad set naming pattern */
  adSetPattern: string;
  /** Ad naming pattern */
  adPattern: string;
  /** UTM parameter structure */
  utmStructure: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
  };
}

export interface RetargetingSegment {
  /** Segment name */
  name: string;
  /** Audience source (e.g., "Website Visitors", "Video Viewers 50%+") */
  source: string;
  /** Lookback window in days */
  lookbackDays: number;
  /** Recommended messaging approach */
  messagingApproach: string;
}

export interface NegativeKeyword {
  /** Keyword or phrase to exclude */
  keyword: string;
  /** Match type: exact, phrase, or broad */
  matchType: 'exact' | 'phrase' | 'broad';
  /** Reason for exclusion */
  reason: string;
}

export interface CampaignStructure {
  /** Campaign templates for each platform/funnel combination */
  campaigns: CampaignTemplate[];
  /** Naming conventions for campaigns, ad sets, and ads */
  namingConvention: NamingConvention;
  /** Retargeting segments and strategies */
  retargetingSegments: RetargetingSegment[];
  /** Negative keywords for search campaigns */
  negativeKeywords: NegativeKeyword[];
}

// =============================================================================
// Creative Strategy (NEW)
// =============================================================================

export interface CreativeAngle {
  /** Angle name (e.g., "Pain Agitation", "Social Proof", "Before/After") */
  name: string;
  /** Description of the angle approach */
  description: string;
  /** Example hook or headline for this angle */
  exampleHook: string;
  /** Which funnel stages this angle works best for */
  bestForFunnelStages: ('cold' | 'warm' | 'hot')[];
  /** Which platforms this angle suits */
  platforms: string[];
}

export interface FormatSpec {
  /** Format type (e.g., "Single Image", "Carousel", "UGC Video", "Static Graphic") */
  format: string;
  /** Recommended dimensions (e.g., "1080x1080", "1080x1920") */
  dimensions: string;
  /** Platform this spec applies to */
  platform: string;
  /** Copy length recommendation */
  copyGuideline: string;
}

export interface CreativeTestingPlan {
  /** Phase name */
  phase: string;
  /** Number of creative variants to test */
  variantsToTest: number;
  /** Testing methodology (e.g., "A/B test hooks", "DCT", "Iterative winner scaling") */
  methodology: string;
  /** Budget allocated to testing */
  testingBudget: number;
  /** Duration of testing in days */
  durationDays: number;
  /** Success criteria for promoting a creative */
  successCriteria: string;
}

export interface CreativeRefreshCadence {
  /** Platform */
  platform: string;
  /** Recommended refresh interval in days */
  refreshIntervalDays: number;
  /** Signs of creative fatigue to watch for */
  fatigueSignals: string[];
}

export interface BrandGuideline {
  /** Guideline category (e.g., "Tone", "Visual", "Compliance") */
  category: string;
  /** Specific guideline */
  guideline: string;
}

export interface CreativeStrategy {
  /** Creative angles to test, ordered by priority */
  angles: CreativeAngle[];
  /** Format specifications per platform */
  formatSpecs: FormatSpec[];
  /** Creative testing plan across phases */
  testingPlan: CreativeTestingPlan[];
  /** Refresh cadence per platform */
  refreshCadence: CreativeRefreshCadence[];
  /** Brand and compliance guidelines for creative production */
  brandGuidelines: BrandGuideline[];
}

// =============================================================================
// Budget Allocation (enriched)
// =============================================================================

export interface FunnelSplit {
  /** Funnel stage */
  stage: 'cold' | 'warm' | 'hot';
  /** Percentage of budget */
  percentage: number;
  /** Rationale for this split */
  rationale: string;
}

export interface MonthlyRoadmap {
  /** Month number (1-based) */
  month: number;
  /** Total budget for this month */
  budget: number;
  /** Primary focus for the month */
  focus: string;
  /** Conditions that trigger scaling up */
  scalingTriggers: string[];
}

export interface BudgetAllocation {
  /** Total monthly budget */
  totalMonthlyBudget: number;
  /** Budget by platform */
  platformBreakdown: {
    platform: string;
    monthlyBudget: number;
    percentage: number;
  }[];
  /** Recommended daily budget ceiling */
  dailyCeiling: number;
  /** Budget ramp-up recommendation */
  rampUpStrategy: string;
  /** Budget split by funnel stage */
  funnelSplit: FunnelSplit[];
  /** Monthly budget roadmap for first 3-6 months */
  monthlyRoadmap: MonthlyRoadmap[];
}

// =============================================================================
// Campaign Phases (unchanged)
// =============================================================================

export interface CampaignPhase {
  /** Phase name (e.g., "Foundation", "Scale", "Optimize") */
  name: string;
  /** Phase number (1-based) */
  phase: number;
  /** Duration in weeks */
  durationWeeks: number;
  /** Primary objective for this phase */
  objective: string;
  /** Key activities during this phase */
  activities: string[];
  /** Success criteria for moving to next phase */
  successCriteria: string[];
  /** Estimated budget for this phase */
  estimatedBudget: number;
  /** What happens if success criteria are NOT met */
  goNoGoDecision?: string;
  /** How to adjust this phase if worst-case sensitivity scenario materializes */
  scenarioAdjustment?: string;
}

// =============================================================================
// KPI Targets (enriched)
// =============================================================================

export interface KPITarget {
  /** KPI name */
  metric: string;
  /** Target value */
  target: string;
  /** Timeframe for achieving target */
  timeframe: string;
  /** How this will be measured */
  measurementMethod: string;
  /** Primary or secondary KPI */
  type: 'primary' | 'secondary';
  /** Industry benchmark for context */
  benchmark: string;
  /** Low/mid/high benchmark range from industry data */
  benchmarkRange?: { low: string; mid: string; high: string };
  /** Confidence in benchmark source (1=anecdotal, 5=platform-verified) */
  sourceConfidence?: number;
  /** Scenario-linked thresholds from sensitivity analysis */
  scenarioThresholds?: { best: string; base: string; worst: string };
}

// =============================================================================
// Performance Model (NEW)
// =============================================================================

export interface CACModel {
  /** Target customer acquisition cost */
  targetCAC: number;
  /** Target cost per lead */
  targetCPL: number;
  /** Expected lead-to-SQL conversion rate (0-100) */
  leadToSqlRate: number;
  /** Expected SQL-to-customer conversion rate (0-100) */
  sqlToCustomerRate: number;
  /** Expected monthly leads at target spend */
  expectedMonthlyLeads: number;
  /** Expected monthly SQLs */
  expectedMonthlySQLs: number;
  /** Expected monthly new customers */
  expectedMonthlyCustomers: number;
  /** Customer lifetime value for ROI context */
  estimatedLTV: number;
  /** Projected LTV:CAC ratio */
  ltvToCacRatio: string;
}

export interface MonitoringSchedule {
  /** Daily checks the media buyer should perform */
  daily: string[];
  /** Weekly review items */
  weekly: string[];
  /** Monthly strategic reviews */
  monthly: string[];
}

export interface PerformanceModel {
  /** CAC funnel math model */
  cacModel: CACModel;
  /** Monitoring schedule for the media buyer */
  monitoringSchedule: MonitoringSchedule;
}

// =============================================================================
// Risk Monitoring (NEW)
// =============================================================================

export interface Risk {
  /** Risk description */
  risk: string;
  /** Category of risk */
  category: 'budget' | 'creative' | 'audience' | 'platform' | 'compliance' | 'market';
  /** Severity: low, medium, high */
  severity: 'low' | 'medium' | 'high';
  /** Likelihood: low, medium, high */
  likelihood: 'low' | 'medium' | 'high';
  /** Probability of risk occurring (1=rare, 5=almost certain) */
  probability?: number;
  /** Impact if risk materializes (1=negligible, 5=catastrophic) */
  impact?: number;
  /** Computed P×I score (system-generated) */
  score?: number;
  /** System-computed risk classification based on P×I score */
  classification?: 'low' | 'medium' | 'high' | 'critical';
  /** Mitigation strategy */
  mitigation: string;
  /** Contingency plan if risk materializes */
  contingency: string;
  /** Specific metric threshold that signals this risk is materializing */
  earlyWarningIndicator?: string;
  /** How often to check this risk indicator */
  monitoringFrequency?: 'daily' | 'weekly' | 'monthly';
}

export interface RiskMonitoring {
  /** Identified risks with mitigation plans */
  risks: Risk[];
  /** Key assumptions this plan depends on */
  assumptions: string[];
}

// =============================================================================
// Complete Media Plan Output
// =============================================================================

export interface MediaPlanOutput {
  /** Executive summary of the media plan */
  executiveSummary: MediaPlanExecutiveSummary;
  /** Per-platform strategy breakdown */
  platformStrategy: PlatformStrategy[];
  /** ICP targeting details with audience segments */
  icpTargeting: ICPTargeting;
  /** Campaign structure with templates and naming conventions */
  campaignStructure: CampaignStructure;
  /** Creative strategy with angles, formats, and testing plan */
  creativeStrategy: CreativeStrategy;
  /** Overall budget allocation */
  budgetAllocation: BudgetAllocation;
  /** Phased campaign rollout */
  campaignPhases: CampaignPhase[];
  /** KPI targets and measurement */
  kpiTargets: KPITarget[];
  /** Performance model with CAC math and monitoring */
  performanceModel: PerformanceModel;
  /** Risk identification and monitoring plan */
  riskMonitoring: RiskMonitoring;
  /** Generation metadata (populated post-generation, not part of AI output) */
  metadata: MediaPlanMetadata;
}

// =============================================================================
// Metadata
// =============================================================================

export interface MediaPlanMetadata {
  /** When the media plan was generated */
  generatedAt: string;
  /** Output structure version */
  version: string;
  /** Total processing time in ms */
  processingTime: number;
  /** Total cost of AI calls */
  totalCost: number;
  /** Model used for generation */
  modelUsed: string;
  /** ID of the source blueprint (for traceability) */
  sourceBlueprintId?: string;
}

// =============================================================================
// Section Constants
// =============================================================================

/** @deprecated Use MediaPlanSectionKey from section-constants.ts instead */
export type MediaPlanSection = 'mediaPlan';

/** @deprecated Use MEDIA_PLAN_SECTION_LABELS from section-constants.ts instead */
export const MEDIA_PLAN_SECTION_LABELS: Record<MediaPlanSection, string> = {
  mediaPlan: 'Media Plan',
};

/** Pipeline stages displayed in the generation UI */
export const MEDIA_PLAN_STAGES = ['Research', 'Synthesis', 'Validation', 'Summary'] as const;

// =============================================================================
// SSE Event Types (per-section streaming for multi-phase pipeline)
// =============================================================================

import type { MediaPlanSectionKey } from './section-constants';

export interface MediaPlanSSESectionStartEvent {
  type: 'section-start';
  section: MediaPlanSectionKey;
  phase: 'research' | 'synthesis' | 'validation' | 'final';
  label: string;
}

export interface MediaPlanSSEProgressEvent {
  type: 'progress';
  percentage: number;
  message: string;
}

export interface MediaPlanSSESectionCompleteEvent {
  type: 'section-complete';
  section: MediaPlanSectionKey;
  phase: 'research' | 'synthesis' | 'validation' | 'final';
  label: string;
}

export interface MediaPlanSSESectionDataEvent {
  type: 'section-data';
  section: MediaPlanSectionKey;
  data: unknown;
  phase: 'research' | 'synthesis' | 'validation' | 'final';
}

export interface MediaPlanSSEDoneEvent {
  type: 'done';
  success: true;
  mediaPlan: MediaPlanOutput;
  metadata: {
    totalTime: number;
    totalCost: number;
  };
}

export interface MediaPlanSSEErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

export type MediaPlanSSEEvent =
  | MediaPlanSSESectionStartEvent
  | MediaPlanSSEProgressEvent
  | MediaPlanSSESectionCompleteEvent
  | MediaPlanSSESectionDataEvent
  | MediaPlanSSEDoneEvent
  | MediaPlanSSEErrorEvent;

// =============================================================================
// Generator Types
// =============================================================================

export interface MediaPlanGeneratorResult {
  success: boolean;
  mediaPlan?: MediaPlanOutput;
  error?: string;
}

export interface MediaPlanGenerateInput {
  blueprint: StrategicBlueprintOutput;
  onboardingData: OnboardingFormData;
}
