// Competitor Research with Perplexity Deep Research
// Real-time competitor intelligence with web search and citations

import { createResearchAgent } from "@/lib/research";
import { MODELS } from "@/lib/openrouter/client";
import type { CitedSectionOutput, CompetitorAnalysis } from "../output-types";

/**
 * Research competitors using Perplexity Deep Research for real-time web search.
 * Returns CompetitorAnalysis with extracted citations from web sources.
 *
 * Uses agent.research() instead of researchJSON() to preserve citations.
 * JSON parsing is done manually after receiving the research response.
 */
export async function researchCompetitors(
  context: string
): Promise<CitedSectionOutput<CompetitorAnalysis>> {
  const agent = createResearchAgent();

  const systemPrompt = `You are an expert competitive analyst with real-time web search capabilities.
Research the competitor landscape using current web data to inform paid media strategy.

CRITICAL: You must output ONLY valid JSON. No text before or after the JSON object.

REQUIRED JSON STRUCTURE (follow EXACTLY):
{
  "competitors": [
    {
      "name": "string - actual competitor company name from web search",
      "positioning": "string - how they position themselves based on their website/marketing",
      "offer": "string - their main offer/product with actual pricing if found",
      "price": "string - e.g. '$997/mo', '$5,000 one-time', 'Custom pricing'",
      "funnels": "string - e.g. 'Demo call, Free trial' based on their actual website",
      "adPlatforms": ["array of platforms they advertise on - verify from ad libraries"],
      "strengths": ["array of 2-3 verified strengths from reviews/market presence"],
      "weaknesses": ["array of 2-3 weaknesses from reviews/user feedback"]
    }
  ],
  "creativeLibrary": {
    "adHooks": ["array of 5-7 actual hook examples from competitor ads found online"],
    "creativeFormats": {
      "ugc": true | false,
      "carousels": true | false,
      "statics": true | false,
      "testimonial": true | false,
      "productDemo": true | false
    }
  },
  "funnelBreakdown": {
    "landingPagePatterns": ["array of 3-4 common landing page patterns observed"],
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

RESEARCH INSTRUCTIONS:
1. Search for actual competitors in this market using web search
2. Look up competitor websites, pricing pages, and marketing materials
3. Check Meta Ad Library and LinkedIn Ad Library for actual ad examples
4. Find real reviews on G2, Capterra, Trustpilot to identify strengths/weaknesses
5. Include 3-5 competitors with verified information from web sources
6. Use actual hook text and headlines from ads you find online
7. Be specific with real data - avoid generic or made-up information

OUTPUT ONLY THE JSON OBJECT. No explanations, no markdown code blocks.`;

  const userPrompt = `Research the competitor landscape for this business and provide real-time competitive intelligence:

${context}

Search the web for:
1. Direct competitors in this market
2. Their pricing, offers, and positioning
3. Their ad creative examples from Meta/LinkedIn ad libraries
4. Customer reviews and ratings
5. Their landing pages and funnel structures

Return the analysis as a JSON object following the exact structure specified.`;

  const response = await agent.research({
    model: MODELS.PERPLEXITY_DEEP_RESEARCH,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 8192,
    jsonMode: true,
    timeout: 120000, // 2 minutes for deep research
  });

  // Parse JSON from research response
  const data = parseCompetitorAnalysisJSON(response.content);

  return {
    data,
    citations: response.citations,
    model: response.model,
    cost: response.cost.totalCost,
  };
}

/**
 * Parse CompetitorAnalysis JSON from research response content.
 * Includes fallback extraction and validation.
 */
