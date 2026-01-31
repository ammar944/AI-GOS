#!/usr/bin/env npx tsx

/**
 * Test Script: Competitor Pricing Scraper
 *
 * This script tests our pricing extraction pipeline:
 * 1. Sitemap discovery → fallback to common paths
 * 2. Firecrawl scraping (handles JS rendering)
 * 3. LLM extraction with Gemini Flash
 * 4. Validation with source quotes
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/test-pricing-scraper.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local if it exists
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex);
        const value = trimmed.slice(eqIndex + 1).replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch {
  // .env.local doesn't exist, that's ok
}

import { createFirecrawlClient } from '@/lib/firecrawl/client';
import { extractPricing } from '@/lib/pricing/extraction';
import { 
  filterRelevantPricing, 
  groupByRelevanceCategory,
  type ScoredPricingTier 
} from '@/lib/pricing/relevance-scorer';
import type { ScoredPricingResult } from '@/lib/pricing/types';

// ============================================================================
// Types
// ============================================================================

interface Competitor {
  name: string;
  website: string;
}

interface PricingTestResult {
  competitor: Competitor;
  pricingUrl: string | null;
  discoveryMethod: 'sitemap' | 'common-path' | 'direct' | 'failed';
  scrapedContentLength: number;
  extractionResult: ScoredPricingResult | null;
  /** Tiers filtered by relevance scoring */
  relevantTiers: ScoredPricingTier[];
  /** All tiers with relevance scores */
  allScoredTiers: ScoredPricingTier[];
  error?: string;
  durationMs: number;
}

// ============================================================================
// Test Competitors
// ============================================================================

const TEST_COMPETITORS: Competitor[] = [
  { name: 'Notion', website: 'https://notion.so' },
  { name: 'Linear', website: 'https://linear.app' },
  { name: 'Vercel', website: 'https://vercel.com' },
  { name: 'Supabase', website: 'https://supabase.com' },
  { name: 'Stripe', website: 'https://stripe.com' },
  { name: 'Figma', website: 'https://figma.com' },
];

// Common pricing page paths to try
const PRICING_PATHS = ['/pricing', '/plans', '/price', '/buy', '/pricing-plans'];

// ============================================================================
// Sitemap Discovery
// ============================================================================

async function findPricingUrlFromSitemap(baseUrl: string): Promise<string | null> {
  const sitemapUrls = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap-0.xml`,
  ];

  // Paths to exclude (tutorials, docs, etc.)
  const EXCLUDE_PATHS = [
    '/blog', '/help', '/docs', '/academy', '/learn', '/guide',
    '/tutorial', '/article', '/support', '/faq', '/changelog',
    '/templates', '/examples', '/community', '/resources'
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`    📍 Trying sitemap: ${sitemapUrl}`);
      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PricingBot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const xml = await response.text();

      // Parse sitemap XML for pricing-related URLs
      const urlMatches = xml.match(/<loc>(.*?)<\/loc>/gi);
      if (!urlMatches) continue;

      // Collect all potential pricing URLs and score them
      const pricingCandidates: Array<{ url: string; score: number }> = [];

      for (const match of urlMatches) {
        const url = match.replace(/<\/?loc>/gi, '');
        const lowerUrl = url.toLowerCase();

        // Skip excluded paths
        if (EXCLUDE_PATHS.some(path => lowerUrl.includes(path))) {
          continue;
        }

        // Check for pricing-related paths
        if (
          lowerUrl.includes('/pricing') ||
          lowerUrl.includes('/plans') ||
          lowerUrl.includes('/price')
        ) {
          // Score by URL simplicity (prefer shorter, simpler paths)
          const pathDepth = (url.match(/\//g) || []).length;
          const score = 100 - pathDepth * 10; // Simpler URLs score higher
          
          // Bonus for exact match like /pricing
          if (lowerUrl.endsWith('/pricing') || lowerUrl.endsWith('/pricing/')) {
            pricingCandidates.push({ url, score: score + 50 });
          } else if (lowerUrl.endsWith('/plans') || lowerUrl.endsWith('/plans/')) {
            pricingCandidates.push({ url, score: score + 40 });
          } else {
            pricingCandidates.push({ url, score });
          }
        }
      }

      // Return the best scoring URL
      if (pricingCandidates.length > 0) {
        pricingCandidates.sort((a, b) => b.score - a.score);
        const bestUrl = pricingCandidates[0].url;
        console.log(`    ✅ Found pricing URL in sitemap: ${bestUrl}`);
        return bestUrl;
      }
    } catch (e) {
      // Sitemap not found or failed, continue to next
    }
  }

  return null;
}

// ============================================================================
// Common Path Discovery
// ============================================================================

async function findPricingUrlFromCommonPaths(baseUrl: string): Promise<string | null> {
  console.log(`    📍 Trying common pricing paths...`);

  for (const path of PRICING_PATHS) {
    const url = `${baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PricingBot/1.0)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        console.log(`    ✅ Found pricing page at: ${url}`);
        return url;
      }
    } catch (e) {
      // Path doesn't exist, try next
    }
  }

  return null;
}

