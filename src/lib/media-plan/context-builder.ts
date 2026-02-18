// Media Plan Context Builder
// Transforms 50KB+ blueprint into focused ~5KB context for AI generation

import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type { AdFormat } from '@/lib/ad-library/types';

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
  const { finalVerdict, coherenceCheck, riskScores } = blueprint.icpAnalysisValidation;
  const lines: string[] = ['## ICP Validation'];

  lines.push(`- Verdict: ${finalVerdict.status}`);
  lines.push(`- Reachable via Paid Channels: ${coherenceCheck.reachableThroughPaidChannels}`);
  lines.push(`- Adequate Scale: ${coherenceCheck.adequateScale}`);
  lines.push(`- Has Budget & Authority: ${coherenceCheck.hasBudgetAndAuthority}`);

  if (riskScores?.length) {
    for (const rs of riskScores) {
      const score = rs.score ?? rs.probability * rs.impact;
      const classification = rs.classification ?? (score >= 16 ? 'critical' : score >= 9 ? 'high' : score >= 4 ? 'medium' : 'low');
      lines.push(`- Risk — ${rs.category.replace(/_/g, ' ')}: ${classification} (${rs.risk})`);
    }
  } else {
    // Legacy fallback
    const ra = (blueprint.icpAnalysisValidation as any).riskAssessment;
    if (ra) {
      lines.push(`- Risk — Reachability: ${ra.reachability}`);
      lines.push(`- Risk — Budget: ${ra.budget}`);
      lines.push(`- Risk — Pain Strength: ${ra.painStrength}`);
      lines.push(`- Risk — Competitiveness: ${ra.competitiveness}`);
    }
  }

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
  const { competitors, creativeLibrary, funnelBreakdown, whiteSpaceGaps, gapsAndOpportunities } = blueprint.competitorAnalysis;
  const lines: string[] = ['## Competitor Landscape'];

  // Per-competitor summary (name, positioning, platforms, strengths/weaknesses + creative data)
  for (const comp of competitors.slice(0, 5)) {
    lines.push(`### ${comp.name}`);
    lines.push(`- Positioning: ${comp.positioning}`);
    lines.push(`- Ad Platforms: ${comp.adPlatforms.join(', ')}`);
    lines.push(`- Strengths: ${comp.strengths.slice(0, 3).join('; ')}`);
    lines.push(`- Weaknesses: ${comp.weaknesses.slice(0, 3).join('; ')}`);

    // Ad creative formats in use
    if (comp.adCreatives && comp.adCreatives.length > 0) {
      const formats = extractCreativeFormats(comp.adCreatives);
      if (formats.length > 0) {
        lines.push(`- Ad Formats Used: ${formats.join(', ')}`);
      }
      const hooks = extractTopHooks(comp.adCreatives);
      if (hooks.length > 0) {
        lines.push(`- Top Hooks: ${hooks.join('; ')}`);
      }
    }

    // Messaging themes
    if (comp.adMessagingThemes && comp.adMessagingThemes.length > 0) {
      lines.push(`- Messaging Themes: ${comp.adMessagingThemes.slice(0, 3).join('; ')}`);
    }
  }

  // Creative library data (aggregate across competitors)
  const formatFlags = creativeLibrary.creativeFormats;
  const activeFormats = Object.entries(formatFlags)
    .filter(([, active]) => active)
    .map(([format]) => format);
  if (activeFormats.length > 0) {
    lines.push('### Competitor Creative Formats');
    lines.push(`- Formats in Use: ${activeFormats.join(', ')}`);
  }

  // Funnel breakdown insights
  if (funnelBreakdown.headlineStructure.length > 0 || funnelBreakdown.ctaHierarchy.length > 0) {
    lines.push('### Competitor Funnel Patterns');
    if (funnelBreakdown.headlineStructure.length > 0) {
      lines.push(`- Headline Patterns: ${funnelBreakdown.headlineStructure.slice(0, 3).join('; ')}`);
    }
    if (funnelBreakdown.ctaHierarchy.length > 0) {
      lines.push(`- CTA Hierarchy: ${funnelBreakdown.ctaHierarchy.slice(0, 3).join('; ')}`);
    }
    if (funnelBreakdown.socialProofPatterns.length > 0) {
      lines.push(`- Social Proof Patterns: ${funnelBreakdown.socialProofPatterns.slice(0, 3).join('; ')}`);
    }
  }

  // Market gaps
  lines.push('### Market Gaps');
  if (whiteSpaceGaps?.length) {
    for (const wsg of whiteSpaceGaps.slice(0, 5)) {
      lines.push(`- [${wsg.type}] ${wsg.gap} (exploit: ${wsg.exploitability}/10, impact: ${wsg.impact}/10) — ${wsg.recommendedAction}`);
    }
  } else if (gapsAndOpportunities) {
    lines.push(`- Messaging Opportunities: ${gapsAndOpportunities.messagingOpportunities.slice(0, 3).join('; ')}`);
    lines.push(`- Creative Opportunities: ${gapsAndOpportunities.creativeOpportunities.slice(0, 3).join('; ')}`);
  }

  return lines.join('\n');
}

// =============================================================================
// Helper Functions for Creative Data Extraction
// =============================================================================

/** Extract unique ad format types from creative array */
function extractCreativeFormats(adCreatives: { format: AdFormat }[]): string[] {
  const formats = new Set<string>();
  for (const ad of adCreatives) {
    if (ad.format) formats.add(ad.format);
  }
  return Array.from(formats);
}

/** Extract top hooks/headlines from creatives (deduplicated, max 3) */
function extractTopHooks(adCreatives: { headline?: string }[]): string[] {
  const hooks: string[] = [];
  const seen = new Set<string>();
  for (const ad of adCreatives) {
    if (ad.headline && !seen.has(ad.headline.toLowerCase())) {
      seen.add(ad.headline.toLowerCase());
      hooks.push(ad.headline);
      if (hooks.length >= 3) break;
    }
  }
  return hooks;
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
