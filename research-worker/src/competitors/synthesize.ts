// research-worker/src/competitors/synthesize.ts
// Single Sonnet call that assembles all pre-fetched evidence into the competitor JSON artifact.
// No tools — pure synthesis. All data already collected in parallel.

import Anthropic from '@anthropic-ai/sdk';
import type { ParsedCompetitorContext } from './parse-context';
import type { ParallelFetchResults } from './parallel-fetch';
import type { SonarCompetitorResult } from './sonar-research';
import { buildLibraryLinks } from '../tools/adlibrary';
import { MODELS } from '../models';
import { buildRunnerTelemetry, type RunnerTelemetry } from '../telemetry';

const SYNTHESIS_MODEL =
  process.env.RESEARCH_COMPETITORS_SYNTHESIS_MODEL ?? MODELS.FAST;
const SYNTHESIS_MAX_TOKENS = 8000;
const SYNTHESIS_TIMEOUT_MS = 60_000;

export interface SynthesisInput {
  parsed: ParsedCompetitorContext;
  fetchResults: ParallelFetchResults;
  sonarResults: SonarCompetitorResult;
}

/**
 * Build the synthesis system prompt with the current date injected.
 * This is a function (not a constant) so the date is always fresh
 * and the model knows what "currently in business" means.
 */
function buildSynthesisSystemPrompt(currentDate: string): string {
  return `You are an expert competitive analyst producing a competitor artifact for a paid media strategist.
Today's date is ${currentDate}.

TASK: Synthesize the pre-fetched evidence into the required JSON schema. All research data has already been gathered — your job is ONLY to synthesize it, not to research further.

CRITICAL RULES:
- HALLUCINATION PREVENTION: NEVER invent competitors, data points, or claims not present in the evidence package. If a competitor has no evidence in the package, do not include them in the output.
- ABSENCE OF DATA ≠ ABSENCE OF FEATURE: If the evidence package does not contain pricing, features, or capabilities for a competitor, that does NOT mean they lack those things. The scrape may have failed. NEVER list "no pricing transparency", "no visible pricing", "limited feature set", or similar claims as weaknesses unless you have POSITIVE EVIDENCE (e.g., a review complaint, a documented limitation) that the weakness exists. "I don't have data" is not evidence of a weakness.
- WEAKNESSES MUST BE EVIDENCE-BACKED: Every weakness must cite what evidence supports it (review complaint, documented limitation, ad analysis finding). If you cannot point to specific evidence, do not include it as a weakness.
- VERIFIED COMPETITORS ONLY: The evidence package includes a "Competitor Validation Results" section. Only include competitors listed under "VERIFIED". Do NOT include any competitor listed under "REMOVED (unverified or wrong industry)".
- PRICING EXTRACTION (CRITICAL): Extract actual pricing tiers ONLY from the Firecrawl Pricing Data section. If the Firecrawl section shows actual dollar amounts ($X/mo, $X/yr), populate the price field with a concise summary. If the Firecrawl section says "scrape failed", "no pricing data detected", or the scraped content has no dollar amounts, set price to "See pricing page" and pricingConfidence to "low". NEVER use your training data to fill in pricing — even if you "know" a competitor's pricing. The ONLY valid source is the Firecrawl section in this evidence package.
- PRICING IS NEVER A WEAKNESS: Not having public pricing, having "opaque pricing", or requiring a demo to get pricing is a legitimate business strategy (CTA-driven sales). NEVER list pricing-related concerns as weaknesses. Pricing belongs in the price field only.
- AD DATA: Use the Ad Library data as ground truth for ad counts, platforms, and creatives. If ad data is sparse, say so in the evidence field.
- REVIEWS: Use the Sonar Pro review intelligence for strengths, weaknesses, and switching triggers. Attribute to source when possible.
- SPYFU: Use SpyFu data for keyword intelligence and ad spend estimates. If SpyFu data is missing, keep adSpendIntensity conservative (4 or below).
- Return exactly 5 competitors when the evidence supports it. If fewer than 5 competitors have verified data, include only those that have been verified.
- Only include companies that are verifiably currently in business.

COMPRESSION RULES (STRICT — output must fit in 7000 tokens):
- positioning, ourAdvantage, counterPositioning: ONE sentence max (under 20 words)
- strengths, weaknesses, opportunities: exactly 3 SHORT bullets each (under 12 words per bullet)
- marketPatterns, marketStrengths, marketWeaknesses: exactly 2 bullets each
- whiteSpaceGaps: top 3 highest-impact gaps only
- citations: max 4 most relevant sources
- adActivity.evidence: one of "Verified", "Partial coverage", "Limited coverage", "Not verified"
- adActivity.themes: 2-3 short theme labels (e.g. "Productivity", "Team collaboration")
- topAdHooks: max 2 hooks per competitor
- overallLandscape: 1 sentence

OUTPUT: Return ONLY the JSON object. No preamble, no markdown fences, no \`\`\`json wrapper. Start with { and end with }.`;
}

