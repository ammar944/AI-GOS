// Ground Truth Review Mining Test
// Layer 1: Perplexity discovers review page URLs ONLY (no summaries, no quotes)
// Layer 2: Firecrawl scrapes Trustpilot for raw reviews + uses extract() for structured data

import { createPerplexity } from '@ai-sdk/perplexity';
import Firecrawl from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { z } from 'zod';

const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY });
const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

// ============================================================
// LAYER 1 SCHEMA: URL Discovery Only — no opinions, no quotes
// ============================================================
const urlDiscoverySchema = z.object({
  competitor: z.string(),
  reviewPages: z.array(z.object({
    platform: z.enum(['G2', 'Capterra', 'Trustpilot']),
    url: z.string().describe('Direct URL to the review listing page. MUST be a real URL you found, not constructed. If not found, use "not_found"'),
    found: z.boolean().describe('true ONLY if you found an actual review page URL'),
  })),
  trustpilotDomain: z.string().optional().describe('The domain used on Trustpilot (e.g. "hubspot.com"). Only if found.'),
  g2Slug: z.string().optional().describe('The G2 product slug (e.g. "hubspot-sales-hub"). Only if found.'),
});

// ============================================================
// LAYER 2 SCHEMA: Structured review extraction from scraped markdown
// ============================================================
const trustpilotExtractSchema = z.object({
  companyName: z.string(),
  trustScore: z.number().optional().describe('TrustScore rating out of 5'),
  totalReviews: z.number().optional().describe('Total number of reviews'),
  ratingDistribution: z.object({
    fiveStar: z.number().optional(),
    fourStar: z.number().optional(),
    threeStar: z.number().optional(),
    twoStar: z.number().optional(),
    oneStar: z.number().optional(),
  }).optional(),
  reviews: z.array(z.object({
    rating: z.number().describe('Star rating 1-5'),
    title: z.string().optional(),
    text: z.string().describe('Full review text'),
    date: z.string().optional(),
    reviewer: z.string().optional(),
    verified: z.boolean().optional(),
  })).describe('Individual reviews found on the page'),
  aiSummary: z.string().optional().describe('Trustpilot\'s own AI-generated review summary if present on the page'),
});

// ============================================================
// TEST: Full ground truth pipeline
// ============================================================
async function testGroundTruthPipeline(competitorName: string, competitorDomain?: string) {
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`# GROUND TRUTH PIPELINE: ${competitorName}`);
  console.log('#'.repeat(70));

  // ---- LAYER 1: Perplexity URL Discovery ----
  console.log(`\n--- LAYER 1: Perplexity URL Discovery ---`);
  const l1Start = Date.now();

  let discovery;
  try {
    const result = await generateObject({
      model: perplexity('sonar-pro'),
      schema: urlDiscoverySchema,
      temperature: 0.1, // Low temp for factual lookup
      maxTokens: 1024,
      system: `You are a research assistant that finds review page URLs.

RULES:
- Your ONLY job is to find the direct URLs to review pages on G2, Capterra, and Trustpilot
- DO NOT summarize reviews, extract quotes, or provide ratings
- DO NOT construct or guess URLs — only return URLs you actually found in search results
- If you cannot find a review page for a platform, set found: false
- For Trustpilot, also extract the domain they use (e.g. "hubspot.com")
- For G2, also extract the product slug (e.g. "hubspot-sales-hub")`,
      prompt: `Find the review page URLs for "${competitorName}"${competitorDomain ? ` (website: ${competitorDomain})` : ''} on these platforms:

1. Search: "${competitorName} site:g2.com reviews"
2. Search: "${competitorName} site:trustpilot.com"
3. Search: "${competitorName} site:capterra.com reviews"

Return ONLY the URLs you find. Nothing else.`,
    });

    discovery = result.object;
    console.log(`Time: ${Date.now() - l1Start}ms`);
    console.log(JSON.stringify(discovery, null, 2));
  } catch (e) {
    console.error(`Layer 1 failed:`, e);
    return;
  }

  // ---- LAYER 2: Firecrawl Trustpilot Scrape ----
  const trustpilotPage = discovery.reviewPages.find(p => p.platform === 'Trustpilot' && p.found);

  if (!trustpilotPage) {
    // Try constructing URL from domain if Perplexity found the domain
    const domain = discovery.trustpilotDomain || competitorDomain;
    if (domain) {
      console.log(`\n--- LAYER 2: Firecrawl Trustpilot (constructed URL from domain: ${domain}) ---`);
      await scrapeAndExtractTrustpilot(`https://www.trustpilot.com/review/${domain}`, competitorName);
    } else {
      console.log(`\n--- LAYER 2: SKIPPED (no Trustpilot page found) ---`);
    }
  } else {
    console.log(`\n--- LAYER 2: Firecrawl Trustpilot (discovered URL) ---`);
    await scrapeAndExtractTrustpilot(trustpilotPage.url, competitorName);
  }

  // ---- LAYER 2B: Try G2 with Firecrawl (expecting block, but let's confirm) ----
  const g2Page = discovery.reviewPages.find(p => p.platform === 'G2' && p.found);
  if (g2Page) {
    console.log(`\n--- LAYER 2B: Firecrawl G2 (expecting block) ---`);
    const l2bStart = Date.now();
    try {
      const doc = await firecrawl.scrape(g2Page.url, { formats: ['markdown'] });
      const md = doc.markdown ?? '';
      console.log(`Time: ${Date.now() - l2bStart}ms`);
      console.log(`Result: ${md.length} chars, ${md.split(/\s+/).length} words`);
      if (md.length > 500) {
        console.log(`G2 ACTUALLY WORKED! First 500 chars:\n${md.slice(0, 500)}`);
      }
    } catch (e: any) {
      console.log(`Time: ${Date.now() - l2bStart}ms`);
      console.log(`G2 blocked as expected: ${e.code || e.message}`);
    }
  }
}

