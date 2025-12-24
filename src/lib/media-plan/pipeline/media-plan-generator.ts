// Media Plan Generator Pipeline
// Generates comprehensive 11-section Media Plan from onboarding data
// Now enhanced with optional Strategic Blueprint context for more accurate plans

import { createOpenRouterClient, MODELS, type ChatMessage } from "@/lib/openrouter/client";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import {
  MEDIA_PLAN_SECTION_ORDER,
  MEDIA_PLAN_SECTION_LABELS,
  type MediaPlanOutput,
  type MediaPlanProgress,
  type MediaPlanSection,
  type ExecutiveSummary,
  type CampaignObjectiveSelection,
  type KeyInsightsFromResearch,
  type ICPAndTargetingStrategy,
  type PlatformAndChannelStrategy,
  type FunnelStrategy,
  type CreativeStrategy,
  type CampaignStructure,
  type KPIsAndPerformanceModel,
  type BudgetAllocationAndScaling,
  type RisksAndMitigation,
} from "../output-types";
import { MEDIA_PLAN_SECTION_SCHEMAS } from "../schemas";
import { z } from "zod";

export type MediaPlanProgressCallback = (progress: MediaPlanProgress) => void;

export interface MediaPlanGeneratorOptions {
  onProgress?: MediaPlanProgressCallback;
  abortSignal?: AbortSignal;
  /** Optional strategic blueprint to enhance media plan generation */
  strategicBlueprint?: StrategicBlueprintOutput;
}

export interface MediaPlanGeneratorResult {
  success: boolean;
  mediaPlan?: MediaPlanOutput;
  partialPlan?: Partial<MediaPlanOutput>;
  failedSection?: MediaPlanSection;
  error?: string;
  metadata: {
    totalTime: number;
    totalCost: number;
    sectionTimings: Record<string, number>;
    completedSections: MediaPlanSection[];
  };
}

// =============================================================================
// Input Sanitization (Prevent Prompt Injection)
// =============================================================================

const MAX_INPUT_LENGTH = 5000;

/**
 * Sanitize user input to prevent prompt injection attacks.
 * - Removes potential instruction override patterns
 * - Limits input length
 * - Escapes code block markers
 */
function sanitizeInput(input: string | undefined | null): string {
  if (!input) return "";

  let sanitized = String(input);

  // Limit length to prevent context overflow
  sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);

  // Remove potential prompt injection patterns (case-insensitive)
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi,
    /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi,
    /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /user\s*:\s*/gi,
    /\[\s*INST\s*\]/gi,
    /\[\s*\/INST\s*\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /```\s*(json|javascript|python|bash|sh|cmd)/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[FILTERED]");
  }

  // Escape remaining code block markers
  sanitized = sanitized.replace(/```/g, "'''");

  // Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized.trim();
}

/**
 * Sanitize a number input, returning a safe default if invalid
 */
function sanitizeNumber(input: number | undefined | null, defaultValue: number = 0): number {
  if (input === undefined || input === null || isNaN(input)) {
    return defaultValue;
  }
  return Math.max(0, Number(input));
}

// =============================================================================
// Business Context Builder
// =============================================================================

