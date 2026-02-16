// Media Plan Phase Context Builders
// Focused ~1500 token context strings per section instead of one generic 5KB blob.
// Each pipeline phase gets only the context it needs for higher quality output.

import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type { PlatformStrategy, ICPTargeting, KPITarget, BudgetAllocation, CampaignStructure, CreativeStrategy, CampaignPhase, PerformanceModel } from './types';

// =============================================================================
// Shared: Client brief (reused across phases)
// =============================================================================

function buildClientBrief(onboarding: OnboardingFormData): string {
  const { budgetTargets, productOffer, icp, businessBasics } = onboarding;
  const lines: string[] = ['## Client Brief'];

  lines.push(`- Business: ${businessBasics.businessName}`);
  lines.push(`- Website: ${businessBasics.websiteUrl}`);
  lines.push(`- Monthly Ad Budget: $${budgetTargets.monthlyAdBudget.toLocaleString()}`);
  if (budgetTargets.dailyBudgetCeiling) lines.push(`- Daily Budget Ceiling: $${budgetTargets.dailyBudgetCeiling}`);
  if (budgetTargets.targetCpl) lines.push(`- Target CPL: $${budgetTargets.targetCpl}`);
  if (budgetTargets.targetCac) lines.push(`- Target CAC: $${budgetTargets.targetCac}`);
  lines.push(`- Offer Price: $${productOffer.offerPrice}`);
  lines.push(`- Pricing Model: ${productOffer.pricingModel.join(', ')}`);
  lines.push(`- Geography: ${icp.geography}`);
  lines.push(`- Industry: ${icp.industryVertical}`);
  lines.push(`- ICP: ${icp.primaryIcpDescription}`);
  if (icp.jobTitles) lines.push(`- Job Titles: ${icp.jobTitles}`);
  lines.push(`- Company Sizes: ${icp.companySize.join(', ')}`);

  return lines.join('\n');
}

// =============================================================================
// Phase 1 Contexts: Research (Sonar Pro)
// =============================================================================

/**
 * Context for platform strategy research.
 * Focuses on: industry, competitors' platform usage, ICP reachability signals.
 */
export function buildPlatformStrategyContext(
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData,
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  // Recommended platforms from synthesis
  const synthesis = blueprint.crossAnalysisSynthesis;
  sections.push('## Blueprint Platform Recommendations');
  for (const plat of synthesis.recommendedPlatforms) {
    sections.push(`- ${plat.platform} (${plat.priority}): ${plat.reasoning}`);
  }

  // Competitor platform usage
  sections.push('## Competitor Ad Platforms');
  for (const comp of blueprint.competitorAnalysis.competitors.slice(0, 5)) {
    sections.push(`- ${comp.name}: ${comp.adPlatforms.join(', ')}`);
  }

  // ICP reachability
  const { coherenceCheck } = blueprint.icpAnalysisValidation;
  sections.push('## ICP Reachability');
  sections.push(`- Reachable via Paid: ${coherenceCheck.reachableThroughPaidChannels}`);
  sections.push(`- Adequate Scale: ${coherenceCheck.adequateScale}`);

  // Funnel types (determines platform suitability)
  sections.push(`- Funnel Types: ${onboarding.productOffer.currentFunnelType.join(', ')}`);

  return sections.join('\n');
}

/**
 * Context for ICP targeting research.
 * Focuses on: ICP details, psychographics, geographic targeting.
 */
