// Blueprint Chunking Service
// Converts strategic blueprints into semantic chunks for RAG

import type {
  StrategicBlueprintOutput,
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
} from '@/lib/strategic-blueprint/output-types';
import type { ChunkInput, BlueprintSection } from './types';

/**
 * Section metadata for human-readable titles
 */
const SECTION_TITLES: Record<BlueprintSection, string> = {
  industryMarketOverview: 'Industry & Market Overview',
  icpAnalysisValidation: 'ICP Analysis & Validation',
  offerAnalysisViability: 'Offer Analysis & Viability',
  competitorAnalysis: 'Competitor Analysis',
  crossAnalysisSynthesis: 'Cross-Analysis Synthesis',
};

/**
 * Convert a blueprint into semantic chunks for embedding.
 * Each chunk represents a meaningful unit that can be retrieved independently.
 */
export function chunkBlueprint(
  blueprintId: string,
  blueprint: StrategicBlueprintOutput
): ChunkInput[] {
  const chunks: ChunkInput[] = [];

  // Section 1: Industry & Market Overview
  chunks.push(...chunkIndustryMarketOverview(blueprintId, blueprint.industryMarketOverview));

  // Section 2: ICP Analysis & Validation
  chunks.push(...chunkICPAnalysis(blueprintId, blueprint.icpAnalysisValidation));

  // Section 3: Offer Analysis & Viability
  chunks.push(...chunkOfferAnalysis(blueprintId, blueprint.offerAnalysisViability));

  // Section 4: Competitor Analysis
  chunks.push(...chunkCompetitorAnalysis(blueprintId, blueprint.competitorAnalysis));

  // Section 5: Cross-Analysis Synthesis
  chunks.push(...chunkCrossAnalysis(blueprintId, blueprint.crossAnalysisSynthesis));

  return chunks;
}

/**
 * Chunk Section 1: Industry & Market Overview
 * Strategy: categorySnapshot as one, each painPoint individually, each driver individually, opportunities as array
 */
function chunkIndustryMarketOverview(
  blueprintId: string,
  section: IndustryMarketOverview
): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const sectionName: BlueprintSection = 'industryMarketOverview';
  const sectionTitle = SECTION_TITLES[sectionName];

  // Category snapshot as one chunk
  const cs = section.categorySnapshot;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'categorySnapshot',
    `Category Snapshot for ${cs.category}: Market maturity is ${cs.marketMaturity}, awareness level is ${cs.awarenessLevel}, buying behavior is ${cs.buyingBehavior}. Average sales cycle: ${cs.averageSalesCycle}. Seasonality: ${cs.seasonality}.`,
    'object',
    sectionTitle,
    'Market category overview including maturity, awareness, and buying patterns',
    false,
    cs
  ));

  // Each primary pain point individually
  section.painPoints.primary.forEach((pain, index) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `painPoints.primary.${index}`,
      `Primary Pain Point: ${pain}`,
      'string',
      sectionTitle,
      'Critical pain point experienced by target audience',
      true,
      pain
    ));
  });

  // Each secondary pain point individually
  section.painPoints.secondary.forEach((pain, index) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `painPoints.secondary.${index}`,
      `Secondary Pain Point: ${pain}`,
      'string',
      sectionTitle,
      'Additional pain point experienced by target audience',
      true,
      pain
    ));
  });

  // Each psychological driver individually
  section.psychologicalDrivers.drivers.forEach((driver, index) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `psychologicalDrivers.drivers.${index}`,
      `Psychological Driver - ${driver.driver}: ${driver.description}`,
      'object',
      sectionTitle,
      'Emotional motivator that drives buying decisions',
      true,
      driver
    ));
  });

  // Market dynamics as one chunk
  const md = section.marketDynamics;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'marketDynamics',
    `Market Dynamics: Demand drivers include ${md.demandDrivers.join(', ')}. Buying triggers: ${md.buyingTriggers.join(', ')}. Barriers to purchase: ${md.barriersToPurchase.join(', ')}.`,
    'object',
    sectionTitle,
    'Market forces affecting buying behavior',
    false,
    md
  ));

  // Messaging opportunities as array chunk
  const mo = section.messagingOpportunities;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'messagingOpportunities',
    `Key Recommendations: ${mo.summaryRecommendations.join('; ')}`,
    'array',
    sectionTitle,
    'Angles to leverage in advertising and funnels',
    true,
    mo
  ));

  // Audience objections
  section.audienceObjections.objections.forEach((obj, index) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `audienceObjections.objections.${index}`,
      `Objection: "${obj.objection}" — How to address: ${obj.howToAddress}`,
      'object',
      sectionTitle,
      'Common objection from prospects with response strategy',
      true,
      obj
    ));
  });

  return chunks;
}

