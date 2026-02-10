// Strategic Blueprint Generator
// Orchestrates all 5 sections with parallel execution
// Uses Vercel AI SDK for research, keeps existing Firecrawl/AdLibrary for enrichment

import {
  researchIndustryMarket,
  researchICPAnalysis,
  researchOfferAnalysis,
  researchCompetitors,
  synthesizeCrossAnalysis,
} from './research';
import { reconcileICPAndOffer, type ReconciliationResult } from './reconciliation';
import type {
  IndustryMarketResult,
  ICPAnalysisResult,
  OfferAnalysisResult,
  CompetitorAnalysisResult,
  CrossAnalysisResult,
  ProgressCallback,
  AllSectionResults,
} from './types';
import type {
  CompetitorAnalysis,
} from './schemas';
import type {
  StrategicBlueprintOutput,
} from '@/lib/strategic-blueprint/output-types';

// Re-export for consumers
export type { StrategicBlueprintOutput } from '@/lib/strategic-blueprint/output-types';

export interface GeneratorOptions {
  onProgress?: ProgressCallback;
  abortSignal?: AbortSignal;
  /** Optional: Pre-enriched competitor data (pricing + ads already added) */
  enrichedCompetitors?: CompetitorAnalysis;
  /** Optional: Pre-fetched keyword intelligence data (from SpyFu) */
  keywordIntelligenceData?: import('@/lib/strategic-blueprint/output-types').KeywordIntelligence;
  /** Async provider for enriched competitors — called between Phase 2 and Phase 3 (zero delay if enrichment already finished) */
  getEnrichedCompetitors?: () => Promise<CompetitorAnalysis | undefined>;
  /** Async provider for keyword intelligence — called between Phase 2 and Phase 3 */
  getKeywordIntelligence?: () => Promise<import('@/lib/strategic-blueprint/output-types').KeywordIntelligence | undefined>;
}

export interface GeneratorResult {
  success: boolean;
  blueprint?: StrategicBlueprintOutput;
  error?: string;
}

// =============================================================================
// Main Generator
// =============================================================================

/**
 * Generate a Strategic Blueprint using Vercel AI SDK
 * 
 * Pipeline:
 * - Phase 1 (parallel): Industry/Market + Competitors base research
 * - Phase 2 (parallel): ICP Validation + Offer Analysis → Reconciliation
 * - Phase 3: Cross-Analysis Synthesis
 * 
 * Note: Competitor enrichment (Firecrawl pricing, Ad Library creatives)
 * should be done externally and passed via options.enrichedCompetitors,
 * OR handled by the API route after this generator returns.
 */
