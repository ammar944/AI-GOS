// ICP Analysis Research with Perplexity Deep Research
// Real-time ICP validation with web search and citations

import { createResearchAgent } from "@/lib/research";
import { MODELS } from "@/lib/openrouter/client";
import type {
  CitedSectionOutput,
  ICPAnalysisValidation,
  IndustryMarketOverview,
  ValidationStatus,
  RiskRating,
} from "../output-types";

/**
 * Research ICP analysis using Perplexity Deep Research for real-time web search.
 * Returns ICPAnalysisValidation with extracted citations from web sources.
 *
 * Uses agent.research() instead of researchJSON() to preserve citations.
 * JSON parsing is done manually after receiving the research response.
 */
export async function researchICPAnalysis(
  context: string,
  industryMarketOverview?: IndustryMarketOverview
): Promise<CitedSectionOutput<ICPAnalysisValidation>> {
  const agent = createResearchAgent();

  // Build context from previous analysis
  const previousContext = industryMarketOverview
    ? `
CONTEXT FROM PREVIOUS MARKET ANALYSIS:
- Primary Pain Points: ${industryMarketOverview.painPoints?.primary?.slice(0, 5).join("; ") || "Not analyzed"}
- Market Maturity: ${industryMarketOverview.categorySnapshot?.marketMaturity || "Unknown"}
- Buying Behavior: ${industryMarketOverview.categorySnapshot?.buyingBehavior || "Unknown"}
- Awareness Level: ${industryMarketOverview.categorySnapshot?.awarenessLevel || "Unknown"}
- Demand Drivers: ${industryMarketOverview.marketDynamics?.demandDrivers?.slice(0, 3).join("; ") || "Not analyzed"}
- Barriers to Purchase: ${industryMarketOverview.marketDynamics?.barriersToPurchase?.slice(0, 3).join("; ") || "Not analyzed"}
`
    : "";

  const systemPrompt = `You are an expert ICP (Ideal Customer Profile) analyst with real-time web search capabilities.
Research and validate the ICP for paid media campaigns using current web data.

${previousContext}

CRITICAL: You must output ONLY valid JSON. No text before or after the JSON object.

REQUIRED JSON STRUCTURE (follow EXACTLY):
{
  "coherenceCheck": {
    "clearlyDefined": true | false,
    "reachableThroughPaidChannels": true | false,
    "adequateScale": true | false,
    "hasPainOfferSolves": true | false,
    "hasBudgetAndAuthority": true | false
  },
  "painSolutionFit": {
    "primaryPain": "string - the main pain point being solved based on web research",
    "offerComponentSolvingIt": "string - which part of the offer addresses this",
    "fitAssessment": "strong" | "moderate" | "weak",
    "notes": "string - additional context on the fit based on market data"
  },
  "marketReachability": {
    "metaVolume": true | false,
    "linkedInVolume": true | false,
    "googleSearchDemand": true | false,
    "contradictingSignals": ["string array - any conflicting data from web research, can be empty []"]
  },
  "economicFeasibility": {
    "hasBudget": true | false,
    "purchasesSimilar": true | false,
    "tamAlignedWithCac": true | false,
    "notes": "string - economic viability notes from market research"
  },
  "riskAssessment": {
    "reachability": "low" | "medium" | "high" | "critical",
    "budget": "low" | "medium" | "high" | "critical",
    "painStrength": "low" | "medium" | "high" | "critical",
    "competitiveness": "low" | "medium" | "high" | "critical"
  },
  "finalVerdict": {
    "status": "validated" | "workable" | "invalid",
    "reasoning": "string - 2-3 sentences explaining the verdict based on research",
    "recommendations": ["string array - 2-4 actionable recommendations"]
  }
}

RESEARCH INSTRUCTIONS:
1. Search for industry-specific audience data on LinkedIn, industry reports, and market research
2. Look up real demographics and company data for this ICP type
3. Research actual budget indicators and purchasing patterns in this market
4. Check Google Trends and ad platform audience sizes where available
5. Find real pain points from forums, Reddit, G2 reviews for this audience
6. Verify if this ICP can actually be reached through paid channels
7. Be honest and critical - flag real concerns based on research

VALIDATION CRITERIA:
- "validated" = ICP is solid and ready for paid campaigns based on evidence
- "workable" = ICP has issues but can proceed with adjustments
- "invalid" = ICP needs major rework before running ads

OUTPUT ONLY THE JSON OBJECT. No explanations, no markdown code blocks.`;

  const userPrompt = `Research and validate the ICP (Ideal Customer Profile) for this business:

${context}

Search the web for:
1. Audience size and reachability on Meta, LinkedIn, and Google
2. Real demographics and company characteristics for this ICP
3. Budget indicators and purchasing patterns in this industry
4. Actual pain points from forums, reviews, and customer feedback
5. Competition for this audience segment
6. Evidence that this ICP can be effectively targeted with paid media

Return the validation analysis as a JSON object following the exact structure specified.`;

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
  const data = parseICPAnalysisJSON(response.content);

  return {
    data,
    citations: response.citations,
    model: response.model,
    cost: response.cost.totalCost,
  };
}

