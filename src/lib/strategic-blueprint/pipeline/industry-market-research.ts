// Industry Market Research with Perplexity Deep Research
// Real-time market intelligence with web search and citations

import { createResearchAgent } from "@/lib/research";
import { MODELS } from "@/lib/openrouter/client";
import type { CitedSectionOutput, IndustryMarketOverview, MarketMaturity, AwarenessLevel, BuyingBehavior } from "../output-types";

/**
 * Research industry and market overview using Perplexity Deep Research for real-time web search.
 * Returns IndustryMarketOverview with extracted citations from web sources.
 *
 * Uses agent.research() instead of researchJSON() to preserve citations.
 * JSON parsing is done manually after receiving the research response.
 */
export async function researchIndustryMarket(
  context: string
): Promise<CitedSectionOutput<IndustryMarketOverview>> {
  const agent = createResearchAgent();

  const systemPrompt = `You are an expert market researcher with real-time web search capabilities.
Research the industry and market landscape using current web data to inform paid media strategy.

CRITICAL: You must output ONLY valid JSON. No text before or after the JSON object.

REQUIRED JSON STRUCTURE (follow EXACTLY):
{
  "categorySnapshot": {
    "category": "string - market category name based on web research",
    "marketMaturity": "early" | "growing" | "saturated",
    "awarenessLevel": "low" | "medium" | "high",
    "buyingBehavior": "impulsive" | "committee_driven" | "roi_based" | "mixed",
    "averageSalesCycle": "string - e.g. '2-4 weeks' or '3-6 months' based on industry reports",
    "seasonality": "string - seasonal patterns or 'Year-round' from market research"
  },
  "marketDynamics": {
    "demandDrivers": ["string array - 4-6 factors driving demand from current trends"],
    "buyingTriggers": ["string array - 4-6 events that trigger purchases based on market data"],
    "barriersToPurchase": ["string array - 3-5 obstacles from customer feedback and reviews"],
    "macroRisks": {
      "regulatoryConcerns": "string - current regulatory risks from news",
      "marketDownturnRisks": "string - economic risks from market reports",
      "industryConsolidation": "string - M&A/consolidation trends"
    }
  },
  "painPoints": {
    "primary": ["string array - 5-7 most critical pain points from forums, reviews, surveys"],
    "secondary": ["string array - 5-8 additional pain points from web research"]
  },
  "psychologicalDrivers": {
    "drivers": [
      {"driver": "string - emotional driver name", "description": "string - how it manifests based on customer behavior data"}
    ]
  },
  "audienceObjections": {
    "objections": [
      {"objection": "string - common objection from reviews and forums", "howToAddress": "string - response strategy based on successful approaches"}
    ]
  },
  "messagingOpportunities": {
    "opportunities": ["string array - 6-8 messaging angles based on market gaps"],
    "summaryRecommendations": ["string array - 3 key strategic recommendations from analysis"]
  }
}

RESEARCH INSTRUCTIONS:
1. Search for current market trends, reports, and industry statistics
2. Look up industry publications, market research reports, and analyst insights
3. Find real pain points from forums, Reddit, G2 reviews, Capterra, and customer feedback
4. Research actual buying behaviors from case studies and industry surveys
5. Identify seasonal patterns and sales cycles from market data
6. Use actual data points and statistics where available
7. Be specific with real findings - avoid generic or made-up information

OUTPUT ONLY THE JSON OBJECT. No explanations, no markdown code blocks.`;

  const userPrompt = `Research the industry and market landscape for this business and provide real-time market intelligence:

${context}

Search the web for:
1. Current market trends and growth statistics for this industry
2. Industry reports and analyst insights
3. Customer pain points from forums, reviews, and feedback platforms
4. Buying behaviors and sales cycles from market research
5. Seasonal patterns and demand drivers
6. Regulatory and macroeconomic factors affecting this market

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
  const data = parseIndustryMarketJSON(response.content);

  return {
    data,
    citations: response.citations,
    model: response.model,
    cost: response.cost.totalCost,
  };
}

/**
 * Parse IndustryMarketOverview JSON from research response content.
 * Includes fallback extraction and validation with defensive defaults.
 */
function parseIndustryMarketJSON(content: string): IndustryMarketOverview {
  // Try to extract JSON from the content
  const jsonString = extractJSON(content);

  if (!jsonString) {
    console.error("[Industry Market Research] Failed to extract JSON from response");
    throw new Error("Failed to extract JSON from industry market research response");
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Validate and apply defensive defaults
    return {
      categorySnapshot: {
        category: String(parsed.categorySnapshot?.category || "Unknown category"),
        marketMaturity: validateMarketMaturity(parsed.categorySnapshot?.marketMaturity),
        awarenessLevel: validateAwarenessLevel(parsed.categorySnapshot?.awarenessLevel),
        buyingBehavior: validateBuyingBehavior(parsed.categorySnapshot?.buyingBehavior),
        averageSalesCycle: String(parsed.categorySnapshot?.averageSalesCycle || "Variable"),
        seasonality: String(parsed.categorySnapshot?.seasonality || "Year-round"),
      },
      marketDynamics: {
        demandDrivers: ensureArray(parsed.marketDynamics?.demandDrivers),
        buyingTriggers: ensureArray(parsed.marketDynamics?.buyingTriggers),
        barriersToPurchase: ensureArray(parsed.marketDynamics?.barriersToPurchase),
        macroRisks: {
          regulatoryConcerns: String(parsed.marketDynamics?.macroRisks?.regulatoryConcerns || "None identified"),
          marketDownturnRisks: String(parsed.marketDynamics?.macroRisks?.marketDownturnRisks || "Standard market risk"),
          industryConsolidation: String(parsed.marketDynamics?.macroRisks?.industryConsolidation || "No significant consolidation"),
        },
      },
      painPoints: {
        primary: ensureArray(parsed.painPoints?.primary),
        secondary: ensureArray(parsed.painPoints?.secondary),
      },
      psychologicalDrivers: {
        drivers: ensureDriversArray(parsed.psychologicalDrivers?.drivers),
      },
      audienceObjections: {
        objections: ensureObjectionsArray(parsed.audienceObjections?.objections),
      },
      messagingOpportunities: {
        opportunities: ensureArray(parsed.messagingOpportunities?.opportunities),
        summaryRecommendations: ensureArray(parsed.messagingOpportunities?.summaryRecommendations),
      },
    };
  } catch (error) {
    console.error("[Industry Market Research] JSON parse error:", error);
    throw new Error(
      `Failed to parse industry market JSON: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validate marketMaturity enum value
 */
function validateMarketMaturity(value: unknown): MarketMaturity {
  if (value === "early" || value === "growing" || value === "saturated") {
    return value;
  }
  return "growing"; // Default
}

/**
 * Validate awarenessLevel enum value
 */
function validateAwarenessLevel(value: unknown): AwarenessLevel {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium"; // Default
}

/**
 * Validate buyingBehavior enum value
 */
function validateBuyingBehavior(value: unknown): BuyingBehavior {
  if (value === "impulsive" || value === "committee_driven" || value === "roi_based" || value === "mixed") {
    return value;
  }
  return "mixed"; // Default
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
 * Ensure drivers array has correct structure
 */
function ensureDriversArray(value: unknown): { driver: string; description: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item: Record<string, unknown>) => ({
    driver: String(item?.driver || "Unknown driver"),
    description: String(item?.description || ""),
  }));
}

/**
 * Ensure objections array has correct structure
 */
function ensureObjectionsArray(value: unknown): { objection: string; howToAddress: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item: Record<string, unknown>) => ({
    objection: String(item?.objection || "Unknown objection"),
    howToAddress: String(item?.howToAddress || ""),
  }));
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
