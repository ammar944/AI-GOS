// research-worker/src/competitors/sonar-research.ts
// Single Perplexity Sonar Pro call for competitor review intelligence,
// preceded by a web-search validation pass that confirms each candidate
// actually exists and operates in the same industry as the client.

import { generateText } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import type { CompetitorEntry } from './parse-context';

const SONAR_TIMEOUT_MS = 25_000;
// Validation runs in parallel per competitor — keep it tight.
const VALIDATION_TIMEOUT_MS = 15_000;

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
  // Populated by the validation step — callers may use this for observability.
  verifiedCompetitors?: string[];
  removedCompetitors?: Array<{ name: string; reason: string }>;
}

interface ValidationResult {
  name: string;
  domain: string | null;
  verified: boolean;
  /** Confidence that this company exists and is in the same industry (0-100) */
  confidence: number;
  reason: string;
}

/**
 * Use Sonar Pro to verify that a single competitor candidate exists and
 * operates in the same industry/space as the client.
 *
 * Returns a ValidationResult — never throws.
 */
async function validateCompetitor(
  candidate: CompetitorEntry,
  clientContext: {
    companyName: string | null;
    productDescription: string | null;
    icpDescription: string | null;
  },
  currentDate: string,
): Promise<ValidationResult> {
  const perplexity = createPerplexity({
    apiKey: process.env.PERPLEXITY_API_KEY,
  });

  const domainHint = candidate.domain ? ` (${candidate.domain})` : '';
  const prompt = `Today is ${currentDate}. You are a business verification researcher.

Does the company "${candidate.name}"${domainHint} exist and is it currently in business?
Does it directly compete with or operate in the same space as:
  - Client: ${clientContext.companyName ?? 'unknown'}
  - What client sells: ${clientContext.productDescription ?? 'unknown'}
  - Client's customers: ${clientContext.icpDescription ?? 'unknown'}

Search the web to verify. Return ONLY valid JSON, no other text:
{
  "exists": true | false,
  "currentlyInBusiness": true | false,
  "officialWebsite": "https://..." or null,
  "industryMatch": true | false,
  "confidence": 0-100,
  "reason": "one sentence explaining your conclusion"
}

Rules:
- Set exists: false if you cannot find any credible web presence for this company
- Set industryMatch: false if the company exists but serves a completely different industry
- confidence should reflect how certain you are based on search results
- NEVER make up company information — only use what you find in search results`;

  try {
    const result = await Promise.race([
      generateText({
        model: perplexity('sonar'),
        prompt,
        maxOutputTokens: 400,
        temperature: 0.1,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Validation timed out after ${VALIDATION_TIMEOUT_MS / 1000}s`)),
          VALIDATION_TIMEOUT_MS,
        ),
      ),
    ]);

    const text = result.text.trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1)) as {
        exists?: boolean;
        currentlyInBusiness?: boolean;
        officialWebsite?: string | null;
        industryMatch?: boolean;
        confidence?: number;
        reason?: string;
      };

      const verified =
        parsed.exists !== false &&
        parsed.currentlyInBusiness !== false &&
        parsed.industryMatch !== false;

      return {
        name: candidate.name,
        domain: parsed.officialWebsite
          ? parsed.officialWebsite
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .split('/')[0]
          : candidate.domain,
        verified,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : (verified ? 70 : 20),
        reason: parsed.reason ?? (verified ? 'Verification passed' : 'Could not verify'),
      };
    }

    // Could not parse — treat as unverified with low confidence
    return {
      name: candidate.name,
      domain: candidate.domain,
      verified: false,
      confidence: 0,
      reason: 'Validation response could not be parsed',
    };
  } catch (error) {
    // Validation failure should not block the pipeline — treat as unverified
    // but let the caller decide whether to include or exclude.
    console.warn(
      `[sonar-research] Validation failed for "${candidate.name}":`,
      error instanceof Error ? error.message : String(error),
    );
    return {
      name: candidate.name,
      domain: candidate.domain,
      verified: false,
      confidence: 0,
      reason: error instanceof Error ? error.message : 'Validation error',
    };
  }
}

/**
 * Validate all competitors in parallel.
 * Returns two lists: verified entries (domain updated if Sonar found a better one)
 * and removed entries with their reasons.
 *
 * Strategy:
 * - Run all validations in parallel for speed.
 * - Keep competitors with confidence >= 60 even if verified flag is false
 *   (handles partial Sonar failures gracefully).
 * - Always keep at least one competitor even if everything fails validation
 *   (prevents empty research output).
 */
async function validateCompetitors(
  candidates: CompetitorEntry[],
  clientContext: {
    companyName: string | null;
    productDescription: string | null;
    icpDescription: string | null;
  },
  currentDate: string,
): Promise<{
  verified: CompetitorEntry[];
  removed: Array<{ name: string; reason: string }>;
}> {
  if (candidates.length === 0) {
    return { verified: [], removed: [] };
  }

  // Skip validation when Perplexity API key is not configured — the pipeline
  // will still produce useful output from Sonar review intelligence later.
  if (!process.env.PERPLEXITY_API_KEY) {
    return { verified: candidates, removed: [] };
  }

  const validationResults = await Promise.all(
    candidates.map(c => validateCompetitor(c, clientContext, currentDate)),
  );

  const verified: CompetitorEntry[] = [];
  const removed: Array<{ name: string; reason: string }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const validation = validationResults[i];
    const candidate = candidates[i];

    // Verified competitors still need a minimum confidence of 30 to guard against
    // cases where Sonar returns verified=true with very low confidence (e.g. 15).
    // Unverified competitors need 60+ confidence to pass through.
    if ((validation.verified && validation.confidence >= 30) || validation.confidence >= 60) {
      // Update domain if Sonar found a better one
      const updatedDomain = validation.domain ?? candidate.domain;
      verified.push({
        ...candidate,
        domain: updatedDomain,
        // If the domain came from validation (not inferred), mark it as confirmed
        inferredDomain: updatedDomain !== candidate.domain ? false : candidate.inferredDomain,
      });
    } else {
      removed.push({ name: candidate.name, reason: validation.reason });
    }
  }

  // Safety valve: if all competitors were removed, keep the highest-confidence one
  if (verified.length === 0 && candidates.length > 0) {
    const best = validationResults.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
    const bestIndex = validationResults.indexOf(best);
    const bestCandidate = candidates[bestIndex];
    const removedIndex = removed.findIndex(r => r.name === bestCandidate.name);
    if (removedIndex >= 0) {
      removed.splice(removedIndex, 1);
    }
    verified.push(bestCandidate);
    console.warn(
      `[sonar-research] All competitors failed validation — keeping "${bestCandidate.name}" as fallback (confidence: ${best.confidence})`,
    );
  }

  return { verified, removed };
}

/**
 * Run a single Sonar Pro search for competitor review intelligence.
 * Returns grounded research with citations — no hallucination risk.
 *
 * Phase 0 (NEW): Validate that each competitor candidate actually exists and
 * is in the same industry as the client. Runs all validations in parallel so
 * total validation time equals the slowest single validation. Note that Phase 0
 * blocks Phase 1 Sonar research, adding ~5-15s to the sonar research leg of
 * the pipeline overall.
 *
 * Phase 1: Gather review intelligence for verified competitors only.
 *
 * Covers what direct APIs cannot provide:
 *   - G2/Capterra/TrustRadius review summaries per competitor
 *   - Third-party competitive positioning signals
 *   - Market patterns and white-space opportunities
 *   - Switching triggers (why users leave competitor X)
 *
 * Does NOT cover (handled by dedicated API callers):
 *   - Ad library data (SearchAPI.io / Apify)
 *   - Keyword intelligence (SpyFu)
 *   - Pricing tiers (Firecrawl scrapes /pricing pages)
 *
 * @param input.competitors        - Parsed competitor entries with names and domains
 * @param input.companyName        - Client company name for relevance framing
 * @param input.productDescription - What the client sells
 * @param input.icpDescription     - Who the client sells to
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

  const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Phase 0: Validate competitors before spending research budget on them.
  const { verified: verifiedCompetitors, removed: removedCompetitors } =
    await validateCompetitors(
      input.competitors,
      {
        companyName: input.companyName,
        productDescription: input.productDescription,
        icpDescription: input.icpDescription,
      },
      currentDate,
    );

  if (removedCompetitors.length > 0) {
    console.info(
      `[sonar-research] Removed ${removedCompetitors.length} unverified competitor(s): ${removedCompetitors.map(r => r.name).join(', ')}`,
    );
  }

  // Use verified entries for research — fall back to original list only when
  // validation was entirely skipped (e.g. no Perplexity key).
  const competitorsForResearch =
    verifiedCompetitors.length > 0 ? verifiedCompetitors : input.competitors;

  if (competitorsForResearch.length === 0) {
    return {
      competitorInsights: [],
      marketPatterns: [],
      whiteSpaceOpportunities: [],
      citations: [],
      verifiedCompetitors: [],
      removedCompetitors,
    };
  }

  const competitorDomains = competitorsForResearch
    .filter(c => c.domain)
    .map(c => `${c.name} (${c.domain})`)
    .join(', ');
  const competitorNames = competitorsForResearch.map(c => c.name).join(', ');

  // Phase 1: Gather review intelligence for verified competitors.
  const prompt = `Today is ${currentDate}. Research these verified competitors for a paid media strategy: ${competitorDomains || competitorNames}

Client context: ${input.companyName ?? 'Unknown'} sells ${input.productDescription ?? 'their product'} to ${input.icpDescription ?? 'their target market'}.

IMPORTANT: Only include companies you can find credible information about via web search. Do NOT invent or hallucinate details.

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

      // Attach validation metadata for observability
      parsed.verifiedCompetitors = verifiedCompetitors.map(c => c.name);
      parsed.removedCompetitors = removedCompetitors;

      return parsed;
    }

    // Fallback: attempt to parse the whole text as JSON
    const fallback = JSON.parse(text) as SonarCompetitorResult;
    fallback.verifiedCompetitors = verifiedCompetitors.map(c => c.name);
    fallback.removedCompetitors = removedCompetitors;
    return fallback;
  } catch (error) {
    console.error('[sonar-research] Sonar Pro competitor research failed:', error);
    // Return empty result — the competitors runner continues with whatever
    // other data sources (ad library, SpyFu, Firecrawl) have already produced.
    return {
      competitorInsights: [],
      marketPatterns: [],
      whiteSpaceOpportunities: [],
      citations: [],
      verifiedCompetitors: verifiedCompetitors.map(c => c.name),
      removedCompetitors,
    };
  }
}
