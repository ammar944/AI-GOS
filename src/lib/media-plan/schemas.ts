// Media Plan Zod Schemas
// Runtime validation schemas matching output-types.ts interfaces

import { z } from "zod";

// =============================================================================
// Enum Schemas (String Literal Unions)
// =============================================================================

export const businessGoalSchema = z.enum([
  "revenue_growth",
  "lead_generation",
  "brand_awareness",
  "market_expansion",
  "customer_acquisition",
  "product_launch",
  "customer_retention",
  "market_share",
]);

export const marketingObjectiveSchema = z.enum([
  "awareness",
  "consideration",
  "conversion",
  "retention",
  "advocacy",
]);

export const targetingMethodSchema = z.enum([
  "interest_based",
  "lookalike",
  "retargeting",
  "job_title",
  "industry",
  "company_size",
  "behavioral",
  "contextual",
  "custom_audience",
  "keyword",
]);

export const platformNameSchema = z.enum([
  "meta",
  "google_ads",
  "linkedin",
  "tiktok",
  "youtube",
  "twitter",
  "pinterest",
  "snapchat",
  "microsoft_ads",
  "programmatic",
  "reddit",
  "quora",
]);

export const platformRoleSchema = z.enum([
  "primary_acquisition",
  "secondary_acquisition",
  "retargeting",
  "awareness",
  "consideration",
  "remarketing",
  "testing",
]);

export const funnelStageSchema = z.enum(["tofu", "mofu", "bofu"]);

export const audienceTemperatureSchema = z.enum(["cold", "warm", "hot"]);

export const riskCategorySchema = z.enum([
  "budget",
  "creative",
  "targeting",
  "platform",
  "market",
  "technical",
  "compliance",
  "competition",
  "timing",
]);

export const riskSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const riskLikelihoodSchema = z.enum([
  "unlikely",
  "possible",
  "likely",
  "very_likely",
]);

// =============================================================================
// Section 1: Executive Summary
// =============================================================================

export const executiveSummarySchema = z.object({
  strategyOverview: z.string(),
  timelineFocus: z.string(),
  strategicPriorities: z.array(z.string()),
  expectedOutcome: z.string(),
  positioningStatement: z.string(),
}).passthrough();

// =============================================================================
// Section 2: Campaign Objective Selection
// =============================================================================

export const platformLogicSchema = z.object({
  salesCycleConsideration: z.string(),
  platformImplications: z.string(),
  recommendedPlatform: z.string(),
  reasoning: z.string(),
}).passthrough();

export const campaignObjectiveSelectionSchema = z.object({
  businessGoal: z.object({
    goal: businessGoalSchema,
    description: z.string(),
  }),
  marketingObjective: z.object({
    objective: marketingObjectiveSchema,
    description: z.string(),
  }),
  platformLogic: platformLogicSchema,
  finalObjective: z.object({
    statement: z.string(),
    reasoning: z.string(),
    successCriteria: z.array(z.string()),
  }),
}).passthrough();

// =============================================================================
// Section 3: Key Insights From Strategic Research
// =============================================================================

export const strategicInsightSchema = z.object({
  category: z.enum(["pain_point", "differentiation", "competitor", "icp", "offer"]),
  insight: z.string(),
  implication: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.string().optional(),
}).passthrough();

export const keyInsightsFromResearchSchema = z.object({
  painPoints: z.object({
    primary: z.string(),
    secondary: z.array(z.string()),
    howToAddress: z.string(),
  }),
  differentiation: z.object({
    uniqueStrengths: z.array(z.string()),
    competitiveAdvantages: z.array(z.string()),
    messagingOpportunities: z.array(z.string()),
  }),
  competitorAngles: z.object({
    commonApproaches: z.array(z.string()),
    gaps: z.array(z.string()),
    opportunities: z.array(z.string()),
  }),
  icpClarity: z.object({
    primaryProfile: z.string(),
    buyingBehavior: z.string(),
    decisionMakers: z.array(z.string()),
    influencers: z.array(z.string()),
  }),
  offerStrengths: z.object({
    valueProposition: z.string(),
    proofPoints: z.array(z.string()),
    guarantees: z.array(z.string()),
  }),
  topInsights: z.array(strategicInsightSchema),
}).passthrough();

// =============================================================================
// Section 4: ICP and Targeting Strategy
// =============================================================================

