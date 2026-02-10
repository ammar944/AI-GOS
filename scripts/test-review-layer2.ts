// Test Layer 1 (Perplexity) on NICHE SaaS + Layer 2 (Firecrawl) on actual review pages
// Goal: Does Perplexity work for obscure companies? Does Firecrawl add real value on top?

import { createPerplexity } from '@ai-sdk/perplexity';
import Firecrawl from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { z } from 'zod';

const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY });
const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

// Same schema as before
const reviewMiningSchema = z.object({
  competitor: z.string(),
  platforms: z.array(z.object({
    platform: z.enum(['G2', 'Capterra', 'Trustpilot', 'other']),
    url: z.string().optional(),
    overallRating: z.number().optional(),
    totalReviews: z.number().optional(),
  })),
  topComplaints: z.array(z.object({
    complaint: z.string(),
    frequency: z.enum(['very_common', 'common', 'occasional']),
    source: z.string(),
  })).min(1).max(8),
  topPraises: z.array(z.object({
    praise: z.string(),
    source: z.string(),
  })).min(1).max(5),
  sentimentSummary: z.string(),
  quotableComplaints: z.array(z.string()),
  quotablePraises: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
});

// ============================================================
// TEST 1: Perplexity on NICHE SaaS (Lemlist - cold outreach tool)
// ============================================================
async function testPerplexityNiche() {
  const competitor = 'Lemlist'; // Niche cold email SaaS
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST 1: Perplexity → NICHE SaaS: "${competitor}"`);
  console.log('='.repeat(60));

  const start = Date.now();
  try {
    const result = await generateObject({
      model: perplexity('sonar-pro'),
      schema: reviewMiningSchema,
      temperature: 0.3,
      maxTokens: 4096,
      system: `You are a competitive intelligence analyst researching customer reviews for SaaS products.

CRITICAL RULES:
- ONLY report data you can actually find on G2, Capterra, Trustpilot, or similar review platforms
- DO NOT fabricate or guess review content. If you cannot find reviews, say so.
- Ratings must come from actual review platform data, not your assumptions
- For quotes: only include text you can attribute to an actual review. If unsure, use "none found"
- Include the direct URL to the review page when you find it`,
      prompt: `Search for customer reviews of "${competitor}" (cold email outreach SaaS tool) on G2, Capterra, and Trustpilot.

Search for:
1. "${competitor} G2 reviews"
2. "${competitor} Capterra reviews"
3. "${competitor} Trustpilot reviews"
4. "${competitor} customer complaints"

Extract ratings, top complaints, top praises, and direct quotes. Be honest about what you can and cannot find.`,
    });

    console.log(`Time: ${Date.now() - start}ms`);
    console.log(JSON.stringify(result.object, null, 2));
  } catch (e) {
    console.error(`Error:`, e);
  }
}

// ============================================================
// TEST 2: Perplexity on VERY NICHE SaaS (Instantly.ai - even smaller)
// ============================================================
async function testPerplexityVeryNiche() {
  const competitor = 'Instantly.ai'; // Very niche cold outreach
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST 2: Perplexity → VERY NICHE SaaS: "${competitor}"`);
  console.log('='.repeat(60));

  const start = Date.now();
  try {
    const result = await generateObject({
      model: perplexity('sonar-pro'),
      schema: reviewMiningSchema,
      temperature: 0.3,
      maxTokens: 4096,
      system: `You are a competitive intelligence analyst researching customer reviews for SaaS products.

CRITICAL RULES:
- ONLY report data you can actually find on G2, Capterra, Trustpilot, or similar review platforms
- DO NOT fabricate or guess review content. If you cannot find reviews, say so.
- Ratings must come from actual review platform data, not your assumptions
- For quotes: only include text you can attribute to an actual review. If unsure, use "none found"
- Include the direct URL to the review page when you find it`,
      prompt: `Search for customer reviews of "${competitor}" (cold email outreach and deliverability SaaS) on G2, Capterra, and Trustpilot.

Search for:
1. "${competitor} G2 reviews"
2. "${competitor} Capterra reviews"
3. "${competitor} Trustpilot reviews"
4. "${competitor} customer complaints"

Extract ratings, top complaints, top praises, and direct quotes. Be honest about what you can and cannot find.`,
    });

    console.log(`Time: ${Date.now() - start}ms`);
    console.log(JSON.stringify(result.object, null, 2));
  } catch (e) {
    console.error(`Error:`, e);
  }
}

// ============================================================
// TEST 3: Firecrawl scrape actual G2 review page (HubSpot - known URL)
// ============================================================
async function testFirecrawlG2() {
  const url = 'https://www.g2.com/products/hubspot-sales-hub/reviews';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST 3: Firecrawl → G2 review page: ${url}`);
  console.log('='.repeat(60));

  const start = Date.now();
  try {
    const doc = await firecrawl.scrape(url, {
      formats: ['markdown'],
    });

    const markdown = doc.markdown ?? '';
    console.log(`Time: ${Date.now() - start}ms`);
    console.log(`Markdown length: ${markdown.length} chars`);
    console.log(`Word count: ${markdown.split(/\s+/).length}`);
    console.log(`\nFirst 3000 chars:\n${markdown.slice(0, 3000)}`);
    console.log(`\n... (truncated) ...\n`);
    console.log(`Last 1000 chars:\n${markdown.slice(-1000)}`);
  } catch (e) {
    console.error(`Error:`, e);
  }
}

// ============================================================
// TEST 4: Firecrawl scrape Trustpilot review page
// ============================================================
async function testFirecrawlTrustpilot() {
  const url = 'https://www.trustpilot.com/review/hubspot.com';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST 4: Firecrawl → Trustpilot page: ${url}`);
  console.log('='.repeat(60));

  const start = Date.now();
  try {
    const doc = await firecrawl.scrape(url, {
      formats: ['markdown'],
    });

    const markdown = doc.markdown ?? '';
    console.log(`Time: ${Date.now() - start}ms`);
    console.log(`Markdown length: ${markdown.length} chars`);
    console.log(`Word count: ${markdown.split(/\s+/).length}`);
    console.log(`\nFirst 3000 chars:\n${markdown.slice(0, 3000)}`);
    console.log(`\n... (truncated) ...\n`);
    console.log(`Last 1000 chars:\n${markdown.slice(-1000)}`);
  } catch (e) {
    console.error(`Error:`, e);
  }
}

async function main() {
  // Run Perplexity tests in parallel (they're independent)
  // Run Firecrawl tests sequentially (share concurrency limits)

  console.log('Starting all tests...\n');

  const [, ,] = await Promise.all([
    testPerplexityNiche(),
    testPerplexityVeryNiche(),
    // Firecrawl tests sequential within their own chain
    (async () => {
      await testFirecrawlG2();
      await testFirecrawlTrustpilot();
    })(),
  ]);

  console.log('\n\nAll tests complete.');
}

main().catch(console.error);
