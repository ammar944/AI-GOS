/**
 * Research Wiki — structured knowledge persistence for runner context sharing.
 *
 * Implements the Karpathy LLM Wiki pattern: each runner writes findings as
 * structured entries to Supabase. Subsequent runners read relevant entries
 * instead of receiving lossy summarized context.
 *
 * Entry extraction is per-section and deterministic — same runner output
 * always produces the same wiki entries.
 */

import { getClient, type ProvenanceSource } from './supabase';

export interface WikiEntry {
  topic: string;
  content: string;
  source_runner: string;
  provenance: ProvenanceSource;
  source_url?: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entry(
  topic: string,
  content: string,
  runner: string,
  provenance: ProvenanceSource = 'ai_synthesis',
  confidence = 70,
  sourceUrl?: string,
): WikiEntry {
  return {
    topic,
    content: content.slice(0, 300),
    source_runner: runner,
    provenance,
    confidence,
    ...(sourceUrl ? { source_url: sourceUrl } : {}),
  };
}

/** Infer provenance from presence of citations/URLs in the data. */
function inferProvenance(
  data: Record<string, unknown>,
): ProvenanceSource {
  if (data.citations && Array.isArray(data.citations) && data.citations.length > 0) return 'tool_output';
  if (data.sources && Array.isArray(data.sources) && data.sources.length > 0) return 'web_search';
  return 'ai_synthesis';
}

function safeStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return '';
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------
// Section extractors
// ---------------------------------------------------------------------------

function extractIdentity(data: Record<string, unknown>): WikiEntry[] {
  const entries: WikiEntry[] = [];
  const r = 'identityResolution';

  if (data.category) entries.push(entry('identity_category', safeStr(data.category), r, 'ai_synthesis', 80));
  if (data.subcategory) entries.push(entry('identity_subcategory', safeStr(data.subcategory), r, 'ai_synthesis', 80));
  if (data.positioning) entries.push(entry('identity_positioning', safeStr(data.positioning), r, 'ai_synthesis', 75));
  if (data.oneLiner) entries.push(entry('identity_one_liner', safeStr(data.oneLiner), r, 'ai_synthesis', 80));
  if (data.targetAudience) entries.push(entry('identity_target_audience', safeStr(data.targetAudience), r, 'ai_synthesis', 75));

  const kw = data.coreKeywords;
  if (Array.isArray(kw)) {
    entries.push(entry('identity_keywords', kw.slice(0, 10).join(', '), r, 'ai_synthesis', 70));
  }
  const neg = data.negativeKeywords;
  if (Array.isArray(neg)) {
    entries.push(entry('identity_negative_keywords', neg.slice(0, 10).join(', '), r, 'ai_synthesis', 70));
  }

  return entries;
}

function extractIndustry(data: Record<string, unknown>): WikiEntry[] {
  const entries: WikiEntry[] = [];
  const r = 'industryResearch';
  const prov = inferProvenance(data);

  const snap = data.categorySnapshot as Record<string, unknown> | undefined;
  if (snap) {
    if (snap.category) entries.push(entry('market_category', safeStr(snap.category), r, prov, 80));
    if (snap.marketSize) entries.push(entry('market_size', safeStr(snap.marketSize), r, prov, 75));
    if (snap.growthTrajectory) entries.push(entry('market_growth', safeStr(snap.growthTrajectory), r, prov, 70));
    if (snap.regulatoryEnvironment) entries.push(entry('market_regulatory', safeStr(snap.regulatoryEnvironment), r, prov, 65));
  }

  const pain = data.painPoints as Record<string, unknown> | undefined;
  if (pain?.primary && Array.isArray(pain.primary)) {
    for (const p of pain.primary.slice(0, 5)) {
      entries.push(entry('pain_point', safeStr(p), r, prov, 75));
    }
  }

  const trends = data.trendSignals;
  if (Array.isArray(trends)) {
    for (const t of trends.slice(0, 5)) {
      const txt = typeof t === 'object' && t !== null ? safeStr((t as Record<string, unknown>).signal ?? t) : safeStr(t);
      entries.push(entry('trend_signal', txt, r, prov, 70));
    }
  }

  const opp = data.marketOpportunities;
  if (Array.isArray(opp)) {
    for (const o of opp.slice(0, 3)) {
      const txt = typeof o === 'object' && o !== null ? safeStr((o as Record<string, unknown>).opportunity ?? o) : safeStr(o);
      entries.push(entry('market_opportunity', txt, r, prov, 70));
    }
  }

  return entries;
}

function extractICP(data: Record<string, unknown>): WikiEntry[] {
  const entries: WikiEntry[] = [];
  const r = 'icpValidation';
  const prov = inferProvenance(data);

  const persona = data.validatedPersona as Record<string, unknown> | undefined;
  if (persona) {
    if (persona.role) entries.push(entry('icp_role', safeStr(persona.role), r, prov, 80));
    if (persona.industry) entries.push(entry('icp_industry', safeStr(persona.industry), r, prov, 80));
    if (persona.companySize) entries.push(entry('icp_company_size', safeStr(persona.companySize), r, prov, 75));
    if (persona.dailyReality) entries.push(entry('icp_daily_reality', safeStr(persona.dailyReality), r, prov, 70));
  }

  const triggers = data.purchaseTriggers ?? data.triggers;
  if (Array.isArray(triggers)) {
    for (const t of triggers.slice(0, 5)) {
      entries.push(entry('icp_trigger', safeStr(t), r, prov, 75));
    }
  }

  const objections = data.objections;
  if (Array.isArray(objections)) {
    for (const o of objections.slice(0, 5)) {
      entries.push(entry('icp_objection', safeStr(o), r, prov, 70));
    }
  }

  const channels = data.channels ?? data.discoveryChannels;
  if (Array.isArray(channels)) {
    for (const c of channels.slice(0, 5)) {
      entries.push(entry('icp_channel', safeStr(c), r, prov, 70));
    }
  }

  return entries;
}

function extractCompetitors(data: Record<string, unknown>): WikiEntry[] {
  const entries: WikiEntry[] = [];
  const r = 'competitorIntel';

  const competitors = data.competitors;
  if (Array.isArray(competitors)) {
    for (const comp of competitors.slice(0, 5)) {
      const c = comp as Record<string, unknown>;
      const name = safeStr(c.name ?? c.companyName ?? '');
      if (!name) continue;

      entries.push(entry('competitor_name', name, r, 'tool_output', 85));
      if (c.domain) entries.push(entry('competitor_domain', `${name}: ${safeStr(c.domain)}`, r, 'tool_output', 90));
      if (c.positioning) entries.push(entry('competitor_positioning', `${name}: ${safeStr(c.positioning)}`, r, 'tool_output', 75));
      if (c.pricing) entries.push(entry('competitor_pricing', `${name}: ${safeStr(c.pricing)}`, r, 'tool_output', 70));
      if (c.weakness) entries.push(entry('competitor_weakness', `${name}: ${safeStr(c.weakness)}`, r, 'ai_synthesis', 65));
      if (c.adActivity) entries.push(entry('competitor_ad_activity', `${name}: ${safeStr(c.adActivity)}`, r, 'tool_output', 75));
    }
  }

  const moves = data.positioningMoves;
  if (Array.isArray(moves)) {
    for (const m of moves.slice(0, 3)) {
      const mv = m as Record<string, unknown>;
      entries.push(entry('positioning_move', safeStr(mv.move ?? m), r, 'ai_synthesis', 65));
    }
  }

  return entries;
}

function extractOffer(data: Record<string, unknown>): WikiEntry[] {
  const entries: WikiEntry[] = [];
  const r = 'offerAnalysis';
  const prov = inferProvenance(data);

  const vps = data.valuePropositions ?? data.offerBreakdown;
  if (Array.isArray(vps)) {
    for (const vp of vps.slice(0, 5)) {
      entries.push(entry('offer_value_prop', safeStr(vp), r, prov, 75));
    }
  }

  if (data.pricing) entries.push(entry('offer_pricing', safeStr(data.pricing), r, prov, 70));
  if (data.offerStrength) entries.push(entry('offer_strength', safeStr(data.offerStrength), r, prov, 65));
  if (data.uniqueMechanism) entries.push(entry('offer_mechanism', safeStr(data.uniqueMechanism), r, prov, 70));

  const roi = data.roiClaims ?? data.proofPoints;
  if (Array.isArray(roi)) {
    for (const claim of roi.slice(0, 3)) {
      entries.push(entry('offer_roi_claim', safeStr(claim), r, prov, 60));
    }
  }

  return entries;
}

function extractKeywords(data: Record<string, unknown>): WikiEntry[] {
  const entries: WikiEntry[] = [];
  const r = 'keywordIntel';

  const groups = data.campaignGroups ?? data.keywordGroups;
  if (Array.isArray(groups)) {
    for (const g of groups.slice(0, 5)) {
      const grp = g as Record<string, unknown>;
      const name = safeStr(grp.name ?? grp.theme ?? '');
      const kws = Array.isArray(grp.keywords) ? grp.keywords.slice(0, 5).join(', ') : '';
      entries.push(entry('keyword_group', `${name}: ${kws}`, r, 'tool_output', 75));
    }
  }

  const negatives = data.negativeKeywords;
  if (Array.isArray(negatives)) {
    entries.push(entry('keyword_negatives', negatives.slice(0, 15).join(', '), r, 'tool_output', 80));
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const SECTION_EXTRACTOR: Record<string, (data: Record<string, unknown>) => WikiEntry[]> = {
  identityResolution: extractIdentity,
  resolveIdentity: extractIdentity,
  industryResearch: extractIndustry,
  researchIndustry: extractIndustry,
  icpValidation: extractICP,
  researchICP: extractICP,
  competitorIntel: extractCompetitors,
  researchCompetitors: extractCompetitors,
  offerAnalysis: extractOffer,
  researchOffer: extractOffer,
  keywordIntel: extractKeywords,
  researchKeywords: extractKeywords,
};

/**
 * Decompose a runner's output into structured wiki entries.
 * Returns empty array for sections without an extractor (e.g., mediaPlan).
 */
export function extractWikiEntries(
  section: string,
  data: unknown,
): WikiEntry[] {
  if (!data || typeof data !== 'object') return [];
  const extractor = SECTION_EXTRACTOR[section];
  if (!extractor) return [];
  try {
    return extractor(data as Record<string, unknown>);
  } catch (err) {
    console.warn(`[wiki] Entry extraction failed for ${section}:`, err);
    return [];
  }
}

/**
 * Append wiki entries to the journey_sessions research_wiki column.
 * Non-fatal — callers should catch and log failures.
 */
export async function writeWikiEntries(
  userId: string,
  runId: string,
  entries: WikiEntry[],
): Promise<void> {
  if (entries.length === 0) return;

  const client = getClient();
  const { error } = await client.rpc('append_research_wiki_entries', {
    p_user_id: userId,
    p_run_id: runId,
    p_entries: JSON.stringify(entries),
  });

  if (error) {
    throw new Error(`Wiki write failed: ${error.message}`);
  }

  console.log(`[wiki] Wrote ${entries.length} entries for ${userId} (run ${runId})`);
}
