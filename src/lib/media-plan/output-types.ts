// Media Plan Output Types
// Comprehensive type definitions for the 11-section Media Plan structure

// =============================================================================
// Section 1: Executive Summary
// =============================================================================

export interface ExecutiveSummary {
  /** High-level overview of the entire strategy */
  strategyOverview: string;
  /** Primary timeline focus (e.g., "90-day sprint", "Q1 launch") */
  timelineFocus: string;
  /** Key strategic priorities in order of importance */
  strategicPriorities: string[];
  /** Expected primary outcome/result */
  expectedOutcome: string;
  /** One-line positioning statement for the campaign */
  positioningStatement: string;
}

// =============================================================================
// Section 2: Campaign Objective Selection
// =============================================================================

export type BusinessGoal =
  | "revenue_growth"
  | "lead_generation"
  | "brand_awareness"
  | "market_expansion"
  | "customer_acquisition"
  | "product_launch"
  | "customer_retention"
  | "market_share";

export type MarketingObjective =
  | "awareness"
  | "consideration"
  | "conversion"
  | "retention"
  | "advocacy";

export interface PlatformLogic {
  /** Sales cycle length consideration */
  salesCycleConsideration: string;
  /** How the sales cycle influences platform choice */
  platformImplications: string;
  /** Recommended primary platform based on sales cycle */
  recommendedPlatform: string;
  /** Reasoning for the recommendation */
  reasoning: string;
}

export interface CampaignObjectiveSelection {
  /** Primary business goal */
  businessGoal: {
    goal: BusinessGoal;
    description: string;
  };
  /** Marketing objective aligned to funnel stage */
  marketingObjective: {
    objective: MarketingObjective;
    description: string;
  };
  /** Platform selection logic based on sales cycle */
  platformLogic: PlatformLogic;
  /** Final consolidated objective */
  finalObjective: {
    statement: string;
    reasoning: string;
    successCriteria: string[];
  };
}

// =============================================================================
// Section 3: Key Insights From Strategic Research
// =============================================================================

export interface StrategicInsight {
  /** Category of insight */
  category: "pain_point" | "differentiation" | "competitor" | "icp" | "offer";
  /** The insight itself */
  insight: string;
  /** How this insight will inform the media plan */
  implication: string;
  /** Confidence level in this insight */
  confidence: "high" | "medium" | "low";
  /** Source of the insight */
  source?: string;
}

export interface KeyInsightsFromResearch {
  /** Top pain points that drive purchase decisions */
  painPoints: {
    primary: string;
    secondary: string[];
    howToAddress: string;
  };
  /** Key differentiators from competition */
  differentiation: {
    uniqueStrengths: string[];
    competitiveAdvantages: string[];
    messagingOpportunities: string[];
  };
  /** Competitor advertising angles and gaps */
  competitorAngles: {
    commonApproaches: string[];
    gaps: string[];
    opportunities: string[];
  };
  /** ICP clarity and targeting insights */
  icpClarity: {
    primaryProfile: string;
    buyingBehavior: string;
    decisionMakers: string[];
    influencers: string[];
  };
  /** Offer strengths to emphasize */
  offerStrengths: {
    valueProposition: string;
    proofPoints: string[];
    guarantees: string[];
  };
  /** All strategic insights consolidated */
  topInsights: StrategicInsight[];
}

// =============================================================================
// Section 4: ICP and Targeting Strategy
// =============================================================================

export type TargetingMethod =
  | "interest_based"
  | "lookalike"
  | "retargeting"
  | "job_title"
  | "industry"
  | "company_size"
  | "behavioral"
  | "contextual"
  | "custom_audience"
  | "keyword";

export interface AudienceSegment {
  /** Name of the audience segment */
  name: string;
  /** Description of who this segment is */
  description: string;
  /** Demographics for this segment */
  demographics: {
    ageRange?: string;
    gender?: string;
    location: string[];
    income?: string;
    education?: string;
  };
  /** Psychographics for this segment */
  psychographics: {
    interests: string[];
    values: string[];
    behaviors: string[];
    painPoints: string[];
  };
  /** Job-related targeting (B2B) */
  professional?: {
    jobTitles: string[];
    industries: string[];
    companySize: string[];
    seniorityLevel: string[];
  };
  /** Priority level for this segment */
  priority: "primary" | "secondary" | "tertiary";
  /** Estimated audience size */
  estimatedSize: string;
}

