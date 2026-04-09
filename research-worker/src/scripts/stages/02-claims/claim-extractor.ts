/**
 * Stage 02 — Claim Extractor (deterministic, 0 AI tokens)
 *
 * Pre-extracts structured citable claims from trimmed research context.
 * AI stages pick from this menu instead of mining raw JSON.
 *
 * ICM contract:
 *   Input:  TrimmedResearchContext (from trim-research-context.ts)
 *   Output: ExtractedClaim[] — structured, citable, source-attributed claims
 */

export interface ExtractedClaim {
  id: number;
  claim: string;
  source: string;
  stat: string | null;
  category: ClaimCategory;
}

export type ClaimCategory =
  | 'market-size'
  | 'audience-pain'
  | 'audience-trigger'
  | 'competitor-weakness'
  | 'competitor-hook'
  | 'offer-strength'
  | 'offer-differentiator'
  | 'pricing'
  | 'result-metric'
  | 'objection-data'
  | 'keyword'
  | 'positioning'
  | 'general';

// --- Extraction helpers ---

const STAT_REGEX = /(\d[\d,.]*[%$KkMmBb]*(?:\s*(?:to|–|-)\s*\d[\d,.]*[%$KkMmBb]*)?)/;

function extractStat(text: string): string | null {
  const match = text.match(STAT_REGEX);
  return match ? match[1] : null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s\S*$/, '') + '...';
}

function isNonEmpty(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 5;
}

function asRecord(val: unknown): Record<string, unknown> | null {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  return null;
}

function asArray(val: unknown): unknown[] {
  return Array.isArray(val) ? val : [];
}

// --- Main extractor ---

