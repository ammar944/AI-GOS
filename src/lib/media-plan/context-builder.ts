// Media Plan Context Builder
// Transforms 50KB+ blueprint into focused ~5KB context for AI generation

import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';

export interface MediaPlanContext {
  contextString: string;
  tokenEstimate: number;
}

/**
 * Build a focused context string for media plan generation.
 * Selectively extracts the most relevant data from the blueprint and onboarding data.
 * Target: <10KB context, ~2500 tokens.
 */
export function buildMediaPlanContext(
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData,
): MediaPlanContext {
  const sections: string[] = [];

  // --- Onboarding Data (most relevant fields) ---
  sections.push(buildOnboardingSection(onboarding));

  // --- Section 1: Industry & Market Overview ---
  sections.push(buildIndustrySection(blueprint));

  // --- Section 2: ICP Analysis & Validation ---
  sections.push(buildICPSection(blueprint));

  // --- Section 3: Offer Analysis & Viability ---
  sections.push(buildOfferSection(blueprint));

  // --- Section 4: Competitor Analysis ---
  sections.push(buildCompetitorSection(blueprint));

  // --- Section 5: Cross-Analysis Synthesis ---
  sections.push(buildSynthesisSection(blueprint));

  // --- Section 6: Keyword Intelligence (if present) ---
  if (blueprint.keywordIntelligence) {
    sections.push(buildKeywordSection(blueprint));
  }

  const contextString = sections.join('\n\n');
  // Rough token estimate: ~4 chars per token for English text
  const tokenEstimate = Math.ceil(contextString.length / 4);

  return { contextString, tokenEstimate };
}

// =============================================================================
// Section Builders
// =============================================================================

function buildOnboardingSection(onboarding: OnboardingFormData): string {
  const { budgetTargets, productOffer, icp, compliance } = onboarding;
  const lines: string[] = ['## Client Brief'];

  // Budget & Targets (critical for media plan)
  lines.push('### Budget & Targets');
  lines.push(`- Monthly Ad Budget: $${budgetTargets.monthlyAdBudget.toLocaleString()}`);
  if (budgetTargets.dailyBudgetCeiling) {
    lines.push(`- Daily Budget Ceiling: $${budgetTargets.dailyBudgetCeiling}`);
  }
  lines.push(`- Campaign Duration: ${budgetTargets.campaignDuration}`);
  if (budgetTargets.targetCpl) lines.push(`- Target CPL: $${budgetTargets.targetCpl}`);
  if (budgetTargets.targetCac) lines.push(`- Target CAC: $${budgetTargets.targetCac}`);
  if (budgetTargets.targetSqlsPerMonth) lines.push(`- Target SQLs/month: ${budgetTargets.targetSqlsPerMonth}`);
  if (budgetTargets.targetDemosPerMonth) lines.push(`- Target Demos/month: ${budgetTargets.targetDemosPerMonth}`);

  // Offer pricing
  lines.push('### Offer');
  lines.push(`- Offer Price: $${productOffer.offerPrice}`);
  lines.push(`- Pricing Model: ${productOffer.pricingModel.join(', ')}`);
  lines.push(`- Funnel Types: ${productOffer.currentFunnelType.join(', ')}`);

  // Geography
  lines.push('### Targeting');
  lines.push(`- Geography: ${icp.geography}`);
  lines.push(`- Industry: ${icp.industryVertical}`);

  // Compliance
  if (compliance.topicsToAvoid || compliance.claimRestrictions) {
    lines.push('### Compliance');
    if (compliance.topicsToAvoid) lines.push(`- Topics to Avoid: ${compliance.topicsToAvoid}`);
    if (compliance.claimRestrictions) lines.push(`- Claim Restrictions: ${compliance.claimRestrictions}`);
  }

  return lines.join('\n');
}

function buildIndustrySection(blueprint: StrategicBlueprintOutput): string {
  const { categorySnapshot, painPoints, marketDynamics } = blueprint.industryMarketOverview;
  const lines: string[] = ['## Industry & Market'];

  // Category snapshot
  lines.push(`- Category: ${categorySnapshot.category}`);
  lines.push(`- Market Maturity: ${categorySnapshot.marketMaturity}`);
  lines.push(`- Awareness Level: ${categorySnapshot.awarenessLevel}`);
  lines.push(`- Buying Behavior: ${categorySnapshot.buyingBehavior}`);
  lines.push(`- Seasonality: ${categorySnapshot.seasonality}`);

  // Top 5 pain points only
  const topPains = [...painPoints.primary.slice(0, 3), ...painPoints.secondary.slice(0, 2)];
  lines.push(`- Top Pain Points: ${topPains.join('; ')}`);

  // Demand drivers
  lines.push(`- Demand Drivers: ${marketDynamics.demandDrivers.slice(0, 4).join('; ')}`);

  return lines.join('\n');
}