/**
 * Chunk Section 2: ICP Analysis & Validation
 * Strategy: coherenceCheck, painSolutionFit, riskAssessment, finalVerdict separately
 */
function chunkICPAnalysis(
  blueprintId: string,
  section: ICPAnalysisValidation
): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const sectionName: BlueprintSection = 'icpAnalysisValidation';
  const sectionTitle = SECTION_TITLES[sectionName];

  // Coherence check
  const cc = section.coherenceCheck;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'coherenceCheck',
    `ICP Coherence Check: Clearly defined: ${cc.clearlyDefined}, Reachable via paid: ${cc.reachableThroughPaidChannels}, Adequate scale: ${cc.adequateScale}, Has pain offer solves: ${cc.hasPainOfferSolves}, Has budget/authority: ${cc.hasBudgetAndAuthority}`,
    'object',
    sectionTitle,
    'Validation that ICP is coherent and targetable',
    false,
    cc
  ));

  // Pain-solution fit
  const psf = section.painSolutionFit;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'painSolutionFit',
    `Pain-Solution Fit: Primary pain being solved is "${psf.primaryPain}". Offer component solving it: "${psf.offerComponentSolvingIt}". Fit assessment: ${psf.fitAssessment}. Notes: ${psf.notes}`,
    'object',
    sectionTitle,
    'Analysis of how well offer solves ICP pain',
    true,
    psf
  ));

  // Market reachability
  const mr = section.marketReachability;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'marketReachability',
    `Market Reachability: Meta volume adequate: ${mr.metaVolume}, LinkedIn volume adequate: ${mr.linkedInVolume}, Google search demand: ${mr.googleSearchDemand}. Contradicting signals: ${mr.contradictingSignals.length > 0 ? mr.contradictingSignals.join(', ') : 'None'}`,
    'object',
    sectionTitle,
    'Assessment of ability to reach ICP via paid channels',
    false,
    mr
  ));

  // Economic feasibility
  const ef = section.economicFeasibility;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'economicFeasibility',
    `Economic Feasibility: Has budget: ${ef.hasBudget}, Purchases similar: ${ef.purchasesSimilar}, TAM aligned with CAC: ${ef.tamAlignedWithCac}. Notes: ${ef.notes}`,
    'object',
    sectionTitle,
    'Financial viability of targeting this ICP',
    false,
    ef
  ));

  // Risk assessment
  const ra = section.riskAssessment;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'riskAssessment',
    `ICP Risk Assessment: Reachability risk: ${ra.reachability}, Budget risk: ${ra.budget}, Pain strength risk: ${ra.painStrength}, Competitiveness risk: ${ra.competitiveness}`,
    'object',
    sectionTitle,
    'Risk levels across key dimensions',
    false,
    ra
  ));

  // Final verdict
  const fv = section.finalVerdict;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'finalVerdict',
    `ICP Final Verdict: Status is ${fv.status}. Reasoning: ${fv.reasoning}. Recommendations: ${fv.recommendations.join('; ')}`,
    'object',
    sectionTitle,
    'Overall ICP validation conclusion',
    true,
    fv
  ));

  return chunks;
}

/**
 * Chunk Section 3: Offer Analysis & Viability
 * Strategy: each score individually, redFlags as array, recommendation as object
 */
