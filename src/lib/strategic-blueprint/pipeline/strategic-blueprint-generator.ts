// Strategic Blueprint Generator Pipeline
// Generates comprehensive 5-section Strategic Blueprint from onboarding data

import { createOpenRouterClient, MODELS, type ChatMessage } from "@/lib/openrouter/client";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import {
  STRATEGIC_BLUEPRINT_SECTION_ORDER,
  STRATEGIC_BLUEPRINT_SECTION_LABELS,
  type StrategicBlueprintOutput,
  type StrategicBlueprintProgress,
  type StrategicBlueprintSection,
  type IndustryMarketOverview,
  type ICPAnalysisValidation,
  type OfferAnalysisViability,
  type CompetitorAnalysis,
  type CrossAnalysisSynthesis,
  type Citation,
} from "../output-types";
import { researchCompetitors } from "./competitor-research";
import { researchIndustryMarket } from "./industry-market-research";
import { researchICPAnalysis } from "./icp-research";
import { researchOfferAnalysis } from "./offer-research";

export type StrategicBlueprintProgressCallback = (progress: StrategicBlueprintProgress) => void;

export interface StrategicBlueprintGeneratorOptions {
  onProgress?: StrategicBlueprintProgressCallback;
  abortSignal?: AbortSignal;
}

export interface StrategicBlueprintGeneratorResult {
  success: boolean;
  strategicBlueprint?: StrategicBlueprintOutput;
  error?: string;
  metadata: {
    totalTime: number;
    totalCost: number;
    sectionTimings: Record<string, number>;
  };
}

// =============================================================================
// Input Sanitization (Prevent Prompt Injection)
// =============================================================================

const MAX_INPUT_LENGTH = 5000;

