// Competitor Enrichment
// Adds real pricing (Firecrawl) and ad creatives (Ad Library) to competitor data

import { createFirecrawlClient } from '@/lib/firecrawl';
import { createEnhancedAdLibraryService } from '@/lib/ad-library';
import { extractPricing, deduplicatePricingTiers, type ScoredPricingResult, type ExtractedPricingTier } from '@/lib/pricing';
import { mineCompetitorReviews } from './review-mining';
import type { CompetitorReviewData } from '@/lib/strategic-blueprint/output-types';
import type { CompetitorAnalysis } from './schemas';

// =============================================================================
// Types
// =============================================================================

interface PricingTier {
  tier: string;
  price: string;
  description?: string;
  features?: string[];
}

import type { EnrichedAdCreative } from '@/lib/foreplay/types';

interface EnrichedCompetitor {
  name: string;
  website?: string;
  positioning: string;
  offer: string;
  price: string;
  funnels: string;
  adPlatforms: string[];
  strengths: string[];
  weaknesses: string[];
  // Enriched fields
  pricingTiers: PricingTier[];
  pricingSource: 'scraped' | 'unavailable';
  pricingConfidence?: number;
  adCreatives: EnrichedAdCreative[];
  reviewData?: CompetitorReviewData;
  /** Analysis depth: 'full' or 'summary' */
  analysisDepth?: string;
}

// =============================================================================
// Currency Normalization — append (~$X USD) for non-USD pricing
// =============================================================================

/** Approximate conversion rates to USD (updated periodically) */
const APPROXIMATE_USD_RATES: Record<string, number> = {
  'EUR': 1.08,
  'GBP': 1.27,
  'CAD': 0.74,
  'AUD': 0.65,
  'JPY': 0.0067,
  'CHF': 1.13,
  'SEK': 0.095,
  'NOK': 0.093,
  'DKK': 0.145,
  'NZD': 0.60,
  'BRL': 0.17,
  'INR': 0.012,
  'MXN': 0.058,
  'SGD': 0.75,
  'HKD': 0.13,
  'KRW': 0.00074,
  'PLN': 0.25,
  'CZK': 0.043,
  'ZAR': 0.055,
};

/** Map currency symbols to ISO codes */
const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  '£': 'GBP',
  'C$': 'CAD',
  'A$': 'AUD',
  '¥': 'JPY',
  'CHF': 'CHF',
  'kr': 'SEK', // Also NOK/DKK but SEK is most common in SaaS
  'R$': 'BRL',
  '₹': 'INR',
  '₩': 'KRW',
  'zł': 'PLN',
  'Kč': 'CZK',
};

/**
 * Detect the currency of a price string from symbols or explicit codes.
 * Falls back to the extraction-level detected currency if provided.
 */
function detectCurrency(priceStr: string, extractionCurrency?: string): string {
  // Check for multi-char symbols first (C$, A$, R$ before single $)
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (symbol.length > 1 && priceStr.includes(symbol)) return code;
  }
  // Single-char symbols
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (symbol.length === 1 && priceStr.includes(symbol)) return code;
  }
  // Check for explicit ISO currency codes in the string
  const upperPrice = priceStr.toUpperCase();
  for (const code of Object.keys(APPROXIMATE_USD_RATES)) {
    if (upperPrice.includes(code)) return code;
  }
  // Use extraction-level currency if available and not USD
  if (extractionCurrency && extractionCurrency.toUpperCase() !== 'USD') {
    return extractionCurrency.toUpperCase();
  }
  return 'USD';
}

/**
 * If a price string is in a non-USD currency, append an approximate USD equivalent.
 * E.g. "€125/mth" → "€125/mth (~$135 USD)"
 * USD prices are returned unchanged.
 */