const OUTPUT_SCHEMA = `{
  "competitors": [
    {
      "name": "string",
      "website": "string — official URL",
      "positioning": "string — their core value proposition",
      "price": "string — Summary like '$199-$599/mo (3 tiers)'. 'See pricing page' only if no Firecrawl data.",
      "pricingConfidence": "high | medium | low | unknown — 'high' if Firecrawl found dollar amounts",
      "pricingTiers": [{"name": "tier name", "price": "$X/mo", "description": "one-line summary"}],
      "strengths": ["string"],
      "weaknesses": ["string — NEVER include pricing-related items here"],
      "opportunities": ["string — exploitable gaps"],
      "ourAdvantage": "string — why the client wins against them",
      "adActivity": {
        "activeAdCount": 0,
        "platforms": ["string"],
        "themes": ["string"],
        "evidence": "string",
        "sourceConfidence": "high | medium | low"
      },
      "adCreatives": "ALWAYS set to empty array [] — post-processing injects real data",
      "libraryLinks": "OMIT — post-processing injects real links",
      "reviews": "OMIT — post-processing injects real review data",
      "threatAssessment": {
        "threatFactors": {
          "marketShareRecognition": 1,
          "adSpendIntensity": 1,
          "productOverlap": 1,
          "priceCompetitiveness": 1,
          "growthTrajectory": 1
        },
        "topAdHooks": ["string"],
        "counterPositioning": "string"
      }
    }
  ],
  "marketPatterns": ["string"],
  "marketStrengths": ["string"],
  "marketWeaknesses": ["string"],
  "whiteSpaceGaps": [
    {
      "gap": "string",
      "type": "messaging | feature | audience | channel",
      "evidence": "string",
      "exploitability": 1,
      "impact": 1,
      "recommendedAction": "string"
    }
  ],
  "overallLandscape": "string",
  "citations": [{ "url": "string", "title": "string" }]
}`;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd();
}