export function extractClaims(researchContext: Record<string, unknown>): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  let id = 0;

  const add = (claim: string, source: string, category: ClaimCategory) => {
    const clean = truncate(claim.trim(), 250);
    if (clean.length < 10) return;
    // Dedup by normalized text
    const norm = clean.toLowerCase().slice(0, 60);
    if (claims.some((c) => c.claim.toLowerCase().slice(0, 60) === norm)) return;
    claims.push({ id: id++, claim: clean, source, stat: extractStat(clean), category });
  };

  // --- ICP Validation ---
  const icp = asRecord(researchContext.icpValidation);
  if (icp) {
    // Triggers → audience-trigger
    for (const t of asArray(icp.triggers)) {
      const rec = asRecord(t);
      const text = rec?.trigger ?? rec?.text ?? rec?.description;
      if (isNonEmpty(text)) add(text as string, 'icpValidation.triggers', 'audience-trigger');
    }

    // Objections → objection-data
    for (const o of asArray(icp.objections)) {
      const rec = asRecord(o);
      const text = rec?.objection ?? rec?.text ?? rec?.description;
      if (isNonEmpty(text)) add(text as string, 'icpValidation.objections', 'objection-data');
    }

    // Pain points
    for (const p of asArray(icp.painPoints ?? icp.challenges)) {
      const text = typeof p === 'string' ? p : (asRecord(p)?.pain ?? asRecord(p)?.text);
      if (isNonEmpty(text)) add(text as string, 'icpValidation.painPoints', 'audience-pain');
    }

    // Audience refinements
    for (const r of asArray(icp.audienceRefinements)) {
      const text = typeof r === 'string' ? r : (asRecord(r)?.refinement ?? asRecord(r)?.text);
      if (isNonEmpty(text)) add(text as string, 'icpValidation.audienceRefinements', 'audience-pain');
    }

    // Persona summary
    const persona = asRecord(icp.persona);
    if (persona) {
      const role = persona.role as string | undefined;
      const company = persona.company as string | undefined;
      if (isNonEmpty(role)) add(`Target: ${role}${company ? ` at ${company}` : ''}`, 'icpValidation.persona', 'audience-pain');
    }
  }

  // --- Offer Analysis ---
  const offer = asRecord(researchContext.offerAnalysis);
  if (offer) {
    // Strengths
    for (const s of asArray(offer.strengths ?? offer.offerStrengths)) {
      const text = typeof s === 'string' ? s : (asRecord(s)?.strength ?? asRecord(s)?.text);
      if (isNonEmpty(text)) add(text as string, 'offerAnalysis.strengths', 'offer-strength');
    }

    // Differentiators
    for (const d of asArray(offer.differentiators ?? offer.uniqueValueProps)) {
      const text = typeof d === 'string' ? d : (asRecord(d)?.differentiator ?? asRecord(d)?.text);
      if (isNonEmpty(text)) add(text as string, 'offerAnalysis.differentiators', 'offer-differentiator');
    }

    // Red flags (often contain stats)
    for (const rf of asArray(offer.redFlags)) {
      const rec = asRecord(rf);
      const text = rec?.flag ?? rec?.description ?? rec?.text;
      if (isNonEmpty(text) && STAT_REGEX.test(text as string)) {
        add(text as string, 'offerAnalysis.redFlags', 'result-metric');
      }
    }

    // Market fit assessment
    const mfa = asRecord(offer.marketFitAssessment);
    if (mfa) {
      for (const [key, val] of Object.entries(mfa)) {
        if (isNonEmpty(val) && STAT_REGEX.test(val as string)) {
          add(val as string, `offerAnalysis.marketFitAssessment.${key}`, 'result-metric');
        }
      }
    }

    // Pricing analysis
    const pricing = asRecord(offer.pricingAnalysis);
    if (pricing) {
      const benchmark = pricing.marketBenchmark ?? pricing.coldTrafficViability ?? pricing.summary;
      if (isNonEmpty(benchmark)) add(benchmark as string, 'offerAnalysis.pricingAnalysis', 'pricing');
    }

    // Messaging recommendations
    for (const m of asArray(offer.messagingRecommendations)) {
      const text = typeof m === 'string' ? m : (asRecord(m)?.recommendation ?? asRecord(m)?.text);
      if (isNonEmpty(text)) add(text as string, 'offerAnalysis.messaging', 'offer-differentiator');
    }
  }

  // --- Competitors ---
  const comp = asRecord(researchContext.competitors);
  if (comp) {
    for (const c of asArray(comp.competitors).slice(0, 3)) {
      const rec = asRecord(c);
      if (!rec) continue;
      const name = String(rec.name ?? rec.advertiser ?? 'Competitor');

      // Weaknesses
      for (const w of asArray(rec.weaknesses ?? rec.gaps)) {
        const text = typeof w === 'string' ? w : (asRecord(w)?.weakness ?? asRecord(w)?.text);
        if (isNonEmpty(text)) add(`${name}: ${text}`, 'competitors.weaknesses', 'competitor-weakness');
      }

      // Top ad hooks
      const threat = asRecord(rec.threatAssessment);
      if (threat) {
        for (const h of asArray(threat.topAdHooks).slice(0, 3)) {
          if (isNonEmpty(h)) add(`${name} hook: "${h}"`, 'competitors.threatAssessment.topAdHooks', 'competitor-hook');
        }
      }
    }
  }

  // --- Competitor Ad Intel (from trim-research-context) ---
  for (const ci of asArray(researchContext.competitorAdIntel)) {
    const rec = asRecord(ci);
    if (!rec) continue;
    const advertiser = String(rec.advertiser ?? 'Competitor');
    for (const h of asArray(rec.topAdHooks).slice(0, 3)) {
      if (isNonEmpty(h)) add(`${advertiser} hook: "${h}"`, 'competitorAdIntel', 'competitor-hook');
    }
  }

  // --- Keywords ---
  const kw = asRecord(researchContext.keywordIntel);
  if (kw) {
    for (const k of asArray(kw.keywords).slice(0, 8)) {
      const rec = asRecord(k);
      if (!rec) continue;
      const keyword = rec.keyword ?? rec.term ?? rec.text;
      const volume = rec.searchVolume ?? rec.volume;
      if (isNonEmpty(keyword)) {
        const text = volume ? `"${keyword}" (${volume} monthly searches)` : `"${keyword}"`;
        add(text, 'keywordIntel.keywords', 'keyword');
      }
    }
  }

  // --- Cross Analysis (Synthesis) ---
  const synthesis = asRecord(researchContext.crossAnalysis);
  if (synthesis) {
    for (const insight of asArray(synthesis.keyInsights).slice(0, 5)) {
      const text = typeof insight === 'string' ? insight : (asRecord(insight)?.insight ?? asRecord(insight)?.text);
      if (isNonEmpty(text)) add(text as string, 'crossAnalysis.keyInsights', 'positioning');
    }

    if (isNonEmpty(synthesis.positioningStrategy)) {
      add(synthesis.positioningStrategy as string, 'crossAnalysis.positioningStrategy', 'positioning');
    }
  }

  // --- Positioning moves ---
  for (const pm of asArray(researchContext.positioningMoves).slice(0, 3)) {
    const text = typeof pm === 'string' ? pm : (asRecord(pm)?.move ?? asRecord(pm)?.text);
    if (isNonEmpty(text)) add(text as string, 'positioningMoves', 'positioning');
  }

  // --- Research stats (already extracted by trim-research-context) ---
  for (const rs of asArray(researchContext.researchStats)) {
    const rec = asRecord(rs);
    if (!rec) continue;
    if (isNonEmpty(rec.stat)) add(rec.stat as string, String(rec.source ?? 'researchStats'), 'result-metric');
  }

  // --- Industry Market ---
  const industry = asRecord(researchContext.industryMarket);
  if (industry) {
    const snapshot = industry.categorySnapshot;
    if (isNonEmpty(snapshot)) add(snapshot as string, 'industryMarket.categorySnapshot', 'market-size');
  }

  // --- Top Actions ---
  for (const ta of asArray(researchContext.topActions).slice(0, 5)) {
    const text = typeof ta === 'string' ? ta : (asRecord(ta)?.action ?? asRecord(ta)?.text);
    if (isNonEmpty(text)) add(text as string, 'topActions', 'positioning');
  }

  return claims;
}

/**
 * Get claims assigned to a specific script plan, formatted for prompt injection.
 * Returns a short, readable block the AI can reference.
 */
export function formatClaimsForScript(
  allClaims: ExtractedClaim[],
  claimIndices: number[],
): string {
  if (claimIndices.length === 0 || allClaims.length === 0) {
    return 'No specific claims assigned. Write benefit-driven copy without citing specific numbers.';
  }

  const assigned = claimIndices
    .map((i) => allClaims[i])
    .filter(Boolean);

  if (assigned.length === 0) return 'No specific claims assigned.';

  return assigned
    .map((c) => `- [${c.source}] ${c.claim}${c.stat ? ` (stat: ${c.stat})` : ''}`)
    .join('\n');
}