function sanitizeInput(input: string | undefined | null): string {
  if (!input) return "";
  let sanitized = String(input);
  sanitized = sanitized.slice(0, MAX_INPUT_LENGTH);

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

  sanitized = sanitized.replace(/```/g, "'''");
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized.trim();
}

function sanitizeNumber(input: number | undefined | null, defaultValue: number = 0): number {
  if (input === undefined || input === null || isNaN(input)) {
    return defaultValue;
  }
  return Math.max(0, Number(input));
}

// =============================================================================
// Business Context Builder
// =============================================================================

function createBusinessContext(data: OnboardingFormData): string {
  const { businessBasics, icp, productOffer, marketCompetition, customerJourney, brandPositioning, budgetTargets, compliance } = data;

  const s = sanitizeInput;
  const n = sanitizeNumber;

  return `
## BUSINESS CONTEXT FOR STRATEGIC BLUEPRINT

### Company Information
- Business Name: ${s(businessBasics.businessName)}
- Website: ${s(businessBasics.websiteUrl)}

### Ideal Customer Profile (ICP)
- Primary ICP: ${s(icp.primaryIcpDescription)}
- Industry: ${s(icp.industryVertical)}
- Target Job Titles: ${s(icp.jobTitles)}
- Company Size: ${Array.isArray(icp.companySize) ? icp.companySize.join(', ') : icp.companySize || 'Not specified'}
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
- Pricing Model: ${Array.isArray(productOffer.pricingModel) ? productOffer.pricingModel.join(', ') : productOffer.pricingModel || 'Not specified'}
- Value Proposition: ${s(productOffer.valueProp)}
- Current Funnel Type: ${Array.isArray(productOffer.currentFunnelType) ? productOffer.currentFunnelType.join(', ') : productOffer.currentFunnelType || 'Not specified'}
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
${budgetTargets.targetCpl ? `- Target CPL: $${n(budgetTargets.targetCpl)}` : ""}
${budgetTargets.targetCac ? `- Target CAC: $${n(budgetTargets.targetCac)}` : ""}

### Compliance
${compliance.topicsToAvoid ? `- Topics to Avoid: ${s(compliance.topicsToAvoid)}` : "- Topics to Avoid: None specified"}
${compliance.claimRestrictions ? `- Claim Restrictions: ${s(compliance.claimRestrictions)}` : "- Claim Restrictions: None specified"}
`.trim();
}

// =============================================================================
// Section-Specific Prompts
// =============================================================================

const SECTION_PROMPTS: Record<StrategicBlueprintSection, (context: string, previousSections?: Partial<StrategicBlueprintOutput>) => ChatMessage[]> = {
  industryMarketOverview: (context) => [
    {
      role: "system",
      content: `You are an expert market researcher. Generate a JSON object for Industry & Market Overview.

REQUIRED STRUCTURE (follow EXACTLY):
{
  "categorySnapshot": {
    "category": "string - market category name",
    "marketMaturity": "early" | "growing" | "saturated",
    "awarenessLevel": "low" | "medium" | "high",
    "buyingBehavior": "impulsive" | "committee_driven" | "roi_based" | "mixed",
    "averageSalesCycle": "string - e.g. '2-4 weeks' or '3-6 months'",
    "seasonality": "string - seasonal patterns or 'Year-round'"
  },
  "marketDynamics": {
    "demandDrivers": ["string array - 4-6 factors driving demand"],
    "buyingTriggers": ["string array - 4-6 events that trigger purchases"],
    "barriersToPurchase": ["string array - 3-5 obstacles to buying"],
    "macroRisks": {
      "regulatoryConcerns": "string - regulatory risks",
      "marketDownturnRisks": "string - economic risks",
      "industryConsolidation": "string - M&A/consolidation risks"
    }
  },
  "painPoints": {
    "primary": ["string array - 5-7 most critical pain points"],
    "secondary": ["string array - 5-8 additional pain points"]
  },
  "psychologicalDrivers": {
    "drivers": [
      {"driver": "string - emotional driver name", "description": "string - how it manifests"}
    ]
  },
  "audienceObjections": {
    "objections": [
      {"objection": "string - common objection", "howToAddress": "string - response strategy"}
    ]
  },
  "messagingOpportunities": {
    "opportunities": ["string array - 6-8 messaging angles"],
    "summaryRecommendations": ["string array - 3 key strategic recommendations"]
  }
}

RULES:
- Use ONLY the exact enum values shown above (e.g., "early", "growing", "saturated" for marketMaturity)
- All arrays must contain the specified number of items
- Be specific and actionable based on the provided business context`
    },
    {
      role: "user",
      content: `Create an Industry & Market Overview for:\n\n${context}`
    }
  ],

  icpAnalysisValidation: (context, prev) => [
    {
      role: "system",
      content: `You are an expert ICP analyst. Validate whether this ICP is viable for paid media campaigns.

${prev?.industryMarketOverview ? `CONTEXT FROM PREVIOUS ANALYSIS:
- Primary Pain Points: ${prev.industryMarketOverview.painPoints?.primary?.slice(0, 3).join("; ") || "Not yet analyzed"}
- Market Maturity: ${prev.industryMarketOverview.categorySnapshot?.marketMaturity || "Unknown"}
- Buying Behavior: ${prev.industryMarketOverview.categorySnapshot?.buyingBehavior || "Unknown"}` : ""}

REQUIRED STRUCTURE (follow EXACTLY):
{
  "coherenceCheck": {
    "clearlyDefined": true | false,
    "reachableThroughPaidChannels": true | false,
    "adequateScale": true | false,
    "hasPainOfferSolves": true | false,
    "hasBudgetAndAuthority": true | false
  },
  "painSolutionFit": {
    "primaryPain": "string - the main pain point being solved",
    "offerComponentSolvingIt": "string - which part of the offer addresses this",
    "fitAssessment": "strong" | "moderate" | "weak",
    "notes": "string - additional context on the fit"
  },
  "marketReachability": {
    "metaVolume": true | false,
    "linkedInVolume": true | false,
    "googleSearchDemand": true | false,
    "contradictingSignals": ["string array - any conflicting data, can be empty []"]
  },
  "economicFeasibility": {
    "hasBudget": true | false,
    "purchasesSimilar": true | false,
    "tamAlignedWithCac": true | false,
    "notes": "string - economic viability notes"
  },
  "riskAssessment": {
    "reachability": "low" | "medium" | "high" | "critical",
    "budget": "low" | "medium" | "high" | "critical",
    "painStrength": "low" | "medium" | "high" | "critical",
    "competitiveness": "low" | "medium" | "high" | "critical"
  },
  "finalVerdict": {
    "status": "validated" | "workable" | "invalid",
    "reasoning": "string - 2-3 sentences explaining the verdict",
    "recommendations": ["string array - 2-4 actionable recommendations"]
  }
}

RULES:
- Be honest and critical - flag real concerns
- Use ONLY the exact enum values shown
- "validated" = ICP is solid and ready for paid campaigns
- "workable" = ICP has issues but can proceed with adjustments
- "invalid" = ICP needs major rework before running ads`
    },
    {
      role: "user",
      content: `Validate the ICP for:\n\n${context}`
    }
  ],

  offerAnalysisViability: (context, prev) => [
    {
      role: "system",
      content: `You are an expert offer analyst. Evaluate offer viability for paid media campaigns.

${prev?.icpAnalysisValidation ? `CONTEXT FROM PREVIOUS ANALYSIS:
- ICP Status: ${prev.icpAnalysisValidation.finalVerdict?.status || "Not validated"}
- Pain-Solution Fit: ${prev.icpAnalysisValidation.painSolutionFit?.fitAssessment || "Unknown"}
- Primary Pain: ${prev.icpAnalysisValidation.painSolutionFit?.primaryPain || "Not identified"}` : ""}

REQUIRED STRUCTURE (follow EXACTLY):
{
  "offerClarity": {
    "clearlyArticulated": true | false,
    "solvesRealPain": true | false,
    "benefitsEasyToUnderstand": true | false,
    "transformationMeasurable": true | false,
    "valuePropositionObvious": true | false
  },
  "offerStrength": {
    "painRelevance": 1-10,
    "urgency": 1-10,
    "differentiation": 1-10,
    "tangibility": 1-10,
    "proof": 1-10,
    "pricingLogic": 1-10,
    "overallScore": number (average of above scores, 1 decimal)
  },
  "marketOfferFit": {
    "marketWantsNow": true | false,
    "competitorsOfferSimilar": true | false,
    "priceMatchesExpectations": true | false,
    "proofStrongForColdTraffic": true | false,
    "transformationBelievable": true | false
  },
  "redFlags": ["array of applicable flags - use ONLY these exact values:
    'offer_too_vague', 'overcrowded_market', 'price_mismatch',
    'weak_or_no_proof', 'no_funnel_built', 'transformation_unclear'
    - can be empty array [] if no red flags"],
  "recommendation": {
    "status": "proceed" | "adjust_messaging" | "adjust_pricing" | "icp_refinement_needed" | "major_offer_rebuild",
    "reasoning": "string - 2-3 sentences explaining the recommendation",
    "actionItems": ["string array - 2-4 specific action items"]
  }
}

RULES:
- Score honestly based on information provided (don't inflate scores)
- overallScore must be the mathematical average of the 6 scores above it
- redFlags array should only contain flags that actually apply
- Use ONLY the exact enum values shown for status and redFlags`
    },
    {
      role: "user",
      content: `Analyze the offer viability for:\n\n${context}`
    }
  ],

  competitorAnalysis: (context) => [
    {
      role: "system",
      content: `You are an expert competitive analyst. Research the competitor landscape for paid media strategy.

REQUIRED STRUCTURE (follow EXACTLY):
{
  "competitors": [
    {
      "name": "string - competitor name",
      "positioning": "string - how they position themselves",
      "offer": "string - their main offer/product",
      "price": "string - e.g. '$997/mo', '$5,000 one-time', 'Custom pricing'",
      "funnels": "string - e.g. 'Demo call, Free trial'",
      "adPlatforms": ["array of platforms - e.g. 'Meta', 'LinkedIn', 'Google'"],
      "strengths": ["array of 2-3 key strengths"],
      "weaknesses": ["array of 2-3 key weaknesses"]
    }
  ],
  "creativeLibrary": {
    "adHooks": ["array of 5-7 hook examples that competitors use in their ads"],
    "creativeFormats": {
      "ugc": true | false,
      "carousels": true | false,
      "statics": true | false,
      "testimonial": true | false,
      "productDemo": true | false
    }
  },
  "funnelBreakdown": {
    "landingPagePatterns": ["array of 3-4 common landing page patterns"],
    "headlineStructure": ["array of 3-4 headline formulas used"],
    "ctaHierarchy": ["array of 2-3 CTA patterns"],
    "socialProofPatterns": ["array of 3-4 social proof types used"],
    "leadCaptureMethods": ["array of 2-3 lead capture approaches"],
    "formFriction": "low" | "medium" | "high"
  },
  "marketStrengths": ["array of 3-4 industry-wide strengths"],
  "marketWeaknesses": ["array of 3-4 industry-wide weaknesses"],
  "gapsAndOpportunities": {
    "messagingOpportunities": ["array of 3-4 messaging gaps to exploit"],
    "creativeOpportunities": ["array of 2-3 creative format opportunities"],
    "funnelOpportunities": ["array of 2-3 funnel improvement opportunities"]
  }
}

RULES:
- Include 3-5 competitors based on the competitor list provided
- If specific competitors aren't named, infer likely competitors from the industry
- Be specific with hooks and patterns - give actual examples, not generic descriptions
- formFriction should reflect typical forms in this market`
    },
    {
      role: "user",
      content: `Analyze competitors for:\n\n${context}`
    }
  ],

  crossAnalysisSynthesis: (context, prev) => [
    {
      role: "system",
      content: `You are a strategic analyst synthesizing all research into actionable paid media strategy.

PREVIOUS ANALYSIS SUMMARY:
${prev?.industryMarketOverview ? `- Market Maturity: ${prev.industryMarketOverview.categorySnapshot?.marketMaturity || "Unknown"}
- Buying Behavior: ${prev.industryMarketOverview.categorySnapshot?.buyingBehavior || "Unknown"}
- Awareness Level: ${prev.industryMarketOverview.categorySnapshot?.awarenessLevel || "Unknown"}
- Top Pain Points: ${prev.industryMarketOverview.painPoints?.primary?.slice(0, 3).join("; ") || "Not analyzed"}` : "- Market Overview: Not yet analyzed"}

${prev?.icpAnalysisValidation ? `- ICP Validation Status: ${prev.icpAnalysisValidation.finalVerdict?.status || "Unknown"}
- Pain-Solution Fit: ${prev.icpAnalysisValidation.painSolutionFit?.fitAssessment || "Unknown"}
- Risk Levels: Reachability=${prev.icpAnalysisValidation.riskAssessment?.reachability || "?"}, Budget=${prev.icpAnalysisValidation.riskAssessment?.budget || "?"}, Competition=${prev.icpAnalysisValidation.riskAssessment?.competitiveness || "?"}` : "- ICP Analysis: Not yet analyzed"}

${prev?.offerAnalysisViability ? `- Offer Overall Score: ${prev.offerAnalysisViability.offerStrength?.overallScore || "?"}/10
- Offer Recommendation: ${prev.offerAnalysisViability.recommendation?.status || "Unknown"}
- Red Flags: ${prev.offerAnalysisViability.redFlags?.length ? prev.offerAnalysisViability.redFlags.join(", ") : "None"}` : "- Offer Analysis: Not yet analyzed"}

${prev?.competitorAnalysis ? `- Competitors Analyzed: ${prev.competitorAnalysis.competitors?.length || 0}
- Market Strengths: ${prev.competitorAnalysis.marketStrengths?.slice(0, 2).join("; ") || "Not analyzed"}
- Key Opportunities: ${prev.competitorAnalysis.gapsAndOpportunities?.messagingOpportunities?.slice(0, 2).join("; ") || "Not analyzed"}` : "- Competitor Analysis: Not yet analyzed"}

REQUIRED STRUCTURE (follow EXACTLY):
{
  "keyInsights": [
    {
      "insight": "string - the key finding",
      "source": "industryMarketOverview" | "icpAnalysisValidation" | "offerAnalysisViability" | "competitorAnalysis",
      "implication": "string - what this means for the paid media strategy",
      "priority": "high" | "medium" | "low"
    }
  ],
  "recommendedPositioning": "string - 2-3 sentence ideal market positioning statement",
  "primaryMessagingAngles": [
    "string - specific messaging angle to test in ads"
  ],
  "recommendedPlatforms": [
    {
      "platform": "Meta" | "LinkedIn" | "Google" | "YouTube" | "TikTok",
      "reasoning": "string - why this platform fits the ICP and offer",
      "priority": "primary" | "secondary" | "testing"
    }
  ],
  "criticalSuccessFactors": [
    "string - must-have element for campaign success"
  ],
  "potentialBlockers": [
    "string - factor that could prevent success"
  ],
  "nextSteps": [
    "string - specific recommended next action"
  ]
}

RULES:
- keyInsights: Include 5-7 insights with at least one from each section
- primaryMessagingAngles: Include 3-5 specific, testable messaging angles
- recommendedPlatforms: Include 2-3 platforms, exactly one should be "primary"
- criticalSuccessFactors: Include 4-5 specific success factors
- potentialBlockers: Include 2-3 realistic blockers based on the analysis
- nextSteps: Include 4-5 actionable next steps in priority order
- Use ONLY the exact enum values shown for source, priority, and platform`
    },
    {
      role: "user",
      content: `Synthesize all analysis into a strategic blueprint for:\n\n${context}`
    }
  ],

  keywordIntelligence: () => [],
};

// =============================================================================
// Main Generator Function
// =============================================================================

export async function generateStrategicBlueprint(
  onboardingData: OnboardingFormData,
  options: StrategicBlueprintGeneratorOptions = {}
): Promise<StrategicBlueprintGeneratorResult> {
  const { onProgress, abortSignal } = options;
  const startTime = Date.now();
  const sectionTimings: Record<string, number> = {};
  let totalCost = 0;

  const completedSections: StrategicBlueprintSection[] = [];
  const partialOutput: Partial<StrategicBlueprintOutput> = {};

  const client = createOpenRouterClient();
  const context = createBusinessContext(onboardingData);

  const updateProgress = (section: StrategicBlueprintSection | null, message: string, error?: string) => {
    if (onProgress) {
      onProgress({
        currentSection: section,
        completedSections: [...completedSections],
        partialOutput: { ...partialOutput },
        progressPercentage: Math.round((completedSections.length / STRATEGIC_BLUEPRINT_SECTION_ORDER.length) * 100),
        progressMessage: message,
        error,
      });
    }
  };

  const checkAbort = () => {
    if (abortSignal?.aborted) {
      throw new Error("Generation aborted by user");
    }
  };

  // Track citations per section for later display (Phase 14)
  const sectionCitations: Record<string, Citation[]> = {};
  const modelsUsed: Set<string> = new Set([MODELS.CLAUDE_SONNET]);

  try {
    for (const section of STRATEGIC_BLUEPRINT_SECTION_ORDER) {
      checkAbort();
      const sectionStart = Date.now();
      updateProgress(section, `Generating ${STRATEGIC_BLUEPRINT_SECTION_LABELS[section]}...`);

      // Special handling for industryMarketOverview - use Perplexity Deep Research
      if (section === "industryMarketOverview") {
        const result = await researchIndustryMarket(context);
        partialOutput[section] = result.data;
        sectionCitations[section] = result.citations;
        totalCost += result.cost;
        modelsUsed.add(MODELS.PERPLEXITY_SONAR);
        sectionTimings[section] = Date.now() - sectionStart;
        completedSections.push(section);
        updateProgress(section, `Completed ${STRATEGIC_BLUEPRINT_SECTION_LABELS[section]} (with ${result.citations.length} citations)`);
        continue;
      }

      // Special handling for icpAnalysisValidation - use Perplexity Deep Research
      if (section === "icpAnalysisValidation") {
        const result = await researchICPAnalysis(context, partialOutput.industryMarketOverview);
        partialOutput[section] = result.data;
        sectionCitations[section] = result.citations;
        totalCost += result.cost;
        modelsUsed.add(MODELS.PERPLEXITY_SONAR);
        sectionTimings[section] = Date.now() - sectionStart;
        completedSections.push(section);
        updateProgress(section, `Completed ${STRATEGIC_BLUEPRINT_SECTION_LABELS[section]} (with ${result.citations.length} citations)`);
        continue;
      }

      // Special handling for offerAnalysisViability - use Perplexity Deep Research
      if (section === "offerAnalysisViability") {
        const result = await researchOfferAnalysis(context, partialOutput.icpAnalysisValidation);
        partialOutput[section] = result.data;
        sectionCitations[section] = result.citations;
        totalCost += result.cost;
        modelsUsed.add(MODELS.PERPLEXITY_SONAR);
        sectionTimings[section] = Date.now() - sectionStart;
        completedSections.push(section);
        updateProgress(section, `Completed ${STRATEGIC_BLUEPRINT_SECTION_LABELS[section]} (with ${result.citations.length} citations)`);
        continue;
      }

      // Special handling for competitorAnalysis - use Perplexity Deep Research
      if (section === "competitorAnalysis") {
        const result = await researchCompetitors(context);
        partialOutput[section] = result.data;
        sectionCitations[section] = result.citations;
        totalCost += result.cost;
        modelsUsed.add(MODELS.PERPLEXITY_SONAR);
        sectionTimings[section] = Date.now() - sectionStart;
        completedSections.push(section);
        updateProgress(section, `Completed ${STRATEGIC_BLUEPRINT_SECTION_LABELS[section]} (with ${result.citations.length} citations)`);
        continue;
      }

      // Only crossAnalysisSynthesis uses Claude Sonnet (other 4 sections use Perplexity Deep Research)
      const promptFn = SECTION_PROMPTS[section];
      const messages = promptFn(context, partialOutput);

      const response = await client.chatJSON({
        model: MODELS.CLAUDE_SONNET,
        messages,
        temperature: 0.3, // Lower temperature for more consistent JSON output
        maxTokens: 4096,
      });

      // @ts-expect-error - Dynamic assignment
      partialOutput[section] = response.data;
      totalCost += response.cost;
      sectionTimings[section] = Date.now() - sectionStart;
      completedSections.push(section);

      updateProgress(section, `Completed ${STRATEGIC_BLUEPRINT_SECTION_LABELS[section]}`);
    }

    const totalTime = Date.now() - startTime;
    const strategicBlueprint: StrategicBlueprintOutput = {
      industryMarketOverview: partialOutput.industryMarketOverview as IndustryMarketOverview,
      icpAnalysisValidation: partialOutput.icpAnalysisValidation as ICPAnalysisValidation,
      offerAnalysisViability: partialOutput.offerAnalysisViability as OfferAnalysisViability,
      competitorAnalysis: partialOutput.competitorAnalysis as CompetitorAnalysis,
      crossAnalysisSynthesis: partialOutput.crossAnalysisSynthesis as CrossAnalysisSynthesis,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: "1.1", // Bumped for multi-model support
        processingTime: totalTime,
        totalCost: Math.round(totalCost * 10000) / 10000,
        modelsUsed: Array.from(modelsUsed),
        overallConfidence: 75,
        sectionCitations: Object.keys(sectionCitations).length > 0 ? sectionCitations : undefined,
      },
    };

    updateProgress(null, "Strategic Blueprint generation complete!");

    return {
      success: true,
      strategicBlueprint,
      metadata: {
        totalTime,
        totalCost,
        sectionTimings,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    const failedSection = STRATEGIC_BLUEPRINT_SECTION_ORDER.find(
      (section) => !completedSections.includes(section)
    ) || null;

    updateProgress(failedSection, `Error: ${errorMessage}`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      metadata: {
        totalTime: Date.now() - startTime,
        totalCost,
        sectionTimings,
      },
    };
  }
}