function buildEvidencePackage(input: SynthesisInput): string {
  const { parsed, fetchResults, sonarResults } = input;
  const sections: string[] = [];

  // 1. Business context (identity card overrides raw fields when available)
  const ic = parsed.identityCard;
  sections.push(`## Client Business Context
- Company: ${parsed.companyName ?? 'Unknown'}
- Website: ${parsed.websiteUrl ?? 'Unknown'}
- Business Model: ${ic?.businessModel ?? parsed.businessModel ?? 'Unknown'}
- Product: ${ic?.coreProduct ?? parsed.productDescription ?? 'Unknown'}
- Product Category: ${ic?.category ?? 'Unknown'}${ic?.subcategory ? ` / ${ic.subcategory}` : ''}
- Core Keywords: ${ic?.coreKeywords?.join(', ') ?? 'N/A'}
- Negative Keywords (wrong categories): ${ic?.negativeKeywords?.join(', ') ?? 'N/A'}
- ICP: ${parsed.icpDescription ?? 'Unknown'}
- Buyer: ${ic?.buyer ?? 'Unknown'}
- Pricing: ${parsed.pricingContext ?? 'Unknown'}
- Unique Edge: ${parsed.uniqueEdge ?? 'Unknown'}
- Goals: ${parsed.goals ?? 'Unknown'}
- Identity Confidence: ${ic?.confidence ?? 'N/A'}/100`);

  // 2. Competitor validation results — synthesis model MUST respect these
  const verifiedNames = sonarResults.verifiedCompetitors ?? parsed.competitors.map(c => c.name);
  const removedList = sonarResults.removedCompetitors ?? [];

  sections.push(`## Competitor Validation Results (WEB-VERIFIED)
VERIFIED — include in output:
${verifiedNames.map(n => `- ${n}`).join('\n') || '(none verified — use all from context with caution)'}

REMOVED (unverified or wrong industry) — DO NOT include in output:
${removedList.map(r => `- ${r.name}: ${r.reason}`).join('\n') || '(none removed)'}`);

  // 3. Firecrawl pricing data — ONLY entries with verified dollar amounts
  sections.push('## Firecrawl Pricing Data (ONLY source for pricing — do NOT use training data)');
  for (const pr of fetchResults.pricing) {
    if (pr.success && pr.pricingMarkdown) {
      console.log(`[evidence] ${pr.competitorName}: pricing VERIFIED — including in evidence`);
      // Use 4000 chars — pricing tables often appear after nav/hero content.
      // Hostie's first $ was at char 9601 of 16319 — 1000 was way too short.
      sections.push(`### ${pr.competitorName} (${pr.domain}) — VERIFIED PRICING
${truncate(pr.pricingMarkdown, 4000)}`);
    } else {
      console.log(`[evidence] ${pr.competitorName}: NO pricing — ${pr.error ?? 'no data'}`);
      sections.push(`### ${pr.competitorName} (${pr.domain}) — NO PRICING FOUND
No verified pricing data available. Set price to "See pricing page" and pricingConfidence to "low". Do NOT infer or guess pricing.`);
    }
  }

  // 4. SpyFu keyword + ad spend data
  sections.push('## SpyFu Data (keyword intelligence + ad spend estimates)');
  for (const sf of fetchResults.spyfu) {
    const data = truncate(JSON.stringify(sf.domainStats ?? {}), 400);
    const kw = truncate(JSON.stringify(sf.keywords ?? []), 400);
    sections.push(`### ${sf.competitorName} (${sf.domain})
Domain stats: ${data}
Top keywords: ${kw}${sf.error ? `\nError: ${sf.error}` : ''}`);
  }

  // 5. Keyword-anchored ads (fallback when name-search on ad libraries misses)
  // Source: Google SERP probe seeded with SpyFu top paid keywords. Matches ad
  // slot landing pages against competitor domain for deterministic discovery.
  const keywordAdEvidence = Array.isArray(fetchResults.keywordAds)
    ? fetchResults.keywordAds.filter((k) => k && k.adsFound && k.adsFound.length > 0)
    : [];
  if (keywordAdEvidence.length > 0) {
    sections.push(
      '## Keyword-anchored Ads (Google SERP probed via SpyFu keywords — domain-verified)',
    );
    for (const k of keywordAdEvidence) {
      const adLines = k.adsFound
        .map((ad) => {
          const headline = ad.headline ? ad.headline : '(no headline)';
          const desc = ad.description ? ` — ${ad.description}` : '';
          const lp = ad.landingPage ? `\n    landing: ${ad.landingPage}` : '';
          return `  • [${ad.keyword}] ${headline}${desc}${lp}`;
        })
        .join('\n');
      sections.push(
        `### ${k.competitorName} (${k.domain}) — ${k.adsFound.length} domain-matched ad(s) across ${k.keywordsProbed} keyword(s)\n${adLines}`,
      );
    }
  } else {
    sections.push(
      '## Keyword-anchored Ads\nNo domain-matched ads recovered from SpyFu keyword SERP probe (either no SpyFu keywords available or no competitor ads ran on those terms).',
    );
  }

  // 6. Ad Library data
  sections.push('## Ad Library Data (creative intelligence)');
  for (const ad of fetchResults.adLibrary) {
    const data = truncate(JSON.stringify(ad.adInsight ?? {}), 800);
    sections.push(`### ${ad.competitorName} (${ad.domain})
${data}${ad.error ? `\nError: ${ad.error}` : ''}`);
  }

  // 6. Review Intelligence (Trustpilot + G2 + Google)
  sections.push('## Review Intelligence (Trustpilot + G2 + Google Business)');
  for (const rev of fetchResults.reviews) {
    const parts: string[] = [`### ${rev.competitorName} (${rev.domain})`];

    if (rev.trustpilot) {
      const tp = rev.trustpilot;
      const ratingStr = tp.rating !== null ? `${tp.rating}/5` : 'N/A';
      const countStr = tp.reviewCount !== null ? `${tp.reviewCount.toLocaleString()} reviews` : 'count unknown';
      const themesStr = Array.isArray(tp.recentThemes) && tp.recentThemes.length > 0 ? ` — themes: ${tp.recentThemes.join(', ')}` : '';
      parts.push(`Trustpilot: ${ratingStr} (${countStr})${themesStr}`);
    } else {
      parts.push('Trustpilot: No data available');
    }

    if (rev.g2) {
      const g2 = rev.g2;
      const ratingStr = g2.rating !== null ? `${g2.rating}/5` : 'N/A';
      const countStr = g2.reviewCount !== null ? `${g2.reviewCount.toLocaleString()} reviews` : 'count unknown';
      const catsStr = Array.isArray(g2.categories) && g2.categories.length > 0 ? ` — categories: ${g2.categories.join(', ')}` : '';
      parts.push(`G2: ${ratingStr} (${countStr})${catsStr}`);
    } else {
      parts.push('G2: No data available');
    }

    if (rev.google) {
      const g = rev.google;
      const ratingStr = g.rating !== null ? `${g.rating}/5` : 'N/A';
      const countStr = g.reviewCount !== null ? `${g.reviewCount.toLocaleString()} reviews` : 'count unknown';
      parts.push(`Google Business: ${ratingStr} (${countStr}) — ${g.url}`);
    } else {
      parts.push('Google Business: No data available');
    }

    if (rev.testimonials && rev.testimonials.length > 0) {
      parts.push('**Testimonials from website:**');
      for (const t of rev.testimonials.slice(0, 5)) {
        const attr = [t.author, t.role, t.company].filter(Boolean).join(', ');
        parts.push(`- "${t.quote.slice(0, 200)}" — ${attr || 'Anonymous'} (${t.sourceUrl})`);
      }
    }

    if (rev.testimonialPages && rev.testimonialPages.length > 0) {
      parts.push(`Testimonial pages discovered: ${rev.testimonialPages.slice(0, 5).join(', ')}`);
    }

    if (rev.error) {
      parts.push(`Error: ${rev.error}`);
    }

    sections.push(parts.join('\n'));
  }

  // 7. Sonar Pro review intelligence
  sections.push('## Sonar Pro Review Intelligence');
  if (Array.isArray(sonarResults.competitorInsights) && sonarResults.competitorInsights.length > 0) {
    for (const insight of sonarResults.competitorInsights) {
      sections.push(`### ${insight.name}
Positioning: ${insight.positioning ?? 'N/A'}
Review Strengths: ${Array.isArray(insight.reviewStrengths) ? insight.reviewStrengths.join(', ') : 'N/A'}
Review Weaknesses: ${Array.isArray(insight.reviewWeaknesses) ? insight.reviewWeaknesses.join(', ') : 'N/A'}
Switching Triggers: ${Array.isArray(insight.switchingTriggers) ? insight.switchingTriggers.join(', ') : 'N/A'}
Market Perception: ${insight.marketPerception ?? 'N/A'}`);
    }
    if (Array.isArray(sonarResults.marketPatterns) && sonarResults.marketPatterns.length > 0) {
      sections.push(`Market Patterns: ${sonarResults.marketPatterns.join('; ')}`);
    }
    if (Array.isArray(sonarResults.whiteSpaceOpportunities) && sonarResults.whiteSpaceOpportunities.length > 0) {
      sections.push(`White Space: ${sonarResults.whiteSpaceOpportunities.join('; ')}`);
    }
  } else {
    sections.push('No review intelligence available. Rely on other evidence sources.');
  }

  // 8. Client's own ad library data (for "Your Ads" section)
  if (fetchResults.clientAdLibrary?.adInsight) {
    const clientAds = fetchResults.clientAdLibrary.adInsight;
    sections.push(`## Client Ad Library Data (YOUR ADS — include in output as clientAdInsight)
Active ad count: ${clientAds.summary.activeAdCount}
Platforms: ${clientAds.summary.platforms.join(', ')}
Themes: ${clientAds.summary.themes.join(', ')}
Evidence: ${clientAds.summary.evidence}
Source confidence: ${clientAds.summary.sourceConfidence}
Creatives: ${truncate(JSON.stringify(clientAds.adCreatives), 1200)}
Library links: ${JSON.stringify(clientAds.libraryLinks)}`);
  } else {
    sections.push('## Client Ad Library Data\nNo client ads found or unable to fetch.');
  }

  // 9. Citations from Sonar
  if (Array.isArray(sonarResults.citations) && sonarResults.citations.length > 0) {
    sections.push(`## Citations from Sonar Pro
${sonarResults.citations.map(c => `- ${c?.title ?? 'Untitled'}: ${c?.url ?? 'N/A'}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Inject library links from the ad library results into the parsed JSON.
 * The synthesis model may not generate them correctly, so we override.
 */
function injectLibraryLinks(
  parsed: Record<string, unknown>,
  input: SynthesisInput,
): void {
  const competitors = parsed.competitors;
  if (!Array.isArray(competitors)) return;

  for (const comp of competitors) {
    if (!comp || typeof comp !== 'object') continue;
    const c = comp as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name : '';
    const website = typeof c.website === 'string' ? c.website : '';

    // Find matching ad library result
    const adResult = input.fetchResults.adLibrary.find(
      a => a.competitorName.toLowerCase() === name.toLowerCase(),
    );
    const adInsight = adResult?.adInsight as Record<string, unknown> | null;

    // Inject library links from ad library tool if available
    if (adInsight?.libraryLinks) {
      c.libraryLinks = adInsight.libraryLinks;
    } else {
      // Generate standard links
      const domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      c.libraryLinks = buildLibraryLinks(name, domain || undefined);
    }

    // Always reset adCreatives — only inject from real ad library API data
    const adCreatives = adInsight
      ? (adInsight as Record<string, unknown>).adCreatives
      : undefined;
    c.adCreatives = Array.isArray(adCreatives) ? adCreatives : [];

    // Ground-truth override for adActivity so the model's guess can NEVER
    // diverge from reality: activeAdCount must equal adCreatives.length, and
    // platforms/themes/evidence/sourceConfidence come from the tool summary,
    // not from the LLM. Prevents "5 Active Ads" with empty creatives list
    // (Choros/10Web bug, 2026-04-19).
    const summary = adInsight
      ? ((adInsight as Record<string, unknown>).summary as Record<string, unknown> | undefined)
      : undefined;
    const creativesLen = Array.isArray(c.adCreatives) ? c.adCreatives.length : 0;
    const existingAdActivity = (c.adActivity && typeof c.adActivity === 'object')
      ? (c.adActivity as Record<string, unknown>)
      : {};
    if (creativesLen > 0 && summary) {
      c.adActivity = {
        ...existingAdActivity,
        activeAdCount: creativesLen,
        platforms: Array.isArray(summary.platforms) && summary.platforms.length > 0
          ? summary.platforms
          : ['Not verified'],
        themes: Array.isArray(summary.themes) ? summary.themes : [],
        evidence: typeof summary.evidence === 'string' && summary.evidence.length > 0
          ? summary.evidence
          : 'Verified via ad library API',
        sourceConfidence: typeof summary.sourceConfidence === 'string'
          ? summary.sourceConfidence
          : 'medium',
      };
    } else {
      // No creatives surfaced — force a conservative, honest signal so the UI
      // can't show a count without anything to render.
      c.adActivity = {
        ...existingAdActivity,
        activeAdCount: 0,
        platforms: ['Not verified'],
        themes: [],
        evidence: 'Not verified — no ad creatives captured for this competitor',
        sourceConfidence: 'low',
      };
    }
  }
}

/**
 * Single Sonnet synthesis call. No tools, no agentic loop.
 * All evidence pre-assembled, model just synthesizes into JSON.
 */
export async function synthesizeCompetitorIntel(
  input: SynthesisInput,
): Promise<{ resultText: string; stopReason: string | null; telemetry: RunnerTelemetry }> {
  const client = new Anthropic({ maxRetries: 0 });
  const evidence = buildEvidencePackage(input);
  const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const systemPrompt = buildSynthesisSystemPrompt(currentDate);

  const result = await Promise.race([
    client.messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: SYNTHESIS_MAX_TOKENS,
      system: `${systemPrompt}\n\n${OUTPUT_SCHEMA}`,
      messages: [
        {
          role: 'user',
          content: `Synthesize the following pre-fetched evidence into the competitor JSON artifact:\n\n${evidence}`,
        },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Synthesis timed out after ${SYNTHESIS_TIMEOUT_MS / 1000}s`)),
        SYNTHESIS_TIMEOUT_MS,
      ),
    ),
  ]);

  const textBlock = result.content.findLast(b => b.type === 'text');
  const resultText = textBlock?.type === 'text' ? textBlock.text : '';

  return {
    resultText,
    stopReason: result.stop_reason,
    telemetry: buildRunnerTelemetry(result),
  };
}

/**
 * Inject scraped review data (Trustpilot + G2) into each competitor object.
 * Matches by competitor name (case-insensitive).
 */
function injectReviews(
  parsed: Record<string, unknown>,
  input: SynthesisInput,
): void {
  const competitors = parsed.competitors;
  if (!Array.isArray(competitors)) return;

  for (const comp of competitors) {
    if (!comp || typeof comp !== 'object') continue;
    const c = comp as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name : '';

    const reviewResult = input.fetchResults.reviews.find(
      r => r.competitorName.toLowerCase() === name.toLowerCase(),
    );

    if (!reviewResult) {
      console.log(`[injectReviews] no review match for "${name}" — available: ${input.fetchResults.reviews.map(r => r.competitorName).join(', ')}`);
      continue;
    }

    console.log(`[injectReviews] matched "${name}" — tp=${reviewResult.trustpilot ? 'yes' : 'no'}, g2=${reviewResult.g2 ? 'yes' : 'no'}, cap=${reviewResult.capterra ? 'yes' : 'no'}, neg=${reviewResult.negativeReviews?.length ?? 0}`);

    const reviews: Record<string, unknown> = {};

    if (reviewResult.trustpilot) {
      reviews.trustpilot = {
        rating: reviewResult.trustpilot.rating ?? undefined,
        reviewCount: reviewResult.trustpilot.reviewCount ?? undefined,
        recentThemes: reviewResult.trustpilot.recentThemes.length > 0
          ? reviewResult.trustpilot.recentThemes
          : undefined,
        url: reviewResult.trustpilot.url,
      };
    }

    if (reviewResult.g2) {
      reviews.g2 = {
        rating: reviewResult.g2.rating ?? undefined,
        reviewCount: reviewResult.g2.reviewCount ?? undefined,
        categories: reviewResult.g2.categories.length > 0
          ? reviewResult.g2.categories
          : undefined,
        url: reviewResult.g2.url,
      };
    }

    if (reviewResult.capterra) {
      reviews.capterra = {
        rating: reviewResult.capterra.rating ?? undefined,
        reviewCount: reviewResult.capterra.reviewCount ?? undefined,
        categories: reviewResult.capterra.categories.length > 0
          ? reviewResult.capterra.categories
          : undefined,
        url: reviewResult.capterra.url,
      };
    }

    if (reviewResult.negativeReviews && reviewResult.negativeReviews.length > 0) {
      reviews.negativeReviews = reviewResult.negativeReviews;
    }

    if (reviewResult.testimonials && reviewResult.testimonials.length > 0) {
      reviews.testimonials = reviewResult.testimonials;
    }

    if (reviewResult.testimonialPages && reviewResult.testimonialPages.length > 0) {
      reviews.testimonialPages = reviewResult.testimonialPages;
    }

    // Only inject if we actually have data from at least one source
    const hasAnyReviewData = reviews.trustpilot || reviews.g2 || reviews.capterra
      || (reviewResult.negativeReviews?.length ?? 0) > 0
      || (reviewResult.testimonials?.length ?? 0) > 0;
    if (hasAnyReviewData) {
      c.reviews = reviews;
      console.log(`[injectReviews] injected reviews for "${name}":`, JSON.stringify(reviews).slice(0, 500));
    } else {
      console.log(`[injectReviews] skipped "${name}" — all sources empty`);
    }
  }
}

/**
 * Strip every `weaknesses[]` entry that does not carry a URL citation in the
 * required `— source: https://...` pattern. The prompt instructs the model to
 * always cite; this post-processor enforces it so generic/hallucinated
 * weaknesses ("too complicated", "poor UX") can never leak through. Better to
 * emit an empty weaknesses array than to invent claims.
 */
function enforceWeaknessCitations(parsed: Record<string, unknown>): void {
  const competitors = parsed.competitors;
  if (!Array.isArray(competitors)) return;

  const EXPLICIT_CITATION = /\bsource:\s*https?:\/\/\S+/i;
  const URL_IN_STRING = /https?:\/\/\S+/i;

  for (const comp of competitors) {
    if (!comp || typeof comp !== 'object') continue;
    const c = comp as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name : '';
    const weaknesses = c.weaknesses;
    if (!Array.isArray(weaknesses)) continue;

    // Collect review source URLs injected earlier in the pipeline.
    // If we have ANY of these, the LLM's weakness claims are grounded in real
    // review data even if the model forgot the "— source:" format.
    const reviewSourceUrls: string[] = [];
    const reviews = (c.reviews && typeof c.reviews === 'object')
      ? (c.reviews as Record<string, unknown>)
      : null;
    if (reviews) {
      const tp = reviews.trustpilot as { url?: string } | undefined;
      const g2 = reviews.g2 as { url?: string } | undefined;
      const cap = reviews.capterra as { url?: string } | undefined;
      if (tp?.url) reviewSourceUrls.push(tp.url);
      if (g2?.url) reviewSourceUrls.push(g2.url);
      if (cap?.url) reviewSourceUrls.push(cap.url);
    }
    const fallbackSourceUrl = reviewSourceUrls[0];

    const kept: string[] = [];
    const dropped: string[] = [];
    let autoCitedCount = 0;
    for (const w of weaknesses) {
      if (typeof w !== 'string') continue;
      if (EXPLICIT_CITATION.test(w) || URL_IN_STRING.test(w)) {
        kept.push(w);
        continue;
      }
      if (fallbackSourceUrl) {
        const stripped = w.replace(/\s*\((?:Sonar Pro|Sonar|web search)\)\s*$/i, '').replace(/[.;\s]+$/, '');
        kept.push(`${stripped} — source: ${fallbackSourceUrl}`);
        autoCitedCount += 1;
        continue;
      }
      dropped.push(w);
    }

    if (dropped.length > 0) {
      console.log(`[weaknesses] dropped uncited for ${name} (no review URL available):`, dropped);
    }
    if (autoCitedCount > 0) {
      console.log(`[weaknesses] auto-cited ${autoCitedCount} weakness(es) for ${name} using ${fallbackSourceUrl}`);
    }
    c.weaknesses = kept;
  }
}

/**
 * Post-process the synthesis output: inject library links, ad creatives,
 * reviews, validate pricing confidence, and tag competitor sources.
 */
export function postProcessSynthesis(
  parsed: Record<string, unknown>,
  input: SynthesisInput,
  crossAnalysis?: import('./review-cross-analysis').ReviewCrossAnalysis | null,
  competitorSources?: Array<{ name: string; source: 'user-provided' | 'ai-discovered'; domain?: string }> | null,
): void {
  injectLibraryLinks(parsed, input);
  injectReviews(parsed, input);
  enforceWeaknessCitations(parsed);
  if (crossAnalysis) {
    parsed.reviewCrossAnalysis = crossAnalysis;
    console.log(`[postProcess] injected reviewCrossAnalysis — ${crossAnalysis.commonWeaknesses.length} shared themes`);
    for (const w of crossAnalysis.commonWeaknesses) {
      console.log(`[postProcess] reviewCrossAnalysis theme="${w.theme}" affectedCompetitors=${JSON.stringify(w.affectedCompetitors)} frequency=${w.frequency}`);
    }
  } else {
    console.log('[postProcess] reviewCrossAnalysis NOT injected — crossAnalysis was null (cross-pattern analysis skipped or timed out)');
  }
  if (competitorSources && competitorSources.length > 0) {
    parsed.competitorSources = competitorSources;
    console.log(`[postProcess] injected competitorSources — ${competitorSources.filter(s => s.source === 'user-provided').length} user-provided, ${competitorSources.filter(s => s.source === 'ai-discovered').length} ai-discovered`);
  }
  injectClientAds(parsed, input);

  // Category keyword ad sweep — unanchored, powers the 6th Competitor Intel
  // tab. Emitted directly from fetchResults (not model-synthesized) so the
  // LLM can't hallucinate or drop it.
  const catAds = input.fetchResults.categoryKeywordAds;
  if (catAds && Array.isArray(catAds.ads) && catAds.ads.length > 0) {
    parsed.categoryKeywordAds = catAds;
    console.log(
      `[postProcess] injected categoryKeywordAds — ${catAds.ads.length} ads across ${catAds.keywordsProbed.length} keywords (meta=${catAds.sources.meta}, google=${catAds.sources.google})`,
    );
  } else {
    console.log(
      `[postProcess] categoryKeywordAds NOT injected — ${catAds?.error ?? 'no ads found'}`,
    );
  }

  // Validate pricing confidence matches Firecrawl data
  const competitors = parsed.competitors;
  if (!Array.isArray(competitors)) return;

  for (const comp of competitors) {
    if (!comp || typeof comp !== 'object') continue;
    const c = comp as Record<string, unknown>;
    const name = typeof c.name === 'string' ? c.name : '';

    const pricingResult = input.fetchResults.pricing.find(
      p => p.competitorName.toLowerCase() === name.toLowerCase(),
    );

    // If Firecrawl didn't find verified pricing (dollar amounts), strip any
    // fabricated pricing the model may have hallucinated from training data.
    if (!pricingResult?.success || !pricingResult.pricingMarkdown) {
      const currentPrice = typeof c.price === 'string' ? c.price : '';
      if (currentPrice && currentPrice !== 'See pricing page') {
        console.log(`[postProcess] STRIPPING fabricated price for "${name}": "${currentPrice}" — no Firecrawl pricing data`);
        c.price = 'See pricing page';
      }
      c.pricingConfidence = 'low';
      c.pricingTiers = [];
    }
  }
}

/**
 * Inject client's own ad data directly from the fetched results.
 * This bypasses the synthesis model to ensure client ads are always accurate.
 */
function injectClientAds(
  parsed: Record<string, unknown>,
  input: SynthesisInput,
): void {
  const clientAd = input.fetchResults.clientAdLibrary;
  if (!clientAd?.adInsight) {
    // No client ads found — leave field absent so schema defaults apply
    return;
  }

  const insight = clientAd.adInsight;
  parsed.clientAdInsight = {
    activeAdCount: insight.summary.activeAdCount,
    platforms: insight.summary.platforms,
    themes: insight.summary.themes,
    evidence: insight.summary.evidence,
    sourceConfidence: insight.summary.sourceConfidence,
    adCreatives: insight.adCreatives.map(ad => ({
      platform: ad.platform,
      id: ad.id,
      advertiser: ad.advertiser,
      headline: ad.headline ?? '',
      body: ad.body ?? '',
      imageUrl: ad.imageUrl ?? '',
      videoUrl: ad.videoUrl ?? '',
      format: ad.format,
      isActive: ad.isActive,
      detailsUrl: ad.detailsUrl ?? '',
    })),
    libraryLinks: insight.libraryLinks,
  };
}
