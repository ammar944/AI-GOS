// Quick test: Can Perplexity Sonar Pro mine reviews from G2/Capterra/Trustpilot?
// Uses the same provider + model config as the main pipeline

import { createPerplexity } from '@ai-sdk/perplexity';
import { generateObject } from 'ai';
import { z } from 'zod';

const perplexity = createPerplexity({
  apiKey: process.env.PERPLEXITY_API_KEY,
});

const reviewMiningSchema = z.object({
  competitor: z.string().describe('Company name'),
  platforms: z.array(z.object({
    platform: z.enum(['G2', 'Capterra', 'Trustpilot', 'other']),
    url: z.string().optional().describe('Direct URL to the review page if found'),
    overallRating: z.number().optional().describe('Rating out of 5, only if explicitly found'),
    totalReviews: z.number().optional().describe('Total number of reviews if stated'),
  })).describe('Review platforms where this competitor has a presence'),
  topComplaints: z.array(z.object({
    complaint: z.string().describe('Specific customer complaint or pain point'),
    frequency: z.enum(['very_common', 'common', 'occasional']).describe('How often this complaint appears'),
    source: z.string().describe('Which platform(s) this was found on'),
  })).min(3).max(8).describe('Most common negative themes from reviews'),
  topPraises: z.array(z.object({
    praise: z.string().describe('Specific thing customers love'),
    source: z.string().describe('Which platform(s) this was found on'),
  })).min(2).max(5).describe('Most praised aspects'),
  sentimentSummary: z.string().describe('2-3 sentence overall sentiment summary based on reviews'),
  quotableComplaints: z.array(z.string()).describe('Direct or near-direct quotes from negative reviews if available. Say "none found" if you cannot find actual quotes.'),
  quotablePraises: z.array(z.string()).describe('Direct or near-direct quotes from positive reviews if available. Say "none found" if you cannot find actual quotes.'),
  confidence: z.enum(['high', 'medium', 'low']).describe('How confident are you in this data? high = found actual review pages, medium = found aggregated summaries, low = mostly inferred'),
});

async function testReviewMining(competitorName: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing review mining for: ${competitorName}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

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
- Prefer G2 and Capterra for B2B SaaS. Trustpilot for broader products.
- Include the direct URL to the review page when you find it`,

      prompt: `Search for and analyze customer reviews of "${competitorName}" on G2, Capterra, and Trustpilot.

Specifically search for:
1. "${competitorName} G2 reviews"
2. "${competitorName} Capterra reviews"
3. "${competitorName} Trustpilot reviews"
4. "${competitorName} customer complaints"
5. "${competitorName} pros and cons reviews"

For each platform where you find reviews:
- Report the rating and review count if visible
- Extract the most common complaints (negative themes)
- Extract the most praised features (positive themes)
- Try to find direct quotes from reviews
- Provide the URL to the review page

Be honest about what you can and cannot find. Mark your confidence level accordingly.`,
    });

    const elapsed = Date.now() - startTime;

    console.log(`\nTime: ${elapsed}ms`);
    console.log(`Tokens: ${result.usage.promptTokens} in / ${result.usage.completionTokens} out`);
    console.log(`\nResult:`);
    console.log(JSON.stringify(result.object, null, 2));

    if ('sources' in result && Array.isArray((result as any).sources)) {
      console.log(`\nSources (${(result as any).sources.length}):`);
      (result as any).sources.forEach((s: any, i: number) => {
        console.log(`  ${i + 1}. ${s.url || s.title || JSON.stringify(s)}`);
      });
    }
  } catch (error) {
    console.error(`\nError:`, error);
  }
}

// Test with well-known SaaS companies that definitely have reviews
async function main() {
  const testCompetitors = ['HubSpot', 'Mailchimp'];

  for (const competitor of testCompetitors) {
    await testReviewMining(competitor);
  }
}

main().catch(console.error);
