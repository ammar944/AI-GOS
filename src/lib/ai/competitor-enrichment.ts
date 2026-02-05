// Competitor Enrichment
// Adds real pricing (Firecrawl) and ad creatives (Ad Library) to competitor data

import { createFirecrawlClient } from '@/lib/firecrawl';
import { createEnhancedAdLibraryService } from '@/lib/ad-library';
import { extractPricing, type ScoredPricingResult, type ExtractedPricingTier } from '@/lib/pricing';
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

// Import types for proper carousel compatibility
import type { AdPlatform, AdFormat, AdRelevance } from '@/lib/ad-library/types';
import type { ForeplayEnrichment, AdSource } from '@/lib/foreplay/types';

// AdCreative type matching what the carousel expects
interface AdCreative {
  id: string;
  platform: AdPlatform;
  advertiser?: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  format: AdFormat;
  isActive: boolean;
  firstSeen?: string;
  lastSeen?: string;
  detailsUrl?: string;
  relevance?: AdRelevance;
  foreplay?: ForeplayEnrichment;
  source?: AdSource;
}

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
  adCreatives: AdCreative[];
}

export interface EnrichmentResult {
  competitors: EnrichedCompetitor[];
  enrichmentCost: number;
  pricingSuccessCount: number;
  adSuccessCount: number;
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
  const competitors = baseAnalysis.competitors;
  let enrichmentCost = 0;
  let pricingSuccessCount = 0;
  let adSuccessCount = 0;

  onProgress?.(`Starting enrichment for ${competitors.length} competitors...`);

  // Initialize clients
  const firecrawlClient = createFirecrawlClient();
  const adLibraryService = createEnhancedAdLibraryService();

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
      const [pricingResult, adResult] = await Promise.all([
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
              timeout: 15000, // Reduced from 30s to 15s
              forceUSLocation: true,
            });

            if (scrapeResult.success && scrapeResult.markdown) {
              const extraction: ScoredPricingResult = await extractPricing({
                markdown: scrapeResult.markdown,
                sourceUrl: pricingUrl,
                companyName: competitor.name,
              });

              if (extraction.success && extraction.confidence >= 60) {
                return {
                  success: true as const,
                  tiers: extraction.tiers.map((t: ExtractedPricingTier) => ({
                    tier: t.tier,
                    price: t.price,
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
              limit: 30,  // More candidates before quality filtering (minRelevanceScore: 70 protects quality)
              minRelevanceScore: 70,      // Raised from 60 for stricter filtering
              excludeCategories: ['unclear', 'lead_magnet'],  // Also exclude lead magnets/partnership ads
              includeSubsidiaries: false,  // Don't include subsidiary brand ads
            });

            console.log(`[Competitor Enrichment] ${competitor.name}: Ad response received`, {
              hasAds: !!adResponse.ads,
              adsCount: adResponse.ads?.length ?? 0,
            });

            if (adResponse.ads && adResponse.ads.length > 0) {
              return {
                success: true as const,
                ads: adResponse.ads.slice(0, 10).map((ad): AdCreative => ({
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
                  foreplay: (ad as any).foreplay,
                  source: (ad as any).source,
                })),
              };
            }
            return { success: false as const };
          } catch (error) {
            console.error(`[Competitor Enrichment] Ad fetch error for ${competitor.name}:`, error);
            return { success: false as const };
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

      return enriched;
    })
  );

  onProgress?.(`Enrichment complete: ${pricingSuccessCount}/${competitors.length} pricing, ${adSuccessCount}/${competitors.length} ads`);

  // Debug: Log final enriched data
  const totalAdsStored = enrichedCompetitors.reduce((sum, c) => sum + (c.adCreatives?.length ?? 0), 0);
  console.log(`[Competitor Enrichment] Final result: ${totalAdsStored} total ads stored across ${enrichedCompetitors.length} competitors`);
  enrichedCompetitors.forEach(c => {
    console.log(`[Competitor Enrichment] - ${c.name}: ${c.adCreatives?.length ?? 0} ads, ${c.pricingTiers?.length ?? 0} pricing tiers`);
  });

  return {
    competitors: enrichedCompetitors,
    enrichmentCost,
    pricingSuccessCount,
    adSuccessCount,
  };
}
