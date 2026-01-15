// Competitor Research with Perplexity Deep Research
// Real-time competitor intelligence with web search and citations

import { createResearchAgent } from "@/lib/research";
import { MODELS } from "@/lib/openrouter/client";
import { createAdLibraryService } from "@/lib/ad-library";
import type { AdCreative } from "@/lib/ad-library";
import type { CitedSectionOutput, CompetitorAnalysis, CompetitorSnapshot, PricingTier, CompetitorOffer } from "../output-types";

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
      "website": "string - competitor website URL (e.g. https://competitor.com)",
      "positioning": "string - how they position themselves based on their website/marketing",
      "offer": "string - their main offer/product with actual pricing if found",
      "price": "string - e.g. '$997/mo', '$5,000 one-time', 'Custom pricing'",
      "funnels": "string - e.g. 'Demo call, Free trial' based on their actual website",
      "adPlatforms": ["array of platforms they advertise on - verify from ad libraries"],
      "strengths": ["array of 2-3 verified strengths from reviews/market presence"],
      "weaknesses": ["array of 2-3 weaknesses from reviews/user feedback"],
      "pricingTiers": [
        { "tier": "string e.g. Starter", "price": "string e.g. $99/mo", "features": ["key feature 1", "key feature 2"] }
      ],
      "mainOffer": {
        "headline": "string - primary value proposition from their marketing",
        "valueProposition": "string - what they promise to deliver",
        "cta": "string - common call-to-action pattern"
      }
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
8. IMPORTANT: Search competitor pricing pages for actual pricing tiers (Starter, Pro, Enterprise, etc.)
9. Extract main offer/value proposition from their landing pages and ads

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
    model: MODELS.PERPLEXITY_SONAR,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 8192,
    jsonMode: true,
    timeout: 120000, // 2 minutes for deep research (Phase 11 decision)
  });

  // Parse JSON from research response
  let data = parseCompetitorAnalysisJSON(response.content);

  // Fetch real ads for each competitor (graceful degradation if API key missing)
  let competitorAds = new Map<string, AdCreative[]>();
  try {
    const adService = createAdLibraryService();
    competitorAds = await fetchCompetitorAds(adService, data.competitors);
    console.log(`[Competitor Research] Fetched ads for ${competitorAds.size} competitors`);
  } catch (error) {
    // SEARCHAPI_KEY missing or service creation failed - continue without ads
    console.warn('[Competitor Research] Ad library unavailable, continuing without ads:',
      error instanceof Error ? error.message : 'Unknown error');
  }

  // Merge ads into competitor snapshots
  data = {
    ...data,
    competitors: mergeAdsIntoCompetitors(data.competitors, competitorAds),
  };

  // Log summary of ads fetched
  const totalAds = data.competitors.reduce((sum, c) => sum + (c.adCreatives?.length || 0), 0);
  if (totalAds > 0) {
    console.log(`[Competitor Research] Total ads attached: ${totalAds} across ${data.competitors.length} competitors`);
  }

  return {
    data,
    citations: response.citations,
    model: response.model,
    cost: response.cost.totalCost, // Ad library calls have no additional cost (included in SearchAPI.io subscription)
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
        pricingTiers: parsePricingTiers(c.pricingTiers),
        mainOffer: parseMainOffer(c.mainOffer),
        // adMessagingThemes will be populated from ad analysis later
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

/**
 * Parse pricing tiers from raw competitor data
 */
function parsePricingTiers(raw: unknown): PricingTier[] | undefined {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return undefined;
  }

  const tiers: PricingTier[] = [];
  for (const item of raw) {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      const tier = String(obj.tier || '').trim();
      const price = String(obj.price || '').trim();
      if (tier && price) {
        tiers.push({
          tier,
          price,
          features: Array.isArray(obj.features)
            ? obj.features.filter((f): f is string => typeof f === 'string')
            : undefined,
        });
      }
    }
  }
  return tiers.length > 0 ? tiers : undefined;
}

/**
 * Parse main offer from raw competitor data
 */
function parseMainOffer(raw: unknown): CompetitorOffer | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const obj = raw as Record<string, unknown>;
  const headline = String(obj.headline || '').trim();
  const valueProposition = String(obj.valueProposition || '').trim();
  const cta = String(obj.cta || '').trim();

  // Need at least headline to be useful
  if (!headline) {
    return undefined;
  }

  return {
    headline,
    valueProposition: valueProposition || headline,
    cta: cta || 'Get Started',
  };
}

/**
 * Ad messaging analysis result
 */
interface AdMessagingAnalysis {
  themes: string[];
  commonCTAs: string[];
  priceMentions: string[];
}

/**
 * Analyze ad creatives to extract messaging themes
 */
