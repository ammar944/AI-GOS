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
  IndustryMarketOverview,
  ICPAnalysisValidation,
  OfferAnalysisViability,
  CompetitorAnalysis,
  CrossAnalysisSynthesis,
} from './schemas';

// =============================================================================
// Types
// =============================================================================

export interface StrategicBlueprintOutput {
  industryMarketOverview: IndustryMarketOverview;
  icpAnalysisValidation: ICPAnalysisValidation;
  offerAnalysisViability: OfferAnalysisViability;
  competitorAnalysis: CompetitorAnalysis;
  crossAnalysisSynthesis: CrossAnalysisSynthesis;
  metadata: {
    generatedAt: string;
    version: string;
    processingTime: number;
    totalCost: number;
    modelsUsed: string[];
    sectionTimings: Record<string, number>;
    sectionCitations: Record<string, { url: string; title?: string }[]>;
  };
}

export interface GeneratorOptions {
  onProgress?: ProgressCallback;
  abortSignal?: AbortSignal;
  /** Optional: Pre-enriched competitor data (pricing + ads already added) */
  enrichedCompetitors?: CompetitorAnalysis;
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
 * - Phase 2 (sequential): ICP Validation → Offer Analysis
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
    // PHASE 1: Parallel Research (Industry + Competitors base)
    // =========================================================================
    progress(1, 'phase1', 'starting', 'Starting parallel research...');

    const phase1Start = Date.now();
    
    const [industryResult, competitorResult] = await Promise.all([
      // Section 1: Industry & Market
      (async () => {
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
      })(),

      // Section 4: Competitors (base research, without enrichment)
      (async () => {
        checkAbort();
        progress(1, 'competitorAnalysis', 'starting', 'Researching competitors...');
        const start = Date.now();
        const result = await researchCompetitors(context);
        sectionTimings.competitorAnalysis = Date.now() - start;
        sectionCitations.competitorAnalysis = result.sources;
        modelsUsed.add(result.model);
        totalCost += result.cost;
        progress(1, 'competitorAnalysis', 'complete', `Competitor research complete (${result.data.competitors.length} found)`);
        return result;
      })(),
    ]);

    sectionTimings.phase1 = Date.now() - phase1Start;
    // Emit Phase 1 complete WITH competitor data for early enrichment
    onProgress?.({
      phase: 1,
      section: 'phase1',
      status: 'complete',
      message: `Phase 1 complete in ${Math.round(sectionTimings.phase1 / 1000)}s`,
      elapsedMs: Date.now() - startTime,
      cost: totalCost,
      competitorData: competitorResult.data, // Enable early enrichment!
    });

    checkAbort();

    // =========================================================================
    // PHASE 2: Sequential Analysis (ICP → Offer)
    // =========================================================================
    progress(2, 'phase2', 'starting', 'Starting analysis phase...');

    const phase2Start = Date.now();

    // Section 2: ICP Analysis (needs Section 1 context)
    progress(2, 'icpValidation', 'starting', 'Analyzing ICP with reasoning...');
    const icpStart = Date.now();
    const icpResult = await researchICPAnalysis(context, industryResult.data);
    sectionTimings.icpValidation = Date.now() - icpStart;
    sectionCitations.icpValidation = icpResult.sources;
    modelsUsed.add(icpResult.model);
    totalCost += icpResult.cost;
    progress(2, 'icpValidation', 'complete', `ICP validation: ${icpResult.data.finalVerdict.status}`);

    checkAbort();

    // Section 3: Offer Analysis (needs Section 2 context)
    progress(2, 'offerAnalysis', 'starting', 'Analyzing offer with reasoning...');
    const offerStart = Date.now();
    const offerResult = await researchOfferAnalysis(context, icpResult.data);
    sectionTimings.offerAnalysis = Date.now() - offerStart;
    sectionCitations.offerAnalysis = offerResult.sources;
    modelsUsed.add(offerResult.model);
    totalCost += offerResult.cost;
    progress(2, 'offerAnalysis', 'complete', `Offer score: ${offerResult.data.offerStrength.overallScore}/10`);

    sectionTimings.phase2 = Date.now() - phase2Start;
    progress(2, 'phase2', 'complete', `Phase 2 complete in ${Math.round(sectionTimings.phase2 / 1000)}s`);

    checkAbort();

    // =========================================================================
    // PHASE 3: Synthesis (Claude Sonnet)
    // =========================================================================
    progress(3, 'crossAnalysis', 'starting', 'Synthesizing strategic blueprint...');

    const phase3Start = Date.now();

    // Use enriched competitor data if provided, otherwise use base research
    const finalCompetitorData = options.enrichedCompetitors ?? competitorResult.data;

    const allSections: AllSectionResults = {
      industryMarket: industryResult.data,
      icpAnalysis: icpResult.data,
      offerAnalysis: offerResult.data,
      competitorAnalysis: finalCompetitorData,
    };

    const synthesisResult = await synthesizeCrossAnalysis(context, allSections);
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
      offerAnalysisViability: offerResult.data,
      competitorAnalysis: finalCompetitorData,
      crossAnalysisSynthesis: synthesisResult.data,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0', // Vercel AI SDK migration
        processingTime: sectionTimings.total,
        totalCost: Math.round(totalCost * 10000) / 10000,
        modelsUsed: Array.from(modelsUsed),
        sectionTimings,
        sectionCitations,
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