export function buildICPTargetingContext(
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData,
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  // ICP validation data
  const icp = blueprint.icpAnalysisValidation;
  sections.push('## ICP Validation');
  sections.push(`- Verdict: ${icp.finalVerdict.status}`);
  sections.push(`- Reasoning: ${icp.finalVerdict.reasoning}`);

  // Pain-solution fit from blueprint ICP analysis
  if (icp.painSolutionFit) {
    sections.push('## Pain-Solution Fit');
    sections.push(`- Primary Pain: ${icp.painSolutionFit.primaryPain}`);
    sections.push(`- Fit: ${icp.painSolutionFit.fitAssessment}`);
  }

  // Customer journey data from onboarding
  sections.push('## Customer Journey');
  sections.push(`- Situation Before: ${onboarding.customerJourney.situationBeforeBuying}`);
  sections.push(`- Desired Transformation: ${onboarding.customerJourney.desiredTransformation}`);
  sections.push(`- Objections: ${onboarding.customerJourney.commonObjections}`);
  sections.push(`- Sales Cycle: ${onboarding.customerJourney.salesCycleLength}`);

  return sections.join('\n');
}

/**
 * Context for KPI benchmarks research.
 * Focuses on: industry vertical, offer type, pricing, targets.
 */
export function buildKPIBenchmarksContext(
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData,
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  // Industry context
  const { categorySnapshot } = blueprint.industryMarketOverview;
  sections.push('## Industry Context');
  sections.push(`- Category: ${categorySnapshot.category}`);
  sections.push(`- Market Maturity: ${categorySnapshot.marketMaturity}`);
  sections.push(`- Buying Behavior: ${categorySnapshot.buyingBehavior}`);

  // Offer strength context
  const { offerStrength } = blueprint.offerAnalysisViability;
  sections.push('## Offer Context');
  sections.push(`- Offer Score: ${offerStrength.overallScore}/10`);

  // Keyword intelligence (if available — provides CPC data)
  if (blueprint.keywordIntelligence?.highIntentKeywords?.length) {
    sections.push('## Keyword CPC Data');
    for (const k of blueprint.keywordIntelligence.highIntentKeywords.slice(0, 5)) {
      sections.push(`- "${k.keyword}" — CPC: $${k.cpc.toFixed(2)}, vol: ${k.searchVolume}/mo`);
    }
  }

  // Targets from onboarding
  const { budgetTargets } = onboarding;
  sections.push('## Client Targets');
  if (budgetTargets.targetCpl) sections.push(`- Target CPL: $${budgetTargets.targetCpl}`);
  if (budgetTargets.targetCac) sections.push(`- Target CAC: $${budgetTargets.targetCac}`);
  if (budgetTargets.targetSqlsPerMonth) sections.push(`- Target SQLs/month: ${budgetTargets.targetSqlsPerMonth}`);
  if (budgetTargets.targetDemosPerMonth) sections.push(`- Target Demos/month: ${budgetTargets.targetDemosPerMonth}`);

  return sections.join('\n');
}

// =============================================================================
// Phase 2 Contexts: Synthesis (Claude Sonnet)
// =============================================================================

/**
 * Context for campaign structure synthesis.
 * Needs: validated platforms, ICP segments, budget.
 */
export function buildCampaignStructureContext(
  onboarding: OnboardingFormData,
  platformStrategy: PlatformStrategy[],
  icpTargeting: ICPTargeting,
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  // Validated platforms from Phase 1
  sections.push('## Validated Platforms');
  for (const p of platformStrategy) {
    sections.push(`- ${p.platform} (${p.priority}): ${p.budgetPercentage}% budget, CPL $${p.expectedCplRange.min}-$${p.expectedCplRange.max}`);
    sections.push(`  Formats: ${p.adFormats.join(', ')}`);
  }

  // ICP segments from Phase 1
  sections.push('## ICP Segments');
  for (const seg of icpTargeting.segments) {
    sections.push(`- ${seg.name} (${seg.funnelPosition}): ${seg.description}`);
  }

  // Compliance
  if (onboarding.compliance.topicsToAvoid || onboarding.compliance.claimRestrictions) {
    sections.push('## Compliance');
    if (onboarding.compliance.topicsToAvoid) sections.push(`- Avoid: ${onboarding.compliance.topicsToAvoid}`);
    if (onboarding.compliance.claimRestrictions) sections.push(`- Restrictions: ${onboarding.compliance.claimRestrictions}`);
  }

  return sections.join('\n');
}

