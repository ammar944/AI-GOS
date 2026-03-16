// research-worker/src/competitors/sonar-research.ts
// Single Perplexity Sonar Pro call for competitor review intelligence.
// Replaces the multi-round Anthropic web_search agentic loop.

import { generateText } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import type { CompetitorEntry } from './parse-context';

const SONAR_TIMEOUT_MS = 25_000;

export interface SonarCompetitorResult {
  competitorInsights: Array<{
    name: string;
    positioning: string;
    reviewStrengths: string[];
    reviewWeaknesses: string[];
    switchingTriggers: string[];
    marketPerception: string;
  }>;
  marketPatterns: string[];
  whiteSpaceOpportunities: string[];
  citations: Array<{ url: string; title: string }>;
}

/**
 * Run a single Sonar Pro search for competitor review intelligence.
 * Returns grounded research with citations — no hallucination risk.
 *
 * Covers what direct APIs cannot provide:
 *   - G2/Capterra/TrustRadius review summaries per competitor
 *   - Third-party competitive positioning signals
 *   - Market patterns and white-space opportunities
 *   - Switching triggers (why users leave competitor X)
 *
 * Does NOT cover (handled by dedicated API callers):
 *   - Ad library data (SearchAPI.io)
 *   - Keyword intelligence (SpyFu)
 *   - Pricing tiers (Firecrawl scrapes /pricing pages)
 *
 * @param input.competitors      - Parsed competitor entries with names and domains
 * @param input.companyName      - Client company name for relevance framing
 * @param input.productDescription - What the client sells
 * @param input.icpDescription   - Who the client sells to
 */
export async function fetchSonarCompetitorResearch(input: {
  competitors: CompetitorEntry[];
  companyName: string | null;
  productDescription: string | null;
  icpDescription: string | null;
}): Promise<SonarCompetitorResult> {
  const perplexity = createPerplexity({
    apiKey: process.env.PERPLEXITY_API_KEY,
  });

  const competitorNames = input.competitors.map(c => c.name).join(', ');
  const competitorDomains = input.competitors
    .filter(c => c.domain)
    .map(c => `${c.name} (${c.domain})`)
    .join(', ');

  const prompt = `Research these competitors for a paid media strategy: ${competitorDomains || competitorNames}

Client context: ${input.companyName ?? 'Unknown'} sells ${input.productDescription ?? 'their product'} to ${input.icpDescription ?? 'their target market'}.

For EACH competitor, find:
1. Their core positioning and value proposition (from their website and marketing)
2. Top 3 strengths from G2/Capterra/TrustRadius reviews
3. Top 3 weaknesses/complaints from negative reviews
4. Why users switch away from them (switching triggers)
5. Overall market perception

Then identify:
- 2-3 patterns across the competitive landscape
- 2-3 white space opportunities (messaging angles, audience segments, or channels that competitors are NOT addressing)

Return ONLY valid JSON, no other text:
{
  "competitorInsights": [
    {
      "name": "CompetitorName",
      "positioning": "Their core value prop in 1-2 sentences",
      "reviewStrengths": ["strength from reviews", "strength from reviews", "strength from reviews"],
      "reviewWeaknesses": ["weakness from reviews", "weakness from reviews", "weakness from reviews"],
      "switchingTriggers": ["why users leave", "why users leave"],
      "marketPerception": "Brief market perception summary"
    }
  ],
  "marketPatterns": ["pattern 1", "pattern 2"],
  "whiteSpaceOpportunities": ["opportunity 1", "opportunity 2"],
  "citations": [{"url": "https://...", "title": "Source title"}]
}`;

  try {
    const result = await Promise.race([
      generateText({
        model: perplexity('sonar-pro'),
        prompt,
        maxOutputTokens: 3000,
        temperature: 0.3,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Sonar Pro timed out after ${SONAR_TIMEOUT_MS / 1000}s`)),
          SONAR_TIMEOUT_MS,
        ),
      ),
    ]);

    // Extract JSON from response — Sonar Pro sometimes prepends prose
    const text = result.text.trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1)) as SonarCompetitorResult;

      // Backfill citations from Sonar Pro response metadata when the model
      // omitted the citations array or returned it empty.
      const sources = (result as { sources?: Array<{ url: string; title?: string }> }).sources;
      if (Array.isArray(sources) && sources.length > 0 && (!parsed.citations || parsed.citations.length === 0)) {
        parsed.citations = sources
          .filter((s): s is { url: string; title: string } => Boolean(s.url))
          .map(s => ({ url: s.url, title: s.title ?? s.url }))
          .slice(0, 6);
      }

      return parsed;
    }

    // Fallback: attempt to parse the whole text as JSON
    return JSON.parse(text) as SonarCompetitorResult;
  } catch (error) {
    console.error('[sonar-research] Sonar Pro competitor research failed:', error);
    // Return empty result — the competitors runner continues with whatever
    // other data sources (ad library, SpyFu, Firecrawl) have already produced.
    return {
      competitorInsights: [],
      marketPatterns: [],
      whiteSpaceOpportunities: [],
      citations: [],
    };
  }
}