export interface TargetingMethodConfig {
  /** The targeting method */
  method: TargetingMethod;
  /** Specific configuration for this method */
  configuration: string;
  /** Platform where this method applies */
  platform: string;
  /** Expected effectiveness */
  expectedEffectiveness: "high" | "medium" | "low";
  /** Rationale for using this method */
  rationale: string;
}

export interface ICPAndTargetingStrategy {
  /** Primary audience definition */
  primaryAudience: AudienceSegment;
  /** Secondary audiences */
  secondaryAudiences: AudienceSegment[];
  /** Targeting methods to use */
  targetingMethods: TargetingMethodConfig[];
  /** Audience size and reachability assessment */
  audienceReachability: {
    totalAddressableAudience: string;
    reachableAudience: string;
    platformBreakdown: {
      platform: string;
      estimatedReach: string;
      cpmEstimate: string;
    }[];
  };
  /** Exclusions */
  exclusions: {
    audiences: string[];
    reasons: string[];
  };
}

// =============================================================================
// Section 5: Platform and Channel Strategy
// =============================================================================

export type PlatformName =
  | "meta"
  | "google_ads"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "twitter"
  | "pinterest"
  | "snapchat"
  | "microsoft_ads"
  | "programmatic"
  | "reddit"
  | "quora";

export type PlatformRole =
  | "primary_acquisition"
  | "secondary_acquisition"
  | "retargeting"
  | "awareness"
  | "consideration"
  | "remarketing"
  | "testing";

export interface PlatformStrategy {
  /** Platform name */
  platform: PlatformName;
  /** Role this platform plays in the strategy */
  role: PlatformRole;
  /** Why this platform was selected */
  whySelected: string[];
  /** Expected contribution to overall goals */
  expectedContribution: {
    metric: string;
    contribution: string;
    percentage: number;
  }[];
  /** Specific tactics for this platform */
  tactics: string[];
  /** Campaign types to run */
  campaignTypes: string[];
  /** Ad formats to use */
  adFormats: string[];
  /** Placement recommendations */
  placements: string[];
  /** Platform-specific best practices */
  bestPractices: string[];
}

export interface PlatformAndChannelStrategy {
  /** All chosen platforms with their strategies */
  platforms: PlatformStrategy[];
  /** Primary platform summary */
  primaryPlatform: {
    platform: PlatformName;
    rationale: string;
  };
  /** Platform synergy explanation */
  platformSynergy: string;
  /** Cross-platform considerations */
  crossPlatformConsiderations: string[];
  /** Platform priority order */
  priorityOrder: PlatformName[];
}

// =============================================================================
// Section 6: Funnel Strategy
// =============================================================================

export type FunnelStage = "tofu" | "mofu" | "bofu";

export interface FunnelStageConfig {
  /** Stage name */
  stage: FunnelStage;
  /** Stage label */
  label: string;
  /** Objective at this stage */
  objective: string;
  /** Content types for this stage */
  contentTypes: string[];
  /** Channels used at this stage */
  channels: string[];
  /** Key messages */
  keyMessages: string[];
  /** Call to action */
  cta: string;
  /** Expected conversion rate to next stage */
  expectedConversionRate: string;
}

export interface LandingPageRequirements {
  /** Type of landing page needed */
  pageType: string;
  /** Key elements required */
  requiredElements: string[];
  /** Headline recommendations */
  headlineRecommendations: string[];
  /** Above-fold requirements */
  aboveFold: string[];
  /** Social proof requirements */
  socialProofNeeded: string[];
  /** Form fields (if applicable) */
  formFields?: string[];
  /** Page speed requirements */
  pageSpeedTarget: string;
  /** Mobile optimization notes */
  mobileOptimization: string[];
}

export interface LeadQualification {
  /** Lead scoring criteria */
  scoringCriteria: {
    criterion: string;
    points: number;
    rationale: string;
  }[];
  /** MQL threshold */
  mqlThreshold: number;
  /** SQL threshold */
  sqlThreshold: number;
  /** Qualification questions */
  qualificationQuestions: string[];
  /** Disqualification criteria */
  disqualifiers: string[];
}