/**
 * Context for creative strategy synthesis.
 * Needs: competitor creative data, ICP psychographics, brand guidelines.
 */
export function buildCreativeStrategyContext(
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData,
  platformStrategy: PlatformStrategy[],
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  // Competitor creative intelligence
  const { competitors, creativeLibrary, gapsAndOpportunities } = blueprint.competitorAnalysis;
  sections.push('## Competitor Creative Intelligence');
  for (const comp of competitors.slice(0, 4)) {
    if (comp.adCreatives?.length) {
      sections.push(`### ${comp.name}`);
      if (comp.adMessagingThemes?.length) {
        sections.push(`- Messaging Themes: ${comp.adMessagingThemes.slice(0, 3).join('; ')}`);
      }
    }
  }

  // Creative gaps
  sections.push('## Creative Opportunities');
  sections.push(`- Messaging: ${gapsAndOpportunities.messagingOpportunities.slice(0, 3).join('; ')}`);
  sections.push(`- Creative: ${gapsAndOpportunities.creativeOpportunities.slice(0, 3).join('; ')}`);

  // Active platforms and formats
  sections.push('## Active Platforms');
  for (const p of platformStrategy) {
    sections.push(`- ${p.platform}: ${p.adFormats.join(', ')}`);
  }

  // Ad hooks from synthesis
  const hooks = blueprint.crossAnalysisSynthesis.messagingFramework?.adHooks;
  if (hooks?.length) {
    sections.push('## Top Ad Hooks');
    for (const hook of hooks.slice(0, 5)) {
      sections.push(`- [${hook.technique}] ${hook.hook}`);
    }
  }

  // Brand tone
  sections.push('## Brand');
  sections.push(`- Positioning: ${onboarding.brandPositioning.brandPositioning}`);
  if (onboarding.brandPositioning.customerVoice) {
    sections.push(`- Customer Voice: ${onboarding.brandPositioning.customerVoice}`);
  }

  return sections.join('\n');
}

/**
 * Context for campaign phases synthesis.
 * Needs: platforms, budget, campaign structure.
 */
export function buildCampaignPhasesContext(
  onboarding: OnboardingFormData,
  platformStrategy: PlatformStrategy[],
  kpiTargets: KPITarget[],
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  sections.push('## Platforms');
  for (const p of platformStrategy) {
    sections.push(`- ${p.platform}: $${p.monthlySpend}/mo (${p.priority})`);
  }

  sections.push('## KPI Targets');
  for (const k of kpiTargets.filter(k => k.type === 'primary')) {
    sections.push(`- ${k.metric}: ${k.target} (${k.timeframe})`);
  }

  sections.push(`- Campaign Duration: ${onboarding.budgetTargets.campaignDuration}`);

  return sections.join('\n');
}

/**
 * Context for budget + monitoring synthesis.
 * Needs: platforms, KPIs, campaign structure.
 */
export function buildBudgetMonitoringContext(
  onboarding: OnboardingFormData,
  platformStrategy: PlatformStrategy[],
  kpiTargets: KPITarget[],
  campaignStructure: CampaignStructure,
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  sections.push('## Validated Platforms');
  for (const p of platformStrategy) {
    sections.push(`- ${p.platform}: ${p.budgetPercentage}% (${p.priority}), CPL $${p.expectedCplRange.min}-$${p.expectedCplRange.max}`);
  }

  sections.push('## Campaigns');
  for (const c of campaignStructure.campaigns) {
    sections.push(`- ${c.name} (${c.platform}, ${c.funnelStage}): $${c.dailyBudget}/day`);
  }

  sections.push('## KPI Targets');
  for (const k of kpiTargets.filter(k => k.type === 'primary').slice(0, 4)) {
    sections.push(`- ${k.metric}: ${k.target}`);
  }

  return sections.join('\n');
}

// =============================================================================
// Phase 3 Contexts: Final Synthesis
// =============================================================================

