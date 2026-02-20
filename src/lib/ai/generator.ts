// Strategic Blueprint Generator
// Orchestrates all 5 sections with parallel execution
// Uses Vercel AI SDK for research, keeps existing Firecrawl/AdLibrary for enrichment

import {
  researchIndustryMarket,
  researchICPAnalysis,
  researchOfferAnalysis,
  researchCompetitors,
  researchSummaryCompetitors,
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
  /** Async provider for SEO audit data — called between Phase 2 and Phase 3 */
  getSEOAudit?: () => Promise<import('@/lib/strategic-blueprint/output-types').SEOAuditData | undefined>;
  /** Full-tier competitor names (deep research + enrichment) */
  fullTierNames?: string[];
  /** Summary-tier competitor names (lightweight research only) */
  summaryTierNames?: string[];
  /** Max ms to wait for enrichment before starting synthesis (default: 5000). Set to Infinity for old blocking behavior. */
  enrichmentDeadlineMs?: number;
}

export interface GeneratorResult {
  success: boolean;
  blueprint?: StrategicBlueprintOutput;
  error?: string;
  /** Enrichment promises that timed out during the grace window — caller can re-await and merge late data */
  lateEnrichment?: {
    enrichedCompetitors?: Promise<CompetitorAnalysis | undefined>;
    keywordIntelligence?: Promise<import('@/lib/strategic-blueprint/output-types').KeywordIntelligence | undefined>;
    seoAudit?: Promise<import('@/lib/strategic-blueprint/output-types').SEOAuditData | undefined>;
  };
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

    // Summary competitor research runs in parallel with full competitor research
    const summaryCompetitorPromise = options.summaryTierNames?.length
      ? (async () => {
          const start = Date.now();
          try {
            const result = await researchSummaryCompetitors(context, options.summaryTierNames!);
            sectionTimings.summaryCompetitors = Date.now() - start;
            modelsUsed.add(result.model);
            totalCost += result.cost;
            console.log(`[Generator] Summary competitor research complete: ${result.data.competitors.length} competitors in ${Date.now() - start}ms`);
            return result;
          } catch (error) {
            console.error('[Generator] Summary competitor research failed (non-fatal):', error);
            return null;
          }
        })()
      : Promise.resolve(null);

    const competitorPromise = (async () => {
      checkAbort();
      progress(1, 'competitorAnalysis', 'starting', 'Researching competitors...');
      const start = Date.now();
      const result = await researchCompetitors(context, options.fullTierNames);
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
    // PRE-SYNTHESIS: Await competitors + race enrichments against deadline
    // Competitors started in Phase 1 and run concurrently — almost certainly
    // finished by now (Phase 2 takes ~8-15s), but we must await to be safe.
    // Enrichment callbacks are raced against a configurable grace deadline so
    // synthesis can start without waiting for slow enrichment (keyword intel).
    // =========================================================================
    progress(3, 'crossAnalysis', 'starting', 'Syncing enrichment data for synthesis...');

    const syncStart = Date.now();
    const deadline = options.enrichmentDeadlineMs ?? 5000;

    // Always await core research (competitors are required for synthesis)
    const [competitorResult, summaryResult] = await Promise.all([
      competitorPromise,
      summaryCompetitorPromise,
    ]);

    // Race each enrichment callback against the grace deadline
    const DEADLINE_SENTINEL = Symbol('deadline');
    const raceDeadline = <T,>(promise: Promise<T>): Promise<T | typeof DEADLINE_SENTINEL> =>
      Promise.race([
        promise,
        new Promise<typeof DEADLINE_SENTINEL>((resolve) =>
          setTimeout(() => resolve(DEADLINE_SENTINEL), deadline),
        ),
      ]);

    const enrichedCompPromise = options.getEnrichedCompetitors?.() ?? Promise.resolve(undefined as CompetitorAnalysis | undefined);
    const kwPromise = options.getKeywordIntelligence?.() ?? Promise.resolve(undefined as import('@/lib/strategic-blueprint/output-types').KeywordIntelligence | undefined);
    const seoPromise = options.getSEOAudit?.() ?? Promise.resolve(undefined as import('@/lib/strategic-blueprint/output-types').SEOAuditData | undefined);

    const [enrichedCompRace, kwRace, seoRace] = await Promise.all([
      raceDeadline(enrichedCompPromise),
      raceDeadline(kwPromise),
      raceDeadline(seoPromise),
    ]);

    const asyncEnrichedCompetitors = enrichedCompRace === DEADLINE_SENTINEL ? undefined : enrichedCompRace;
    const asyncKeywordData = kwRace === DEADLINE_SENTINEL ? undefined : kwRace;
    const asyncSEOAuditData = seoRace === DEADLINE_SENTINEL ? undefined : seoRace;

    // Track which enrichments timed out so the caller can re-await them
    const lateEnrichment: GeneratorResult['lateEnrichment'] = {};
    if (enrichedCompRace === DEADLINE_SENTINEL) lateEnrichment.enrichedCompetitors = enrichedCompPromise;
    if (kwRace === DEADLINE_SENTINEL) lateEnrichment.keywordIntelligence = kwPromise;
    if (seoRace === DEADLINE_SENTINEL) lateEnrichment.seoAudit = seoPromise;

    // Merge summary-tier competitors into the competitor result
    if (summaryResult && summaryResult.data.competitors.length > 0) {
      const summaryCompetitors = summaryResult.data.competitors.map(c => ({
        ...c,
        analysisDepth: 'summary' as const,
        funnels: '',
        adPlatforms: [] as string[],
      }));
      competitorResult.data.competitors = [
        ...competitorResult.data.competitors,
        ...summaryCompetitors,
      ];
      console.log(`[Generator] Merged ${summaryCompetitors.length} summary competitors (total: ${competitorResult.data.competitors.length})`);
    }

    const enrichedParts: string[] = [];
    if (asyncEnrichedCompetitors) enrichedParts.push('competitors');
    if (asyncKeywordData) enrichedParts.push('keywords');
    if (asyncSEOAuditData) enrichedParts.push('seo-audit');
    const timedOutParts = Object.keys(lateEnrichment);
    const syncMs = Date.now() - syncStart;
    console.log(`[Generator] Pre-synthesis sync: competitors + ${enrichedParts.join(', ') || 'no enrichment'} (${syncMs}ms wait)${timedOutParts.length > 0 ? ` — timed out: ${timedOutParts.join(', ')}` : ''}`);

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

    const synthesisResult = await synthesizeCrossAnalysis(context, allSections, finalKeywordData, asyncSEOAuditData);
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

    const hasLateEnrichment = Object.keys(lateEnrichment).length > 0;
    return { success: true, blueprint, ...(hasLateEnrichment && { lateEnrichment }) };
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
  researchSummaryCompetitors,
  synthesizeCrossAnalysis,
} from './research';