export interface RetargetingPath {
  /** Retargeting window (7/14/30 days) */
  window: "7_day" | "14_day" | "30_day" | "60_day" | "90_day" | "180_day";
  /** Label for this retargeting segment */
  label: string;
  /** Audience definition */
  audienceDefinition: string;
  /** Message focus */
  messageFocus: string;
  /** Offer/incentive (if any) */
  offer?: string;
  /** Creative approach */
  creativeApproach: string;
  /** Frequency cap */
  frequencyCap: string;
  /** Expected engagement rate */
  expectedEngagement: string;
}

export interface FunnelStrategy {
  /** Overall funnel flow description */
  funnelFlow: string;
  /** Detailed stage configurations */
  stages: FunnelStageConfig[];
  /** Complete conversion path */
  conversionPath: {
    step: number;
    action: string;
    touchpoint: string;
    expectedDropoff: string;
  }[];
  /** Landing page requirements */
  landingPageRequirements: LandingPageRequirements;
  /** Lead qualification strategy */
  leadQualification: LeadQualification;
  /** Retargeting paths */
  retargetingPaths: RetargetingPath[];
  /** Attribution model recommendation */
  attributionModel: string;
}

// =============================================================================
// Section 7: Creative Strategy
// =============================================================================

export interface CreativeAngle {
  /** Angle name/identifier */
  name: string;
  /** Description of the angle */
  description: string;
  /** Target emotion/response */
  targetEmotion: string;
  /** Key message */
  keyMessage: string;
  /** Example hooks */
  exampleHooks: string[];
  /** Best platforms for this angle */
  bestPlatforms: PlatformName[];
  /** Target funnel stage */
  funnelStage: FunnelStage;
  /** Priority level */
  priority: "primary" | "secondary" | "tertiary";
}

export interface HookPattern {
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Example implementations */
  examples: string[];
  /** Why this pattern works for this audience */
  whyItWorks: string;
  /** Best formats for this pattern */
  bestFormats: string[];
}

export interface CreativeFormat {
  /** Format type */
  format: string;
  /** Platform where this format applies */
  platform: PlatformName;
  /** Specifications */
  specs: {
    dimensions?: string;
    duration?: string;
    fileType?: string;
    maxFileSize?: string;
  };
  /** Best practices for this format */
  bestPractices: string[];
  /** Priority level */
  priority: "must_have" | "should_have" | "nice_to_have";
  /** Quantity needed */
  quantityNeeded: number;
}

export interface CreativeTestingPlan {
  /** Testing methodology */
  methodology: string;
  /** Variables to test */
  variablesToTest: {
    variable: string;
    variations: string[];
    priority: "high" | "medium" | "low";
  }[];
  /** Testing timeline */
  timeline: string;
  /** Success criteria */
  successCriteria: string;
  /** Statistical significance threshold */
  significanceThreshold: string;
  /** Testing budget allocation */
  budgetAllocation: string;
}

export interface CreativeStrategy {
  /** Primary creative angles */
  primaryAngles: CreativeAngle[];
  /** Hook patterns to use */
  hookPatterns: HookPattern[];
  /** Formats needed per platform */
  formatsNeeded: CreativeFormat[];
  /** Creative testing plan */
  testingPlan: CreativeTestingPlan;
  /** Expected winning angles */
  expectedWinners: {
    angle: string;
    reasoning: string;
    confidenceLevel: "high" | "medium" | "low";
  }[];
  /** Creative refresh cadence */
  refreshCadence: string;
  /** Brand guidelines adherence */
  brandGuidelines: {
    mustInclude: string[];
    mustAvoid: string[];
    toneOfVoice: string;
  };
}

// =============================================================================
// Section 8: Campaign Structure
// =============================================================================

export type AudienceTemperature = "cold" | "warm" | "hot";