function buildICPSection(blueprint: StrategicBlueprintOutput): string {
  const { finalVerdict, coherenceCheck, riskAssessment } = blueprint.icpAnalysisValidation;
  const lines: string[] = ['## ICP Validation'];

  lines.push(`- Verdict: ${finalVerdict.status}`);
  lines.push(`- Reachable via Paid Channels: ${coherenceCheck.reachableThroughPaidChannels}`);
  lines.push(`- Adequate Scale: ${coherenceCheck.adequateScale}`);
  lines.push(`- Has Budget & Authority: ${coherenceCheck.hasBudgetAndAuthority}`);
  lines.push(`- Risk — Reachability: ${riskAssessment.reachability}`);
  lines.push(`- Risk — Budget: ${riskAssessment.budget}`);
  lines.push(`- Risk — Pain Strength: ${riskAssessment.painStrength}`);
  lines.push(`- Risk — Competitiveness: ${riskAssessment.competitiveness}`);

  return lines.join('\n');
}

function buildOfferSection(blueprint: StrategicBlueprintOutput): string {
  const { offerStrength, redFlags, recommendation } = blueprint.offerAnalysisViability;
  const lines: string[] = ['## Offer Viability'];

  lines.push(`- Overall Score: ${offerStrength.overallScore}/10`);
  lines.push(`- Recommendation: ${recommendation.status}`);
  lines.push(`- Reasoning: ${recommendation.reasoning}`);
  if (redFlags.length > 0) {
    lines.push(`- Red Flags: ${redFlags.join(', ')}`);
  }

  return lines.join('\n');
}

function buildCompetitorSection(blueprint: StrategicBlueprintOutput): string {
  const { competitors, gapsAndOpportunities } = blueprint.competitorAnalysis;
  const lines: string[] = ['## Competitor Landscape'];

  // Per-competitor summary (name, positioning, platforms, strengths/weaknesses only)
  for (const comp of competitors.slice(0, 5)) {
    lines.push(`### ${comp.name}`);
    lines.push(`- Positioning: ${comp.positioning}`);
    lines.push(`- Ad Platforms: ${comp.adPlatforms.join(', ')}`);
    lines.push(`- Strengths: ${comp.strengths.slice(0, 3).join('; ')}`);
    lines.push(`- Weaknesses: ${comp.weaknesses.slice(0, 3).join('; ')}`);
  }

  // Market gaps
  lines.push('### Market Gaps');
  lines.push(`- Messaging Opportunities: ${gapsAndOpportunities.messagingOpportunities.slice(0, 3).join('; ')}`);
  lines.push(`- Creative Opportunities: ${gapsAndOpportunities.creativeOpportunities.slice(0, 3).join('; ')}`);

  return lines.join('\n');
}

function buildSynthesisSection(blueprint: StrategicBlueprintOutput): string {
  const synthesis = blueprint.crossAnalysisSynthesis;
  const lines: string[] = ['## Strategic Synthesis'];

  // Recommended platforms
  lines.push('### Recommended Platforms');
  for (const plat of synthesis.recommendedPlatforms) {
    lines.push(`- ${plat.platform} (${plat.priority}): ${plat.reasoning}`);
  }

  // Core message
  if (synthesis.messagingFramework?.coreMessage) {
    lines.push(`### Core Message\n${synthesis.messagingFramework.coreMessage}`);
  }

  // Top 5 ad hooks
  if (synthesis.messagingFramework?.adHooks) {
    lines.push('### Top Ad Hooks');
    for (const hook of synthesis.messagingFramework.adHooks.slice(0, 5)) {
      lines.push(`- [${hook.technique}] ${hook.hook}`);
    }
  }

  // Success factors & blockers
  lines.push(`### Critical Success Factors\n${synthesis.criticalSuccessFactors.slice(0, 5).map(f => `- ${f}`).join('\n')}`);
  lines.push(`### Potential Blockers\n${synthesis.potentialBlockers.slice(0, 3).map(b => `- ${b}`).join('\n')}`);

  return lines.join('\n');
}

function buildKeywordSection(blueprint: StrategicBlueprintOutput): string {
  const kw = blueprint.keywordIntelligence;
  if (!kw) return '';

  const lines: string[] = ['## Keyword Intelligence'];

  // Domain stats summary
  if (kw.clientDomain) {
    lines.push('### Client Domain');
    lines.push(`- Organic Keywords: ${kw.clientDomain.organicKeywords}`);
    lines.push(`- Paid Keywords: ${kw.clientDomain.paidKeywords}`);
    lines.push(`- Est. Monthly Organic Clicks: ${kw.clientDomain.monthlyOrganicClicks}`);
    lines.push(`- Est. Traffic Value: $${kw.clientDomain.organicClicksValue}/mo`);
  }

  // Top 10 high-intent keywords
  if (kw.highIntentKeywords.length > 0) {
    lines.push('### High-Intent Keywords');
    for (const k of kw.highIntentKeywords.slice(0, 10)) {
      lines.push(`- "${k.keyword}" — vol: ${k.searchVolume}/mo, CPC: $${k.cpc.toFixed(2)}, difficulty: ${k.difficulty}`);
    }
  }

  return lines.join('\n');
}
