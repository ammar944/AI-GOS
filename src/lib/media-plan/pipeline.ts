// Media Plan Pipeline — Wave-Based Orchestrator
// Coordinates Phase 1 (Sonar Pro research) → Phase 2 (Sonnet synthesis in staggered waves)
// → Phase 3 (final synthesis) following the strategic blueprint generator.ts pattern.

import type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';
import type { OnboardingFormData } from '@/lib/onboarding/types';
import type {
  MediaPlanOutput,
  MediaPlanMetadata,
  PlatformStrategy,
  ICPTargeting,
  KPITarget,
  CampaignStructure,
  CreativeStrategy,
  BudgetAllocation,
  CampaignPhase,
  PerformanceModel,
  MediaPlanExecutiveSummary,
  RiskMonitoring,
} from './types';
import type { MediaPlanSectionKey } from './section-constants';
import { executeWave } from './wave-executor';

// Phase 1: Research
import { researchPlatformStrategy, researchICPTargeting, researchKPIBenchmarks } from './research';

// Phase 2/3: Synthesis
import {
  synthesizeCampaignStructure,
  synthesizeCreativeStrategy,
  synthesizeCampaignPhases,
  synthesizeBudgetAndMonitoring,
  synthesizeExecutiveSummary,
  synthesizeRiskMonitoring,
} from './synthesis';

// Context builders
import {
  buildPlatformStrategyContext,
  buildICPTargetingContext,
  buildKPIBenchmarksContext,
  buildCampaignStructureContext,
  buildCreativeStrategyContext,
  buildCampaignPhasesContext,
  buildBudgetMonitoringContext,
  buildExecutiveSummaryContext,
  buildRiskMonitoringContext,
} from './phase-context-builders';

// Deterministic validation
import {
  validateAndFixBudget,
  computeCACModel,
  buildPerformanceModel,
  validateCrossSection,
  reconcileKPITargets,
  reconcileTimeline,
  validatePhaseBudgets,
  buildResolvedTargets,
  validateWithinPlatformBudgets,
  validateCampaignNaming,
  validateRetargetingPoolRealism,
  validatePerPlatformDailyBudgets,
  validatePlatformCompliance,
  estimateRetentionMultiplier,
  validateRiskMonitoring,
  reconcileMonthlyRoadmapWithPhases,
  sweepStaleReferences,
  type CACModelInput,
} from './validation';

import { estimateCost, MODELS } from '@/lib/ai/providers';

// =============================================================================
// Types
// =============================================================================

export interface PipelineProgress {
  section: MediaPlanSectionKey;
  phase: 'research' | 'synthesis' | 'validation' | 'final';
  status: 'start' | 'complete' | 'data';
  label: string;
  data?: unknown;
}

export interface PipelineOptions {
  onSectionProgress?: (progress: PipelineProgress) => void;
  onProgress?: (message: string, percentage: number) => void;
}

export interface PipelineResult {
  success: boolean;
  mediaPlan?: MediaPlanOutput;
  error?: string;
  totalCost: number;
  phaseTimings: Record<string, number>;
}

// =============================================================================
// Section label lookup
// =============================================================================

const SECTION_LABELS: Record<MediaPlanSectionKey, string> = {
  executiveSummary: 'Executive Summary',
  platformStrategy: 'Platform Strategy',
  icpTargeting: 'ICP Targeting',
  campaignStructure: 'Campaign Structure',
  creativeStrategy: 'Creative Strategy',
  budgetAllocation: 'Budget Allocation',
  campaignPhases: 'Campaign Phases',
  kpiTargets: 'KPI Targets',
  performanceModel: 'Performance Model',
  riskMonitoring: 'Risk & Monitoring',
};

// =============================================================================
// Pipeline Orchestrator
// =============================================================================

