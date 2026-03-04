import { z } from 'zod';
import { tool } from 'ai';
import { SECTION_LABELS } from './utils';

const SECTION_KEYS = [
  'industryMarketOverview',
  'icpAnalysisValidation',
  'offerAnalysisViability',
  'competitorAnalysis',
  'crossAnalysisSynthesis',
] as const;

type SectionKey = (typeof SECTION_KEYS)[number];

function condenseIndustryMarket(data: Record<string, unknown>): Record<string, unknown> {
  const painPoints = data.painPoints as { primary?: string[]; secondary?: string[] } | undefined;
  const categorySnapshot = data.categorySnapshot as Record<string, unknown> | undefined;
  const messagingOps = data.messagingOpportunities as { opportunities?: string[] } | undefined;

  return {
    category: categorySnapshot?.category,
    marketSize: categorySnapshot?.marketSize,
    primaryPainPoints: painPoints?.primary?.slice(0, 5),
    secondaryPainPoints: painPoints?.secondary?.slice(0, 3),
    psychologicalDrivers: (data.psychologicalDrivers as string[] | undefined)?.slice(0, 3),
    buyingTriggers: (data.buyingTriggers as string[] | undefined)?.slice(0, 3),
    demandSignals: data.demandSignals,
    messagingOpportunities: messagingOps?.opportunities?.slice(0, 5),
  };
}

function condenseICP(data: Record<string, unknown>): Record<string, unknown> {
  const verdict = data.finalVerdict as Record<string, unknown> | undefined;
  const psychographics = data.psychographics as Record<string, unknown> | undefined;

  return {
    verdictStatus: verdict?.status,
    verdictReasoning: verdict?.reasoning,
    icpDescription: data.icpDescription,
    goals: (psychographics?.goals as string[] | undefined)?.slice(0, 3),
    fears: (psychographics?.fears as string[] | undefined)?.slice(0, 3),
    dayInLife: psychographics?.dayInLife,
    painSolutionFit: data.painSolutionFit,
    riskAssessment: data.riskAssessment,
    reachabilityScore: data.reachabilityScore,
    targetingRecommendations: (data.targetingRecommendations as string[] | undefined)?.slice(0, 3),
  };
}

function condenseOffer(data: Record<string, unknown>): Record<string, unknown> {
  const strength = data.offerStrength as Record<string, unknown> | undefined;
  const recommendation = data.recommendation as Record<string, unknown> | undefined;

  return {
    overallScore: strength?.overallScore,
    dimensionScores: strength
      ? {
          painRelevance: strength.painRelevance,
          urgency: strength.urgency,
          differentiation: strength.differentiation,
          tangibility: strength.tangibility,
          proof: strength.proof,
          pricingLogic: strength.pricingLogic,
        }
      : undefined,
    recommendationStatus: recommendation?.status,
    recommendationReasoning: recommendation?.reasoning,
    redFlags: (data.redFlags as string[] | undefined)?.slice(0, 5),
    strengths: (data.strengths as string[] | undefined)?.slice(0, 3),
  };
}

function condenseCompetitors(data: Record<string, unknown>): Record<string, unknown> {
  const competitors = data.competitors as Array<Record<string, unknown>> | undefined;
  const gaps = data.gapsAndOpportunities as Record<string, unknown> | undefined;

  return {
    competitors: competitors?.map((c) => ({
      name: c.name,
      positioning: c.positioning,
      topWeaknesses: (c.weaknesses as string[] | undefined)?.slice(0, 2),
      adHooks: (c.adHooks as string[] | undefined)?.slice(0, 2),
      creativeFormats: (c.creativeFormats as string[] | undefined)?.slice(0, 2),
    })),
    messagingGaps: (gaps?.messagingOpportunities as string[] | undefined)?.slice(0, 5),
    positioningGaps: (gaps?.positioningGaps as string[] | undefined)?.slice(0, 3),
  };
}

function condenseSynthesis(data: Record<string, unknown>): Record<string, unknown> {
  const messagingFramework = data.messagingFramework as Record<string, unknown> | undefined;

  return {
    recommendedPositioning: data.recommendedPositioning,
    primaryMessagingAngles: data.primaryMessagingAngles,
    adHooks: messagingFramework?.adHooks ?? data.adHooks,
    advertisingAngles: messagingFramework?.advertisingAngles ?? data.advertisingAngles,
    proofPoints: (messagingFramework?.proofPoints as string[] | undefined)?.slice(0, 5),
    objectionHandlers: (messagingFramework?.objectionHandlers as string[] | undefined)?.slice(0, 3),
    platformRecommendations: data.platformRecommendations,
    nextSteps: (data.nextSteps as string[] | undefined)?.slice(0, 5),
    keyInsights: (data.keyInsights as string[] | undefined)?.slice(0, 3),
  };
}

const CONDENSERS: Record<SectionKey, (data: Record<string, unknown>) => Record<string, unknown>> = {
  industryMarketOverview: condenseIndustryMarket,
  icpAnalysisValidation: condenseICP,
  offerAnalysisViability: condenseOffer,
  competitorAnalysis: condenseCompetitors,
  crossAnalysisSynthesis: condenseSynthesis,
};

export function createQueryBlueprintTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Load a condensed summary of a specific blueprint section (1-2K tokens). ' +
      'Use this as your PRIMARY way to access blueprint data — call it before answering ' +
      'any question about a section. Much more token-efficient than deepDive. ' +
      'Use the optional aspect parameter to focus the response on what you need.',
    inputSchema: z.object({
      section: z.enum(SECTION_KEYS).describe('The blueprint section to load'),
      aspect: z
        .string()
        .optional()
        .describe(
          'Optional: specific aspect to focus on (e.g., "pain points", "offer scores", ' +
            '"ad hooks", "competitor weaknesses", "positioning")'
        ),
    }),
    execute: async ({ section, aspect }) => {
      const sectionData = blueprint[section];
      const label = SECTION_LABELS[section] || section;

      if (!sectionData || typeof sectionData !== 'object') {
        return {
          section,
          label,
          status: 'empty' as const,
          summary: null,
          error: `Section "${section}" has no data in this blueprint.`,
        };
      }

      const condenser = CONDENSERS[section];
      const condensed = condenser(sectionData as Record<string, unknown>);

      const cleaned = Object.fromEntries(
        Object.entries(condensed).filter(([, v]) => v !== undefined && v !== null)
      );

      return {
        section,
        label,
        status: 'loaded' as const,
        aspect: aspect || 'all',
        summary: cleaned,
        tokenEstimate: Math.ceil(JSON.stringify(cleaned).length / 4),
        note: 'This is a condensed summary. Use deepDive if you need complete raw data.',
      };
    },
  });
}