export async function generateStrategicBlueprint(
  context: string,
  options: GeneratorOptions = {}
): Promise<GeneratorResult> {
  const { onProgress, abortSignal } = options;
  const startTime = Date.now();
  const sectionTimings: Record<string, number> = {};
  const sectionCitations: Record<string, { url: string; title?: string }[]> = {};
  const modelsUsed = new Set<string>();
  let totalCost = 0;

  const progress = (
    phase: 1 | 2 | 3,
    section: string,
    status: 'starting' | 'complete' | 'error',
    message: string
  ) => {
    onProgress?.({
      phase,
      section,
      status,
      message,
      elapsedMs: Date.now() - startTime,
      cost: totalCost,
    });
  };

  const checkAbort = () => {
    if (abortSignal?.aborted) {
      throw new Error('Generation aborted');
    }
  };

  try {
    // =========================================================================
    // PHASE 1: Industry + Competitors (concurrent, but decoupled)
    // Phase 2 only needs industryResult, so we don't wait for competitors.
    // Competitors resolve independently and emit competitorData for enrichment.
    // =========================================================================
    progress(1, 'phase1', 'starting', 'Starting parallel research...');

    const phase1Start = Date.now();

    // Start both concurrently — but DON'T Promise.all them
    const industryPromise = (async () => {
      checkAbort();
      progress(1, 'industryMarket', 'starting', 'Researching industry & market...');
      const start = Date.now();
      const result = await researchIndustryMarket(context);
      sectionTimings.industryMarket = Date.now() - start;
      sectionCitations.industryMarket = result.sources;
      modelsUsed.add(result.model);
      totalCost += result.cost;
      progress(1, 'industryMarket', 'complete', `Industry research complete (${result.sources.length} sources)`);
      return result;
    })();

    const competitorPromise = (async () => {
      checkAbort();
      progress(1, 'competitorAnalysis', 'starting', 'Researching competitors...');
      const start = Date.now();
      const result = await researchCompetitors(context);
      sectionTimings.competitorAnalysis = Date.now() - start;
      sectionCitations.competitorAnalysis = result.sources;
      modelsUsed.add(result.model);
      totalCost += result.cost;
      progress(1, 'competitorAnalysis', 'complete', `Competitor research complete (${result.data.competitors.length} found)`);

      // Emit competitor data immediately so route.ts can start enrichment
      onProgress?.({
        phase: 1,
        section: 'phase1',
        status: 'complete',
        message: `Competitor research complete — enrichment can begin`,
        elapsedMs: Date.now() - startTime,
        cost: totalCost,
        competitorData: result.data,
      });

      return result;
    })();

    // Only wait for industry before starting Phase 2
    const industryResult = await industryPromise;
    sectionTimings.phase1Industry = Date.now() - phase1Start;

    checkAbort();

    // =========================================================================
    // PHASE 2: Parallel ICP + Offer Analysis → Reconciliation
    // =========================================================================
    const phase2Start = Date.now();

    progress(2, 'phase2', 'starting', 'Starting parallel ICP and Offer analysis...');

    // Run ICP and Offer in parallel - both use industry context
    const [icpResult, offerResult] = await Promise.all([
      // Section 2: ICP Analysis (uses industry context)
      (async () => {
        checkAbort();
        progress(2, 'icpValidation', 'starting', 'Analyzing ICP with reasoning...');
        const start = Date.now();
        const result = await researchICPAnalysis(context, industryResult.data);
        sectionTimings.icpValidation = Date.now() - start;
        sectionCitations.icpValidation = result.sources;
        modelsUsed.add(result.model);
        totalCost += result.cost;
        progress(2, 'icpValidation', 'complete', `ICP validation: ${result.data.finalVerdict.status}`);
        return result;
      })(),

      // Section 3: Offer Analysis (uses industry context, not ICP)
      (async () => {
        checkAbort();
        progress(2, 'offerAnalysis', 'starting', 'Analyzing offer with reasoning...');
        const start = Date.now();
        const result = await researchOfferAnalysis(context, industryResult.data);
        sectionTimings.offerAnalysis = Date.now() - start;
        sectionCitations.offerAnalysis = result.sources;
        modelsUsed.add(result.model);
        totalCost += result.cost;
        progress(2, 'offerAnalysis', 'complete', `Offer score: ${result.data.offerStrength.overallScore}/10`);
        return result;
      })(),
    ]);

    checkAbort();

    // Apply reconciliation rules to ensure consistency
    progress(2, 'reconciliation', 'starting', 'Applying reconciliation rules...');
    const reconciliation = reconcileICPAndOffer(icpResult.data, offerResult.data);
    sectionTimings.reconciliation = reconciliation.reconciliationTimeMs;

    // Use reconciled offer for rest of pipeline
    const finalOfferData = reconciliation.adjustedOffer;

    if (reconciliation.conflictsDetected > 0) {
      progress(2, 'reconciliation', 'complete',
        `Reconciliation applied ${reconciliation.conflictsDetected} adjustments`);
    } else {
      progress(2, 'reconciliation', 'complete', 'No conflicts detected');
    }

    sectionTimings.phase2 = Date.now() - phase2Start;

    checkAbort();

    // =========================================================================
    // PRE-SYNTHESIS: Await competitors + parallel enrichments + keywords
    // Competitors started in Phase 1 and run concurrently — almost certainly
    // finished by now (Phase 2 takes ~8-15s), but we must await to be safe.
    // =========================================================================
    progress(3, 'crossAnalysis', 'starting', 'Syncing enrichment data for synthesis...');

    const syncStart = Date.now();
    const [competitorResult, asyncEnrichedCompetitors, asyncKeywordData] = await Promise.all([
      competitorPromise,
      options.getEnrichedCompetitors?.() ?? Promise.resolve(undefined as CompetitorAnalysis | undefined),
      options.getKeywordIntelligence?.() ?? Promise.resolve(undefined as import('@/lib/strategic-blueprint/output-types').KeywordIntelligence | undefined),
    ]);

    const enrichedParts: string[] = [];
    if (asyncEnrichedCompetitors) enrichedParts.push('competitors');
    if (asyncKeywordData) enrichedParts.push('keywords');
    const syncMs = Date.now() - syncStart;
    console.log(`[Generator] Pre-synthesis sync: competitors + ${enrichedParts.join(', ') || 'no enrichment'} (${syncMs}ms wait)`);

    sectionTimings.phase1 = Date.now() - phase1Start;

    // Emit Phase 2 complete with all sections (competitors now guaranteed available)
    onProgress?.({
      phase: 2,
      section: 'phase2',
      status: 'complete',
      message: `Phase 2 complete in ${Math.round(sectionTimings.phase2 / 1000)}s${
        reconciliation.conflictsDetected > 0 ? ` (${reconciliation.conflictsDetected} reconciliations)` : ''
      }`,
      elapsedMs: Date.now() - startTime,
      cost: totalCost,
      allSectionsData: {
        industryMarket: industryResult.data,
        icpAnalysis: icpResult.data,
        offerAnalysis: finalOfferData, // Use reconciled offer
        competitorAnalysis: competitorResult.data,
      },
      reconciliationResult: reconciliation.conflictsDetected > 0 ? reconciliation : undefined,
    });

    // =========================================================================
    // PHASE 3: Synthesis (Claude Sonnet)
    // =========================================================================
    progress(3, 'crossAnalysis', 'starting', 'Synthesizing strategic blueprint...');

    const phase3Start = Date.now();

    // Use enriched competitor data if available (async > static > base research)
    const finalCompetitorData = asyncEnrichedCompetitors ?? options.enrichedCompetitors ?? competitorResult.data;
    const finalKeywordData = asyncKeywordData ?? options.keywordIntelligenceData;

    const allSections: AllSectionResults = {
      industryMarket: industryResult.data,
      icpAnalysis: icpResult.data,
      offerAnalysis: finalOfferData, // Use reconciled offer
      competitorAnalysis: finalCompetitorData,
    };

    const synthesisResult = await synthesizeCrossAnalysis(context, allSections, finalKeywordData);
    sectionTimings.crossAnalysis = Date.now() - phase3Start;
    modelsUsed.add(synthesisResult.model);
    totalCost += synthesisResult.cost;

    progress(3, 'crossAnalysis', 'complete', 'Strategic synthesis complete');

    sectionTimings.phase3 = Date.now() - phase3Start;
    sectionTimings.total = Date.now() - startTime;

    // =========================================================================
    // Build Final Output
    // =========================================================================
    const blueprint: StrategicBlueprintOutput = {
      industryMarketOverview: industryResult.data,
      icpAnalysisValidation: icpResult.data,
      offerAnalysisViability: finalOfferData, // Use reconciled offer
      competitorAnalysis: finalCompetitorData,
      crossAnalysisSynthesis: synthesisResult.data,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.1', // Parallel Phase 2 with reconciliation
        processingTime: sectionTimings.total,
        totalCost: Math.round(totalCost * 10000) / 10000,
        modelsUsed: Array.from(modelsUsed),
        sectionTimings,
        sectionCitations,
        // Reconciliation metadata (only included if there were adjustments)
        ...(reconciliation.conflictsDetected > 0 && {
          reconciliationNotes: reconciliation.reconciliationNotes,
          reconciliationAdjustments: reconciliation.conflictsDetected,
        }),
      },
    };

    return { success: true, blueprint };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n[GENERATOR_ERROR] Blueprint generation failed:', message);
    console.error('[GENERATOR_FULL_ERROR]', error);
    progress(1, 'error', 'error', message);
    return { success: false, error: message };
  }
}

// =============================================================================
// Export for API route
// =============================================================================

export { 
  researchIndustryMarket,
  researchICPAnalysis,
  researchOfferAnalysis,
  researchCompetitors,
  synthesizeCrossAnalysis,
} from './research';