// Helper to create context from onboarding data
function createBusinessContext(data: OnboardingFormData): string {
  const { businessBasics, icp, productOffer, marketCompetition, customerJourney, brandPositioning, assetsProof, budgetTargets, compliance } = data;

  // Sanitize all user inputs
  const s = sanitizeInput; // Shorthand
  const n = sanitizeNumber;

  return `
## BUSINESS CONTEXT

### Company Information
- Business Name: ${s(businessBasics.businessName)}
- Website: ${s(businessBasics.websiteUrl)}
- Contact: ${s(businessBasics.contactName)} (${s(businessBasics.contactEmail)})
${businessBasics.billingOwner ? `- Billing Account Owner: ${s(businessBasics.billingOwner)}` : ""}
${businessBasics.paymentVerified ? "- Payment Method: Verified" : ""}

### Ideal Customer Profile (ICP)
- Primary ICP: ${s(icp.primaryIcpDescription)}
- Industry: ${s(icp.industryVertical)}
- Target Job Titles: ${s(icp.jobTitles)}
- Company Size: ${s(icp.companySize)}
- Geography: ${s(icp.geography)}
- Easiest to Close: ${s(icp.easiestToClose)}
- Buying Triggers: ${s(icp.buyingTriggers)}
- Best Client Sources: ${icp.bestClientSources?.map(s).join(", ") || "Not specified"}
${icp.secondaryIcp ? `- Secondary ICP: ${s(icp.secondaryIcp)}` : ""}
${icp.systemsPlatforms ? `- Systems & Platforms Used: ${s(icp.systemsPlatforms)}` : ""}

### Product & Offer
- Product Description: ${s(productOffer.productDescription)}
- Core Deliverables: ${s(productOffer.coreDeliverables)}
- Offer Price: $${n(productOffer.offerPrice)}
- Pricing Model: ${s(productOffer.pricingModel)}
- Value Proposition: ${s(productOffer.valueProp)}
- Current Funnel Type: ${s(productOffer.currentFunnelType)}
${productOffer.guarantees ? `- Guarantees: ${s(productOffer.guarantees)}` : ""}

### Market & Competition
- Top Competitors: ${s(marketCompetition.topCompetitors)}
- Unique Edge: ${s(marketCompetition.uniqueEdge)}
- Market Bottlenecks: ${s(marketCompetition.marketBottlenecks)}
${marketCompetition.competitorFrustrations ? `- Competitor Frustrations: ${s(marketCompetition.competitorFrustrations)}` : ""}
${marketCompetition.proprietaryTech ? `- Proprietary Tech: ${s(marketCompetition.proprietaryTech)}` : ""}

### Customer Journey
- Situation Before Buying: ${s(customerJourney.situationBeforeBuying)}
- Desired Transformation: ${s(customerJourney.desiredTransformation)}
- Common Objections: ${s(customerJourney.commonObjections)}
- Sales Cycle Length: ${s(customerJourney.salesCycleLength)}
${customerJourney.salesProcessOverview ? `- Sales Process: ${s(customerJourney.salesProcessOverview)}` : ""}

### Brand & Positioning
- Brand Positioning: ${s(brandPositioning.brandPositioning)}
${brandPositioning.customerVoice ? `- Customer Voice: ${s(brandPositioning.customerVoice)}` : ""}

### Budget & Targets
- Monthly Ad Budget: $${n(budgetTargets.monthlyAdBudget)}
- Campaign Duration: ${s(budgetTargets.campaignDuration)}
${budgetTargets.dailyBudgetCeiling ? `- Daily Ceiling: $${n(budgetTargets.dailyBudgetCeiling)}` : ""}
${budgetTargets.targetCpl ? `- Target CPL: $${n(budgetTargets.targetCpl)}` : ""}
${budgetTargets.targetCac ? `- Target CAC: $${n(budgetTargets.targetCac)}` : ""}
${budgetTargets.targetSqlsPerMonth ? `- Target SQLs/month: ${n(budgetTargets.targetSqlsPerMonth)}` : ""}
${budgetTargets.targetDemosPerMonth ? `- Target Demos/month: ${n(budgetTargets.targetDemosPerMonth)}` : ""}

### Available Assets & Proof
${assetsProof?.salesDeckUrl ? `- Sales Deck: ${s(assetsProof.salesDeckUrl)}` : ""}
${assetsProof?.productDemoUrl ? `- Product Demo: ${s(assetsProof.productDemoUrl)}` : ""}
${assetsProof?.caseStudiesUrl ? `- Case Studies: ${s(assetsProof.caseStudiesUrl)}` : ""}
${assetsProof?.testimonialsUrl ? `- Testimonials: ${s(assetsProof.testimonialsUrl)}` : ""}
${assetsProof?.landingPageUrl ? `- Landing Page: ${s(assetsProof.landingPageUrl)}` : ""}
${assetsProof?.existingAdsUrl ? `- Existing Ads: ${s(assetsProof.existingAdsUrl)}` : ""}
${assetsProof?.brandGuidelinesUrl ? `- Brand Guidelines: ${s(assetsProof.brandGuidelinesUrl)}` : ""}
${assetsProof?.loomWalkthroughUrl ? `- Loom Walkthrough: ${s(assetsProof.loomWalkthroughUrl)}` : ""}
${assetsProof?.emailSequencesUrl ? `- Email Sequences: ${s(assetsProof.emailSequencesUrl)}` : ""}
${assetsProof?.productScreenshotsUrl ? `- Product Screenshots: ${s(assetsProof.productScreenshotsUrl)}` : ""}
${assetsProof?.ugcVideosUrl ? `- UGC Videos: ${s(assetsProof.ugcVideosUrl)}` : ""}

### Compliance
${compliance.topicsToAvoid ? `- Topics to Avoid: ${s(compliance.topicsToAvoid)}` : "- Topics to Avoid: None specified"}
${compliance.claimRestrictions ? `- Claim Restrictions: ${s(compliance.claimRestrictions)}` : "- Claim Restrictions: None specified"}
`.trim();
}