function analyzeAdMessaging(ads: AdCreative[]): AdMessagingAnalysis {
  if (!ads || ads.length === 0) {
    return { themes: [], commonCTAs: [], priceMentions: [] };
  }

  // Collect all text from ads with type guards
  const allText: string[] = [];
  for (const ad of ads) {
    if (typeof ad.headline === 'string' && ad.headline) {
      allText.push(ad.headline.toLowerCase());
    }
    if (typeof ad.body === 'string' && ad.body) {
      allText.push(ad.body.toLowerCase());
    }
  }

  const fullText = allText.join(' ');

  // Extract recurring words/phrases (simple frequency analysis)
  const wordCounts = new Map<string, number>();
  const meaningfulWords = fullText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));

  for (const word of meaningfulWords) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  // Get words that appear 2+ times as themes
  const themes = Array.from(wordCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // Extract CTAs (common patterns)
  const ctaPatterns = [
    /get started/gi, /sign up/gi, /try free/gi, /learn more/gi,
    /book a demo/gi, /start free/gi, /join now/gi, /contact us/gi,
    /request demo/gi, /free trial/gi, /schedule/gi,
  ];
  const foundCTAs = new Set<string>();
  for (const pattern of ctaPatterns) {
    const matches = fullText.match(pattern);
    if (matches) {
      foundCTAs.add(matches[0].toLowerCase());
    }
  }

  // Extract price mentions
  const pricePattern = /\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year|user|seat))?/gi;
  const priceMentions = [...new Set(fullText.match(pricePattern) || [])];

  return {
    themes,
    commonCTAs: Array.from(foundCTAs),
    priceMentions,
  };
}

/**
 * Extract pricing tiers from ad text mentions
 */
function extractPricingFromText(text: string): PricingTier[] {
  if (!text) return [];

  // Limit input to prevent performance issues with large text
  const safeText = text.length > 50000 ? text.slice(0, 50000) : text;

  const tiers: PricingTier[] = [];

  // Pattern: tier name followed by price
  const tierPricePattern = /(?:(\w+)\s+(?:plan|tier)?[:.]?\s*)?\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year|user|seat))?/gi;
  const matches = safeText.matchAll(tierPricePattern);

  for (const match of matches) {
    const fullMatch = match[0];
    const tierName = match[1];
    const priceMatch = fullMatch.match(/\$[\d,]+(?:\.\d{2})?(?:\s*\/\s*(?:mo|month|yr|year|user|seat))?/i);

    if (priceMatch) {
      tiers.push({
        tier: tierName || 'Standard',
        price: priceMatch[0],
      });
    }
  }

  return tiers;
}

/** Common stop words to filter out from theme analysis */
const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'your', 'have', 'more', 'will', 'what',
  'when', 'which', 'their', 'they', 'been', 'were', 'being', 'other', 'some',
  'than', 'then', 'into', 'only', 'over', 'such', 'make', 'like', 'just',
  'also', 'well', 'very', 'most', 'even', 'back', 'much', 'here', 'take',
  'each', 'where', 'after', 'before', 'about', 'through', 'could', 'should',
]);

// =============================================================================
// Ad Library Integration
// =============================================================================

/**
 * Fetch ads for each competitor from all ad library platforms
 * Service handles rate limiting internally
 */
async function fetchCompetitorAds(
  adService: ReturnType<typeof createAdLibraryService>,
  competitors: CompetitorSnapshot[]
): Promise<Map<string, AdCreative[]>> {
  const adsMap = new Map<string, AdCreative[]>();

  // Fetch ads for each competitor in parallel (service handles rate limiting)
  const fetchPromises = competitors.map(async (competitor) => {
    try {
      const response = await adService.fetchAllPlatforms({
        query: competitor.name,
        limit: 10, // 10 ads per platform max
      });

      // Combine all successful platform results
      const allAds = response.results
        .filter(r => r.success)
        .flatMap(r => r.ads);

      adsMap.set(competitor.name, allAds);
    } catch (error) {
      console.error(`[Competitor Research] Failed to fetch ads for ${competitor.name}:`, error);
      adsMap.set(competitor.name, []);
    }
  });

  await Promise.all(fetchPromises);
  return adsMap;
}

/**
 * Merge fetched ads into competitor snapshots and analyze ad messaging
 */
function mergeAdsIntoCompetitors(
  competitors: CompetitorSnapshot[],
  adsMap: Map<string, AdCreative[]>
): CompetitorSnapshot[] {
  return competitors.map(competitor => {
    const ads = adsMap.get(competitor.name) || [];

    // Analyze ad messaging if we have ads
    let adMessagingThemes: string[] | undefined;
    let enhancedPricingTiers = competitor.pricingTiers;

    if (ads.length > 0) {
      const analysis = analyzeAdMessaging(ads);

      // Use themes if found
      if (analysis.themes.length > 0) {
        adMessagingThemes = analysis.themes;
        console.log(`[Competitor Research] ${competitor.name} - Extracted ${analysis.themes.length} messaging themes from ${ads.length} ads`);
      }

      // Extract and merge price mentions from ads if no pricing tiers from research
      if (!enhancedPricingTiers || enhancedPricingTiers.length === 0) {
        const allAdText = ads
          .map(ad => `${ad.headline || ''} ${ad.body || ''}`)
          .join(' ');
        const extractedTiers = extractPricingFromText(allAdText);
        if (extractedTiers.length > 0) {
          enhancedPricingTiers = extractedTiers;
          console.log(`[Competitor Research] ${competitor.name} - Extracted ${extractedTiers.length} pricing tiers from ad text`);
        }
      }
    }

    return {
      ...competitor,
      adCreatives: ads,
      pricingTiers: enhancedPricingTiers,
      adMessagingThemes,
    };
  });
}