/**
 * Parse ICPAnalysisValidation JSON from research response content.
 * Includes fallback extraction and validation with defensive defaults.
 */
function parseICPAnalysisJSON(content: string): ICPAnalysisValidation {
  // Try to extract JSON from the content
  const jsonString = extractJSON(content);

  if (!jsonString) {
    console.error("[ICP Research] Failed to extract JSON from response");
    throw new Error("Failed to extract JSON from ICP research response");
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Validate and apply defensive defaults
    return {
      coherenceCheck: {
        clearlyDefined: Boolean(parsed.coherenceCheck?.clearlyDefined),
        reachableThroughPaidChannels: Boolean(parsed.coherenceCheck?.reachableThroughPaidChannels),
        adequateScale: Boolean(parsed.coherenceCheck?.adequateScale),
        hasPainOfferSolves: Boolean(parsed.coherenceCheck?.hasPainOfferSolves),
        hasBudgetAndAuthority: Boolean(parsed.coherenceCheck?.hasBudgetAndAuthority),
      },
      painSolutionFit: {
        primaryPain: String(parsed.painSolutionFit?.primaryPain || "Not identified"),
        offerComponentSolvingIt: String(parsed.painSolutionFit?.offerComponentSolvingIt || ""),
        fitAssessment: validateFitAssessment(parsed.painSolutionFit?.fitAssessment),
        notes: String(parsed.painSolutionFit?.notes || ""),
      },
      marketReachability: {
        metaVolume: Boolean(parsed.marketReachability?.metaVolume),
        linkedInVolume: Boolean(parsed.marketReachability?.linkedInVolume),
        googleSearchDemand: Boolean(parsed.marketReachability?.googleSearchDemand),
        contradictingSignals: ensureArray(parsed.marketReachability?.contradictingSignals),
      },
      economicFeasibility: {
        hasBudget: Boolean(parsed.economicFeasibility?.hasBudget),
        purchasesSimilar: Boolean(parsed.economicFeasibility?.purchasesSimilar),
        tamAlignedWithCac: Boolean(parsed.economicFeasibility?.tamAlignedWithCac),
        notes: String(parsed.economicFeasibility?.notes || ""),
      },
      riskAssessment: {
        reachability: validateRiskRating(parsed.riskAssessment?.reachability),
        budget: validateRiskRating(parsed.riskAssessment?.budget),
        painStrength: validateRiskRating(parsed.riskAssessment?.painStrength),
        competitiveness: validateRiskRating(parsed.riskAssessment?.competitiveness),
      },
      finalVerdict: {
        status: validateValidationStatus(parsed.finalVerdict?.status),
        reasoning: String(parsed.finalVerdict?.reasoning || "ICP requires further analysis"),
        recommendations: ensureArray(parsed.finalVerdict?.recommendations),
      },
    };
  } catch (error) {
    console.error("[ICP Research] JSON parse error:", error);
    throw new Error(
      `Failed to parse ICP analysis JSON: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validate ValidationStatus enum value
 */
function validateValidationStatus(value: unknown): ValidationStatus {
  if (value === "validated" || value === "workable" || value === "invalid") {
    return value;
  }
  return "workable"; // Default
}

/**
 * Validate RiskRating enum value
 */
function validateRiskRating(value: unknown): RiskRating {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  return "medium"; // Default
}

/**
 * Validate fitAssessment enum value
 */
function validateFitAssessment(value: unknown): "strong" | "moderate" | "weak" {
  if (value === "strong" || value === "moderate" || value === "weak") {
    return value;
  }
  return "moderate"; // Default
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