export interface CampaignStructureSegment {
  /** Audience temperature */
  temperature: AudienceTemperature;
  /** Segment name */
  name: string;
  /** Audience definition */
  audienceDefinition: string;
  /** Campaign objective */
  objective: string;
  /** Budget allocation percentage */
  budgetAllocation: number;
  /** Bid strategy */
  bidStrategy: string;
  /** Targeting settings */
  targeting: {
    includes: string[];
    excludes: string[];
  };
  /** Expected CPM range */
  expectedCpm: string;
  /** Expected results */
  expectedResults: string;
}

export interface RetargetingSegment {
  /** Segment name */
  name: string;
  /** Audience source */
  source: string;
  /** Time window */
  timeWindow: string;
  /** Message/offer */
  message: string;
  /** Creative approach */
  creativeApproach: string;
  /** Frequency cap */
  frequencyCap: string;
  /** Priority level */
  priority: number;
}

export interface ScalingStructure {
  /** Scaling trigger criteria */
  scalingTriggers: {
    metric: string;
    threshold: string;
    action: string;
  }[];
  /** Scaling approach */
  approach: string;
  /** Budget increase increments */
  budgetIncrements: string;
  /** Monitoring frequency */
  monitoringFrequency: string;
  /** Rollback criteria */
  rollbackCriteria: string[];
}

export interface NamingConventions {
  /** Campaign naming pattern */
  campaignPattern: string;
  /** Campaign example */
  campaignExample: string;
  /** Ad set naming pattern */
  adSetPattern: string;
  /** Ad set example */
  adSetExample: string;
  /** Ad naming pattern */
  adPattern: string;
  /** Ad example */
  adExample: string;
  /** UTM structure */
  utmStructure: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    term?: string;
  };
}

export interface CampaignStructure {
  /** Cold audience structure */
  coldStructure: CampaignStructureSegment[];
  /** Warm audience structure */
  warmStructure: CampaignStructureSegment[];
  /** Hot audience structure */
  hotStructure: CampaignStructureSegment[];
  /** Retargeting segments */
  retargetingSegments: RetargetingSegment[];
  /** Scaling structure */
  scalingStructure: ScalingStructure;
  /** Naming conventions */
  namingConventions: NamingConventions;
  /** Account structure overview */
  accountStructureOverview: string;
}

// =============================================================================
// Section 9: KPIs and Performance Model
// =============================================================================

export interface KPIDefinition {
  /** Metric name */
  metric: string;
  /** Target value */
  target: string;
  /** Unit of measurement */
  unit: string;
  /** Benchmark from industry/research */
  benchmark: string;
  /** How this will be measured */
  measurementMethod: string;
  /** Reporting frequency */
  reportingFrequency: "daily" | "weekly" | "monthly";
}

export interface CACModel {
  /** Target CAC */
  targetCac: number;
  /** CAC calculation breakdown */
  calculation: {
    component: string;
    value: string;
    percentage: number;
  }[];
  /** CAC by channel */
  byChannel: {
    channel: string;
    estimatedCac: number;
    rationale: string;
  }[];
  /** CAC optimization levers */
  optimizationLevers: string[];
}

export interface BreakEvenAnalysis {
  /** Break-even point */
  breakEvenPoint: {
    customers: number;
    revenue: number;
    timeframe: string;
  };
  /** Revenue per customer */
  revenuePerCustomer: number;
  /** Contribution margin */
  contributionMargin: string;
  /** Time to break even */
  timeToBreakEven: string;
  /** Assumptions */
  assumptions: string[];
  /** Sensitivity analysis */
  sensitivityAnalysis: {
    variable: string;
    impact: string;
  }[];
}

export interface MetricsSchedule {
  /** Daily metrics to track */
  daily: {
    metric: string;
    threshold: string;
    action: string;
  }[];
  /** Weekly metrics to track */
  weekly: {
    metric: string;
    threshold: string;
    action: string;
  }[];
  /** Monthly metrics to track */
  monthly: {
    metric: string;
    target: string;
    reviewProcess: string;
  }[];
}

export interface KPIsAndPerformanceModel {
  /** Primary KPIs */
  primaryKpis: KPIDefinition[];
  /** Secondary KPIs */
  secondaryKpis: KPIDefinition[];
  /** Benchmark expectations */
  benchmarkExpectations: {
    metric: string;
    pessimistic: string;
    realistic: string;
    optimistic: string;
  }[];
  /** CAC model */
  cacModel: CACModel;
  /** Break-even analysis */
  breakEvenMath: BreakEvenAnalysis;
  /** Metrics tracking schedule */
  metricsSchedule: MetricsSchedule;
  /** North star metric */
  northStarMetric: {
    metric: string;
    target: string;
    rationale: string;
  };
}