// =============================================================================
// Strategic Blueprint Context Builder
// =============================================================================

function createStrategicBlueprintContext(blueprint: StrategicBlueprintOutput): string {
  const { industryMarketOverview, icpAnalysisValidation, offerAnalysisViability, competitorAnalysis, crossAnalysisSynthesis } = blueprint;

  return `
## STRATEGIC BLUEPRINT INSIGHTS (Use these validated insights to inform your strategy)

### Market Overview
- Category: ${industryMarketOverview?.categorySnapshot?.category || "N/A"}
- Market Maturity: ${industryMarketOverview?.categorySnapshot?.marketMaturity || "N/A"}
- Awareness Level: ${industryMarketOverview?.categorySnapshot?.awarenessLevel || "N/A"}
- Buying Behavior: ${industryMarketOverview?.categorySnapshot?.buyingBehavior || "N/A"}
- Sales Cycle: ${industryMarketOverview?.categorySnapshot?.averageSalesCycle || "N/A"}

### Validated Pain Points
Primary:
${industryMarketOverview?.painPoints?.primary?.slice(0, 5).map(p => `- ${p}`).join("\n") || "- Not specified"}

### Psychological Drivers
${industryMarketOverview?.psychologicalDrivers?.drivers?.slice(0, 4).map(d => `- ${d?.driver}: ${d?.description}`).join("\n") || "- Not specified"}

### Key Objections & Responses
${industryMarketOverview?.audienceObjections?.objections?.slice(0, 4).map(o => `- "${o?.objection}" → ${o?.howToAddress}`).join("\n") || "- Not specified"}

### ICP Validation
- Status: ${icpAnalysisValidation?.finalVerdict?.status?.toUpperCase() || "N/A"}
- Pain-Solution Fit: ${icpAnalysisValidation?.painSolutionFit?.fitAssessment || "N/A"}
- Primary Pain: ${icpAnalysisValidation?.painSolutionFit?.primaryPain || "N/A"}

### Offer Analysis
- Overall Score: ${offerAnalysisViability?.offerStrength?.overallScore || "N/A"}/10
- Recommendation: ${offerAnalysisViability?.recommendation?.status || "N/A"}
${offerAnalysisViability?.redFlags?.length ? `- Red Flags: ${offerAnalysisViability.redFlags.join(", ")}` : ""}

### Competitor Insights
${competitorAnalysis?.competitors?.slice(0, 3).map(c => `- ${c?.name}: ${c?.positioning} (${c?.adPlatforms?.join(", ") || "unknown platforms"})`).join("\n") || "- Not analyzed"}

### Gaps & Opportunities
- Messaging: ${competitorAnalysis?.gapsAndOpportunities?.messagingOpportunities?.slice(0, 2).join("; ") || "N/A"}
- Creative: ${competitorAnalysis?.gapsAndOpportunities?.creativeOpportunities?.slice(0, 2).join("; ") || "N/A"}

### Strategic Recommendations
- Recommended Positioning: ${crossAnalysisSynthesis?.recommendedPositioning || "N/A"}
- Primary Messaging Angles: ${crossAnalysisSynthesis?.primaryMessagingAngles?.slice(0, 3).join(", ") || "N/A"}
- Recommended Platforms: ${crossAnalysisSynthesis?.recommendedPlatforms?.map(p => `${p?.platform} (${p?.priority})`).join(", ") || "N/A"}
- Critical Success Factors: ${crossAnalysisSynthesis?.criticalSuccessFactors?.slice(0, 3).join("; ") || "N/A"}
`.trim();
}