export const audienceSegmentSchema = z.object({
  name: z.string(),
  description: z.string(),
  demographics: z.object({
    ageRange: z.string().optional(),
    gender: z.string().optional(),
    location: z.array(z.string()),
    income: z.string().optional(),
    education: z.string().optional(),
  }),
  psychographics: z.object({
    interests: z.array(z.string()),
    values: z.array(z.string()),
    behaviors: z.array(z.string()),
    painPoints: z.array(z.string()),
  }),
  professional: z.object({
    jobTitles: z.array(z.string()),
    industries: z.array(z.string()),
    companySize: z.array(z.string()),
    seniorityLevel: z.array(z.string()),
  }).optional(),
  priority: z.enum(["primary", "secondary", "tertiary"]),
  estimatedSize: z.string(),
}).passthrough();

export const targetingMethodConfigSchema = z.object({
  method: targetingMethodSchema,
  configuration: z.string(),
  platform: z.string(),
  expectedEffectiveness: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
}).passthrough();

export const icpAndTargetingStrategySchema = z.object({
  primaryAudience: audienceSegmentSchema,
  secondaryAudiences: z.array(audienceSegmentSchema),
  targetingMethods: z.array(targetingMethodConfigSchema),
  audienceReachability: z.object({
    totalAddressableAudience: z.string(),
    reachableAudience: z.string(),
    platformBreakdown: z.array(z.object({
      platform: z.string(),
      estimatedReach: z.string(),
      cpmEstimate: z.string(),
    })),
  }),
  exclusions: z.object({
    audiences: z.array(z.string()),
    reasons: z.array(z.string()),
  }),
}).passthrough();

// =============================================================================
// Section 5: Platform and Channel Strategy
// =============================================================================

export const platformStrategySchema = z.object({
  platform: platformNameSchema,
  role: platformRoleSchema,
  whySelected: z.array(z.string()),
  expectedContribution: z.array(z.object({
    metric: z.string(),
    contribution: z.string(),
    percentage: z.number(),
  })),
  tactics: z.array(z.string()),
  campaignTypes: z.array(z.string()),
  adFormats: z.array(z.string()),
  placements: z.array(z.string()),
  bestPractices: z.array(z.string()),
}).passthrough();

export const platformAndChannelStrategySchema = z.object({
  platforms: z.array(platformStrategySchema),
  primaryPlatform: z.object({
    platform: platformNameSchema,
    rationale: z.string(),
  }),
  platformSynergy: z.string(),
  crossPlatformConsiderations: z.array(z.string()),
  priorityOrder: z.array(platformNameSchema),
}).passthrough();

// =============================================================================
// Section 6: Funnel Strategy
// =============================================================================

export const funnelStageConfigSchema = z.object({
  stage: funnelStageSchema,
  label: z.string(),
  objective: z.string(),
  contentTypes: z.array(z.string()),
  channels: z.array(z.string()),
  keyMessages: z.array(z.string()),
  cta: z.string(),
  expectedConversionRate: z.string(),
}).passthrough();

export const landingPageRequirementsSchema = z.object({
  pageType: z.string(),
  requiredElements: z.array(z.string()),
  headlineRecommendations: z.array(z.string()),
  aboveFold: z.array(z.string()),
  socialProofNeeded: z.array(z.string()),
  formFields: z.array(z.string()).optional(),
  pageSpeedTarget: z.string(),
  mobileOptimization: z.array(z.string()),
}).passthrough();

export const leadQualificationSchema = z.object({
  scoringCriteria: z.array(z.object({
    criterion: z.string(),
    points: z.number(),
    rationale: z.string(),
  })),
  mqlThreshold: z.number(),
  sqlThreshold: z.number(),
  qualificationQuestions: z.array(z.string()),
  disqualifiers: z.array(z.string()),
}).passthrough();

export const retargetingPathSchema = z.object({
  window: z.enum(["7_day", "14_day", "30_day", "60_day", "90_day", "180_day"]),
  label: z.string(),
  audienceDefinition: z.string(),
  messageFocus: z.string(),
  offer: z.string().optional(),
  creativeApproach: z.string(),
  frequencyCap: z.string(),
  expectedEngagement: z.string(),
}).passthrough();

