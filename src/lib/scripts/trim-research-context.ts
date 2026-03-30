interface TrimmedResearchContext {
  targetAudience: string;
  targetAudienceMonologue?: string[];
  icpValidation?: unknown;
  offerAnalysis?: unknown;
  competitors?: { competitors: unknown[] };
  keywordIntel?: { keywords: unknown[] };
  industryMarket?: unknown;
  crossAnalysis?: unknown;
  mediaPlan?: unknown;
  // Competitor ad intelligence
  competitorAdIntel?: Array<{
    advertiser: string;
    topAdHooks: string[];
    adCreatives: Array<{ platform: string; headline?: string; body?: string; format: string }>;
  }>;
  // Research-derived stats for rotation (extracted from research sections)
  researchStats?: Array<{ stat: string; source: string }>;
  // Intelligence fields (capped for token budget)
  positioningMoves?: unknown[];
  audienceRefinements?: unknown[];
  marketOpportunities?: unknown[];
  topActions?: unknown[];
}

/**
 * Extracts priority fields from research_results for ad script generation.
 * Token budget: ~8000 tokens total.
 *
 * Priority 1 (full): ICP + Offer (~3000 tokens)
 * Priority 2 (summary): Competitors top 3 + Keywords top 10 (~2000 tokens)
 * Priority 3 (headlines): Industry + Synthesis + MediaPlan (~1500 tokens)
 */