/**
 * Context for executive summary — needs the COMPLETE plan.
 */
export function buildExecutiveSummaryContext(
  onboarding: OnboardingFormData,
  platformStrategy: PlatformStrategy[],
  budgetAllocation: BudgetAllocation,
  performanceModel: PerformanceModel,
  campaignPhases: CampaignPhase[],
  kpiTargets: KPITarget[],
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  sections.push('## Platform Strategy');
  for (const p of platformStrategy) {
    sections.push(`- ${p.platform}: $${p.monthlySpend}/mo (${p.priority})`);
  }

  sections.push('## Budget');
  sections.push(`- Total: $${budgetAllocation.totalMonthlyBudget}/mo`);
  sections.push(`- Daily Ceiling: $${budgetAllocation.dailyCeiling}`);

  sections.push('## Performance Model');
  const cac = performanceModel.cacModel;
  sections.push(`- Target CPL: $${cac.targetCPL}`);
  sections.push(`- Expected Leads: ${cac.expectedMonthlyLeads}/mo`);
  sections.push(`- Expected Customers: ${cac.expectedMonthlyCustomers}/mo`);
  sections.push(`- LTV:CAC: ${cac.ltvToCacRatio}`);

  sections.push('## Campaign Phases');
  for (const phase of campaignPhases) {
    sections.push(`- Phase ${phase.phase}: ${phase.name} (${phase.durationWeeks}w, $${phase.estimatedBudget})`);
  }

  sections.push('## Primary KPIs');
  for (const k of kpiTargets.filter(k => k.type === 'primary')) {
    sections.push(`- ${k.metric}: ${k.target}`);
  }

  return sections.join('\n');
}

/**
 * Context for risk monitoring — needs concrete plan elements.
 */
export function buildRiskMonitoringContext(
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData,
  platformStrategy: PlatformStrategy[],
  budgetAllocation: BudgetAllocation,
  performanceModel: PerformanceModel,
  creativeStrategy: CreativeStrategy,
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  sections.push('## Platforms & Budget');
  for (const p of platformStrategy) {
    sections.push(`- ${p.platform}: $${p.monthlySpend}/mo (${p.budgetPercentage}%)`);
  }
  sections.push(`- Total: $${budgetAllocation.totalMonthlyBudget}/mo, Daily Ceiling: $${budgetAllocation.dailyCeiling}`);

  sections.push('## CAC Model');
  const cac = performanceModel.cacModel;
  sections.push(`- CAC: $${cac.targetCAC}, CPL: $${cac.targetCPL}, LTV:CAC: ${cac.ltvToCacRatio}`);
  sections.push(`- Leads: ${cac.expectedMonthlyLeads}/mo → SQLs: ${cac.expectedMonthlySQLs} → Customers: ${cac.expectedMonthlyCustomers}`);

  sections.push('## Creative Approach');
  sections.push(`- ${creativeStrategy.angles.length} angles, ${creativeStrategy.formatSpecs.length} format specs`);

  // ICP risk signals from blueprint
  const { riskAssessment } = blueprint.icpAnalysisValidation;
  sections.push('## ICP Risk Signals');
  sections.push(`- Reachability: ${riskAssessment.reachability}`);
  sections.push(`- Budget: ${riskAssessment.budget}`);
  sections.push(`- Competitiveness: ${riskAssessment.competitiveness}`);

  // Offer red flags
  if (blueprint.offerAnalysisViability.redFlags.length > 0) {
    sections.push(`## Offer Red Flags: ${blueprint.offerAnalysisViability.redFlags.join(', ')}`);
  }

  // Compliance
  if (onboarding.compliance.topicsToAvoid) sections.push(`- Avoid: ${onboarding.compliance.topicsToAvoid}`);
  if (onboarding.compliance.claimRestrictions) sections.push(`- Restrictions: ${onboarding.compliance.claimRestrictions}`);

  return sections.join('\n');
}
