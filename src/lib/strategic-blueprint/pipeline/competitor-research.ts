// Competitor Research with Perplexity Deep Research
// Real-time competitor intelligence with web search and citations

import { createResearchAgent } from "@/lib/research";
import { MODELS } from "@/lib/openrouter/client";
import { createEnhancedAdLibraryService, assessAdRelevance } from "@/lib/ad-library";
import type { AdCreative } from "@/lib/ad-library";
import type { EnrichedAdCreative } from "@/lib/foreplay/types";
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
        {
          "tier": "string e.g. Starter, Pro, Enterprise",
          "price": "string e.g. $99/mo, $299/mo, Custom pricing",
          "description": "string - brief summary of what this tier includes, e.g. 'Essential analytics for small teams'",
          "targetAudience": "string - who this tier is for, e.g. 'Small teams', 'Growing businesses', 'Enterprise companies'",
          "features": ["array of 3-5 specific features included, e.g. 'Multi-touch attribution', 'CRM integration', 'Custom reports'"],
          "limitations": "string - usage limits if any, e.g. 'Up to 5 users, 10K contacts/mo'"
        }
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
8. CRITICAL - PRICING TIER EXTRACTION: Visit competitor pricing pages and extract:
   - All tier names (e.g., Free, Starter, Pro, Enterprise)
   - Exact prices or "Custom pricing" if applicable
   - Description of what each tier offers
   - Target audience for each tier (who it's designed for)
   - 3-5 KEY FEATURES per tier that differentiate it from other tiers
   - Any usage limitations (users, contacts, API calls, etc.)
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

  // Fetch real ads for each competitor with Foreplay enrichment (graceful degradation if API key missing)
  let competitorAds = new Map<string, EnrichedAdCreative[]>();
  try {
    const adService = createEnhancedAdLibraryService();
    competitorAds = await fetchCompetitorAds(adService, data.competitors);
    console.log(`[Competitor Research] Fetched ads for ${competitorAds.size} competitors`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Differentiate between missing API key (expected) vs actual errors (unexpected)
    if (errorMessage.includes('SEARCHAPI_KEY') || errorMessage.includes('Environment variable')) {
      // Expected: API key not configured - this is fine, just skip ad library
      console.info('[Competitor Research] SEARCHAPI_KEY not configured - skipping ad library search');
    } else {
      // Unexpected error - log as error for investigation but continue
      console.error('[Competitor Research] Ad library search failed:', errorMessage);
    }
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
        website: c.website ? String(c.website) : undefined,
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
          description: typeof obj.description === 'string' ? obj.description.trim() : undefined,
          targetAudience: typeof obj.targetAudience === 'string' ? obj.targetAudience.trim() : undefined,
          features: Array.isArray(obj.features)
            ? obj.features.filter((f): f is string => typeof f === 'string')
            : undefined,
          limitations: typeof obj.limitations === 'string' ? obj.limitations.trim() : undefined,
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
 * Fetch ads for each competitor from all ad library platforms with Foreplay enrichment
 *
 * Uses EnhancedAdLibraryService which:
 * 1. Fetches ads from SearchAPI (LinkedIn, Meta, Google)
 * 2. Enriches with Foreplay intelligence (transcripts, hooks, emotional analysis)
 * 3. Optionally includes Foreplay as additional ad source
 */
async function fetchCompetitorAds(
  adService: ReturnType<typeof createEnhancedAdLibraryService>,
  competitors: CompetitorSnapshot[]
): Promise<Map<string, EnrichedAdCreative[]>> {
  const adsMap = new Map<string, EnrichedAdCreative[]>();

  // Calculate date range for Foreplay (last 90 days)
  const dateRange = {
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  };

  // Fetch ads for each competitor in parallel
  // Each competitor gets its own request context (no shared state)
  const fetchPromises = competitors.map(async (competitor) => {
    try {
      // Extract domain from website URL if available
      const domain = extractDomainFromURL(competitor.website);

      // Extract clean company name from domain for better search results
      // This matches the test environment approach: "dreamdata" from "dreamdata.io"
      // Using domain-based extraction avoids false positives from partial name matches
      // (e.g., "Windsor.ai" would match "Windsor Airport Limo" but "windsor" from domain won't)
      const companyName = domain
        ? domain.split('.')[0]
        : competitor.name.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Use enhanced service with Foreplay enrichment AND Foreplay as ad source
      const response = await adService.fetchAllPlatforms({
        query: companyName,
        domain, // Pass domain for better Google Ads filtering and validation
        limit: 10, // 10 ads per platform max
        enableForeplayEnrichment: true, // Enrich with transcripts, hooks, emotional analysis
        includeForeplayAsSource: true, // Also fetch unique historical ads from Foreplay database
        foreplayDateRange: dateRange,
        maxEnrichments: 10, // Control costs - max 10 ads enriched per competitor
      });

      // Enhanced service returns ads directly (not results array)
      const allAds = response.ads;

      adsMap.set(competitor.name, allAds);

      // Log summary for this competitor
      console.log(
        `[Competitor Research] ${competitor.name}: Searched "${companyName}" (domain: ${domain || 'none'}) → Found ${allAds.length} ads`
      );
      if (allAds.length > 0) {
        const enrichedCount = allAds.filter(ad => ad.foreplay).length;
        const uniqueAdvertisers = [...new Set(allAds.map(ad => ad.advertiser))];
        console.log(
          `[Competitor Research] ${competitor.name}: ${enrichedCount} enriched, advertisers: [${uniqueAdvertisers.join(', ')}]`
        );
      }
    } catch (error) {
      console.error(`[Competitor Research] Failed to fetch ads for ${competitor.name}:`, error);
      adsMap.set(competitor.name, []);
    }
  });

  await Promise.all(fetchPromises);
  return adsMap;
}

/**
 * Extract domain from a full URL
 * Example: "https://www.tesla.com/about" → "tesla.com"
 */
function extractDomainFromURL(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    // If URL doesn't have protocol, add it
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(urlWithProtocol);

    // Remove www prefix if present
    let hostname = parsed.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }

    return hostname;
  } catch {
    // If URL parsing fails, try basic extraction
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/);
    return match ? match[1] : undefined;
  }
}