// =============================================================================
// Section 10: Budget Allocation and Scaling Roadmap
// =============================================================================

export interface InitialBudget {
  /** Total monthly budget */
  totalMonthly: number;
  /** Daily budget */
  daily: number;
  /** Currency */
  currency: string;
  /** Testing budget (first 2-4 weeks) */
  testingPhase: {
    duration: string;
    budget: number;
    objective: string;
  };
  /** Scaling budget (post-testing) */
  scalingPhase: {
    budget: number;
    objective: string;
  };
}

export interface PlatformBudgetAllocation {
  /** Platform name */
  platform: PlatformName;
  /** Budget amount */
  amount: number;
  /** Percentage of total */
  percentage: number;
  /** Rationale */
  rationale: string;
  /** Expected return */
  expectedReturn: string;
  /** Minimum viable spend */
  minimumViableSpend: number;
}

export interface ScalingRule {
  /** Rule name */
  name: string;
  /** Trigger condition */
  trigger: string;
  /** Action to take */
  action: string;
  /** Budget change */
  budgetChange: string;
  /** Validation period */
  validationPeriod: string;
  /** Risk level */
  riskLevel: "low" | "medium" | "high";
}

export interface EfficiencyCurve {
  /** Spend level */
  spendLevel: string;
  /** Expected efficiency */
  expectedEfficiency: string;
  /** Marginal CPA */
  marginalCpa: string;
  /** Notes */
  notes: string;
}

export interface BudgetAllocationAndScaling {
  /** Initial budget breakdown */
  initialBudget: InitialBudget;
  /** Allocation per platform */
  platformAllocation: PlatformBudgetAllocation[];
  /** Budget by funnel stage */
  funnelAllocation: {
    stage: FunnelStage;
    percentage: number;
    amount: number;
    rationale: string;
  }[];
  /** Scaling rules */
  scalingRules: ScalingRule[];
  /** Efficiency curves */
  efficiencyCurves: EfficiencyCurve[];
  /** Budget reallocation triggers */
  reallocationTriggers: {
    trigger: string;
    from: string;
    to: string;
    condition: string;
  }[];
  /** Monthly budget roadmap */
  monthlyRoadmap: {
    month: number;
    budget: number;
    focus: string;
    expectedResults: string;
  }[];
}

// =============================================================================
// Section 11: Risks and Mitigation
// =============================================================================

export type RiskCategory =
  | "budget"
  | "creative"
  | "targeting"
  | "platform"
  | "market"
  | "technical"
  | "compliance"
  | "competition"
  | "timing";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskLikelihood = "unlikely" | "possible" | "likely" | "very_likely";

export interface Risk {
  /** Risk identifier */
  id: string;
  /** Risk category */
  category: RiskCategory;
  /** Risk description */
  description: string;
  /** Severity level */
  severity: RiskSeverity;
  /** Likelihood */
  likelihood: RiskLikelihood;
  /** Impact if realized */
  impact: string;
  /** Early warning signs */
  warningSignals: string[];
}

export interface MitigationStep {
  /** Associated risk ID */
  riskId: string;
  /** Mitigation action */
  action: string;
  /** When to implement */
  timing: "preventive" | "reactive" | "contingent";
  /** Owner/responsible party */
  owner: string;
  /** Resources needed */
  resourcesNeeded: string[];
  /** Success criteria */
  successCriteria: string;
}

export interface Dependency {
  /** Dependency name */
  name: string;
  /** Description */
  description: string;
  /** Type of dependency */
  type: "internal" | "external" | "technical" | "resource";
  /** Status */
  status: "met" | "in_progress" | "at_risk" | "blocked";
  /** Mitigation if not met */
  mitigation: string;
  /** Impact if not met */
  impactIfNotMet: string;
}

