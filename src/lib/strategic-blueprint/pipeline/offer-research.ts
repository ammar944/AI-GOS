// Offer Analysis Research with Perplexity Deep Research
// Real-time offer viability analysis with web search and citations

import { createResearchAgent } from "@/lib/research";
import { MODELS } from "@/lib/openrouter/client";
import type {
  CitedSectionOutput,
  OfferAnalysisViability,
  ICPAnalysisValidation,
  OfferRedFlag,
  OfferRecommendation,
} from "../output-types";

/**
 * Research offer analysis using Perplexity Deep Research for real-time web search.
 * Returns OfferAnalysisViability with extracted citations from web sources.
 *
 * Uses agent.research() instead of researchJSON() to preserve citations.
 * JSON parsing is done manually after receiving the research response.
 */
export async function researchOfferAnalysis(
  context: string,
  icpAnalysis?: ICPAnalysisValidation
): Promise<CitedSectionOutput<OfferAnalysisViability>> {
  const agent = createResearchAgent();

  // Build context from previous analysis
  const previousContext = icpAnalysis
    ? `
CONTEXT FROM PREVIOUS ICP ANALYSIS:
- ICP Validation Status: ${icpAnalysis.finalVerdict?.status || "Unknown"}
- Pain-Solution Fit: ${icpAnalysis.painSolutionFit?.fitAssessment || "Unknown"}
- Primary Pain: ${icpAnalysis.painSolutionFit?.primaryPain || "Not identified"}
- Has Budget: ${icpAnalysis.economicFeasibility?.hasBudget ? "Yes" : "No/Unknown"}
- Purchases Similar: ${icpAnalysis.economicFeasibility?.purchasesSimilar ? "Yes" : "No/Unknown"}
- Risk Levels: Reachability=${icpAnalysis.riskAssessment?.reachability || "?"}, Budget=${icpAnalysis.riskAssessment?.budget || "?"}, Competition=${icpAnalysis.riskAssessment?.competitiveness || "?"}
`
    : "";

  const systemPrompt = `You are an expert offer analyst with real-time web search capabilities.
Evaluate offer viability for paid media campaigns using current web data on pricing benchmarks, competitor offers, and market expectations.

${previousContext}

CRITICAL: You must output ONLY valid JSON. No text before or after the JSON object.

REQUIRED JSON STRUCTURE (follow EXACTLY):
{
  "offerClarity": {
    "clearlyArticulated": true | false,
    "solvesRealPain": true | false,
    "benefitsEasyToUnderstand": true | false,
    "transformationMeasurable": true | false,
    "valuePropositionObvious": true | false
  },
  "offerStrength": {
    "painRelevance": 1-10 (based on market research),
    "urgency": 1-10 (based on market demand indicators),
    "differentiation": 1-10 (based on competitor comparison),
    "tangibility": 1-10 (based on deliverable clarity),
    "proof": 1-10 (based on evidence available),
    "pricingLogic": 1-10 (based on market price benchmarks),
    "overallScore": number (average of above 6 scores, 1 decimal place)
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
    - can be empty array [] if no red flags based on research"],
  "recommendation": {
    "status": "proceed" | "adjust_messaging" | "adjust_pricing" | "icp_refinement_needed" | "major_offer_rebuild",
    "reasoning": "string - 2-3 sentences explaining the recommendation based on research",
    "actionItems": ["string array - 2-4 specific action items based on market data"]
  }
}

RESEARCH INSTRUCTIONS:
1. Search for pricing benchmarks in this industry/market
2. Look up competitor offers and their positioning
3. Research market expectations for similar products/services
4. Find real customer feedback on similar offers
5. Check if the transformation promised is believable based on industry norms
6. Verify proof/social proof requirements for this market
7. Be honest in scoring - don't inflate based on incomplete information

SCORING GUIDE (be critical):
- 1-3: Weak, major concerns
- 4-5: Below average, needs improvement
- 6-7: Acceptable, some room for improvement
- 8-9: Strong, minor optimizations possible
- 10: Exceptional, best-in-class

OUTPUT ONLY THE JSON OBJECT. No explanations, no markdown code blocks.`;

  const userPrompt = `Analyze the offer viability for this business:

${context}

Search the web for:
1. Pricing benchmarks for similar offers in this market
2. Competitor offers and how they're positioned
3. Customer expectations and what resonates in this industry
4. Social proof requirements for cold traffic in this market
5. Common objections and how successful offers address them
6. Market saturation and differentiation opportunities

Return the analysis as a JSON object following the exact structure specified.`;

  const response = await agent.research({
    model: MODELS.PERPLEXITY_SONAR,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 8192,
    jsonMode: true,
    timeout: 60000, // 1 minute for sonar-pro
  });

  // Parse JSON from research response
  const data = parseOfferAnalysisJSON(response.content);

  return {
    data,
    citations: response.citations,
    model: response.model,
    cost: response.cost.totalCost,
  };
}

/**
 * Parse OfferAnalysisViability JSON from research response content.
 * Includes fallback extraction and validation with defensive defaults.
 */