/**
 * Merge fetched ads into competitor snapshots and analyze ad messaging
 * Applies relevance scoring to each ad to help identify cross-brand contamination
 * and lead magnet ads that may not directly relate to the competitor's core product
 * Includes Foreplay enrichment data when available (transcripts, hooks, emotional analysis)
 */
function mergeAdsIntoCompetitors(
  competitors: CompetitorSnapshot[],
  adsMap: Map<string, EnrichedAdCreative[]>
): CompetitorSnapshot[] {
  return competitors.map(competitor => {
    const rawAds = adsMap.get(competitor.name) || [];

    // Extract domain for relevance scoring
    const domain = extractDomainFromURL(competitor.website);

    // Apply relevance scoring to each ad
    // This helps identify:
    // - Direct ads (clearly from this competitor)
    // - Lead magnets (educational content like books, webinars)
    // - Subsidiary/related brand ads (e.g., Slack for Salesforce)
    // - Unclear matches (may be API false positives)
    const scoredAds = rawAds.map(ad => ({
      ...ad,
      relevance: ad.relevance ?? assessAdRelevance(ad, competitor.name, domain),
    }));

    // Filter out ads with very low relevance (< 40 score)
    // These are likely false positives from the ad library API
    // e.g., "Windsor Airport Limo" for "Windsor.ai" search
    const MIN_RELEVANCE_SCORE = 40;
    const ads = scoredAds.filter(ad => (ad.relevance?.score ?? 50) >= MIN_RELEVANCE_SCORE);

    // Log filtered ads count
    const filteredCount = scoredAds.length - ads.length;
    if (filteredCount > 0) {
      const filteredAdvertisers = scoredAds
        .filter(ad => (ad.relevance?.score ?? 50) < MIN_RELEVANCE_SCORE)
        .map(ad => `${ad.advertiser} (${ad.relevance?.score ?? 0})`);
      console.log(
        `[Competitor Research] ${competitor.name}: Filtered out ${filteredCount} low-relevance ads: [${filteredAdvertisers.join(', ')}]`
      );
    }

    // Sort by relevance score (highest first)
    ads.sort((a, b) => (b.relevance?.score ?? 50) - (a.relevance?.score ?? 50));

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

      // Log relevance scoring summary
      const highRelevance = ads.filter(a => (a.relevance?.score ?? 0) >= 70).length;
      const lowRelevance = ads.filter(a => (a.relevance?.score ?? 0) < 40).length;
      if (lowRelevance > 0) {
        console.log(`[Competitor Research] ${competitor.name} - Relevance: ${highRelevance} high, ${lowRelevance} low (may need manual review)`);
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