export interface RisksAndMitigation {
  /** Top risks identified */
  topRisks: Risk[];
  /** Mitigation steps */
  mitigationSteps: MitigationStep[];
  /** Key dependencies */
  dependencies: Dependency[];
  /** Contingency plans */
  contingencyPlans: {
    scenario: string;
    response: string;
    trigger: string;
  }[];
  /** Risk monitoring approach */
  riskMonitoring: {
    frequency: string;
    metrics: string[];
    escalationPath: string;
  };
}

// =============================================================================
// Complete Media Plan Output
// =============================================================================

export interface MediaPlanOutput {
  /** Section 1: Executive Summary */
  executiveSummary: ExecutiveSummary;
  /** Section 2: Campaign Objective Selection */
  campaignObjectiveSelection: CampaignObjectiveSelection;
  /** Section 3: Key Insights From Strategic Research */
  keyInsightsFromResearch: KeyInsightsFromResearch;
  /** Section 4: ICP and Targeting Strategy */
  icpAndTargetingStrategy: ICPAndTargetingStrategy;
  /** Section 5: Platform and Channel Strategy */
  platformAndChannelStrategy: PlatformAndChannelStrategy;
  /** Section 6: Funnel Strategy */
  funnelStrategy: FunnelStrategy;
  /** Section 7: Creative Strategy */
  creativeStrategy: CreativeStrategy;
  /** Section 8: Campaign Structure */
  campaignStructure: CampaignStructure;
  /** Section 9: KPIs and Performance Model */
  kpisAndPerformanceModel: KPIsAndPerformanceModel;
  /** Section 10: Budget Allocation and Scaling Roadmap */
  budgetAllocationAndScaling: BudgetAllocationAndScaling;
  /** Section 11: Risks and Mitigation */
  risksAndMitigation: RisksAndMitigation;
  /** Metadata about the generated plan */
  metadata: MediaPlanMetadata;
}

export interface MediaPlanMetadata {
  /** When the plan was generated */
  generatedAt: string;
  /** Version of the plan structure */
  version: string;
  /** Total processing time in ms */
  processingTime: number;
  /** Total cost of AI calls */
  totalCost: number;
  /** Input data hash for tracking */
  inputHash?: string;
  /** Models used in generation */
  modelsUsed: string[];
  /** Confidence score (0-100) */
  overallConfidence: number;
  /** Validity period */
  validUntil?: string;
}

// =============================================================================
// Partial/Progress Types for Streaming
// =============================================================================

export type MediaPlanSection = keyof Omit<MediaPlanOutput, "metadata">;

export interface MediaPlanProgress {
  /** Current section being generated */
  currentSection: MediaPlanSection | null;
  /** Completed sections */
  completedSections: MediaPlanSection[];
  /** Partial output with completed sections */
  partialOutput: Partial<MediaPlanOutput>;
  /** Progress percentage */
  progressPercentage: number;
  /** Current section progress message */
  progressMessage: string;
  /** Error if any */
  error?: string;
}

// =============================================================================
// Section Order Constant
// =============================================================================

export const MEDIA_PLAN_SECTION_ORDER: MediaPlanSection[] = [
  "executiveSummary",
  "campaignObjectiveSelection",
  "keyInsightsFromResearch",
  "icpAndTargetingStrategy",
  "platformAndChannelStrategy",
  "funnelStrategy",
  "creativeStrategy",
  "campaignStructure",
  "kpisAndPerformanceModel",
  "budgetAllocationAndScaling",
  "risksAndMitigation",
];

export const MEDIA_PLAN_SECTION_LABELS: Record<MediaPlanSection, string> = {
  executiveSummary: "Executive Summary",
  campaignObjectiveSelection: "Campaign Objective Selection",
  keyInsightsFromResearch: "Key Insights From Strategic Research",
  icpAndTargetingStrategy: "ICP and Targeting Strategy",
  platformAndChannelStrategy: "Platform and Channel Strategy",
  funnelStrategy: "Funnel Strategy",
  creativeStrategy: "Creative Strategy",
  campaignStructure: "Campaign Structure",
  kpisAndPerformanceModel: "KPIs and Performance Model",
  budgetAllocationAndScaling: "Budget Allocation and Scaling Roadmap",
  risksAndMitigation: "Risks and Mitigation",
};