export async function runMediaPlanPipeline(
  blueprint: StrategicBlueprintOutput,
  onboarding: OnboardingFormData,
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  const { onSectionProgress, onProgress } = options;
  const startTime = Date.now();
  let totalCost = 0;
  const phaseTimings: Record<string, number> = {};

  const emitSection = (section: MediaPlanSectionKey, status: 'start' | 'complete', phase: PipelineProgress['phase']) => {
    onSectionProgress?.({ section, phase, status, label: SECTION_LABELS[section] });
  };

  const emitSectionData = (section: MediaPlanSectionKey, data: unknown, phase: PipelineProgress['phase']) => {
    onSectionProgress?.({ section, phase, status: 'data', label: SECTION_LABELS[section], data });
  };

  try {
    // =========================================================================
    // PHASE 1: Web-Grounded Research (Parallel, Sonar Pro)
    // =========================================================================
    const phase1Start = Date.now();
    onProgress?.('Phase 1: Researching platforms, ICP targeting, and KPI benchmarks...', 5);

    // Build focused contexts for each research call
    const platformCtx = buildPlatformStrategyContext(blueprint, onboarding);
    const icpCtx = buildICPTargetingContext(blueprint, onboarding);
    const kpiCtx = buildKPIBenchmarksContext(blueprint, onboarding);

    // Emit section-start for all Phase 1 sections
    emitSection('platformStrategy', 'start', 'research');
    emitSection('icpTargeting', 'start', 'research');
    emitSection('kpiTargets', 'start', 'research');

    // Run all three in parallel
    const [platformResult, icpResult, kpiResult] = await Promise.all([
      researchPlatformStrategy(platformCtx),
      researchICPTargeting(icpCtx),
      researchKPIBenchmarks(kpiCtx),
    ]);

    const platformStrategy: PlatformStrategy[] = platformResult.data.platforms;
    const icpTargeting: ICPTargeting = icpResult.data;
    const kpiTargets: KPITarget[] = kpiResult.data.kpiTargets;

    totalCost += platformResult.cost + icpResult.cost + kpiResult.cost;

    // Emit section-complete + section-data for Phase 1
    emitSection('platformStrategy', 'complete', 'research');
    emitSection('icpTargeting', 'complete', 'research');
    emitSection('kpiTargets', 'complete', 'research');
    emitSectionData('platformStrategy', platformStrategy, 'research');
    emitSectionData('icpTargeting', icpTargeting, 'research');
    emitSectionData('kpiTargets', kpiTargets, 'research');

    phaseTimings.phase1 = Date.now() - phase1Start;
    onProgress?.('Phase 1 complete. Starting synthesis...', 30);

    // =========================================================================
    // PHASE 2A: Synthesis in Staggered Waves (Sonnet)
    // Wave 1: Campaign Structure + Creative Strategy (no cross-dependency)
    // Wave 2: Campaign Phases + Budget (budget needs campaign structure from Wave 1)
    // =========================================================================
    const phase2Start = Date.now();

    // Build contexts that only depend on Phase 1 outputs
    const campaignStructureCtx = buildCampaignStructureContext(onboarding, platformStrategy, icpTargeting, blueprint);
    const creativeStrategyCtx = buildCreativeStrategyContext(blueprint, onboarding, platformStrategy);
    const campaignPhasesCtx = buildCampaignPhasesContext(onboarding, platformStrategy, kpiTargets, blueprint);

    // --- Wave 1: Campaign Structure (6K) + Creative Strategy (5K), 5s stagger ---
    onProgress?.('Synthesizing campaign structure + creative strategy...', 32);

    interface SynthesisResult<T> { data: T; cost: number }

    const wave1 = await executeWave<SynthesisResult<unknown>>([
      {
        id: 'campaignStructure',
        execute: () => synthesizeCampaignStructure(campaignStructureCtx),
        onStart: () => emitSection('campaignStructure', 'start', 'synthesis'),
        onComplete: (result) => {
          emitSection('campaignStructure', 'complete', 'synthesis');
          emitSectionData('campaignStructure', result.data, 'synthesis');
        },
      },
      {
        id: 'creativeStrategy',
        execute: () => synthesizeCreativeStrategy(creativeStrategyCtx),
        onStart: () => emitSection('creativeStrategy', 'start', 'synthesis'),
        onComplete: (result) => {
          emitSection('creativeStrategy', 'complete', 'synthesis');
          emitSectionData('creativeStrategy', result.data, 'synthesis');
        },
      },
    ], { staggerDelayMs: 5000 });

    const campaignStructure: CampaignStructure = wave1.results.get('campaignStructure')!.data as CampaignStructure;
    const creativeStrategy: CreativeStrategy = wave1.results.get('creativeStrategy')!.data as CreativeStrategy;
    const wave1Cost = Array.from(wave1.results.values()).reduce((sum, r) => sum + r.cost, 0);
    totalCost += wave1Cost;

    onProgress?.('Wave 1 complete. Starting budget + phases...', 50);
    console.log(`[MediaPlan:Pipeline] Wave 1 complete in ${wave1.timingMs}ms ($${wave1Cost.toFixed(4)})`);

    // --- Wave 2: Campaign Phases (4K) + Budget (4.5K), 3s stagger ---
    // Budget now gets REAL campaign structure data (quality improvement)
    const budgetCtx = buildBudgetMonitoringContext(onboarding, platformStrategy, kpiTargets, campaignStructure, blueprint);

    onProgress?.('Synthesizing campaign phases + budget...', 52);

    const wave2 = await executeWave<SynthesisResult<unknown>>([
      {
        id: 'campaignPhases',
        execute: () => synthesizeCampaignPhases(campaignPhasesCtx),
        onStart: () => emitSection('campaignPhases', 'start', 'synthesis'),
        onComplete: (result) => {
          emitSection('campaignPhases', 'complete', 'synthesis');
          emitSectionData('campaignPhases', (result.data as { campaignPhases: CampaignPhase[] }).campaignPhases, 'synthesis');
        },
      },
      {
        id: 'budgetAllocation',
        execute: () => synthesizeBudgetAndMonitoring(budgetCtx),
        onStart: () => emitSection('budgetAllocation', 'start', 'synthesis'),
        // budgetAllocation complete emitted after validation below
      },
    ], { staggerDelayMs: 3000 });

    const campaignPhases: CampaignPhase[] = (wave2.results.get('campaignPhases')!.data as { campaignPhases: CampaignPhase[] }).campaignPhases;
    const budgetMonitoringResult = wave2.results.get('budgetAllocation')!;
    const wave2Cost = Array.from(wave2.results.values()).reduce((sum, r) => sum + r.cost, 0);
    totalCost += wave2Cost;

    onProgress?.('Synthesis complete. Validating...', 65);
    console.log(`[MediaPlan:Pipeline] Wave 2 complete in ${wave2.timingMs}ms ($${wave2Cost.toFixed(4)})`);

    // --- Phase 2B: Validate budget ---
    onProgress?.('Validating budget math...', 68);
    emitSection('performanceModel', 'start', 'validation');

    const budgetMonitoringData = budgetMonitoringResult.data as {
      budgetAllocation: BudgetAllocation;
      monitoringSchedule: { daily: string[]; weekly: string[]; monthly: string[] };
    };
    const { budget: validatedBudget, adjustments: budgetAdjustments } = validateAndFixBudget(
      budgetMonitoringData.budgetAllocation,
      onboarding.budgetTargets.monthlyAdBudget,
    );
    let budgetAllocation: BudgetAllocation = validatedBudget;

    if (budgetAdjustments.length > 0) {
      console.log(`[MediaPlan:Pipeline] Budget adjustments: ${budgetAdjustments.map(a => a.rule).join(', ')}`);
    }

    // --- Phase 2C: Deterministic CAC Model ---
    // Extract target CPL from KPI research or use onboarding target
    const cplFromKPI = kpiTargets.find(k =>
      k.metric.toLowerCase().includes('cost per lead') || k.metric.toLowerCase().includes('cpl'),
    );
    let targetCPL = onboarding.budgetTargets.targetCpl ?? 75;
    if (cplFromKPI) {
      const match = cplFromKPI.target.match(/\$?(\d+)/);
      if (match) targetCPL = parseInt(match[1], 10);
    }

    // Extract conversion rates from KPI research or use defaults
    let leadToSqlRate = 15; // industry default
    const sqlToCustomerRate = 25; // industry default
    const sqlRateKPI = kpiTargets.find(k =>
      k.metric.toLowerCase().includes('sql') && k.metric.toLowerCase().includes('rate'),
    );
    if (sqlRateKPI) {
      const match = sqlRateKPI.target.match(/(\d+)/);
      if (match) leadToSqlRate = parseInt(match[1], 10);
    }

    const retentionMultiplier = estimateRetentionMultiplier(onboarding.productOffer.pricingModel);

    const cacInput: CACModelInput = {
      monthlyBudget: budgetAllocation.totalMonthlyBudget,
      targetCPL,
      leadToSqlRate,
      sqlToCustomerRate,
      offerPrice: onboarding.productOffer.offerPrice,
      retentionMultiplier,
    };

    const performanceModel: PerformanceModel = buildPerformanceModel(
      cacInput,
      budgetMonitoringData.monitoringSchedule,
    );

    emitSection('budgetAllocation', 'complete', 'synthesis');
    emitSectionData('budgetAllocation', budgetAllocation, 'synthesis');
    emitSection('performanceModel', 'complete', 'validation');
    emitSectionData('performanceModel', performanceModel, 'validation');

    // --- Collect all validation warnings for persistence ---
    const allValidationWarnings: string[] = [];

    // --- Reconcile KPI targets against deterministic CAC model ---
    onProgress?.('Reconciling KPI targets with computed model...', 70);
    const { kpiTargets: reconciledKPIs, overrides: kpiOverrides } = reconcileKPITargets(
      kpiTargets,
      performanceModel.cacModel,
      budgetAllocation.totalMonthlyBudget,
      onboarding.productOffer.offerPrice,
    );
    if (kpiOverrides.length > 0) {
      console.log(`[MediaPlan:Pipeline] KPI overrides: ${kpiOverrides.map(o => `${o.rule}: ${o.reason}`).join('; ')}`);
      allValidationWarnings.push(...kpiOverrides.map(o => `KPI Override (${o.rule}): ${o.reason}`));
    }

    // --- Cross-section validation ---
    onProgress?.('Validating cross-section consistency...', 72);
    const crossValidation = validateCrossSection({
      platformStrategy,
      icpTargeting,
      campaignStructure,
      budgetAllocation,
      kpiTargets: reconciledKPIs,
      performanceModel,
    });
    if (crossValidation.warnings.length > 0) {
      console.warn(`[MediaPlan:Pipeline] Cross-section warnings: ${crossValidation.warnings.join('; ')}`);
      allValidationWarnings.push(...crossValidation.warnings);
    }

    // Apply cross-validation fixes (e.g. proportional daily budget scaling)
    let validatedCampaignStructure = campaignStructure;
    if (crossValidation.fixes?.campaignStructure) {
      validatedCampaignStructure = crossValidation.fixes.campaignStructure;
      console.log('[MediaPlan:Pipeline] Applied cross-validation campaign structure fix');
    }

    // --- Phase 2D: Within-platform campaign budget split validation ---
    onProgress?.('Validating within-platform budget splits...', 73);
    const withinPlatformResult = validateWithinPlatformBudgets(validatedCampaignStructure);
    validatedCampaignStructure = withinPlatformResult.campaignStructure;
    if (withinPlatformResult.warnings.length > 0) {
      console.warn(`[MediaPlan:Pipeline] Within-platform budget warnings: ${withinPlatformResult.warnings.join('; ')}`);
      allValidationWarnings.push(...withinPlatformResult.warnings);
    }
    if (withinPlatformResult.adjustments.length > 0) {
      console.log(`[MediaPlan:Pipeline] Within-platform budget adjustments: ${withinPlatformResult.adjustments.map(a => a.rule).join(', ')}`);
    }

    // --- Phase 2D.5: Per-platform daily budget validation ---
    onProgress?.('Validating per-platform daily budgets...', 73.5);
    const perPlatformWarnings: string[] = [];
    validatedCampaignStructure = validatePerPlatformDailyBudgets(
      platformStrategy,
      validatedCampaignStructure,
      perPlatformWarnings,
    );
    if (perPlatformWarnings.length > 0) {
      console.warn(`[MediaPlan:Pipeline] Per-platform daily budget warnings: ${perPlatformWarnings.join('; ')}`);
      allValidationWarnings.push(...perPlatformWarnings);
    }

    // --- Phase 2E: ACV + Platform Minimum Compliance ---
    onProgress?.('Validating ACV rules and platform minimums...', 74);
    const complianceResult = validatePlatformCompliance(
      platformStrategy,
      validatedCampaignStructure,
      onboarding,
    );
    validatedCampaignStructure = complianceResult.campaignStructure;
    // Update platformStrategy with belowMinimum flags and rationale prepends
    // (platformStrategy is used downstream for exec summary and risk context)
    const validatedPlatformStrategy = complianceResult.platformStrategy;
    if (complianceResult.warnings.length > 0) {
      console.warn(`[MediaPlan:Pipeline] Platform compliance warnings: ${complianceResult.warnings.join('; ')}`);
      allValidationWarnings.push(...complianceResult.warnings);
    }
    if (complianceResult.adjustments.length > 0) {
      console.log(`[MediaPlan:Pipeline] Platform compliance adjustments: ${complianceResult.adjustments.map(a => a.rule).join(', ')}`);
    }

    // --- Phase 2F: Campaign naming consistency ---
    onProgress?.('Validating campaign naming conventions...', 75);
    const namingResult = validateCampaignNaming(validatedCampaignStructure);
    validatedCampaignStructure = namingResult.campaignStructure;
    if (namingResult.adjustments.length > 0) {
      console.log(`[MediaPlan:Pipeline] Naming adjustments: ${namingResult.adjustments.map(a => a.rule).join(', ')}`);
    }

    // --- Phase 2G: Phase budget reconciliation ---
    const phaseBudgetResult = validatePhaseBudgets(
      campaignPhases,
      budgetAllocation.totalMonthlyBudget,
      budgetAllocation.dailyCeiling,
      validatedCampaignStructure.campaigns,
    );
    const validatedCampaignPhases = phaseBudgetResult.phases;
    if (phaseBudgetResult.adjustments.length > 0) {
      console.log(`[MediaPlan:Pipeline] Phase budget adjustments: ${phaseBudgetResult.adjustments.map(a => a.rule).join(', ')}`);
    }

    // --- Phase 2G.5: Monthly roadmap ↔ phase budget reconciliation ---
    const roadmapResult = reconcileMonthlyRoadmapWithPhases(budgetAllocation, validatedCampaignPhases);
    budgetAllocation = roadmapResult.budgetAllocation;
    if (roadmapResult.adjustments.length > 0) {
      console.log(`[MediaPlan:Pipeline] Roadmap reconciliation: ${roadmapResult.adjustments.map(a => a.rule).join(', ')}`);
    }

    // --- Phase 2H: Retargeting pool realism check ---
    const hasExistingPaidTraffic = (blueprint.keywordIntelligence?.clientDomain?.paidKeywords ?? 0) > 0;
    const hasOrganicKeywords = (blueprint.keywordIntelligence?.clientDomain?.organicKeywords ?? 0) > 0;
    const retargetingResult = validateRetargetingPoolRealism({
      campaignStructure: validatedCampaignStructure,
      campaignPhases: validatedCampaignPhases,
      hasExistingPaidTraffic,
      hasOrganicKeywords,
    });
    validatedCampaignStructure = retargetingResult.campaignStructure;
    const finalCampaignPhases = retargetingResult.campaignPhases;
    if (retargetingResult.warnings.length > 0) {
      console.warn(`[MediaPlan:Pipeline] Retargeting warnings: ${retargetingResult.warnings.join('; ')}`);
      allValidationWarnings.push(...retargetingResult.warnings);
    }

    // --- Emit validated campaign structure (replaces pre-validation synthesis emit) ---
    emitSectionData('campaignStructure', validatedCampaignStructure, 'validation');

    // --- Build resolved targets for downstream consumption ---
    const resolvedTargets = buildResolvedTargets(performanceModel.cacModel, budgetAllocation.totalMonthlyBudget);

    phaseTimings.phase2 = Date.now() - phase2Start;

    // =========================================================================
    // PHASE 3: Final Synthesis (Parallel, Claude Sonnet)
    // =========================================================================
    const phase3Start = Date.now();
    onProgress?.('Phase 3: Writing executive summary and risk analysis...', 78);

    const execSummaryCtx = buildExecutiveSummaryContext(
      onboarding, validatedPlatformStrategy, budgetAllocation, performanceModel, finalCampaignPhases, reconciledKPIs, resolvedTargets, blueprint,
    );
    const riskCtx = buildRiskMonitoringContext(
      blueprint, onboarding, validatedPlatformStrategy, budgetAllocation, performanceModel, creativeStrategy, resolvedTargets,
    );

    emitSection('executiveSummary', 'start', 'final');
    emitSection('riskMonitoring', 'start', 'final');

    const [execSummaryResult, riskResult] = await Promise.all([
      synthesizeExecutiveSummary(execSummaryCtx),
      synthesizeRiskMonitoring(riskCtx),
    ]);

    const executiveSummary: MediaPlanExecutiveSummary = execSummaryResult.data;
    const riskMonitoring: RiskMonitoring = validateRiskMonitoring(riskResult.data);

    totalCost += execSummaryResult.cost + riskResult.cost;

    emitSection('executiveSummary', 'complete', 'final');
    emitSection('riskMonitoring', 'complete', 'final');
    emitSectionData('executiveSummary', executiveSummary, 'final');
    emitSectionData('riskMonitoring', riskMonitoring, 'final');

    // --- Post-Phase-3: Timeline consistency check (warning only) ---
    const timelineWarnings = reconcileTimeline(executiveSummary, finalCampaignPhases);
    if (timelineWarnings.length > 0) {
      console.warn(`[MediaPlan:Pipeline] Timeline warnings: ${timelineWarnings.join('; ')}`);
      allValidationWarnings.push(...timelineWarnings);
    }

    phaseTimings.phase3 = Date.now() - phase3Start;

    // =========================================================================
    // Assemble final output
    // =========================================================================
    const totalTime = Date.now() - startTime;

    const metadata: MediaPlanMetadata = {
      generatedAt: new Date().toISOString(),
      version: '3.0.0',
      processingTime: totalTime,
      totalCost,
      modelUsed: `${MODELS.SONAR_PRO} + ${MODELS.CLAUDE_SONNET}`,
    };

    let mediaPlan: MediaPlanOutput = {
      executiveSummary,
      platformStrategy: validatedPlatformStrategy,
      icpTargeting,
      campaignStructure: validatedCampaignStructure,
      creativeStrategy,
      budgetAllocation,
      campaignPhases: finalCampaignPhases,
      kpiTargets: reconciledKPIs,
      performanceModel,
      riskMonitoring,
      metadata,
    };

    // --- Post-assembly: Sweep stale CAC/lead/LTV references in free text ---
    const sweepResult = sweepStaleReferences(mediaPlan, performanceModel.cacModel, budgetAllocation.totalMonthlyBudget, onboarding.productOffer.offerPrice);
    mediaPlan = sweepResult.mediaPlan;
    if (sweepResult.corrections.length > 0) {
      console.log(`[MediaPlan:Pipeline] Stale reference sweep: ${sweepResult.corrections.length} corrections`);
      for (const c of sweepResult.corrections) {
        console.log(`  → ${c}`);
      }
      allValidationWarnings.push(...sweepResult.corrections.map(c => `Stale reference fix: ${c}`));
    }

    // --- Persist all validation warnings on the output ---
    if (allValidationWarnings.length > 0) {
      mediaPlan.validationWarnings = allValidationWarnings;
    }

    onProgress?.('Media plan complete!', 100);

    console.log(`[MediaPlan:Pipeline] Complete in ${totalTime}ms ($${totalCost.toFixed(4)}). Phase timings: P1=${phaseTimings.phase1}ms, P2=${phaseTimings.phase2}ms, P3=${phaseTimings.phase3}ms`);

    return { success: true, mediaPlan, totalCost, phaseTimings };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
    console.error('[MediaPlan:Pipeline] Error:', errorMessage);
    return { success: false, error: errorMessage, totalCost, phaseTimings };
  }
}