function parseCompetitorAnalysisJSON(content: string): CompetitorAnalysis {
  // Try to extract JSON from the content
  const jsonString = extractJSON(content);

  if (!jsonString) {
    console.error("[Competitor Research] Failed to extract JSON from response");
    throw new Error("Failed to extract JSON from competitor research response");
  }

  try {
    const parsed = JSON.parse(jsonString);

    // Validate required fields exist
    if (!parsed.competitors || !Array.isArray(parsed.competitors)) {
      throw new Error("Missing or invalid 'competitors' array");
    }
    if (!parsed.creativeLibrary) {
      throw new Error("Missing 'creativeLibrary' object");
    }
    if (!parsed.funnelBreakdown) {
      throw new Error("Missing 'funnelBreakdown' object");
    }
    if (!parsed.gapsAndOpportunities) {
      throw new Error("Missing 'gapsAndOpportunities' object");
    }

    // Ensure arrays have defaults if missing
    return {
      competitors: parsed.competitors.map((c: Record<string, unknown>) => ({
        name: String(c.name || "Unknown"),
        positioning: String(c.positioning || ""),
        offer: String(c.offer || ""),
        price: String(c.price || "Custom pricing"),
        funnels: String(c.funnels || ""),
        adPlatforms: Array.isArray(c.adPlatforms) ? c.adPlatforms : [],
        strengths: Array.isArray(c.strengths) ? c.strengths : [],
        weaknesses: Array.isArray(c.weaknesses) ? c.weaknesses : [],
      })),
      creativeLibrary: {
        adHooks: Array.isArray(parsed.creativeLibrary.adHooks)
          ? parsed.creativeLibrary.adHooks
          : [],
        creativeFormats: {
          ugc: Boolean(parsed.creativeLibrary.creativeFormats?.ugc),
          carousels: Boolean(parsed.creativeLibrary.creativeFormats?.carousels),
          statics: Boolean(parsed.creativeLibrary.creativeFormats?.statics),
          testimonial: Boolean(parsed.creativeLibrary.creativeFormats?.testimonial),
          productDemo: Boolean(parsed.creativeLibrary.creativeFormats?.productDemo),
        },
      },
      funnelBreakdown: {
        landingPagePatterns: Array.isArray(parsed.funnelBreakdown.landingPagePatterns)
          ? parsed.funnelBreakdown.landingPagePatterns
          : [],
        headlineStructure: Array.isArray(parsed.funnelBreakdown.headlineStructure)
          ? parsed.funnelBreakdown.headlineStructure
          : [],
        ctaHierarchy: Array.isArray(parsed.funnelBreakdown.ctaHierarchy)
          ? parsed.funnelBreakdown.ctaHierarchy
          : [],
        socialProofPatterns: Array.isArray(parsed.funnelBreakdown.socialProofPatterns)
          ? parsed.funnelBreakdown.socialProofPatterns
          : [],
        leadCaptureMethods: Array.isArray(parsed.funnelBreakdown.leadCaptureMethods)
          ? parsed.funnelBreakdown.leadCaptureMethods
          : [],
        formFriction: validateFormFriction(parsed.funnelBreakdown.formFriction),
      },
      marketStrengths: Array.isArray(parsed.marketStrengths) ? parsed.marketStrengths : [],
      marketWeaknesses: Array.isArray(parsed.marketWeaknesses) ? parsed.marketWeaknesses : [],
      gapsAndOpportunities: {
        messagingOpportunities: Array.isArray(parsed.gapsAndOpportunities.messagingOpportunities)
          ? parsed.gapsAndOpportunities.messagingOpportunities
          : [],
        creativeOpportunities: Array.isArray(parsed.gapsAndOpportunities.creativeOpportunities)
          ? parsed.gapsAndOpportunities.creativeOpportunities
          : [],
        funnelOpportunities: Array.isArray(parsed.gapsAndOpportunities.funnelOpportunities)
          ? parsed.gapsAndOpportunities.funnelOpportunities
          : [],
      },
    };
  } catch (error) {
    console.error("[Competitor Research] JSON parse error:", error);
    throw new Error(
      `Failed to parse competitor analysis JSON: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Validate formFriction enum value
 */
function validateFormFriction(value: unknown): "low" | "medium" | "high" {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "medium"; // Default
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