// Section-specific prompts - Simplified and focused for reliable JSON output
const SECTION_PROMPTS: Record<MediaPlanSection, (context: string, previousSections?: Partial<MediaPlanOutput>) => ChatMessage[]> = {
  executiveSummary: (context) => [
    {
      role: "system",
      content: `You are an expert media strategist creating an Executive Summary for a media plan.

Generate a JSON object with these fields:
- strategyOverview: 2-3 sentence overview of the strategy
- timelineFocus: timeline focus like "90-day acquisition sprint"
- strategicPriorities: array of 3-5 key priorities
- expectedOutcome: primary expected result with metrics
- positioningStatement: one compelling positioning statement

Be specific and data-driven based on the business context.`
    },
    {
      role: "user",
      content: `Create an Executive Summary for this business:\n\n${context}`
    }
  ],

  campaignObjectiveSelection: (context) => [
    {
      role: "system",
      content: `You are an expert media strategist. Generate Campaign Objective Selection.

Platform Logic Rules:
- Sales cycle under 14 days: Meta and Google (impulse/transactional)
- Sales cycle 15-45 days: Google and LinkedIn (consideration)
- Sales cycle 45+ days: LinkedIn primary (enterprise/complex)

Generate a JSON object with:
- businessGoal: object with "goal" (one of: revenue_growth, lead_generation, brand_awareness, customer_acquisition, product_launch) and "description"
- marketingObjective: object with "objective" (one of: awareness, consideration, conversion) and "description"
- platformLogic: object with salesCycleConsideration, platformImplications, recommendedPlatform, reasoning
- finalObjective: object with statement, reasoning, and successCriteria (array of 3-4 criteria)`
    },
    {
      role: "user",
      content: `Determine campaign objectives for:\n\n${context}`
    }
  ],

  keyInsightsFromResearch: (context) => [
    {
      role: "system",
      content: `You are an expert market researcher. Generate Key Insights for the media plan.

Generate a JSON object with:
- painPoints: object with primary (main pain point), secondary (array of 2-3), howToAddress
- differentiation: object with uniqueStrengths (array), competitiveAdvantages (array), messagingOpportunities (array)
- competitorAngles: object with commonApproaches (array), gaps (array), opportunities (array)
- icpClarity: object with primaryProfile, buyingBehavior, decisionMakers (array), influencers (array)
- offerStrengths: object with valueProposition, proofPoints (array), guarantees (array)
- topInsights: array of 5-7 objects, each with category (pain_point/differentiation/competitor/icp/offer), insight, implication, confidence (high/medium/low)`
    },
    {
      role: "user",
      content: `Extract key strategic insights for media planning from:\n\n${context}`
    }
  ],

  icpAndTargetingStrategy: (context) => [
    {
      role: "system",
      content: `You are an expert in audience targeting. Generate ICP and Targeting Strategy.

Generate a JSON object with:
- primaryAudience: object with name, description, demographics (ageRange, location array, income), psychographics (interests, values, behaviors, painPoints arrays), professional (jobTitles, industries, companySize, seniorityLevel arrays), priority ("primary"), estimatedSize
- secondaryAudiences: empty array []
- targetingMethods: array of objects with method (interest_based/lookalike/job_title/keyword/behavioral/retargeting), configuration, platform, expectedEffectiveness (high/medium/low), rationale
- audienceReachability: object with totalAddressableAudience, reachableAudience, platformBreakdown (array of platform/estimatedReach/cpmEstimate objects)
- exclusions: object with audiences (array) and reasons (array)`
    },
    {
      role: "user",
      content: `Create ICP and targeting strategy for:\n\n${context}`
    }
  ],

  platformAndChannelStrategy: (context, prev) => [
    {
      role: "system",
      content: `You are an expert media buyer. Generate Platform and Channel Strategy.

${prev?.campaignObjectiveSelection ? `Previous context - Recommended Platform: ${prev.campaignObjectiveSelection.platformLogic?.recommendedPlatform || "Not specified"}` : ""}

Generate a JSON object with:
- platforms: array of 2-4 platform objects, each with platform (meta/google_ads/linkedin/youtube), role (primary_acquisition/secondary_acquisition/retargeting/awareness), whySelected (array), expectedContribution (array of metric/contribution/percentage objects), tactics (array), campaignTypes (array), adFormats (array), placements (array), bestPractices (array)
- primaryPlatform: object with platform and rationale
- platformSynergy: string describing how platforms work together
- crossPlatformConsiderations: array of considerations
- priorityOrder: array of platform names in priority order`
    },
    {
      role: "user",
      content: `Create platform strategy for:\n\n${context}`
    }
  ],

  funnelStrategy: (context, prev) => [
    {
      role: "system",
      content: `You are a conversion funnel expert. Generate Funnel Strategy.

Generate a JSON object with:
- funnelFlow: string like "Ad → Landing Page → Lead Form → Demo → Close"
- stages: array of 3 objects (tofu/mofu/bofu), each with stage, label, objective, contentTypes (array), channels (array), keyMessages (array), cta, expectedConversionRate
- conversionPath: array of step objects with step (number), action, touchpoint, expectedDropoff
- landingPageRequirements: object with pageType, requiredElements (array), headlineRecommendations (array), aboveFold (array), socialProofNeeded (array), formFields (array), pageSpeedTarget, mobileOptimization (array)
- leadQualification: object with scoringCriteria (array of criterion/points/rationale), mqlThreshold (number), sqlThreshold (number), qualificationQuestions (array), disqualifiers (array)
- retargetingPaths: array of objects with window (7_day/14_day/30_day), label, audienceDefinition, messageFocus, creativeApproach, frequencyCap, expectedEngagement
- attributionModel: string`
    },
    {
      role: "user",
      content: `Create funnel strategy for:\n\n${context}`
    }
  ],

  creativeStrategy: (context, prev) => [
    {
      role: "system",
      content: `You are a creative strategist for paid media. Generate Creative Strategy.

${prev?.keyInsightsFromResearch ? `Key insight - Primary Pain Point: ${prev.keyInsightsFromResearch.painPoints?.primary || "Not specified"}` : ""}

Generate a JSON object with:
- primaryAngles: array of 3-5 angle objects with name, description, targetEmotion, keyMessage, exampleHooks (array of 3-4), bestPlatforms (array), funnelStage (tofu/mofu/bofu), priority (primary/secondary)
- hookPatterns: array of pattern objects with name, description, examples (array), whyItWorks, bestFormats (array)
- formatsNeeded: array of format objects with format, platform (meta/linkedin/google_ads), specs (dimensions/duration/fileType), bestPractices (array), priority (must_have/should_have/nice_to_have), quantityNeeded (number)
- testingPlan: object with methodology, variablesToTest (array of variable/variations/priority), timeline, successCriteria, significanceThreshold, budgetAllocation
- expectedWinners: array of objects with angle, reasoning, confidenceLevel (high/medium/low)
- refreshCadence: string like "Refresh every 2-3 weeks"
- brandGuidelines: object with mustInclude (array), mustAvoid (array), toneOfVoice`
    },
    {
      role: "user",
      content: `Create creative strategy for:\n\n${context}`
    }
  ],

  campaignStructure: (context, prev) => [
    {
      role: "system",
      content: `You are a media buying expert. Generate Campaign Structure.

Generate a JSON object with:
- coldStructure: array of campaign objects with temperature ("cold"), name, audienceDefinition, objective, budgetAllocation (number), bidStrategy, targeting (includes/excludes arrays), expectedCpm, expectedResults
- warmStructure: array of similar campaign objects with temperature "warm"
- hotStructure: array of similar campaign objects with temperature "hot"
- retargetingSegments: array with name, source, timeWindow, message, creativeApproach, frequencyCap, priority (number)
- scalingStructure: object with scalingTriggers (array of metric/threshold/action), approach, budgetIncrements, monitoringFrequency, rollbackCriteria (array)
- namingConventions: object with campaignPattern, campaignExample, adSetPattern, adSetExample, adPattern, adExample, utmStructure (source/medium/campaign/content)
- accountStructureOverview: brief overview string`
    },
    {
      role: "user",
      content: `Create campaign structure for:\n\n${context}`
    }
  ],

  kpisAndPerformanceModel: (context, prev) => [
    {
      role: "system",
      content: `You are a performance marketing analyst. Generate KPIs and Performance Model.

Generate a JSON object with:
- primaryKpis: array of KPI objects with metric, target, unit, benchmark, measurementMethod, reportingFrequency (daily/weekly/monthly)
- secondaryKpis: array of similar KPI objects
- benchmarkExpectations: array with metric, pessimistic, realistic, optimistic
- cacModel: object with targetCac (number), calculation (array of component/value/percentage), byChannel (array of channel/estimatedCac/rationale), optimizationLevers (array)
- breakEvenMath: object with breakEvenPoint (customers/revenue/timeframe), revenuePerCustomer (number), contributionMargin, timeToBreakEven, assumptions (array), sensitivityAnalysis (array of variable/impact)
- metricsSchedule: object with daily (array of metric/threshold/action), weekly (array), monthly (array of metric/target/reviewProcess)
- northStarMetric: object with metric, target, rationale`
    },
    {
      role: "user",
      content: `Create KPIs and performance model for:\n\n${context}`
    }
  ],

  budgetAllocationAndScaling: (context, prev) => [
    {
      role: "system",
      content: `You are a media budget strategist. Generate Budget Allocation and Scaling Roadmap.

${prev?.platformAndChannelStrategy ? `Platforms to allocate: ${prev.platformAndChannelStrategy.priorityOrder?.join(", ") || "meta, google_ads"}` : ""}

Generate a JSON object with:
- initialBudget: object with totalMonthly (number), daily (number), currency ("USD"), testingPhase (duration/budget/objective), scalingPhase (budget/objective)
- platformAllocation: array with platform (meta/google_ads/linkedin/youtube), amount (number), percentage (number), rationale, expectedReturn, minimumViableSpend (number)
- funnelAllocation: array with stage (tofu/mofu/bofu), percentage (number), amount (number), rationale
- scalingRules: array with name, trigger, action, budgetChange, validationPeriod, riskLevel (low/medium/high)
- efficiencyCurves: array with spendLevel, expectedEfficiency, marginalCpa, notes
- reallocationTriggers: array with trigger, from, to, condition
- monthlyRoadmap: array with month (number), budget (number), focus, expectedResults`
    },
    {
      role: "user",
      content: `Create budget allocation and scaling roadmap for:\n\n${context}`
    }
  ],

  risksAndMitigation: (context) => [
    {
      role: "system",
      content: `You are a risk management expert for media campaigns. Generate Risks and Mitigation plan.

Generate a JSON object with:
- topRisks: array of 5-7 risk objects with id (like "R1"), category (budget/creative/targeting/platform/market/competition), description, severity (low/medium/high/critical), likelihood (unlikely/possible/likely/very_likely), impact, warningSignals (array)
- mitigationSteps: array with riskId (matching risk id), action, timing (preventive/reactive/contingent), owner, resourcesNeeded (array), successCriteria
- dependencies: array with name, description, type (internal/external/technical/resource), status (met/in_progress/at_risk/blocked), mitigation, impactIfNotMet
- contingencyPlans: array with scenario, response, trigger
- riskMonitoring: object with frequency, metrics (array), escalationPath`
    },
    {
      role: "user",
      content: `Identify risks and mitigation strategies for:\n\n${context}`
    }
  ],
};

