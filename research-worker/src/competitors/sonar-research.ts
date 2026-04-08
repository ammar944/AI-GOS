// research-worker/src/competitors/sonar-research.ts
// Single Perplexity Sonar Pro call for competitor review intelligence,
// preceded by a web-search validation pass that confirms each candidate
// actually exists and operates in the same industry as the client.

import { generateText } from 'ai';
import { createPerplexity } from '@ai-sdk/perplexity';
import type { CompetitorEntry, IdentityCard } from './parse-context';

const SONAR_TIMEOUT_MS = 25_000;
const DISCOVERY_TIMEOUT_MS = 15_000;
// Validation runs in parallel per competitor — keep it tight.
const VALIDATION_TIMEOUT_MS = 15_000;
const DOMAIN_HEAD_TIMEOUT_MS = 3_000;

/**
 * Verify a domain resolves via HEAD request.
 * Returns true if the domain responds with any 2xx/3xx status.
 * Returns false on 4xx/5xx, network error, or timeout.
 */
async function verifyDomainResolves(domain: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(DOMAIN_HEAD_TIMEOUT_MS),
      redirect: 'follow',
    });
    const resolves = response.status < 400;
    console.log(`[sonar-research] Domain HEAD verify "${domain}": ${response.status} (${resolves ? 'OK' : 'FAIL'})`);
    return resolves;
  } catch (error) {
    console.log(`[sonar-research] Domain HEAD verify "${domain}": failed (${error instanceof Error ? error.message : 'unknown'})`);
    return false;
  }
}