// ============================================================================
// Main Test Function
// ============================================================================

async function testCompetitor(competitor: Competitor): Promise<PricingTestResult> {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 Testing: ${competitor.name} (${competitor.website})`);
  console.log('='.repeat(60));

  const result: PricingTestResult = {
    competitor,
    pricingUrl: null,
    discoveryMethod: 'failed',
    scrapedContentLength: 0,
    extractionResult: null,
    relevantTiers: [],
    allScoredTiers: [],
    durationMs: 0,
  };

  try {
    // Step 1: Discover pricing URL
    console.log('\n  📌 Step 1: Discovering pricing URL...');

    // Try sitemap first
    let pricingUrl = await findPricingUrlFromSitemap(competitor.website);
    if (pricingUrl) {
      result.discoveryMethod = 'sitemap';
    } else {
      // Fallback to common paths
      pricingUrl = await findPricingUrlFromCommonPaths(competitor.website);
      if (pricingUrl) {
        result.discoveryMethod = 'common-path';
      }
    }

    if (!pricingUrl) {
      result.error = 'Could not discover pricing URL';
      result.durationMs = Date.now() - startTime;
      console.log('  ❌ Could not find pricing page');
      return result;
    }

    result.pricingUrl = pricingUrl;
    console.log(`  ✅ Pricing URL: ${pricingUrl} (via ${result.discoveryMethod})`);

    // Step 2: Scrape pricing page with Firecrawl
    console.log('\n  📌 Step 2: Scraping pricing page with Firecrawl...');

    const firecrawl = createFirecrawlClient();

    if (!firecrawl.isAvailable()) {
      result.error = 'Firecrawl API key not configured';
      result.durationMs = Date.now() - startTime;
      console.log('  ❌ Firecrawl not available');
      return result;
    }

    const scrapeResult = await firecrawl.scrape({
      url: pricingUrl,
      timeout: 30000,
    });

    if (!scrapeResult.success || !scrapeResult.markdown) {
      result.error = `Scraping failed: ${scrapeResult.error}`;
      result.durationMs = Date.now() - startTime;
      console.log(`  ❌ Scraping failed: ${scrapeResult.error}`);
      return result;
    }

    result.scrapedContentLength = scrapeResult.markdown.length;
    console.log(`  ✅ Scraped ${scrapeResult.markdown.length} characters`);

    // Log a preview of the content
    const preview = scrapeResult.markdown.slice(0, 500).replace(/\n/g, ' ').trim();
    console.log(`  📄 Preview: ${preview}...`);

    // Step 3: Extract pricing with LLM
    console.log('\n  📌 Step 3: Extracting pricing with Gemini Flash...');

    const extractionResult = await extractPricing({
      markdown: scrapeResult.markdown,
      sourceUrl: pricingUrl,
      companyName: competitor.name,
      timeout: 45000,
    });

    result.extractionResult = extractionResult;
    result.durationMs = Date.now() - startTime;

    // Log extraction results
    if (extractionResult.success && extractionResult.tiers.length > 0) {
      console.log(`  ✅ Extracted ${extractionResult.tiers.length} pricing tiers`);
      console.log(`  📊 Confidence: ${extractionResult.confidence}% (${extractionResult.confidenceLevel})`);
      console.log(`  💰 LLM Cost: $${extractionResult.cost.toFixed(4)}`);

      // Step 4: Apply relevance scoring
      console.log('\n  📌 Step 4: Scoring tier relevance...');
      
      const relevantTiers = filterRelevantPricing(extractionResult.tiers, {
        competitorName: competitor.name,
        competitorUrl: competitor.website,
        minScore: 50,
        includeAddOns: true,
      });
      
      result.relevantTiers = relevantTiers.filter(t => t.relevance?.category === 'core_product');
      result.allScoredTiers = relevantTiers;
      
      // Group by category
      const grouped = groupByRelevanceCategory(relevantTiers);
      
      console.log(`  ✅ Relevance scoring complete`);
      console.log(`    - Core product tiers: ${grouped.core_product.length}`);
      console.log(`    - Add-ons: ${grouped.add_on.length}`);
      console.log(`    - Different products: ${grouped.different_product.length}`);
      console.log(`    - Unclear: ${grouped.unclear.length}`);

      console.log('\n  📋 Pricing Tiers (with relevance):');
      for (const tier of relevantTiers) {
        const rel = tier.relevance;
        const categoryIcon = {
          core_product: '🎯',
          add_on: '➕',
          different_product: '🔀',
          unclear: '❓',
        }[rel?.category ?? 'unclear'];
        
        console.log(`    ${categoryIcon} ${tier.tier}: ${tier.price}`);
        console.log(`    │  └─ Relevance: ${rel?.score ?? 0}% (${rel?.category ?? 'unknown'})`);
        if (rel?.signals && rel.signals.length > 0) {
          console.log(`    │  └─ Signals: ${rel.signals.slice(0, 2).join(', ')}`);
        }
        if (tier.description) {
          console.log(`    │  └─ ${tier.description.slice(0, 60)}...`);
        }
      }

      if (extractionResult.hasCustomPricing) {
        console.log('    └─ ⚡ Custom/Enterprise pricing available');
      }

      if (extractionResult.currency) {
        console.log(`    └─ 💵 Currency: ${extractionResult.currency}`);
      }

      if (extractionResult.billingPeriod) {
        console.log(`    └─ 📅 Billing: ${extractionResult.billingPeriod}`);
      }
    } else {
      console.log(`  ⚠️ Extraction ${extractionResult.success ? 'succeeded but found 0 tiers' : 'failed'}`);
      if (extractionResult.error) {
        console.log(`  ❌ Error: ${extractionResult.error}`);
      }
    }

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.durationMs = Date.now() - startTime;
    console.log(`  ❌ Error: ${result.error}`);
    return result;
  }
}

// ============================================================================
// Summary & Validation
// ============================================================================

function printSummary(results: PricingTestResult[]): void {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));

  const successful = results.filter(
    (r) => r.extractionResult?.success && r.extractionResult.tiers.length > 0
  );
  const failed = results.filter(
    (r) => !r.extractionResult?.success || r.extractionResult.tiers.length === 0
  );

  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  // Accuracy breakdown
  console.log('\n📋 Results by Competitor:');
  console.log('-'.repeat(80));

  for (const result of results) {
    const status = result.extractionResult?.success && result.extractionResult.tiers.length > 0
      ? '✅'
      : '❌';
    const totalTiers = result.extractionResult?.tiers.length ?? 0;
    const coreTiers = result.relevantTiers.length;
    const confidence = result.extractionResult?.confidence ?? 0;

    console.log(
      `${status} ${result.competitor.name.padEnd(12)} | ` +
      `Tiers: ${String(totalTiers).padStart(2)} (${coreTiers} core) | ` +
      `Confidence: ${String(confidence).padStart(3)}% | ` +
      `Method: ${(result.discoveryMethod || 'N/A').padEnd(11)} | ` +
      `Time: ${(result.durationMs / 1000).toFixed(1)}s`
    );

    if (result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
  }

  // Total cost
  const totalCost = results.reduce(
    (sum, r) => sum + (r.extractionResult?.cost ?? 0),
    0
  );
  console.log(`\n💰 Total LLM Cost: $${totalCost.toFixed(4)}`);

  // Validation notes
  console.log('\n📝 VALIDATION NOTES:');
  console.log('-'.repeat(80));
  console.log('Please manually verify these results against actual pricing pages:');

  for (const result of successful) {
    if (result.pricingUrl && result.extractionResult) {
      console.log(`\n${result.competitor.name}:`);
      console.log(`  URL: ${result.pricingUrl}`);
      console.log(`  Core product tiers (relevance-filtered):`);
      if (result.relevantTiers.length > 0) {
        for (const tier of result.relevantTiers) {
          console.log(`    🎯 ${tier.tier}: ${tier.price} (${tier.relevance?.score ?? 0}%)`);
        }
      } else {
        console.log('    (no core product tiers identified)');
      }
      
      // Show filtered-out tiers
      const filteredOut = result.allScoredTiers.filter(
        t => t.relevance?.category !== 'core_product'
      );
      if (filteredOut.length > 0) {
        console.log(`  Filtered out (add-ons/different products):`);
        for (const tier of filteredOut) {
          const icon = tier.relevance?.category === 'add_on' ? '➕' : 
                       tier.relevance?.category === 'different_product' ? '🔀' : '❓';
          console.log(`    ${icon} ${tier.tier}: ${tier.price} (${tier.relevance?.category})`);
        }
      }
    }
  }

  // Recommendations
  console.log('\n\n🎯 RECOMMENDATIONS:');
  console.log('-'.repeat(80));

  if (failed.length > 0) {
    console.log('Failed competitors need investigation:');
    for (const result of failed) {
      console.log(`  - ${result.competitor.name}: ${result.error || 'No tiers extracted'}`);
    }
  }

  const lowConfidence = results.filter(
    (r) => r.extractionResult && r.extractionResult.confidence < 70
  );
  if (lowConfidence.length > 0) {
    console.log('\nLow confidence extractions (< 70%):');
    for (const result of lowConfidence) {
      console.log(
        `  - ${result.competitor.name}: ${result.extractionResult?.confidence}%`
      );
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('🚀 Starting Competitor Pricing Scraper Test');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`🎯 Testing ${TEST_COMPETITORS.length} competitors\n`);

  // Check Firecrawl availability
  const firecrawl = createFirecrawlClient();
  if (!firecrawl.isAvailable()) {
    console.error('❌ FIRECRAWL_API_KEY not configured in environment');
    process.exit(1);
  }
  console.log('✅ Firecrawl API key configured');

  // Check OpenRouter availability
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not configured in environment');
    process.exit(1);
  }
  console.log('✅ OpenRouter API key configured');

  const results: PricingTestResult[] = [];

  // Test each competitor sequentially (to respect rate limits)
  for (const competitor of TEST_COMPETITORS) {
    const result = await testCompetitor(competitor);
    results.push(result);

    // Small delay between competitors to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Print summary
  printSummary(results);

  // Exit with error code if any failed
  const failedCount = results.filter(
    (r) => !r.extractionResult?.success || r.extractionResult.tiers.length === 0
  ).length;

  if (failedCount > 0) {
    console.log(`\n⚠️ ${failedCount} competitor(s) failed extraction`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