function addUsdEquivalent(priceStr: string, extractionCurrency?: string): string {
  const currency = detectCurrency(priceStr, extractionCurrency);
  if (currency === 'USD') return priceStr;

  // Extract the first numeric value from the string
  const numericMatch = priceStr.match(/[\d,]+\.?\d*/);
  if (!numericMatch) return priceStr;

  const numericPrice = parseFloat(numericMatch[0].replace(/,/g, ''));
  const rate = APPROXIMATE_USD_RATES[currency];
  if (!rate || isNaN(numericPrice)) return priceStr;

  const usdEquiv = Math.round(numericPrice * rate);
  return `${priceStr} (~$${usdEquiv} USD)`;
}

const HIGH_RECALL_FETCH_LIMIT = 100;
const MAX_STORED_ADS_PER_COMPETITOR = 50;
const HIGH_RECALL_MIN_RELEVANCE = 60;
const HIGH_RECALL_META_PAGE_LIMIT = 3;
const HIGH_RECALL_FOREPLAY_LOOKBACK_DAYS = 180;
const HIGH_RECALL_COUNTRIES = ['US', 'CA', 'GB', 'AU'];

export interface EnrichmentResult {
  competitors: EnrichedCompetitor[];
  enrichmentCost: number;
  pricingSuccessCount: number;
  adSuccessCount: number;
  reviewSuccessCount: number;
}

// =============================================================================
// Main Enrichment Function
// =============================================================================

/**
 * Enrich competitor data with real pricing and ad creatives
 */
