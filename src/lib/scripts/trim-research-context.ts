interface TrimmedResearchContext {
  targetAudience: string;
  icpValidation?: unknown;
  offerAnalysis?: unknown;
  competitors?: { competitors: unknown[] };
  keywordIntel?: { keywords: unknown[] };
  industryMarket?: unknown;
  crossAnalysis?: unknown;
  mediaPlan?: unknown;
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

  const result: TrimmedResearchContext = { targetAudience };

  // Priority 1: Full content
  if (icp) result.icpValidation = icp;
  const offer = get('offerAnalysis');
  if (offer) result.offerAnalysis = offer;

  // Priority 2: Summarized
  const comp = get('competitors');
  if (comp?.competitors && Array.isArray(comp.competitors)) {
    result.competitors = { competitors: comp.competitors.slice(0, 3) };
  }
  const kw = get('keywordIntel');
  if (kw?.keywords && Array.isArray(kw.keywords)) {
    result.keywordIntel = { keywords: kw.keywords.slice(0, 10) };
  }

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