export async function generateMediaPlan(
  onboardingData: OnboardingFormData,
  options: MediaPlanGeneratorOptions = {}
): Promise<MediaPlanGeneratorResult> {
  const { onProgress, abortSignal, strategicBlueprint } = options;
  const startTime = Date.now();
  const sectionTimings: Record<string, number> = {};
  let totalCost = 0;

  const completedSections: MediaPlanSection[] = [];
  const partialOutput: Partial<MediaPlanOutput> = {};

  const client = createOpenRouterClient();

  // Build context - include strategic blueprint if available
  let context = createBusinessContext(onboardingData);
  if (strategicBlueprint) {
    context += "\n\n" + createStrategicBlueprintContext(strategicBlueprint);
  }

  // Helper to update progress
  const updateProgress = (section: MediaPlanSection | null, message: string, error?: string) => {
    if (onProgress) {
      onProgress({
        currentSection: section,
        completedSections: [...completedSections],
        partialOutput: { ...partialOutput },
        progressPercentage: Math.round((completedSections.length / MEDIA_PLAN_SECTION_ORDER.length) * 100),
        progressMessage: message,
        error,
      });
    }
  };

  // Helper to check abort
  const checkAbort = () => {
    if (abortSignal?.aborted) {
      throw new Error("Generation aborted by user");
    }
  };

  try {
    // Generate each section sequentially (with context building)
    for (const section of MEDIA_PLAN_SECTION_ORDER) {
      checkAbort();
      const sectionStart = Date.now();
      updateProgress(section, `Generating ${MEDIA_PLAN_SECTION_LABELS[section]}...`);

      try {
        const promptFn = SECTION_PROMPTS[section];
        const messages = promptFn(context, partialOutput);

        // Get the schema for this section (cast to unknown for dynamic lookup)
        const schema = MEDIA_PLAN_SECTION_SCHEMAS[section] as z.ZodType<unknown>;

        // Use Claude Sonnet with schema validation for type-safe responses
        const response = await client.chatJSONValidated(
          {
            model: MODELS.CLAUDE_SONNET,
            messages,
            temperature: 0.4,
            maxTokens: 4096,
          },
          schema
        );

        // @ts-expect-error - Dynamic assignment
        partialOutput[section] = response.data;
        totalCost += response.cost;
        sectionTimings[section] = Date.now() - sectionStart;
        completedSections.push(section);

        updateProgress(section, `Completed ${MEDIA_PLAN_SECTION_LABELS[section]}`);
      } catch (sectionError) {
        // Section generation failed
        const errorMessage = sectionError instanceof Error ? sectionError.message : "Unknown error";
        console.error(`Section ${section} failed:`, errorMessage);

        // Check if we have enough sections for a useful partial result (3+ sections)
        if (completedSections.length >= 3) {
          // Return partial result
          updateProgress(section, `Failed at ${MEDIA_PLAN_SECTION_LABELS[section]} - returning partial result`, errorMessage);

          return {
            success: false,
            partialPlan: { ...partialOutput },
            failedSection: section,
            error: `Generation stopped at ${MEDIA_PLAN_SECTION_LABELS[section]}: ${errorMessage}`,
            metadata: {
              totalTime: Date.now() - startTime,
              totalCost,
              sectionTimings,
              completedSections: [...completedSections],
            },
          };
        }

        // Too early for partial result - propagate error
        throw sectionError;
      }
    }

    // Add metadata
    const totalTime = Date.now() - startTime;
    const mediaPlan: MediaPlanOutput = {
      executiveSummary: partialOutput.executiveSummary as ExecutiveSummary,
      campaignObjectiveSelection: partialOutput.campaignObjectiveSelection as CampaignObjectiveSelection,
      keyInsightsFromResearch: partialOutput.keyInsightsFromResearch as KeyInsightsFromResearch,
      icpAndTargetingStrategy: partialOutput.icpAndTargetingStrategy as ICPAndTargetingStrategy,
      platformAndChannelStrategy: partialOutput.platformAndChannelStrategy as PlatformAndChannelStrategy,
      funnelStrategy: partialOutput.funnelStrategy as FunnelStrategy,
      creativeStrategy: partialOutput.creativeStrategy as CreativeStrategy,
      campaignStructure: partialOutput.campaignStructure as CampaignStructure,
      kpisAndPerformanceModel: partialOutput.kpisAndPerformanceModel as KPIsAndPerformanceModel,
      budgetAllocationAndScaling: partialOutput.budgetAllocationAndScaling as BudgetAllocationAndScaling,
      risksAndMitigation: partialOutput.risksAndMitigation as RisksAndMitigation,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: "1.0",
        processingTime: totalTime,
        totalCost: Math.round(totalCost * 10000) / 10000,
        modelsUsed: [MODELS.CLAUDE_SONNET],
        overallConfidence: 75,
      },
    };

    updateProgress(null, "Media Plan generation complete!");

    return {
      success: true,
      mediaPlan,
      metadata: {
        totalTime,
        totalCost,
        sectionTimings,
        completedSections: [...completedSections],
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    const failedSection = MEDIA_PLAN_SECTION_ORDER.find(
      (section) => !completedSections.includes(section)
    );

    updateProgress(failedSection ?? null, `Error: ${errorMessage}`, errorMessage);

    return {
      success: false,
      failedSection,
      error: errorMessage,
      metadata: {
        totalTime: Date.now() - startTime,
        totalCost,
        sectionTimings,
        completedSections: [...completedSections],
      },
    };
  }
}