function chunkOfferAnalysis(
  blueprintId: string,
  section: OfferAnalysisViability
): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const sectionName: BlueprintSection = 'offerAnalysisViability';
  const sectionTitle = SECTION_TITLES[sectionName];

  // Offer clarity as one chunk
  const oc = section.offerClarity;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'offerClarity',
    `Offer Clarity: Clearly articulated: ${oc.clearlyArticulated}, Solves real pain: ${oc.solvesRealPain}, Benefits easy to understand: ${oc.benefitsEasyToUnderstand}, Transformation measurable: ${oc.transformationMeasurable}, Value prop obvious: ${oc.valuePropositionObvious}`,
    'object',
    sectionTitle,
    'Assessment of how clearly the offer is defined',
    false,
    oc
  ));

  // Each offer strength score individually
  const os = section.offerStrength;
  const scoreFields = [
    { key: 'painRelevance', label: 'Pain Relevance', desc: 'How relevant the offer is to target pain' },
    { key: 'urgency', label: 'Urgency', desc: 'Urgency created by the offer' },
    { key: 'differentiation', label: 'Differentiation', desc: 'How differentiated from competitors' },
    { key: 'tangibility', label: 'Tangibility', desc: 'How tangible the deliverables are' },
    { key: 'proof', label: 'Proof', desc: 'Strength of social proof and evidence' },
    { key: 'pricingLogic', label: 'Pricing Logic', desc: 'How logical the pricing appears' },
  ] as const;

  scoreFields.forEach(({ key, label, desc }) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `offerStrength.${key}`,
      `Offer Strength - ${label}: ${os[key]}/10`,
      'number',
      sectionTitle,
      desc,
      true,
      os[key]
    ));
  });

  // Overall score
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'offerStrength.overallScore',
    `Offer Strength Overall Score: ${os.overallScore}/10`,
    'number',
    sectionTitle,
    'Aggregate offer strength score',
    false,
    os.overallScore
  ));

  // Market-offer fit
  const mof = section.marketOfferFit;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'marketOfferFit',
    `Market-Offer Fit: Market wants now: ${mof.marketWantsNow}, Competitors offer similar: ${mof.competitorsOfferSimilar}, Price matches expectations: ${mof.priceMatchesExpectations}, Proof strong for cold traffic: ${mof.proofStrongForColdTraffic}, Transformation believable: ${mof.transformationBelievable}`,
    'object',
    sectionTitle,
    'How well the offer fits current market conditions',
    false,
    mof
  ));

  // Red flags as array
  if (section.redFlags.length > 0) {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      'redFlags',
      `Offer Red Flags: ${section.redFlags.join(', ')}`,
      'array',
      sectionTitle,
      'Warning signs identified in the offer',
      true,
      section.redFlags
    ));
  }

  // Recommendation
  const rec = section.recommendation;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'recommendation',
    `Offer Recommendation: ${rec.status}. Reasoning: ${rec.reasoning}. Action items: ${rec.actionItems.join('; ')}`,
    'object',
    sectionTitle,
    'Final recommendation for the offer',
    true,
    rec
  ));

  return chunks;
}

/**
 * Chunk Section 4: Competitor Analysis
 * Strategy: each competitor as one unit, adHooks as array, gapsAndOpportunities as object
 */
function chunkCompetitorAnalysis(
  blueprintId: string,
  section: CompetitorAnalysis
): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const sectionName: BlueprintSection = 'competitorAnalysis';
  const sectionTitle = SECTION_TITLES[sectionName];

  // Each competitor as one chunk
  section.competitors.forEach((comp, index) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `competitors.${index}`,
      `Competitor: ${comp.name}. Positioning: ${comp.positioning}. Offer: ${comp.offer}. Price: ${comp.price}. Funnels: ${comp.funnels}. Ad platforms: ${comp.adPlatforms.join(', ')}. Strengths: ${comp.strengths.join(', ')}. Weaknesses: ${comp.weaknesses.join(', ')}.`,
      'object',
      sectionTitle,
      `Competitive analysis of ${comp.name}`,
      false,
      comp
    ));
  });

  // Creative formats
  const cf = section.creativeLibrary.creativeFormats;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'creativeLibrary.creativeFormats',
    `Competitor Creative Formats: UGC: ${cf.ugc}, Carousels: ${cf.carousels}, Statics: ${cf.statics}, Testimonial: ${cf.testimonial}, Product Demo: ${cf.productDemo}`,
    'object',
    sectionTitle,
    'Types of creative formats used by competitors',
    false,
    cf
  ));

  // Funnel breakdown
  const fb = section.funnelBreakdown;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'funnelBreakdown',
    `Competitor Funnel Patterns: Headlines: ${fb.headlineStructure.join('; ')}. CTAs: ${fb.ctaHierarchy.join('; ')}. Social proof: ${fb.socialProofPatterns.join('; ')}. Lead capture: ${fb.leadCaptureMethods.join('; ')}. Form friction: ${fb.formFriction}.`,
    'object',
    sectionTitle,
    'Common funnel patterns among competitors',
    false,
    fb
  ));

  // Gaps and opportunities
  const gaps = section.gapsAndOpportunities;
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'gapsAndOpportunities',
    `Competitive Gaps & Opportunities: Messaging opportunities: ${gaps.messagingOpportunities.join('; ')}. Creative opportunities: ${gaps.creativeOpportunities.join('; ')}. Funnel opportunities: ${gaps.funnelOpportunities.join('; ')}.`,
    'object',
    sectionTitle,
    'Identified gaps and opportunities vs competitors',
    true,
    gaps
  ));

  // Market strengths and weaknesses
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'marketStrengths',
    `Market Strengths: ${section.marketStrengths.join('; ')}`,
    'array',
    sectionTitle,
    'Overall strengths observed in the market',
    false,
    section.marketStrengths
  ));

  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'marketWeaknesses',
    `Market Weaknesses: ${section.marketWeaknesses.join('; ')}`,
    'array',
    sectionTitle,
    'Overall weaknesses observed in the market',
    false,
    section.marketWeaknesses
  ));

  return chunks;
}