async function scrapeAndExtractTrustpilot(url: string, competitorName: string) {
  const l2Start = Date.now();

  try {
    // Step 1: Scrape the page
    console.log(`Scraping: ${url}`);
    const doc = await firecrawl.scrape(url, { formats: ['markdown'] });
    const markdown = doc.markdown ?? '';

    console.log(`Scrape time: ${Date.now() - l2Start}ms`);
    console.log(`Markdown: ${markdown.length} chars, ${markdown.split(/\s+/).length} words`);

    if (markdown.length < 200) {
      console.log(`Too short — page likely didn't load or doesn't exist`);
      console.log(`Content: ${markdown}`);
      return;
    }

    // Step 2: Extract structured data from markdown using AI SDK
    console.log(`\nExtracting structured review data...`);
    const extractStart = Date.now();

    // Use Perplexity would be wasteful here — use a simple prompt with the markdown
    // Actually we need a local model or just parse it. Let's use Perplexity since we have it.
    // Better: just parse the markdown directly for key data points.

    // Simple regex extraction from Trustpilot markdown
    const trustScoreMatch = markdown.match(/TrustScore\s+([\d.]+)\s+out of\s+5/i)
      || markdown.match(/(\d+\.\d+)\s*$/m);
    const totalReviewsMatch = markdown.match(/Reviews\s*([\d,]+)/i)
      || markdown.match(/([\d,]+)\s*reviews/i);

    // Extract individual reviews (Trustpilot format: "Rated X out of 5 stars" followed by text)
    const reviewBlocks = markdown.split(/(?=Rated \d out of 5 stars)/);
    const reviews: Array<{rating: number; text: string; date?: string; title?: string}> = [];

    for (const block of reviewBlocks.slice(1)) { // Skip first (before any review)
      const ratingMatch = block.match(/Rated (\d) out of 5 stars/);
      if (!ratingMatch) continue;

      const rating = parseInt(ratingMatch[1]);

      // Get the review text (everything after the rating line, before next review or section)
      const lines = block.split('\n').filter(l => l.trim().length > 0);
      const textLines: string[] = [];
      let foundDate = '';

      for (const line of lines.slice(1)) { // Skip rating line
        // Skip boilerplate
        if (line.includes('Useful') || line.includes('Share') || line.includes('Flag')) continue;
        if (line.includes('Reply from')) break;
        if (line.includes('Date of experience')) {
          foundDate = line.replace('Date of experience:', '').trim();
          continue;
        }
        if (line.trim().length > 10) {
          textLines.push(line.trim());
        }
      }

      const text = textLines.join(' ').trim();
      if (text.length > 20) {
        reviews.push({
          rating,
          text: text.slice(0, 500), // Cap at 500 chars
          date: foundDate || undefined,
        });
      }
    }

    // Also grab Trustpilot's own AI summary if present
    const aiSummaryMatch = markdown.match(/Review summary\s*\n\s*Based on reviews, created with AI\s*\n([\s\S]*?)(?=\n###|\nBased on these reviews)/);
    const aiSummary = aiSummaryMatch?.[1]?.trim();

    console.log(`Extract time: ${Date.now() - extractStart}ms`);
    console.log(`\n--- GROUND TRUTH RESULTS ---`);

    const trustScore = trustScoreMatch ? parseFloat(trustScoreMatch[1]) : null;
    const totalReviews = totalReviewsMatch ? parseInt(totalReviewsMatch[1].replace(/,/g, '')) : null;

    console.log(`Company: ${competitorName}`);
    console.log(`TrustScore: ${trustScore ?? 'not found'}/5`);
    console.log(`Total Reviews: ${totalReviews ?? 'not found'}`);
    console.log(`Reviews extracted: ${reviews.length}`);

    if (aiSummary) {
      console.log(`\nTrustpilot AI Summary (their own, not ours):`);
      console.log(`  "${aiSummary}"`);
    }

    console.log(`\nSample reviews (ground truth — scraped directly):`);
    for (const review of reviews.slice(0, 8)) {
      const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      console.log(`\n  ${stars} ${review.date ?? ''}`);
      console.log(`  "${review.text}"`);
    }

    // Summary stats
    if (reviews.length > 0) {
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      const negativeReviews = reviews.filter(r => r.rating <= 2);
      const positiveReviews = reviews.filter(r => r.rating >= 4);

      console.log(`\n--- STATS ---`);
      console.log(`Avg rating of scraped reviews: ${avgRating.toFixed(1)}/5`);
      console.log(`Positive (4-5★): ${positiveReviews.length}`);
      console.log(`Negative (1-2★): ${negativeReviews.length}`);

      if (negativeReviews.length > 0) {
        console.log(`\nTop negative themes (from actual review text):`);
        for (const r of negativeReviews.slice(0, 3)) {
          console.log(`  ★${'★'.repeat(r.rating - 1)}${'☆'.repeat(5 - r.rating)} "${r.text.slice(0, 150)}..."`);
        }
      }
    }

  } catch (e: any) {
    console.log(`Time: ${Date.now() - l2Start}ms`);
    console.error(`Firecrawl error: ${e.code || e.message}`);
  }
}

async function main() {
  // Test 1: Well-known SaaS (HubSpot)
  await testGroundTruthPipeline('HubSpot', 'hubspot.com');

  // Test 2: Niche SaaS (Lemlist)
  await testGroundTruthPipeline('Lemlist', 'lemlist.com');

  // Test 3: Very niche SaaS (Instantly.ai)
  await testGroundTruthPipeline('Instantly.ai', 'instantly.ai');

  console.log('\n\nAll ground truth tests complete.');
}

main().catch(console.error);
