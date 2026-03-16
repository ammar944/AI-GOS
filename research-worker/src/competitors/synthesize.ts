// research-worker/src/competitors/synthesize.ts
// Single Sonnet call that assembles all pre-fetched evidence into the competitor JSON artifact.
// No tools — pure synthesis. All data already collected in parallel.

import Anthropic from '@anthropic-ai/sdk';
import type { ParsedCompetitorContext } from './parse-context';
import type { ParallelFetchResults } from './parallel-fetch';
import type { SonarCompetitorResult } from './sonar-research';
import { buildLibraryLinks } from '../tools/adlibrary';

const SYNTHESIS_MODEL =
  process.env.RESEARCH_COMPETITORS_SYNTHESIS_MODEL ?? 'claude-haiku-4-5-20251001';
const SYNTHESIS_MAX_TOKENS = 8000;
const SYNTHESIS_TIMEOUT_MS = 60_000;

export interface SynthesisInput {
  parsed: ParsedCompetitorContext;
  fetchResults: ParallelFetchResults;
  sonarResults: SonarCompetitorResult;
}

const SYNTHESIS_SYSTEM_PROMPT = `You are an expert competitive analyst producing a competitor artifact for a paid media strategist.

TASK: Synthesize the pre-fetched evidence into the required JSON schema. All research data has already been gathered — your job is ONLY to synthesize it, not to research further.

CRITICAL RULES:
- PRICING: Use ONLY the Firecrawl pricing data as ground truth. If Firecrawl found pricing, use those exact tiers. If Firecrawl did NOT find pricing, set price to "See pricing page" and pricingConfidence to "low". NEVER infer or hallucinate pricing.
- AD DATA: Use the Ad Library data as ground truth for ad counts, platforms, and creatives. If ad data is sparse, say so in the evidence field.
- REVIEWS: Use the Sonar Pro review intelligence for strengths, weaknesses, and switching triggers. Attribute to source when possible.
- SPYFU: Use SpyFu data for keyword intelligence and ad spend estimates. If SpyFu data is missing, keep adSpendIntensity conservative (4 or below).
- Return exactly 5 competitors when the evidence supports it. If fewer than 5 competitors have data, include what you have.
- Do not invent competitors, data points, or claims not in the evidence.

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

const OUTPUT_SCHEMA = `{
  "competitors": [
    {
      "name": "string",
      "website": "string — official URL",
      "positioning": "string — their core value proposition",
      "price": "string — FROM FIRECRAWL DATA ONLY, or 'See pricing page'",
      "pricingConfidence": "high | medium | low | unknown",
      "strengths": ["string"],
      "weaknesses": ["string"],
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

  // 1. Business context
  sections.push(`## Client Business Context
- Company: ${parsed.companyName ?? 'Unknown'}
- Website: ${parsed.websiteUrl ?? 'Unknown'}
- Business Model: ${parsed.businessModel ?? 'Unknown'}
- Product: ${parsed.productDescription ?? 'Unknown'}
- ICP: ${parsed.icpDescription ?? 'Unknown'}
- Pricing: ${parsed.pricingContext ?? 'Unknown'}
- Unique Edge: ${parsed.uniqueEdge ?? 'Unknown'}
- Goals: ${parsed.goals ?? 'Unknown'}`);

  // 2. Competitors list
  sections.push(`## Competitors Identified (from user)
${parsed.competitors.map(c => `- ${c.name} (${c.domain ?? 'no domain'})${c.inferredDomain ? ' [domain inferred]' : ''}`).join('\n')}`);

  // 3. Firecrawl pricing data
  sections.push('## Firecrawl Pricing Data (GROUND TRUTH for pricing)');
  for (const pr of fetchResults.pricing) {
    if (pr.success && pr.pricingMarkdown) {
      sections.push(`### ${pr.competitorName} (${pr.domain})
${truncate(pr.pricingMarkdown, 1000)}`);
    } else {
      sections.push(`### ${pr.competitorName} (${pr.domain})
Pricing scrape failed: ${pr.error ?? 'No data'}. Use "See pricing page" with pricingConfidence: "low".`);
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

  // 5. Ad Library data
  sections.push('## Ad Library Data (creative intelligence)');
  for (const ad of fetchResults.adLibrary) {
    const data = truncate(JSON.stringify(ad.adInsight ?? {}), 800);
    sections.push(`### ${ad.competitorName} (${ad.domain})
${data}${ad.error ? `\nError: ${ad.error}` : ''}`);
  }

  // 6. Sonar Pro review intelligence
  sections.push('## Sonar Pro Review Intelligence');
  if (sonarResults.competitorInsights.length > 0) {
    for (const insight of sonarResults.competitorInsights) {
      sections.push(`### ${insight.name}
Positioning: ${insight.positioning ?? 'N/A'}
Review Strengths: ${(insight.reviewStrengths ?? []).join(', ') || 'N/A'}
Review Weaknesses: ${(insight.reviewWeaknesses ?? []).join(', ') || 'N/A'}
Switching Triggers: ${(insight.switchingTriggers ?? []).join(', ') || 'N/A'}
Market Perception: ${insight.marketPerception ?? 'N/A'}`);
    }
    if (sonarResults.marketPatterns?.length > 0) {
      sections.push(`Market Patterns: ${sonarResults.marketPatterns.join('; ')}`);
    }
    if (sonarResults.whiteSpaceOpportunities?.length > 0) {
      sections.push(`White Space: ${sonarResults.whiteSpaceOpportunities.join('; ')}`);
    }
  } else {
    sections.push('No review intelligence available. Rely on other evidence sources.');
  }

  // 7. Citations from Sonar
  if (sonarResults.citations.length > 0) {
    sections.push(`## Citations from Sonar Pro
${sonarResults.citations.map(c => `- ${c.title}: ${c.url}`).join('\n')}`);
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
  }
}

/**
 * Single Sonnet synthesis call. No tools, no agentic loop.
 * All evidence pre-assembled, model just synthesizes into JSON.
 */
export async function synthesizeCompetitorIntel(
  input: SynthesisInput,
): Promise<{ resultText: string; stopReason: string | null }> {
  const client = new Anthropic({ maxRetries: 0 });
  const evidence = buildEvidencePackage(input);

  const result = await Promise.race([
    client.messages.create({
      model: SYNTHESIS_MODEL,
      max_tokens: SYNTHESIS_MAX_TOKENS,
      system: `${SYNTHESIS_SYSTEM_PROMPT}\n\n${OUTPUT_SCHEMA}`,
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
  };
}

/**
 * Post-process the synthesis output: inject library links, ad creatives,
 * and validate pricing confidence.
 */
export function postProcessSynthesis(
  parsed: Record<string, unknown>,
  input: SynthesisInput,
): void {
  injectLibraryLinks(parsed, input);

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

    // If Firecrawl didn't find pricing, force low confidence
    if (!pricingResult?.success || !pricingResult.pricingMarkdown) {
      if (c.pricingConfidence === 'high' || c.pricingConfidence === 'medium') {
        c.pricingConfidence = 'low';
      }
    }
  }
}