export const funnelStrategySchema = z.object({
  funnelFlow: z.string(),
  stages: z.array(funnelStageConfigSchema),
  conversionPath: z.array(z.object({
    step: z.number(),
    action: z.string(),
    touchpoint: z.string(),
    expectedDropoff: z.string(),
  })),
  landingPageRequirements: landingPageRequirementsSchema,
  leadQualification: leadQualificationSchema,
  retargetingPaths: z.array(retargetingPathSchema),
  attributionModel: z.string(),
}).passthrough();

// =============================================================================
// Section 7: Creative Strategy
// =============================================================================

export const creativeAngleSchema = z.object({
  name: z.string(),
  description: z.string(),
  targetEmotion: z.string(),
  keyMessage: z.string(),
  exampleHooks: z.array(z.string()),
  bestPlatforms: z.array(platformNameSchema),
  funnelStage: funnelStageSchema,
  priority: z.enum(["primary", "secondary", "tertiary"]),
}).passthrough();

export const hookPatternSchema = z.object({
  name: z.string(),
  description: z.string(),
  examples: z.array(z.string()),
  whyItWorks: z.string(),
  bestFormats: z.array(z.string()),
}).passthrough();

export const creativeFormatSchema = z.object({
  format: z.string(),
  platform: platformNameSchema,
  specs: z.object({
    dimensions: z.string().optional(),
    duration: z.string().optional(),
    fileType: z.string().optional(),
    maxFileSize: z.string().optional(),
  }),
  bestPractices: z.array(z.string()),
  priority: z.enum(["must_have", "should_have", "nice_to_have"]),
  quantityNeeded: z.number(),
}).passthrough();

export const creativeTestingPlanSchema = z.object({
  methodology: z.string(),
  variablesToTest: z.array(z.object({
    variable: z.string(),
    variations: z.array(z.string()),
    priority: z.enum(["high", "medium", "low"]),
  })),
  timeline: z.string(),
  successCriteria: z.string(),
  significanceThreshold: z.string(),
  budgetAllocation: z.string(),
}).passthrough();

export const creativeStrategySchema = z.object({
  primaryAngles: z.array(creativeAngleSchema),
  hookPatterns: z.array(hookPatternSchema),
  formatsNeeded: z.array(creativeFormatSchema),
  testingPlan: creativeTestingPlanSchema,
  expectedWinners: z.array(z.object({
    angle: z.string(),
    reasoning: z.string(),
    confidenceLevel: z.enum(["high", "medium", "low"]),
  })),
  refreshCadence: z.string(),
  brandGuidelines: z.object({
    mustInclude: z.array(z.string()),
    mustAvoid: z.array(z.string()),
    toneOfVoice: z.string(),
  }),
}).passthrough();

// =============================================================================
// Section 8: Campaign Structure
// =============================================================================

export const campaignStructureSegmentSchema = z.object({
  temperature: audienceTemperatureSchema,
  name: z.string(),
  audienceDefinition: z.string(),
  objective: z.string(),
  budgetAllocation: z.number(),
  bidStrategy: z.string(),
  targeting: z.object({
    includes: z.array(z.string()),
    excludes: z.array(z.string()),
  }),
  expectedCpm: z.string(),
  expectedResults: z.string(),
}).passthrough();

export const retargetingSegmentSchema = z.object({
  name: z.string(),
  source: z.string(),
  timeWindow: z.string(),
  message: z.string(),
  creativeApproach: z.string(),
  frequencyCap: z.string(),
  priority: z.number(),
}).passthrough();

export const scalingStructureSchema = z.object({
  scalingTriggers: z.array(z.object({
    metric: z.string(),
    threshold: z.string(),
    action: z.string(),
  })),
  approach: z.string(),
  budgetIncrements: z.string(),
  monitoringFrequency: z.string(),
  rollbackCriteria: z.array(z.string()),
}).passthrough();

export const namingConventionsSchema = z.object({
  campaignPattern: z.string(),
  campaignExample: z.string(),
  adSetPattern: z.string(),
  adSetExample: z.string(),
  adPattern: z.string(),
  adExample: z.string(),
  utmStructure: z.object({
    source: z.string(),
    medium: z.string(),
    campaign: z.string(),
    content: z.string(),
    term: z.string().optional(),
  }),
}).passthrough();