export function trimResearchForScripts(
  researchResults: Record<string, { data?: unknown }>,
): TrimmedResearchContext {
  const get = (key: string) => researchResults[key]?.data as Record<string, unknown> | undefined;

  const icp = get('icpValidation');
  const persona = icp?.persona as Record<string, unknown> | undefined;
  const targetAudience = persona
    ? [persona.role, persona.company, persona.demographics].filter(Boolean).join(', ')
    : 'target audience';

  // ICP monologue extraction — Collier framework triggers
  const triggers = (icp?.triggers ?? []) as { trigger: string }[];
  const monologue = triggers
    .slice(0, 5)
    .map((t) => t.trigger)
    .filter(Boolean);

  const result: TrimmedResearchContext = {
    targetAudience,
    targetAudienceMonologue: monologue.length > 0 ? monologue : undefined,
  };

  // Priority 1: Full content
  if (icp) result.icpValidation = icp;
  const offer = get('offerAnalysis');
  if (offer) result.offerAnalysis = offer;

  // Priority 2: Summarized
  const comp = get('competitors');
  if (comp?.competitors && Array.isArray(comp.competitors)) {
    result.competitors = { competitors: comp.competitors.slice(0, 3) };
  }

  // Extract competitor ad intelligence for scripting
  if (comp?.competitors && Array.isArray(comp.competitors)) {
    const adIntel: Array<{
      advertiser: string;
      topAdHooks: string[];
      adCreatives: Array<{ platform: string; headline?: string; body?: string; format: string }>;
    }> = [];
    for (const c of (comp.competitors as Array<Record<string, unknown>>).slice(0, 3)) {
      const name = String(c.name ?? c.advertiser ?? 'Unknown');
      const threat = c.threatAssessment as Record<string, unknown> | undefined;
      const topAdHooks = Array.isArray(threat?.topAdHooks)
        ? (threat.topAdHooks as string[]).slice(0, 5)
        : [];
      const adActivity = c.adActivity as Record<string, unknown> | undefined;
      const creatives = Array.isArray(adActivity?.adCreatives)
        ? (adActivity.adCreatives as Array<Record<string, unknown>>)
            .filter((ad) => ad.headline || ad.body)
            .slice(0, 5)
            .map((ad) => ({
              platform: String(ad.platform ?? 'unknown'),
              headline: ad.headline as string | undefined,
              body: ad.body as string | undefined,
              format: String(ad.format ?? 'unknown'),
            }))
        : [];
      if (topAdHooks.length > 0 || creatives.length > 0) {
        adIntel.push({ advertiser: name, topAdHooks, adCreatives: creatives });
      }
    }
    if (adIntel.length > 0) result.competitorAdIntel = adIntel;
  }
  const kw = get('keywordIntel');
  if (kw?.keywords && Array.isArray(kw.keywords)) {
    result.keywordIntel = { keywords: kw.keywords.slice(0, 10) };
  }

  // Priority 2b: Intelligence fields (capped at 3-5 items each)
  const compFull = get('competitors');
  const positioningMoves = (compFull?.positioningMoves as unknown[] | undefined)?.slice(0, 3);
  if (positioningMoves?.length) result.positioningMoves = positioningMoves;

  const audienceRefinements = (icp?.audienceRefinements as unknown[] | undefined)?.slice(0, 3);
  if (audienceRefinements?.length) result.audienceRefinements = audienceRefinements;

  const industryFull = get('industryMarket');
  const marketOpportunities = (industryFull?.marketOpportunities as unknown[] | undefined)?.slice(0, 3);
  if (marketOpportunities?.length) result.marketOpportunities = marketOpportunities;

  const synthesisFull = get('crossAnalysis');
  const scorecard = synthesisFull?.readinessScorecard as Record<string, unknown> | undefined;
  const topActions = (scorecard?.topActions as unknown[] | undefined)?.slice(0, 5);
  if (topActions?.length) result.topActions = topActions;

  // Extract research-derived stats for rotation
  const researchStats: Array<{ stat: string; source: string }> = [];
  // Scan offerAnalysis for stats (redFlags, marketFitAssessment, pricingAnalysis)
  if (offer) {
    const redFlags = Array.isArray(offer.redFlags) ? offer.redFlags as Array<Record<string, unknown>> : [];
    for (const rf of redFlags) {
      const text = String(rf.flag ?? rf.description ?? rf.text ?? '');
      if (text && /\d/.test(text)) researchStats.push({ stat: text.slice(0, 200), source: 'offerAnalysis.redFlags' });
    }
    const mfa = offer.marketFitAssessment as Record<string, unknown> | undefined;
    if (mfa) {
      for (const [key, val] of Object.entries(mfa)) {
        const text = typeof val === 'string' ? val : '';
        if (text && /\d/.test(text)) researchStats.push({ stat: text.slice(0, 200), source: `offerAnalysis.marketFitAssessment.${key}` });
      }
    }
    const pricing = offer.pricingAnalysis as Record<string, unknown> | undefined;
    if (pricing) {
      const benchmark = pricing.marketBenchmark ?? pricing.coldTrafficViability;
      if (typeof benchmark === 'string' && /\d/.test(benchmark)) {
        researchStats.push({ stat: benchmark.slice(0, 200), source: 'offerAnalysis.pricingAnalysis' });
      }
    }
  }
  // Scan ICP for stats (triggers, objections with numbers)
  if (icp) {
    const objections = Array.isArray(icp.objections) ? icp.objections as Array<Record<string, unknown>> : [];
    for (const obj of objections) {
      const text = String(obj.objection ?? obj.text ?? obj.description ?? '');
      if (text && /\d/.test(text)) researchStats.push({ stat: text.slice(0, 200), source: 'icpValidation.objections' });
    }
  }
  // Deduplicate and cap at 10
  const seenStats = new Set<string>();
  const uniqueStats = researchStats.filter((s) => {
    const key = s.stat.toLowerCase().slice(0, 50);
    if (seenStats.has(key)) return false;
    seenStats.add(key);
    return true;
  }).slice(0, 10);
  if (uniqueStats.length > 0) result.researchStats = uniqueStats;

  // Priority 3: Headlines only
  const industry = get('industryMarket');
  if (industry?.categorySnapshot) {
    result.industryMarket = { categorySnapshot: industry.categorySnapshot };
  }
  const synthesis = get('crossAnalysis');
  if (synthesis) {
    result.crossAnalysis = {
      keyInsights: Array.isArray(synthesis.keyInsights)
        ? synthesis.keyInsights.slice(0, 5)
        : synthesis.keyInsights,
      positioningStrategy: synthesis.positioningStrategy,
    };
  }
  const media = get('mediaPlan');
  if (media?.channelMixBudget) {
    result.mediaPlan = { channelMixBudget: media.channelMixBudget };
  }

  return result;
}
