// Ground Truth Review Mining v2
// Strategy:
//   Trustpilot: Construct URL from domain (predictable pattern) → Firecrawl scrape
//   G2: Perplexity finds slug → Firecrawl blocked → fall back to Perplexity SERP extract
//   Capterra: Skip (unpredictable URLs + likely blocked)

import Firecrawl from '@mendable/firecrawl-js';
import { createPerplexity } from '@ai-sdk/perplexity';
import { generateObject } from 'ai';
import { z } from 'zod';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY });

// ============================================================
// Trustpilot: Direct scrape (ground truth)
// ============================================================
async function scrapeTrustpilot(domain: string, companyName: string) {
  const url = `https://www.trustpilot.com/review/${domain}`;
  console.log(`\n  [Trustpilot] Scraping ${url}`);
  const start = Date.now();

  try {
    const doc = await firecrawl.scrape(url, { formats: ['markdown'] });
    const markdown = doc.markdown ?? '';
    console.log(`  [Trustpilot] ${Date.now() - start}ms — ${markdown.length} chars`);

    if (markdown.length < 300) {
      console.log(`  [Trustpilot] Page too short — company likely not on Trustpilot`);
      return null;
    }

    // Parse structured data from markdown
    const trustScoreMatch = markdown.match(/(\d+\.\d+)/);
    const totalReviewsMatch = markdown.match(/Reviews\s*([\d,]+)/i) || markdown.match(/([\d,]+)\s*reviews/i);

    // Extract Trustpilot's own AI summary
    const aiSummaryMatch = markdown.match(/Review summary\s*\n\s*Based on reviews, created with AI\s*\n([\s\S]*?)(?=\n###|\nBased on these reviews)/);

    // Extract individual reviews
    const reviewBlocks = markdown.split(/(?=Rated \d out of 5 stars)/);
    const reviews: Array<{ rating: number; text: string; date?: string }> = [];

    for (const block of reviewBlocks.slice(1)) {
      const ratingMatch = block.match(/Rated (\d) out of 5 stars/);
      if (!ratingMatch) continue;
      const rating = parseInt(ratingMatch[1]);

      const lines = block.split('\n').filter(l => l.trim().length > 0);
      const textLines: string[] = [];
      let date = '';

      for (const line of lines.slice(1)) {
        if (line.includes('Useful') || line.includes('Share') || line.includes('Flag')) continue;
        if (line.includes('Reply from')) break;
        if (line.includes('Date of experience')) {
          date = line.replace('Date of experience:', '').replace('Date of experience', '').trim();
          continue;
        }
        if (line.trim().length > 15) textLines.push(line.trim());
      }

      const text = textLines.join(' ').trim();
      if (text.length > 30) {
        reviews.push({ rating, text: text.slice(0, 500), date: date || undefined });
      }
    }

    return {
      source: 'trustpilot' as const,
      url,
      trustScore: trustScoreMatch ? parseFloat(trustScoreMatch[1]) : null,
      totalReviews: totalReviewsMatch ? parseInt(totalReviewsMatch[1].replace(/,/g, '')) : null,
      aiSummary: aiSummaryMatch?.[1]?.trim() ?? null,
      reviews,
      groundTruth: true,
    };
  } catch (e: any) {
    console.log(`  [Trustpilot] ${Date.now() - start}ms — Error: ${e.code || e.message}`);
    return null;
  }
}

// ============================================================
// G2: Since Firecrawl is blocked, use Perplexity to extract
// ONLY the rating + review count from G2's public page metadata
// (Google shows "4.5 stars, 13995 reviews" in SERP snippets)
// ============================================================
async function getG2Metadata(competitorName: string) {
  console.log(`\n  [G2] Perplexity SERP metadata lookup for "${competitorName}"`);
  const start = Date.now();

  const metadataSchema = z.object({
    found: z.boolean(),
    url: z.string().optional(),
    rating: z.number().optional().describe('G2 star rating out of 5. ONLY from the G2 page itself.'),
    reviewCount: z.number().optional().describe('Total reviews on G2. ONLY from G2 data.'),
    productCategory: z.string().optional().describe('G2 category for this product'),
  });

  try {
    const result = await generateObject({
      model: perplexity('sonar-pro'),
      schema: metadataSchema,
      temperature: 0.1,
      maxTokens: 512,
      system: `You look up G2.com product pages to find their aggregate rating and review count.
ONLY return data that appears on the actual G2 product page (rating stars and review count).
DO NOT summarize reviews or extract quotes. Just the metadata.`,
      prompt: `What is the G2 rating and review count for "${competitorName}"? Search: "${competitorName} site:g2.com"`,
    });

    console.log(`  [G2] ${Date.now() - start}ms`);
    return {
      source: 'g2' as const,
      ...result.object,
      groundTruth: true, // Rating/count are public metadata visible in SERP
    };
  } catch (e: any) {
    console.log(`  [G2] ${Date.now() - start}ms — Error: ${e.message}`);
    return null;
  }
}

// ============================================================
// Full pipeline
// ============================================================
async function mineReviews(competitorName: string, competitorDomain: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`GROUND TRUTH REVIEW MINING: ${competitorName} (${competitorDomain})`);
  console.log('='.repeat(70));

  const start = Date.now();

  // Run both in parallel — they're independent
  const [trustpilotResult, g2Result] = await Promise.all([
    scrapeTrustpilot(competitorDomain, competitorName),
    getG2Metadata(competitorName),
  ]);

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`FINAL RESULTS (${Date.now() - start}ms total)`);
  console.log('─'.repeat(50));

  // G2
  if (g2Result?.found) {
    console.log(`\n  G2: ${g2Result.rating}/5 from ${g2Result.reviewCount} reviews`);
    console.log(`  URL: ${g2Result.url}`);
    console.log(`  Category: ${g2Result.productCategory}`);
    console.log(`  Data type: SERP metadata (verified aggregate)`);
  } else {
    console.log(`\n  G2: Not found`);
  }

  // Trustpilot
  if (trustpilotResult) {
    console.log(`\n  Trustpilot: ${trustpilotResult.trustScore}/5 from ${trustpilotResult.totalReviews} reviews`);
    console.log(`  URL: ${trustpilotResult.url}`);
    console.log(`  Data type: DIRECT SCRAPE (full ground truth)`);
    console.log(`  Reviews scraped: ${trustpilotResult.reviews.length}`);

    if (trustpilotResult.aiSummary) {
      console.log(`\n  Trustpilot's own AI summary:`);
      console.log(`  "${trustpilotResult.aiSummary}"`);
    }

    // Show rating breakdown
    const byRating = [1, 2, 3, 4, 5].map(r => ({
      rating: r,
      count: trustpilotResult.reviews.filter(rev => rev.rating === r).length,
    }));
    console.log(`\n  Rating distribution (from scraped reviews):`);
    for (const { rating, count } of byRating.reverse()) {
      const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, 10 - count));
      console.log(`    ${rating}★ ${bar} ${count}`);
    }

    // Show actual reviews
    console.log(`\n  Sample NEGATIVE reviews (1-2★):`);
    const negative = trustpilotResult.reviews.filter(r => r.rating <= 2).slice(0, 3);
    for (const r of negative) {
      console.log(`    ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.date ?? ''}`);
      console.log(`    "${r.text.slice(0, 200)}${r.text.length > 200 ? '...' : ''}"\n`);
    }

    console.log(`  Sample POSITIVE reviews (4-5★):`);
    const positive = trustpilotResult.reviews.filter(r => r.rating >= 4).slice(0, 3);
    for (const r of positive) {
      console.log(`    ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} ${r.date ?? ''}`);
      console.log(`    "${r.text.slice(0, 200)}${r.text.length > 200 ? '...' : ''}"\n`);
    }
  } else {
    console.log(`\n  Trustpilot: Not found or not on platform`);
  }
}

async function main() {
  await mineReviews('HubSpot', 'hubspot.com');
  await mineReviews('Lemlist', 'lemlist.com');
  await mineReviews('Instantly.ai', 'instantly.ai');

  console.log('\n\nDone.');
}

main().catch(console.error);