export const campaignStructureSchema = z.object({
  coldStructure: z.array(campaignStructureSegmentSchema),
  warmStructure: z.array(campaignStructureSegmentSchema),
  hotStructure: z.array(campaignStructureSegmentSchema),
  retargetingSegments: z.array(retargetingSegmentSchema),
  scalingStructure: scalingStructureSchema,
  namingConventions: namingConventionsSchema,
  accountStructureOverview: z.string(),
}).passthrough();

// =============================================================================
// Section 9: KPIs and Performance Model
// =============================================================================

export const kpiDefinitionSchema = z.object({
  metric: z.string(),
  target: z.string(),
  unit: z.string(),
  benchmark: z.string(),
  measurementMethod: z.string(),
  reportingFrequency: z.enum(["daily", "weekly", "monthly"]),
}).passthrough();

export const cacModelSchema = z.object({
  targetCac: z.number(),
  calculation: z.array(z.object({
    component: z.string(),
    value: z.string(),
    percentage: z.number(),
  })),
  byChannel: z.array(z.object({
    channel: z.string(),
    estimatedCac: z.number(),
    rationale: z.string(),
  })),
  optimizationLevers: z.array(z.string()),
}).passthrough();

export const breakEvenAnalysisSchema = z.object({
  breakEvenPoint: z.object({
    customers: z.number(),
    revenue: z.number(),
    timeframe: z.string(),
  }),
  revenuePerCustomer: z.number(),
  contributionMargin: z.string(),
  timeToBreakEven: z.string(),
  assumptions: z.array(z.string()),
  sensitivityAnalysis: z.array(z.object({
    variable: z.string(),
    impact: z.string(),
  })),
}).passthrough();

export const metricsScheduleSchema = z.object({
  daily: z.array(z.object({
    metric: z.string(),
    threshold: z.string(),
    action: z.string(),
  })),
  weekly: z.array(z.object({
    metric: z.string(),
    threshold: z.string(),
    action: z.string(),
  })),
  monthly: z.array(z.object({
    metric: z.string(),
    target: z.string(),
    reviewProcess: z.string(),
  })),
}).passthrough();

export const kpisAndPerformanceModelSchema = z.object({
  primaryKpis: z.array(kpiDefinitionSchema),
  secondaryKpis: z.array(kpiDefinitionSchema),
  benchmarkExpectations: z.array(z.object({
    metric: z.string(),
    pessimistic: z.string(),
    realistic: z.string(),
    optimistic: z.string(),
  })),
  cacModel: cacModelSchema,
  breakEvenMath: breakEvenAnalysisSchema,
  metricsSchedule: metricsScheduleSchema,
  northStarMetric: z.object({
    metric: z.string(),
    target: z.string(),
    rationale: z.string(),
  }),
}).passthrough();

// =============================================================================
// Section 10: Budget Allocation and Scaling Roadmap
// =============================================================================

export const initialBudgetSchema = z.object({
  totalMonthly: z.number(),
  daily: z.number(),
  currency: z.string(),
  testingPhase: z.object({
    duration: z.string(),
    budget: z.number(),
    objective: z.string(),
  }),
  scalingPhase: z.object({
    budget: z.number(),
    objective: z.string(),
  }),
}).passthrough();

export const platformBudgetAllocationSchema = z.object({
  platform: platformNameSchema,
  amount: z.number(),
  percentage: z.number(),
  rationale: z.string(),
  expectedReturn: z.string(),
  minimumViableSpend: z.number(),
}).passthrough();

export const scalingRuleSchema = z.object({
  name: z.string(),
  trigger: z.string(),
  action: z.string(),
  budgetChange: z.string(),
  validationPeriod: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
}).passthrough();

export const efficiencyCurveSchema = z.object({
  spendLevel: z.string(),
  expectedEfficiency: z.string(),
  marginalCpa: z.string(),
  notes: z.string(),
}).passthrough();

export const budgetAllocationAndScalingSchema = z.object({
  initialBudget: initialBudgetSchema,
  platformAllocation: z.array(platformBudgetAllocationSchema),
  funnelAllocation: z.array(z.object({
    stage: funnelStageSchema,
    percentage: z.number(),
    amount: z.number(),
    rationale: z.string(),
  })),
  scalingRules: z.array(scalingRuleSchema),
  efficiencyCurves: z.array(efficiencyCurveSchema),
  reallocationTriggers: z.array(z.object({
    trigger: z.string(),
    from: z.string(),
    to: z.string(),
    condition: z.string(),
  })),
  monthlyRoadmap: z.array(z.object({
    month: z.number(),
    budget: z.number(),
    focus: z.string(),
    expectedResults: z.string(),
  })),
}).passthrough();