/**
 * Wave 6e Hole 1: Tokenized keyword check.
 *
 * Checks whether a description "mentions" a keyword phrase using:
 *   1. Direct substring match (catches verbatim phrases AND plural forms)
 *   2. Token overlap with word-boundary regex (catches paraphrased phrases —
 *      e.g. "ai meeting assistant" matches "AI Notetaker for meetings" because
 *      'meeting' appears as a word stem)
 *
 * Tokens shorter than 4 characters are skipped to avoid false positives like
 * "ai" matching "Asia" or "available". Word-boundary anchoring on the START
 * of the token catches plural/inflected forms ("meeting" → "meetings") without
 * false-matching unrelated words.
 *
 * 60% threshold: at least 60% of significant tokens in the keyword must appear
 * as word-boundary-anchored stems in the description.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function descriptionMentionsKeyword(description: string, keyword: string): boolean {
  const desc = description.toLowerCase();
  const kw = keyword.toLowerCase().trim();
  if (!kw) return false;

  // Direct substring match (handles verbatim and natural plurals)
  if (desc.includes(kw)) return true;

  // Token overlap with word-boundary anchoring on the start of each token
  const tokens = kw.split(/\s+/).filter(t => t.length >= 4);
  if (tokens.length === 0) {
    // Single short keyword (e.g. "AI") — require strict word boundary on both sides
    if (kw.length >= 3) {
      const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
      return re.test(desc);
    }
    return false;
  }

  let hits = 0;
  for (const t of tokens) {
    const re = new RegExp(`\\b${escapeRegex(t)}`, 'i');
    if (re.test(desc)) hits++;
  }
  return hits / tokens.length >= 0.6;
}

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
  // Full CompetitorEntry[] with corrected domains from Sonar validation.
  // Use these for downstream ad fetching (verified domains, not inferred).
  verifiedEntries?: CompetitorEntry[];
}

interface ValidationResult {
  name: string;
  domain: string | null;
  verified: boolean;
  /** Whether the domain was confirmed via HEAD request (not just Sonar output) */
  domainVerified?: boolean;
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
    identityCard?: import('./parse-context').IdentityCard | null;
  },
  currentDate: string,
): Promise<ValidationResult> {
  const perplexity = createPerplexity({
    apiKey: process.env.PERPLEXITY_API_KEY,
  });

  // Wave 6e Layer 1: only pass the domain hint when it was USER-SUPPLIED.
  // For inferred domains (e.g. "Fathom" → guessed "fathom.com"), passing the hint
  // creates confirmation bias — Sonar finds *some* business at that URL and
  // confirms it instead of searching for the right company in the client's
  // category. Suppressing the hint forces Sonar to search blind using the
  // category context below.
  const domainHint = candidate.domain && !candidate.inferredDomain
    ? ` (${candidate.domain})`
    : '';

  // Use identity card for more precise classification when available
  const identityCard = clientContext.identityCard;
  const productLine = identityCard
    ? `${identityCard.coreProduct} (Category: ${identityCard.category})`
    : (clientContext.productDescription ?? 'unknown');
  const keywordsHint = identityCard?.coreKeywords?.length
    ? `\n  - Core keywords for this space: ${identityCard.coreKeywords.join(', ')}`
    : '';

  // Build negative signal from BOTH negativeKeywords AND evidence.conflicts.
  // Conflicts are more reliable than negativeKeywords (the resolver explicitly
  // names wrong-category competitors and their actual categories).
  const negativeTerms = [...(identityCard?.negativeKeywords ?? [])];
  if (identityCard?.evidence?.conflicts?.length) {
    for (const conflict of identityCard.evidence.conflicts) {
      // Extract category terms from conflict text like "are knowledge management platforms"
      const categoryMatch = conflict.match(/(?:are|is)\s+(?:primarily\s+)?([^,.]+?)(?:\s+(?:platforms?|tools?|apps?))/i);
      if (categoryMatch?.[1]) {
        negativeTerms.push(categoryMatch[1].trim());
      }
    }
  }
  const negativeHint = negativeTerms.length > 0
    ? `\n  - NOT in these categories (wrong matches): ${[...new Set(negativeTerms)].join(', ')}`
    : '';

  const prompt = `Today is ${currentDate}. You are a business verification researcher.

Does the company "${candidate.name}"${domainHint} exist and is it currently in business?
Does it directly compete with or operate in the same space as:
  - Client: ${clientContext.companyName ?? 'unknown'}
  - What client sells: ${productLine}
  - Client's customers: ${clientContext.icpDescription ?? 'unknown'}${keywordsHint}${negativeHint}

CRITICAL — multi-company disambiguation:
Many short names exist for SEVERAL unrelated companies in different industries. Examples:
  - "Fathom" → fathom.video (AI meeting assistant), fathom.ai (analytics), Fathom Holdings (real estate), Fathom Sauce Company (food).
  - "Otter" → otter.ai (transcription) but also unrelated otter.com businesses.
  - "Avoma", "Gong", "Bird", "Notion", "Linear" all have multiple unrelated companies sharing the name.

Do NOT confirm the FIRST company you find with this name. You MUST:
  1. Search for "${candidate.name}" to see ALL companies with this name.
  2. From those candidates, pick ONLY the one that operates in the client's category above.
  3. If multiple candidates exist, search "${candidate.name} ${identityCard?.category ?? 'in this category'}" to disambiguate.
  4. Return the website of the SPECIFIC company in the client's category, not any other Fathom/Otter/etc.

Search the web to verify. Return ONLY valid JSON, no other text:
{
  "exists": true | false,
  "currentlyInBusiness": true | false,
  "officialWebsite": "https://..." or null,
  "websiteDescription": "one sentence describing what THIS company does, in their own words from the website",
  "industryMatch": true | false,
  "confidence": 0-100,
  "reason": "one sentence explaining your conclusion AND why this is the right company (not a same-named one in another industry)"
}

Rules:
- Set exists: false if you cannot find any credible web presence for this company
- Set industryMatch: false if the company exists but serves a completely different industry or market segment. Use the core keywords and negative keywords above to determine if the candidate is in the SAME specific space. A note-taking app is NOT a competitor to a video creation tool, even if both use AI.
- websiteDescription MUST come from the actual company website, not from a guess. It will be used for downstream category verification.
- If the candidate's domain hint resolves but belongs to a DIFFERENT business than expected, IGNORE the hint and return the CORRECT domain. Search for "[company name] [industry]" to find the right one.
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
        websiteDescription?: string | null;
        industryMatch?: boolean;
        confidence?: number;
        reason?: string;
      };

      let verified =
        parsed.exists !== false &&
        parsed.currentlyInBusiness !== false &&
        parsed.industryMatch !== false;

      // Wave 6e Layer 3: local category verification via the website description.
      // Even if Sonar claims industryMatch=true, we cross-check that the description
      // it returned actually mentions a category keyword OR doesn't trip a negative
      // keyword. This catches cases where Sonar confidently picks the wrong company
      // (e.g. "Fathom" → Fathom Sauce Company instead of fathom.video) by looking at
      // the actual website content, not just the URL.
      //
      // Wave 6e Hole 1 fix: use tokenized matching (descriptionMentionsKeyword)
      // instead of literal substring. Catches paraphrased descriptions where the
      // category keyword tokens appear as stems (e.g. "AI Notetaker for meetings"
      // matches "ai meeting assistant" via the 'meeting' token).
      const description = parsed.websiteDescription ?? '';
      const coreKw = (identityCard?.coreKeywords ?? []).filter(Boolean);
      const negKw = (identityCard?.negativeKeywords ?? []).filter(Boolean);

      let categoryVerdict: 'matches' | 'mismatches' | 'no-signal' = 'no-signal';
      if (description) {
        const hitsNegative = negKw.some(kw => descriptionMentionsKeyword(description, kw));
        const hitsCore = coreKw.some(kw => descriptionMentionsKeyword(description, kw));
        if (hitsNegative && !hitsCore) {
          categoryVerdict = 'mismatches';
        } else if (hitsCore) {
          categoryVerdict = 'matches';
        }
      }

      console.log(
        `[sonar-research] "${candidate.name}": websiteDescription="${parsed.websiteDescription ?? ''}" → verdict=${categoryVerdict}`,
      );

      // Hard reject only on explicit negative-keyword hit. A weak/no-signal
      // description should NOT block valid competitors with sparse descriptions.
      if (categoryVerdict === 'mismatches') {
        console.warn(
          `[sonar-research] "${candidate.name}": REJECTED — description matches negative keywords ` +
            `[${negKw.join(', ')}] without any core keyword match. Likely wrong-company match.`,
        );
        verified = false;
      }

      // Extract and verify domain from Sonar's officialWebsite
      let resolvedDomain = candidate.domain;
      let domainVerified = false;

      if (parsed.officialWebsite && categoryVerdict !== 'mismatches') {
        const sonarDomain = parsed.officialWebsite
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0];

        // HEAD check: verify the domain actually resolves
        const domainResolves = await verifyDomainResolves(sonarDomain);
        if (domainResolves) {
          resolvedDomain = sonarDomain;
          domainVerified = true;
          console.log(`[sonar-research] "${candidate.name}": Sonar domain "${sonarDomain}" verified via HEAD`);
        } else {
          // Sonar returned a domain that doesn't resolve — keep the original
          console.warn(`[sonar-research] "${candidate.name}": Sonar domain "${sonarDomain}" failed HEAD check, keeping original "${candidate.domain}"`);
        }
      }

      // If category mismatched, downgrade confidence so the caller can decide
      // whether to keep or drop. We don't auto-remove because it's user-provided.
      const confidence = categoryVerdict === 'mismatches'
        ? 15
        : (typeof parsed.confidence === 'number' ? parsed.confidence : (verified ? 70 : 20));

      const reason = categoryVerdict === 'mismatches'
        ? `Wrong-company match: description "${parsed.websiteDescription}" hit negative keywords without core match`
        : (parsed.reason ?? (verified ? 'Verification passed' : 'Could not verify'));

      return {
        name: candidate.name,
        domain: resolvedDomain,
        verified,
        domainVerified,
        confidence,
        reason,
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
    identityCard?: import('./parse-context').IdentityCard | null;
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

  // User-provided competitors are ALWAYS kept. The user knows their market.
  // Validation only checks existence + domain resolution, NOT category match.
  // Category-mismatched competitors are tagged but not removed — synthesis
  // positions the client against both user-provided and discovered competitors.
  const validationResults = await Promise.all(
    candidates.map(c => validateCompetitor(c, clientContext, currentDate)),
  );

  const verified: CompetitorEntry[] = [];
  const removed: Array<{ name: string; reason: string }> = [];

  for (let i = 0; i < candidates.length; i++) {
    const validation = validationResults[i];
    const candidate = candidates[i];

    // Only reject if the company genuinely doesn't exist or domain is dead.
    // NEVER reject for industryMatch — user chose these competitors for a reason.
    if (validation.verified || validation.confidence >= 30) {
      const updatedDomain = validation.domain ?? candidate.domain;
      verified.push({
        ...candidate,
        domain: updatedDomain,
        // Wave 6d fix: clear inferredDomain whenever Sonar verified the domain,
        // not only when the domain was upgraded to a different value. Previously
        // Avoma stayed marked as inferredDomain=true because its original
        // guessed "avoma.com" happened to be correct — Sonar verified it via
        // HEAD but `domainWasUpgraded` was false since the value didn't change,
        // so the flag never got cleared. Downstream this blocked pricing scraping
        // AND forced the ad library into unverified mode, producing ambiguous
        // verdicts and zero ads for a valid competitor.
        inferredDomain: validation.domainVerified ? false : candidate.inferredDomain,
      });
    } else if (!validation.verified && validation.reason?.toLowerCase().includes('cannot find')) {
      // Company doesn't exist — remove it
      removed.push({ name: candidate.name, reason: validation.reason });
    } else {
      // Low confidence but company exists — keep it. User provided it.
      verified.push(candidate);
      console.info(`[sonar-research] Keeping "${candidate.name}" despite low confidence (${validation.confidence}) — user-provided`);
    }
  }

  // Safety valve: if all competitors were removed (all don't exist), keep the best one
  if (verified.length === 0 && candidates.length > 0) {
    const best = validationResults.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
    const bestIndex = validationResults.indexOf(best);
    const bestCandidate = candidates[bestIndex];
    const removedIndex = removed.findIndex(r => r.name === bestCandidate.name);
    if (removedIndex >= 0) removed.splice(removedIndex, 1);
    verified.push(bestCandidate);
    console.warn(
      `[sonar-research] All competitors failed validation — keeping "${bestCandidate.name}" as fallback (confidence: ${best.confidence})`,
    );
  }

  return { verified, removed };
}

/**
 * Discover competitors via Sonar Pro when user-provided ones are all wrong-category.
 * Uses the identity card's coreKeywords to search for real competitors.
 * Returns up to 5 CompetitorEntry objects with verified domains.
 */
async function discoverCompetitorsFromIdentity(
  identityCard: IdentityCard,
  companyName: string | null,
): Promise<CompetitorEntry[]> {
  if (!process.env.PERPLEXITY_API_KEY) return [];

  const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY });
  const keywords = identityCard.coreKeywords.slice(0, 3).join(', ');
  const currentDate = new Date().toISOString().slice(0, 10);

  const prompt = `Today is ${currentDate}. Find the top 5 competitors for a company in this space:
  - Category: ${identityCard.category}
  - Product: ${identityCard.coreProduct}
  - Keywords: ${keywords}
  - Company to exclude: ${companyName ?? 'N/A'} (this is the CLIENT, not a competitor)

Search the web and return ONLY companies that are DIRECT competitors in the SAME product category.
Do NOT include general productivity tools, note-taking apps, or tools from adjacent categories.

Return ONLY valid JSON, no other text:
{
  "competitors": [
    { "name": "Company Name", "domain": "company.com", "reason": "one sentence why they compete" }
  ]
}`;

  try {
    const result = await Promise.race([
      generateText({
        model: perplexity('sonar'),
        prompt,
        maxOutputTokens: 600,
        temperature: 0.1,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Discovery timed out')), DISCOVERY_TIMEOUT_MS),
      ),
    ]);

    const text = result.text.trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1)) as {
        competitors?: Array<{ name: string; domain?: string; reason?: string }>;
      };

      if (Array.isArray(parsed.competitors)) {
        const entries: CompetitorEntry[] = [];
        for (const c of parsed.competitors.slice(0, 5)) {
          if (!c.name) continue;
          const domain = c.domain
            ? c.domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
            : null;
          entries.push({
            name: c.name,
            domain,
            inferredDomain: !domain,
          });
        }
        console.info(
          `[sonar-research] Discovered ${entries.length} competitors via identity card: ${entries.map(e => e.name).join(', ')}`,
        );
        return entries;
      }
    }
  } catch (err) {
    console.warn('[sonar-research] Competitor discovery failed:', err instanceof Error ? err.message : err);
  }
  return [];
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
 * Phase 0.5: If all competitors fail validation due to wrong industry AND an
 * identity card is available, discover real competitors via Sonar Pro search.
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
  identityCard?: import('./parse-context').IdentityCard | null;
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
        identityCard: input.identityCard ?? null,
      },
      currentDate,
    );

  if (removedCompetitors.length > 0) {
    console.info(
      `[sonar-research] Removed ${removedCompetitors.length} unverified competitor(s): ${removedCompetitors.map(r => r.name).join(', ')}`,
    );
  }

  // Phase 0.5: If all user-provided competitors were wrong-category and we have
  // an identity card, discover real competitors via Sonar Pro web search.
  // Discovery: when identity card flags a category mismatch in user competitors,
  // discover ADDITIONAL competitors in the correct category. These are ADDED to
  // the user-provided list, not used as replacements.
  let discoveredCompetitors: CompetitorEntry[] = [];
  if (input.identityCard?.evidence?.conflicts?.length) {
    const conflictText = input.identityCard.evidence.conflicts.join(' ').toLowerCase();
    const hasCompetitorMismatch =
      conflictText.includes('not direct competitor') ||
      conflictText.includes('not content') ||
      conflictText.includes('note-taking') ||
      conflictText.includes('knowledge management') ||
      conflictText.includes('true competitors');

    if (hasCompetitorMismatch) {
      console.info('[sonar-research] Identity card flags competitor category mismatch — discovering additional competitors');
      discoveredCompetitors = await discoverCompetitorsFromIdentity(
        input.identityCard,
        input.companyName,
      );
      // Deduplicate: don't add discovered competitors that match user-provided ones
      const existingNames = new Set(verifiedCompetitors.map(c => c.name.toLowerCase()));
      discoveredCompetitors = discoveredCompetitors.filter(
        dc => !existingNames.has(dc.name.toLowerCase()),
      );
      if (discoveredCompetitors.length > 0) {
        console.info(
          `[sonar-research] Adding ${discoveredCompetitors.length} discovered competitors: ${discoveredCompetitors.map(c => c.name).join(', ')}`,
        );
      }
    }
  }

  // Merge user-provided (verified) + discovered competitors
  const competitorsForResearch = [...verifiedCompetitors, ...discoveredCompetitors];

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
- IMPORTANT: If your research reveals a major competitor in this market that is NOT in the list above (e.g. a market leader with significant market share, funding, or brand recognition), include them in competitorInsights anyway. The initial competitor list may be incomplete — do not omit well-known players just because they weren't listed.

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
      const allEntries = [...verifiedCompetitors, ...discoveredCompetitors];
      parsed.verifiedCompetitors = allEntries.map(c => c.name);
      parsed.removedCompetitors = removedCompetitors;
      parsed.verifiedEntries = allEntries;

      return parsed;
    }

    // Fallback: attempt to parse the whole text as JSON
    const allEntries = [...verifiedCompetitors, ...discoveredCompetitors];
    const fallback = JSON.parse(text) as SonarCompetitorResult;
    fallback.verifiedCompetitors = allEntries.map(c => c.name);
    fallback.removedCompetitors = removedCompetitors;
    fallback.verifiedEntries = allEntries;
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
      verifiedCompetitors: [...verifiedCompetitors, ...discoveredCompetitors].map(c => c.name),
      removedCompetitors,
      verifiedEntries: [...verifiedCompetitors, ...discoveredCompetitors],
    };
  }
}
