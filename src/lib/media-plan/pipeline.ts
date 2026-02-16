// Media Plan Pipeline — 4-Phase Orchestrator
// Coordinates Phase 1 (Sonar Pro research) → Phase 2 (Sonnet synthesis + code validation)
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
  estimateRetentionMultiplier,
  type CACModelInput,
} from './validation';

import { estimateCost, MODELS } from '@/lib/ai/providers';

// =============================================================================
// Types
// =============================================================================

export interface PipelineProgress {
  section: MediaPlanSectionKey;
  phase: 'research' | 'synthesis' | 'validation' | 'final';
  status: 'start' | 'complete';
  label: string;
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

    // Emit section-complete for Phase 1
    emitSection('platformStrategy', 'complete', 'research');
    emitSection('icpTargeting', 'complete', 'research');
    emitSection('kpiTargets', 'complete', 'research');

    phaseTimings.phase1 = Date.now() - phase1Start;
    onProgress?.('Phase 1 complete. Starting synthesis...', 30);

    // =========================================================================
    // PHASE 2: Synthesis + Budget + CAC (Parallel groups after Phase 1)
    // =========================================================================
    const phase2Start = Date.now();

    // --- Phase 2: Sequential Sonnet synthesis ---
    // Sequential to stay under 8K output tokens/min rate limit.
    // Rate-limit retry logic in synthesis.ts handles any transient 429s.

    const campaignStructureCtx = buildCampaignStructureContext(onboarding, platformStrategy, icpTargeting);
    const creativeStrategyCtx = buildCreativeStrategyContext(blueprint, onboarding, platformStrategy);
    const campaignPhasesCtx = buildCampaignPhasesContext(onboarding, platformStrategy, kpiTargets);
    const budgetCtx = buildBudgetMonitoringContext(onboarding, platformStrategy, kpiTargets, {
      campaigns: [], // not yet available — budget call uses platform + KPI data
      namingConvention: { campaignPattern: '', adSetPattern: '', adPattern: '', utmStructure: { source: '', medium: '', campaign: '', content: '' } },
      retargetingSegments: [],
      negativeKeywords: [],
    });

    // 1. Campaign Structure
    emitSection('campaignStructure', 'start', 'synthesis');
    const campaignStructureResult = await synthesizeCampaignStructure(campaignStructureCtx);
    emitSection('campaignStructure', 'complete', 'synthesis');
    onProgress?.('Campaign structure complete. Synthesizing creative strategy...', 38);

    // 2. Creative Strategy
    emitSection('creativeStrategy', 'start', 'synthesis');
    const creativeStrategyResult = await synthesizeCreativeStrategy(creativeStrategyCtx);
    emitSection('creativeStrategy', 'complete', 'synthesis');
    onProgress?.('Creative strategy complete. Planning campaign phases...', 46);

    // 3. Campaign Phases
    emitSection('campaignPhases', 'start', 'synthesis');
    const campaignPhasesResult = await synthesizeCampaignPhases(campaignPhasesCtx);
    emitSection('campaignPhases', 'complete', 'synthesis');
    onProgress?.('Campaign phases complete. Allocating budget...', 54);

    // 4. Budget + Monitoring
    emitSection('budgetAllocation', 'start', 'synthesis');
    const budgetMonitoringResult = await synthesizeBudgetAndMonitoring(budgetCtx);

    const campaignStructure: CampaignStructure = campaignStructureResult.data;
    const creativeStrategy: CreativeStrategy = creativeStrategyResult.data;
    const campaignPhases: CampaignPhase[] = campaignPhasesResult.data.campaignPhases;

    totalCost += campaignStructureResult.cost + creativeStrategyResult.cost +
                 campaignPhasesResult.cost + budgetMonitoringResult.cost;

    // --- Phase 2B: Validate budget ---
    onProgress?.('Validating budget math...', 60);
    emitSection('performanceModel', 'start', 'validation');

    const { budget: validatedBudget, adjustments: budgetAdjustments } = validateAndFixBudget(
      budgetMonitoringResult.data.budgetAllocation,
      onboarding.budgetTargets.monthlyAdBudget,
    );
    const budgetAllocation: BudgetAllocation = validatedBudget;

    if (budgetAdjustments.length > 0) {
      console.log(`[MediaPlan:Pipeline] Budget adjustments: ${budgetAdjustments.map(a => a.rule).join(', ')}`);
    }

    emitSection('budgetAllocation', 'complete', 'synthesis');

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
    let sqlToCustomerRate = 25; // industry default
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
      budgetMonitoringResult.data.monitoringSchedule,
    );

    emitSection('performanceModel', 'complete', 'validation');

    // --- Reconcile KPI targets against deterministic CAC model ---
    onProgress?.('Reconciling KPI targets with computed model...', 65);
    const { kpiTargets: reconciledKPIs, overrides: kpiOverrides } = reconcileKPITargets(
      kpiTargets,
      performanceModel.cacModel,
    );
    if (kpiOverrides.length > 0) {
      console.log(`[MediaPlan:Pipeline] KPI overrides: ${kpiOverrides.map(o => `${o.rule}: ${o.reason}`).join('; ')}`);
    }

    // --- Cross-section validation ---
    onProgress?.('Validating cross-section consistency...', 70);
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
    }

    phaseTimings.phase2 = Date.now() - phase2Start;

    // =========================================================================
    // PHASE 3: Final Synthesis (Parallel, Claude Sonnet)
    // =========================================================================
    const phase3Start = Date.now();
    onProgress?.('Phase 3: Writing executive summary and risk analysis...', 75);

    const execSummaryCtx = buildExecutiveSummaryContext(
      onboarding, platformStrategy, budgetAllocation, performanceModel, campaignPhases, reconciledKPIs,
    );
    const riskCtx = buildRiskMonitoringContext(
      blueprint, onboarding, platformStrategy, budgetAllocation, performanceModel, creativeStrategy,
    );

    emitSection('executiveSummary', 'start', 'final');
    emitSection('riskMonitoring', 'start', 'final');

    const [execSummaryResult, riskResult] = await Promise.all([
      synthesizeExecutiveSummary(execSummaryCtx),
      synthesizeRiskMonitoring(riskCtx),
    ]);

    const executiveSummary: MediaPlanExecutiveSummary = execSummaryResult.data;
    const riskMonitoring: RiskMonitoring = riskResult.data;

    totalCost += execSummaryResult.cost + riskResult.cost;

    emitSection('executiveSummary', 'complete', 'final');
    emitSection('riskMonitoring', 'complete', 'final');

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

    const mediaPlan: MediaPlanOutput = {
      executiveSummary,
      platformStrategy,
      icpTargeting,
      campaignStructure,
      creativeStrategy,
      budgetAllocation,
      campaignPhases,
      kpiTargets: reconciledKPIs,
      performanceModel,
      riskMonitoring,
      metadata,
    };

    onProgress?.('Media plan complete!', 100);

    console.log(`[MediaPlan:Pipeline] Complete in ${totalTime}ms ($${totalCost.toFixed(4)}). Phase timings: P1=${phaseTimings.phase1}ms, P2=${phaseTimings.phase2}ms, P3=${phaseTimings.phase3}ms`);

    return { success: true, mediaPlan, totalCost, phaseTimings };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown pipeline error';
    console.error('[MediaPlan:Pipeline] Error:', errorMessage);
    return { success: false, error: errorMessage, totalCost, phaseTimings };
  }
}