// =============================================================================
// Section 11: Risks and Mitigation
// =============================================================================

export const riskSchema = z.object({
  id: z.string(),
  category: riskCategorySchema,
  description: z.string(),
  severity: riskSeveritySchema,
  likelihood: riskLikelihoodSchema,
  impact: z.string(),
  warningSignals: z.array(z.string()),
}).passthrough();

export const mitigationStepSchema = z.object({
  riskId: z.string(),
  action: z.string(),
  timing: z.enum(["preventive", "reactive", "contingent"]),
  owner: z.string(),
  resourcesNeeded: z.array(z.string()),
  successCriteria: z.string(),
}).passthrough();

export const dependencySchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(["internal", "external", "technical", "resource"]),
  status: z.enum(["met", "in_progress", "at_risk", "blocked"]),
  mitigation: z.string(),
  impactIfNotMet: z.string(),
}).passthrough();

export const risksAndMitigationSchema = z.object({
  topRisks: z.array(riskSchema),
  mitigationSteps: z.array(mitigationStepSchema),
  dependencies: z.array(dependencySchema),
  contingencyPlans: z.array(z.object({
    scenario: z.string(),
    response: z.string(),
    trigger: z.string(),
  })),
  riskMonitoring: z.object({
    frequency: z.string(),
    metrics: z.array(z.string()),
    escalationPath: z.string(),
  }),
}).passthrough();

// =============================================================================
// Metadata Schema
// =============================================================================

export const mediaPlanMetadataSchema = z.object({
  generatedAt: z.string(),
  version: z.string(),
  processingTime: z.number(),
  totalCost: z.number(),
  inputHash: z.string().optional(),
  modelsUsed: z.array(z.string()),
  overallConfidence: z.number(),
  validUntil: z.string().optional(),
}).passthrough();

// =============================================================================
// Complete Media Plan Output Schema
// =============================================================================

export const mediaPlanOutputSchema = z.object({
  executiveSummary: executiveSummarySchema,
  campaignObjectiveSelection: campaignObjectiveSelectionSchema,
  keyInsightsFromResearch: keyInsightsFromResearchSchema,
  icpAndTargetingStrategy: icpAndTargetingStrategySchema,
  platformAndChannelStrategy: platformAndChannelStrategySchema,
  funnelStrategy: funnelStrategySchema,
  creativeStrategy: creativeStrategySchema,
  campaignStructure: campaignStructureSchema,
  kpisAndPerformanceModel: kpisAndPerformanceModelSchema,
  budgetAllocationAndScaling: budgetAllocationAndScalingSchema,
  risksAndMitigation: risksAndMitigationSchema,
  metadata: mediaPlanMetadataSchema,
}).passthrough();

// =============================================================================
// Progress Schema
// =============================================================================

export const mediaPlanProgressSchema = z.object({
  currentSection: z.string().nullable(),
  completedSections: z.array(z.string()),
  partialOutput: z.record(z.string(), z.any()),
  progressPercentage: z.number(),
  progressMessage: z.string(),
  error: z.string().optional(),
}).passthrough();

// =============================================================================
// Exported Schema Names Array
// =============================================================================

export const MEDIA_PLAN_SECTION_SCHEMAS = {
  executiveSummary: executiveSummarySchema,
  campaignObjectiveSelection: campaignObjectiveSelectionSchema,
  keyInsightsFromResearch: keyInsightsFromResearchSchema,
  icpAndTargetingStrategy: icpAndTargetingStrategySchema,
  platformAndChannelStrategy: platformAndChannelStrategySchema,
  funnelStrategy: funnelStrategySchema,
  creativeStrategy: creativeStrategySchema,
  campaignStructure: campaignStructureSchema,
  kpisAndPerformanceModel: kpisAndPerformanceModelSchema,
  budgetAllocationAndScaling: budgetAllocationAndScalingSchema,
  risksAndMitigation: risksAndMitigationSchema,
} as const;