function parseOfferAnalysisJSON(content: string): OfferAnalysisViability {
  // Try to extract JSON from the content
  const jsonString = extractJSON(content);

  if (!jsonString) {
    console.error("[Offer Research] Failed to extract JSON from response");
    throw new Error("Failed to extract JSON from offer research response");
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Extract and validate scores
    const painRelevance = clampScore(parsed.offerStrength?.painRelevance);
    const urgency = clampScore(parsed.offerStrength?.urgency);
    const differentiation = clampScore(parsed.offerStrength?.differentiation);
    const tangibility = clampScore(parsed.offerStrength?.tangibility);
    const proof = clampScore(parsed.offerStrength?.proof);
    const pricingLogic = clampScore(parsed.offerStrength?.pricingLogic);

    // Calculate overall score as average
    const overallScore = calculateOverallScore(
      painRelevance,
      urgency,
      differentiation,
      tangibility,
      proof,
      pricingLogic
    );

    // Validate and apply defensive defaults
    return {
      offerClarity: {
        clearlyArticulated: Boolean(parsed.offerClarity?.clearlyArticulated),
        solvesRealPain: Boolean(parsed.offerClarity?.solvesRealPain),
        benefitsEasyToUnderstand: Boolean(parsed.offerClarity?.benefitsEasyToUnderstand),
        transformationMeasurable: Boolean(parsed.offerClarity?.transformationMeasurable),
        valuePropositionObvious: Boolean(parsed.offerClarity?.valuePropositionObvious),
      },
      offerStrength: {
        painRelevance,
        urgency,
        differentiation,
        tangibility,
        proof,
        pricingLogic,
        overallScore,
      },
      marketOfferFit: {
        marketWantsNow: Boolean(parsed.marketOfferFit?.marketWantsNow),
        competitorsOfferSimilar: Boolean(parsed.marketOfferFit?.competitorsOfferSimilar),
        priceMatchesExpectations: Boolean(parsed.marketOfferFit?.priceMatchesExpectations),
        proofStrongForColdTraffic: Boolean(parsed.marketOfferFit?.proofStrongForColdTraffic),
        transformationBelievable: Boolean(parsed.marketOfferFit?.transformationBelievable),
      },
      redFlags: validateRedFlags(parsed.redFlags),
      recommendation: {
        status: validateOfferRecommendation(parsed.recommendation?.status),
        reasoning: String(parsed.recommendation?.reasoning || "Offer requires further analysis"),
        actionItems: ensureArray(parsed.recommendation?.actionItems),
      },
    };
  } catch (error) {
    console.error("[Offer Research] JSON parse error:", error);
    throw new Error(
      `Failed to parse offer analysis JSON: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Clamp score to 1-10 range
 */
function clampScore(value: unknown): number {
  if (typeof value !== "number" || isNaN(value)) {
    return 5; // Default to middle score
  }
  return Math.min(10, Math.max(1, Math.round(value)));
}

/**
 * Calculate overall score as average of individual scores
 */
function calculateOverallScore(...scores: number[]): number {
  const sum = scores.reduce((acc, score) => acc + score, 0);
  const average = sum / scores.length;
  return Math.round(average * 10) / 10; // Round to 1 decimal place
}

/**
 * Valid offer red flags
 */
const VALID_RED_FLAGS: OfferRedFlag[] = [
  "offer_too_vague",
  "overcrowded_market",
  "price_mismatch",
  "weak_or_no_proof",
  "no_funnel_built",
  "transformation_unclear",
];

/**
 * Validate and filter red flags array
 */
function validateRedFlags(value: unknown): OfferRedFlag[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((flag): flag is OfferRedFlag =>
    VALID_RED_FLAGS.includes(flag as OfferRedFlag)
  );
}

/**
 * Validate OfferRecommendation enum value
 */
function validateOfferRecommendation(value: unknown): OfferRecommendation {
  const validValues: OfferRecommendation[] = [
    "proceed",
    "adjust_messaging",
    "adjust_pricing",
    "icp_refinement_needed",
    "major_offer_rebuild",
  ];
  if (validValues.includes(value as OfferRecommendation)) {
    return value as OfferRecommendation;
  }
  return "adjust_messaging"; // Default
}

/**
 * Ensure value is a string array with fallback to empty array
 */
function ensureArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [];
}

/**
 * Extract JSON from response content.
 * Handles various formats: raw JSON, markdown code blocks, mixed content.
 */
function extractJSON(content: string): string | null {
  if (!content || typeof content !== "string") {
    return null;
  }

  const trimmed = content.trim();

  // Strategy 1: Direct parse if whole content is valid JSON
  if (isValidJSON(trimmed)) {
    return trimmed;
  }

  // Strategy 2: Extract from markdown code block
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const blockContent = codeBlockMatch[1].trim();
    if (isValidJSON(blockContent)) {
      return blockContent;
    }
  }

  // Strategy 3: Find first { and try to extract balanced JSON object
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace !== -1) {
    const fromBrace = trimmed.substring(firstBrace);
    const balanced = extractBalancedJSON(fromBrace);
    if (balanced && isValidJSON(balanced)) {
      return balanced;
    }
  }

  return null;
}

/**
 * Extract a balanced JSON object by counting braces
 */
function extractBalancedJSON(content: string): string | null {
  if (!content.startsWith("{")) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return content.substring(0, i + 1);
      }
    }
  }

  return null;
}

/**
 * Check if a string is valid JSON
 */
function isValidJSON(str: string): boolean {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}