/**
 * Chunk Section 5: Cross-Analysis Synthesis
 * Strategy: each keyInsight individually, positioning as one, messagingAngles as array, platforms as array, nextSteps as array
 */
function chunkCrossAnalysis(
  blueprintId: string,
  section: CrossAnalysisSynthesis
): ChunkInput[] {
  const chunks: ChunkInput[] = [];
  const sectionName: BlueprintSection = 'crossAnalysisSynthesis';
  const sectionTitle = SECTION_TITLES[sectionName];

  // Each key insight individually
  section.keyInsights.forEach((insight, index) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `keyInsights.${index}`,
      `Key Insight (${insight.priority} priority): ${insight.insight}. Source: ${insight.source}. Implication: ${insight.implication}`,
      'object',
      sectionTitle,
      'Strategic insight from cross-analysis',
      true,
      insight
    ));
  });

  // Recommended positioning as one chunk
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'recommendedPositioning',
    `Recommended Positioning: ${section.recommendedPositioning}`,
    'string',
    sectionTitle,
    'Recommended market positioning',
    true,
    section.recommendedPositioning
  ));

  // Platforms as array (each platform individually for better retrieval)
  section.recommendedPlatforms.forEach((plat, index) => {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      `recommendedPlatforms.${index}`,
      `Recommended Platform: ${plat.platform} (${plat.priority}). Reasoning: ${plat.reasoning}`,
      'object',
      sectionTitle,
      `Platform recommendation: ${plat.platform}`,
      true,
      plat
    ));
  });

  // Critical success factors
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'criticalSuccessFactors',
    `Critical Success Factors: ${section.criticalSuccessFactors.join('; ')}`,
    'array',
    sectionTitle,
    'Key factors required for success',
    false,
    section.criticalSuccessFactors
  ));

  // Potential blockers
  if (section.potentialBlockers.length > 0) {
    chunks.push(createChunk(
      blueprintId,
      sectionName,
      'potentialBlockers',
      `Potential Blockers: ${section.potentialBlockers.join('; ')}`,
      'array',
      sectionTitle,
      'Obstacles that could impede success',
      false,
      section.potentialBlockers
    ));
  }

  // Next steps as array
  chunks.push(createChunk(
    blueprintId,
    sectionName,
    'nextSteps',
    `Recommended Next Steps: ${section.nextSteps.join('; ')}`,
    'array',
    sectionTitle,
    'Actionable next steps',
    true,
    section.nextSteps
  ));

  return chunks;
}

/**
 * Helper to create a chunk with consistent structure
 */
function createChunk(
  blueprintId: string,
  section: BlueprintSection,
  fieldPath: string,
  content: string,
  contentType: ChunkInput['contentType'],
  sectionTitle: string,
  fieldDescription: string,
  isEditable: boolean,
  originalValue: unknown
): ChunkInput {
  return {
    blueprintId,
    section,
    fieldPath,
    content,
    contentType,
    metadata: {
      sectionTitle,
      fieldDescription,
      isEditable,
      originalValue,
    },
  };
}