export async function enrichCompetitors(
  baseAnalysis: CompetitorAnalysis,
  onProgress?: (message: string) => void
): Promise<EnrichmentResult> {
  // Only enrich full-tier competitors — summary-tier pass through as-is
  const fullTierCompetitors = baseAnalysis.competitors.filter(c => (c as any).analysisDepth !== 'summary');
  const summaryCompetitors = baseAnalysis.competitors.filter(c => (c as any).analysisDepth === 'summary');

  if (summaryCompetitors.length > 0) {
    onProgress?.(`Enriching ${fullTierCompetitors.length} full-tier competitors (${summaryCompetitors.length} summary skipped)...`);
  }

  const competitors = fullTierCompetitors;
  let enrichmentCost = 0;
  let pricingSuccessCount = 0;
  let adSuccessCount = 0;
  let reviewSuccessCount = 0;

  onProgress?.(`Starting enrichment for ${competitors.length} competitors...`);

  // Initialize clients
  const firecrawlClient = createFirecrawlClient();
  const adLibraryService = createEnhancedAdLibraryService();

  const foreplayAvailable = adLibraryService.isForeplayAvailable();
  console.log(`[Competitor Enrichment] Foreplay available: ${foreplayAvailable}`);

  // Check if Firecrawl is available
  const firecrawlAvailable = firecrawlClient.isAvailable();
  if (!firecrawlAvailable) {
    console.warn('[Competitor Enrichment] FIRECRAWL_API_KEY not configured - skipping pricing scrape');
  }

  // Process each competitor with PARALLEL pricing + ads fetching
  const enrichedCompetitors: EnrichedCompetitor[] = await Promise.all(
    competitors.map(async (competitor) => {
      const enriched: EnrichedCompetitor = {
        ...competitor,
        pricingTiers: [],
        pricingSource: 'unavailable',
        adCreatives: [],
      };

      // =====================================================================
      // PARALLEL: Fetch pricing AND ads simultaneously
      // =====================================================================
      const [pricingResult, adResult, reviewResult] = await Promise.all([
        // Task 1: Scrape Pricing (Firecrawl)
        (async () => {
          if (!firecrawlAvailable || !competitor.website?.trim()) {
            return { success: false as const };
          }
          try {
            onProgress?.(`Scraping pricing for ${competitor.name}...`);
            const pricingUrl = `${competitor.website.replace(/\/$/, '')}/pricing`;
            const scrapeResult = await firecrawlClient.scrape({
              url: pricingUrl,
              timeout: 10000,
              forceUSLocation: true,
            });

            if (scrapeResult.success && scrapeResult.markdown) {
              const extraction: ScoredPricingResult = await extractPricing({
                markdown: scrapeResult.markdown,
                sourceUrl: pricingUrl,
                companyName: competitor.name,
              });

              if (extraction.success && extraction.confidence >= 60) {
                // Deduplicate tiers that share the same plan name (monthly/annual toggle duplicates)
                const dedupedTiers = deduplicatePricingTiers(extraction.tiers);
                // Detect non-USD currency and append approximate USD equivalent
                const detectedCurrency = extraction.currency ?? undefined;
                return {
                  success: true as const,
                  tiers: dedupedTiers.map((t: ExtractedPricingTier) => ({
                    tier: t.tier,
                    price: addUsdEquivalent(t.price, detectedCurrency),
                    description: t.description ?? undefined,
                    features: t.features ?? undefined,
                  })),
                  confidence: extraction.confidence,
                  cost: (extraction.cost ?? 0) + 0.01,
                };
              }
            }
            return { success: false as const, cost: 0.01 };
          } catch (error) {
            console.error(`[Competitor Enrichment] Pricing error for ${competitor.name}:`, error);
            return { success: false as const };
          }
        })(),

        // Task 2: Fetch Ad Creatives (Ad Library) - runs in parallel
        (async () => {
          try {
            onProgress?.(`Fetching ads for ${competitor.name}...`);
            const adResponse = await adLibraryService.fetchAllPlatforms({
              query: competitor.name,
              domain: competitor.website,  // Pass website for domain validation
              limit: HIGH_RECALL_FETCH_LIMIT,
              recallMode: 'high',
              minRelevanceScore: HIGH_RECALL_MIN_RELEVANCE,
              excludeCategories: [],
              includeSubsidiaries: true,
              metaPageLimit: HIGH_RECALL_META_PAGE_LIMIT,
              countries: HIGH_RECALL_COUNTRIES,
              enableForeplayEnrichment: true,
              includeForeplayAsSource: true,
              foreplayDateRange: { from: getDaysAgo(HIGH_RECALL_FOREPLAY_LOOKBACK_DAYS), to: getToday() },
            });

            console.log(`[Competitor Enrichment] ${competitor.name}: Ad response received`, {
              hasAds: !!adResponse.ads,
              adsCount: adResponse.ads?.length ?? 0,
            });

            if (adResponse.ads && adResponse.ads.length > 0) {
              const sourceCounts = adResponse.ads.reduce<Record<string, number>>((acc, ad) => {
                const key = ad.source ?? 'unknown';
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
              }, {});
              const platformCounts = adResponse.ads.reduce<Record<string, number>>((acc, ad) => {
                const key = ad.platform ?? 'unknown';
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
              }, {});

              console.log(`[Competitor Enrichment] ${competitor.name}: Keeping top ${MAX_STORED_ADS_PER_COMPETITOR}/${adResponse.ads.length} ads`, {
                sourceCounts,
                platformCounts,
                searchApiTotal: adResponse.metadata?.searchapi?.total_ads,
                foreplayTotal: adResponse.metadata?.foreplay_source?.total_ads ?? 0,
              });

              return {
                success: true as const,
                ads: adResponse.ads.slice(0, MAX_STORED_ADS_PER_COMPETITOR).map((ad): EnrichedAdCreative => ({
                  id: ad.id,
                  platform: ad.platform,
                  advertiser: ad.advertiser,
                  headline: ad.headline,
                  body: ad.body,
                  imageUrl: ad.imageUrl,
                  videoUrl: ad.videoUrl,
                  format: ad.format || 'image',
                  isActive: ad.isActive ?? true,
                  firstSeen: ad.firstSeen,
                  lastSeen: ad.lastSeen,
                  detailsUrl: ad.detailsUrl,
                  relevance: ad.relevance,
                  rawData: ad.rawData,
                  foreplay: ad.foreplay,
                  source: ad.source,
                })),
              };
            }
            return { success: false as const };
          } catch (error) {
            console.error(`[Competitor Enrichment] Ad fetch error for ${competitor.name}:`, error);
            return { success: false as const };
          }
        })(),

        // Task 3: Review Mining (Trustpilot + G2) - runs in parallel
        (async () => {
          try {
            onProgress?.(`Mining reviews for ${competitor.name}...`);
            const result = await mineCompetitorReviews(
              competitor.name,
              competitor.website,
              onProgress,
              {
                name: competitor.name,
                website: competitor.website,
                positioning: competitor.positioning,
                offer: competitor.offer,
              },
            );
            return { success: true as const, ...result };
          } catch (error) {
            console.error(`[Competitor Enrichment] Review mining error for ${competitor.name}:`, error);
            return { success: false as const, cost: 0 };
          }
        })(),
      ]);

      // Apply results
      if (pricingResult.success) {
        enriched.pricingTiers = pricingResult.tiers;
        enriched.pricingSource = 'scraped';
        enriched.pricingConfidence = pricingResult.confidence;
        enrichmentCost += pricingResult.cost;
        pricingSuccessCount++;
        onProgress?.(`${competitor.name}: Found ${enriched.pricingTiers.length} pricing tiers`);
      } else if (pricingResult.cost) {
        enrichmentCost += pricingResult.cost;
      }

      if (adResult.success) {
        enriched.adCreatives = adResult.ads;
        // Override guessed platforms with actual platforms where we found ads
        const actualPlatforms = [...new Set(adResult.ads.map(ad => ad.platform))];
        enriched.adPlatforms = actualPlatforms.length > 0 ? actualPlatforms : [];
        adSuccessCount++;
        console.log(`[Competitor Enrichment] ${competitor.name}: Stored ${enriched.adCreatives.length} ads`);
        onProgress?.(`${competitor.name}: Found ${enriched.adCreatives.length} ads`);
      } else {
        // No ads found - clear guessed platforms to avoid misleading UI
        enriched.adPlatforms = [];
        console.log(`[Competitor Enrichment] ${competitor.name}: No ads found`);
        onProgress?.(`${competitor.name}: No ads found`);
      }

      if (reviewResult.success) {
        enriched.reviewData = reviewResult.reviewData;
        enrichmentCost += reviewResult.cost;
        reviewSuccessCount++;
        const tp = reviewResult.reviewData.trustpilot;
        const g2 = reviewResult.reviewData.g2;
        const parts: string[] = [];
        if (tp) parts.push(`Trustpilot ${tp.trustScore}/5`);
        if (g2) parts.push(`G2 ${g2.rating}/5`);
        onProgress?.(`${competitor.name}: Reviews found (${parts.join(', ') || 'partial'})`);
      }

      return enriched;
    })
  );

  onProgress?.(`Enrichment complete: ${pricingSuccessCount}/${competitors.length} pricing, ${adSuccessCount}/${competitors.length} ads, ${reviewSuccessCount}/${competitors.length} reviews`);

  // Pass summary-tier competitors through with minimal enriched fields
  const passedThroughSummary: EnrichedCompetitor[] = summaryCompetitors.map(c => ({
    ...c,
    pricingTiers: [],
    pricingSource: 'unavailable' as const,
    adCreatives: [],
    analysisDepth: 'summary',
  }));

  // Merge enriched full-tier + passed-through summary-tier
  const allCompetitors = [...enrichedCompetitors, ...passedThroughSummary];

  // Debug: Log final enriched data
  const totalAdsStored = allCompetitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
  console.log(`[Competitor Enrichment] Final result: ${totalAdsStored} total ads stored across ${allCompetitors.length} competitors (${enrichedCompetitors.length} full + ${passedThroughSummary.length} summary)`);
  enrichedCompetitors.forEach(c => {
    const hasReviews = c.reviewData?.trustpilot || c.reviewData?.g2;
    console.log(`[Competitor Enrichment] - ${c.name}: ${c.adCreatives?.length ?? 0} ads, ${c.pricingTiers?.length ?? 0} pricing tiers, reviews: ${hasReviews ? 'yes' : 'no'}`);
  });

  return {
    competitors: allCompetitors,
    enrichmentCost,
    pricingSuccessCount,
    adSuccessCount,
    reviewSuccessCount,
  };
}

function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, days));
  return d.toISOString().split('T')[0];
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
