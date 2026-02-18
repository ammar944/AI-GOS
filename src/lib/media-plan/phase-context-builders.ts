// Media Plan Phase Context Builders
// Focused ~1500 token context strings per section instead of one generic 5KB blob.
// Each pipeline phase gets only the context it needs for higher quality output.

import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type { PlatformStrategy, ICPTargeting, KPITarget, BudgetAllocation, CampaignStructure, CreativeStrategy, CampaignPhase, PerformanceModel } from './types';

// =============================================================================
// ResolvedTargets — flat deterministic targets from computed CAC model
// =============================================================================

export interface ResolvedTargets {
  monthlyBudget: number;
  cpl: number;
  cac: number;
  leadsPerMonth: number;
  sqlsPerMonth: number;
  customersPerMonth: number;
  leadToSqlRate: number;
  sqlToCustomerRate: number;
  ltvCacRatio: string;
  estimatedLtv: number;
}

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
  blueprint?: StrategicBlueprintOutput,
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

  // Keyword intelligence from research (if available)
  if (blueprint?.keywordIntelligence?.highIntentKeywords?.length) {
    sections.push('## High-Intent Keywords (from research)');
    for (const k of blueprint.keywordIntelligence.highIntentKeywords.slice(0, 10)) {
      sections.push(`- "${k.keyword}" (${k.searchVolume}/mo, $${k.cpc.toFixed(2)} CPC)`);
    }
    sections.push('');
    sections.push('INSTRUCTION: Google Ads campaigns MUST target keywords from the high-intent list above. Do not invent keywords — use the researched ones.');
  }

  // Paid keyword gaps from research (useful for campaign targeting)
  if (blueprint?.keywordIntelligence?.paidGaps?.length) {
    sections.push('## Paid Keyword Gaps (competitors bid, you don\'t)');
    for (const k of blueprint.keywordIntelligence.paidGaps.slice(0, 8)) {
      sections.push(`- "${k.keyword}" (${k.searchVolume}/mo, $${k.cpc.toFixed(2)} CPC, difficulty: ${k.difficulty})`);
    }
  }

  // Trigger events from blueprint ICP analysis
  const triggerEvents = blueprint?.icpAnalysisValidation?.triggerEvents;
  if (triggerEvents?.length) {
    sections.push('## Trigger Events for Targeting');
    triggerEvents.slice(0, 6).forEach(t => {
      sections.push(`- ${t.event} (${t.urgencyLevel}, detection: ${t.detectionMethod})`);
      sections.push(`  Hook: "${t.recommendedHook}"`);
    });
    sections.push('INSTRUCTION: Create trigger-based ad sets targeting these specific events where platform targeting allows.');
  }

  // White space gaps for campaign positioning
  const whiteSpaceGapsCampaign = blueprint?.competitorAnalysis?.whiteSpaceGaps;
  if (whiteSpaceGapsCampaign?.length) {
    const topGaps = whiteSpaceGapsCampaign
      .filter(g => g.type === 'audience' || g.type === 'channel')
      .slice(0, 3);
    if (topGaps.length) {
      sections.push('## Audience & Channel Gaps');
      topGaps.forEach(g => {
        sections.push(`- [${g.type}] ${g.gap} (score: ${g.compositeScore ?? 'N/A'})`);
        sections.push(`  Action: ${g.recommendedAction}`);
      });
    }
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
  const { competitors, creativeLibrary } = blueprint.competitorAnalysis;
  sections.push('## Competitor Creative Intelligence');
  for (const comp of competitors.slice(0, 4)) {
    if (comp.adCreatives?.length) {
      sections.push(`### ${comp.name}`);
      if (comp.adMessagingThemes?.length) {
        sections.push(`- Messaging Themes: ${comp.adMessagingThemes.slice(0, 3).join('; ')}`);
      }
    }
  }

  // White space gaps (scored, replaces old gapsAndOpportunities)
  const whiteSpaceGaps = blueprint.competitorAnalysis?.whiteSpaceGaps;
  if (whiteSpaceGaps?.length) {
    const messagingGaps = whiteSpaceGaps.filter(g => g.type === 'messaging' || g.type === 'feature').slice(0, 4);
    const channelGaps = whiteSpaceGaps.filter(g => g.type === 'channel').slice(0, 2);

    if (messagingGaps.length) {
      sections.push('## Messaging & Feature White Space (scored gaps — exploit these)');
      messagingGaps.forEach(g => {
        sections.push(`- ${g.gap} (exploitability: ${g.exploitability}/10, impact: ${g.impact}/10, composite: ${g.compositeScore ?? 'N/A'})`);
        sections.push(`  Evidence: ${g.evidence}`);
        sections.push(`  Recommended: ${g.recommendedAction}`);
      });
      sections.push('INSTRUCTION: Top-scored white space gaps should directly inform creative angles. At least 1 angle must exploit the highest-scored gap.');
    }
    if (channelGaps.length) {
      sections.push('## Channel Gaps');
      channelGaps.forEach(g => {
        sections.push(`- ${g.gap}: ${g.recommendedAction}`);
      });
    }
  } else if (blueprint.competitorAnalysis?.gapsAndOpportunities) {
    // Legacy fallback for old blueprints without whiteSpaceGaps
    const gapsAndOpportunities = blueprint.competitorAnalysis.gapsAndOpportunities;
    sections.push('## Creative Opportunities');
    sections.push(`- Messaging: ${gapsAndOpportunities.messagingOpportunities.slice(0, 3).join('; ')}`);
    sections.push(`- Creative: ${gapsAndOpportunities.creativeOpportunities.slice(0, 3).join('; ')}`);
  }

  // Primary competitor threats with counter-positioning
  const primaryThreats = blueprint.competitorAnalysis?.competitors
    ?.filter(c => c.threatAssessment?.classification === 'primary');
  if (primaryThreats?.length) {
    sections.push('## Primary Competitor Threats (must position against)');
    primaryThreats.forEach(c => {
      sections.push(`- ${c.name} (threat score: ${c.threatAssessment?.weightedThreatScore})`);
      if (c.threatAssessment?.counterPositioning) {
        sections.push(`  Counter-positioning: ${c.threatAssessment.counterPositioning}`);
      }
      if (c.threatAssessment?.topAdHooks?.length) {
        sections.push(`  Their hooks: ${c.threatAssessment.topAdHooks.join('; ')}`);
      }
    });
    sections.push('INSTRUCTION: Include at least 1 creative angle that directly counter-positions against primary threats above.');
  }

  // Active platforms and formats
  sections.push('## Active Platforms');
  for (const p of platformStrategy) {
    sections.push(`- ${p.platform}: ${p.adFormats.join(', ')}`);
  }

  // Ad hooks from synthesis (with technique + awareness level)
  const hooks = blueprint.crossAnalysisSynthesis.messagingFramework?.adHooks;
  if (hooks?.length) {
    sections.push('## Top Ad Hooks');
    for (const hook of hooks.slice(0, 5)) {
      sections.push(`- [${hook.technique}] ${hook.hook} (awareness: ${hook.targetAwareness})`);
    }
  }

  // Competitor weaknesses (from analysis)
  const competitorWeaknesses: string[] = [];
  for (const comp of competitors.slice(0, 4)) {
    if (comp.weaknesses?.length) {
      for (const w of comp.weaknesses.slice(0, 2)) {
        competitorWeaknesses.push(`- ${comp.name}: "${w}"`);
      }
    }
  }
  if (competitorWeaknesses.length > 0) {
    sections.push('## Competitor Weaknesses (from analysis)');
    sections.push(...competitorWeaknesses);
    sections.push('');
    sections.push('INSTRUCTION: Include at least 1 creative angle that leverages competitor weaknesses above.');
  }

  // Offer proof score
  const proofScore = blueprint.offerAnalysisViability.offerStrength.overallScore;
  sections.push(`## Offer Proof Score: ${proofScore}/10`);
  if (proofScore < 7) {
    sections.push('WARNING: Proof is weak for cold traffic. Do NOT use specific customer count claims or revenue figures unless documented. Use "typically" language and focus on process/speed benefits rather than outcome claims.');
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
 * Optional blueprint for sensitivity analysis scenario data.
 */
// NOTE: pipeline.ts caller needs update to pass blueprint
export function buildCampaignPhasesContext(
  onboarding: OnboardingFormData,
  platformStrategy: PlatformStrategy[],
  kpiTargets: KPITarget[],
  blueprint?: StrategicBlueprintOutput,
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

  // Sensitivity analysis scenarios from blueprint ICP analysis
  const sensitivity = blueprint?.icpAnalysisValidation?.sensitivityAnalysis;
  if (sensitivity) {
    sections.push('');
    sections.push('## Sensitivity Analysis');
    sections.push(`- Best Case: CPL $${sensitivity.bestCase.assumedCPL}, SQL rate ${sensitivity.bestCase.assumedLeadToSqlRate}%, Customer rate ${sensitivity.bestCase.assumedSqlToCustomerRate}%`);
    sections.push(`- Base Case: CPL $${sensitivity.baseCase.assumedCPL}, SQL rate ${sensitivity.baseCase.assumedLeadToSqlRate}%, Customer rate ${sensitivity.baseCase.assumedSqlToCustomerRate}%`);
    sections.push(`- Worst Case: CPL $${sensitivity.worstCase.assumedCPL}, SQL rate ${sensitivity.worstCase.assumedLeadToSqlRate}%, Customer rate ${sensitivity.worstCase.assumedSqlToCustomerRate}%`);
    sections.push(`- Break-even: max CPL $${sensitivity.breakEven.maxCPLFor3xLTV} for 3x LTV, max CAC $${sensitivity.breakEven.maxCAC}, min lead-to-SQL rate ${sensitivity.breakEven.minLeadToSqlRate}%, budget floor $${sensitivity.breakEven.budgetFloorForTesting}`);
    sections.push('');
    sections.push('INSTRUCTION: Use base case for primary targets. Worst case defines minimum acceptable floor. If worst-case CPL exceeds budget capacity, note this as a constraint on phase scaling.');
  }

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
  blueprint?: StrategicBlueprintOutput,
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

  // Segment budget weights from ICP prioritization
  const segmentSizing = blueprint?.icpAnalysisValidation?.segmentSizing;
  if (segmentSizing?.length) {
    sections.push('## Segment Budget Weights (from ICP prioritization)');
    [...segmentSizing]
      .sort((a, b) => a.priorityTier - b.priorityTier)
      .forEach(s => {
        sections.push(`- Tier ${s.priorityTier}: ${s.recommendedBudgetWeight}% of budget (~${s.totalAddressableAccounts} accounts, ${s.totalAddressableContacts} contacts)`);
      });
    sections.push('INSTRUCTION: Budget allocation should weight towards higher-priority segments. Tier 1 should receive the largest share.');
  }

  // Research-recommended platform allocation
  const recPlatforms = blueprint?.crossAnalysisSynthesis.recommendedPlatforms;
  if (recPlatforms?.length) {
    sections.push('## Research-Recommended Platform Allocation');
    for (const p of recPlatforms) {
      sections.push(`- ${p.platform} (${p.priority}): ${p.reasoning}`);
    }
    sections.push('');
    sections.push('INSTRUCTION: Platform budget allocation should align with research recommendations. If deviating >10%, include justification.');
  }

  // Sensitivity analysis scenarios for contingency planning
  const sensitivity = blueprint?.icpAnalysisValidation?.sensitivityAnalysis;
  if (sensitivity) {
    sections.push('');
    sections.push('## Sensitivity Analysis');
    sections.push(`- Best Case: CPL $${sensitivity.bestCase.assumedCPL}, SQL rate ${sensitivity.bestCase.assumedLeadToSqlRate}%, Customer rate ${sensitivity.bestCase.assumedSqlToCustomerRate}%`);
    sections.push(`- Base Case: CPL $${sensitivity.baseCase.assumedCPL}, SQL rate ${sensitivity.baseCase.assumedLeadToSqlRate}%, Customer rate ${sensitivity.baseCase.assumedSqlToCustomerRate}%`);
    sections.push(`- Worst Case: CPL $${sensitivity.worstCase.assumedCPL}, SQL rate ${sensitivity.worstCase.assumedLeadToSqlRate}%, Customer rate ${sensitivity.worstCase.assumedSqlToCustomerRate}%`);
    sections.push(`- Break-even: max CPL $${sensitivity.breakEven.maxCPLFor3xLTV} for 3x LTV, max CAC $${sensitivity.breakEven.maxCAC}, min lead-to-SQL rate ${sensitivity.breakEven.minLeadToSqlRate}%, budget floor $${sensitivity.breakEven.budgetFloorForTesting}`);
    sections.push('');
    sections.push('INSTRUCTION: Use worst-case CPL as the ceiling for scaling decisions. Contingency triggers should activate budget reallocation when metrics approach worst-case thresholds.');
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
  resolvedTargets?: ResolvedTargets,
  blueprint?: StrategicBlueprintOutput,
): string {
  const sections: string[] = [buildClientBrief(onboarding)];

  // SAM estimate for market context
  const samEstimate = blueprint?.icpAnalysisValidation?.samEstimate;
  if (samEstimate) {
    sections.push('## Market Size (SAM)');
    sections.push(`- Serviceable Addressable Market: ~${samEstimate.estimatedSAMCompanies.toLocaleString()} companies`);
    sections.push(`- Estimated annual contract value: $${samEstimate.estimatedAnnualContractValue.toLocaleString()}`);
    sections.push(`- Confidence: ${samEstimate.confidence}`);
  }

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

  // Validated performance targets (if provided)
  if (resolvedTargets) {
    sections.push('## Validated Performance Targets (use these EXACT numbers)');
    sections.push(`- Monthly Budget: $${resolvedTargets.monthlyBudget.toLocaleString()}`);
    sections.push(`- Target CPL: $${resolvedTargets.cpl}`);
    sections.push(`- Expected Leads/mo: ${resolvedTargets.leadsPerMonth}`);
    sections.push(`- Expected SQLs/mo: ${resolvedTargets.sqlsPerMonth}`);
    sections.push(`- Expected Customers/mo: ${resolvedTargets.customersPerMonth}`);
    sections.push(`- Target CAC: $${resolvedTargets.cac}`);
    sections.push(`- LTV:CAC Ratio: ${resolvedTargets.ltvCacRatio}`);
    sections.push('');
    sections.push('CRITICAL: Use ONLY the numbers above for the executive summary. Do not round, estimate, or substitute benchmark numbers.');
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
  resolvedTargets?: ResolvedTargets,
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

  // ICP risk scores from blueprint (new numerical scoring)
  const riskScores = blueprint.icpAnalysisValidation?.riskScores;
  if (riskScores?.length) {
    sections.push('## ICP Risk Scores (inherit these — add campaign-specific risks on top)');
    [...riskScores]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .forEach(r => {
        sections.push(`- [${r.classification?.toUpperCase() ?? 'UNSCORED'}] ${r.category}: ${r.risk} (P:${r.probability} × I:${r.impact} = ${r.score ?? '?'})`);
        if (r.mitigation) sections.push(`  Mitigation: ${r.mitigation}`);
        if (r.contingency) sections.push(`  Contingency: ${r.contingency}`);
        if (r.earlyWarningIndicator) sections.push(`  Early warning: ${r.earlyWarningIndicator}`);
        if (r.budgetImpactEstimate) sections.push(`  Budget impact: ${r.budgetImpactEstimate}`);
      });
    sections.push('INSTRUCTION: Inherit these risk scores. Risks scored ≥13 MUST appear in the media plan risk section with mitigations. Add campaign-specific risks on top.');
  } else {
    // Legacy fallback for old blueprints with riskAssessment instead of riskScores
    const legacyRisk = (blueprint.icpAnalysisValidation as unknown as Record<string, unknown>)?.riskAssessment as
      { reachability?: string; budget?: string; competitiveness?: string; painStrength?: string } | undefined;
    if (legacyRisk) {
      sections.push('## ICP Risk Signals');
      if (legacyRisk.reachability) sections.push(`- Reachability: ${legacyRisk.reachability}`);
      if (legacyRisk.budget) sections.push(`- Budget: ${legacyRisk.budget}`);
      if (legacyRisk.competitiveness) sections.push(`- Competitiveness: ${legacyRisk.competitiveness}`);
    }
  }

  // Offer red flags
  if (blueprint.offerAnalysisViability.redFlags.length > 0) {
    sections.push(`## Offer Red Flags: ${blueprint.offerAnalysisViability.redFlags.join(', ')}`);
  }

  // Compliance
  if (onboarding.compliance.topicsToAvoid) sections.push(`- Avoid: ${onboarding.compliance.topicsToAvoid}`);
  if (onboarding.compliance.claimRestrictions) sections.push(`- Restrictions: ${onboarding.compliance.claimRestrictions}`);

  // Validated performance targets (if provided)
  if (resolvedTargets) {
    sections.push('## Validated Performance Targets (reference for risk thresholds)');
    sections.push(`- Monthly Budget: $${resolvedTargets.monthlyBudget.toLocaleString()}`);
    sections.push(`- Target CPL: $${resolvedTargets.cpl}`);
    sections.push(`- Expected Leads/mo: ${resolvedTargets.leadsPerMonth}`);
    sections.push(`- Expected SQLs/mo: ${resolvedTargets.sqlsPerMonth}`);
    sections.push(`- Expected Customers/mo: ${resolvedTargets.customersPerMonth}`);
    sections.push(`- Target CAC: $${resolvedTargets.cac}`);
    sections.push(`- LTV:CAC Ratio: ${resolvedTargets.ltvCacRatio}`);
    sections.push('');
    sections.push('CRITICAL: Use ONLY the numbers above when defining risk thresholds and monitoring triggers. Do not substitute benchmark numbers.');
  }

  return sections.join('\n');
}
