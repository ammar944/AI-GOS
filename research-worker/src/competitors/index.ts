// research-worker/src/competitors/index.ts
// Optimized competitor research runner — parallel pipeline, ~30-40s total.
//
// Architecture:
//   Phase 1 (parallel, ~12-15s): Sonar Pro + Firecrawl + SpyFu + Ad Library
//   Phase 2 (single call, ~15-20s): Sonnet synthesis with all evidence
//
// Replaces the 930-line agentic toolRunner loop that took 100-120s.

import { extractJson } from '../runner';
import type { RunnerTelemetry } from '../telemetry';
import { finalizeRunnerResult } from '../contracts';
import type { ResearchResult } from '../supabase';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';
import { parseCompetitorContext } from './parse-context';
import { fetchSonarCompetitorResearch, type SonarCompetitorResult } from './sonar-research';
import { fetchAllCompetitorData, type ParallelFetchResults } from './parallel-fetch';
import { synthesizeCompetitorIntel, postProcessSynthesis, type SynthesisInput } from './synthesize';
import { analyzeReviewGaps } from './review-gap-intelligence';
import { analyzeReviewCrossPatterns } from './review-cross-analysis';

export { parseCompetitorContext } from './parse-context';
export type { ParsedCompetitorContext, CompetitorEntry } from './parse-context';

const PIPELINE_TIMEOUT_MS = 120_000; // Hard cap: 120s (fetch ~45s + synthesis ~60s + buffer for review scraping)

interface PipelineResult {
  resultText: string;
  stopReason: string | null;
  fetchDurationMs: number;
  synthesisDurationMs: number;
  synthInput: SynthesisInput;
  gapIntelligence: Record<string, import('./review-gap-intelligence').CompetitorGapIntelligence> | null;
  crossAnalysis: import('./review-cross-analysis').ReviewCrossAnalysis | null;
}

/**
 * Phase 1: Validate competitors, then fetch data for verified ones.
 *
 * Pipeline (sequential, correct):
 *   parseCompetitorContext()
 *     → fetchSonarCompetitorResearch() [validates + corrects domains]
 *     → fetchAllCompetitorData(verifiedEntries) [uses VERIFIED names + REAL domains]
 *
 * Sonar validation runs first so ad fetching uses verified domains, preventing
 * false-positive ads for short/ambiguous competitor names (e.g. "Atlas VPN" for "Atlas").
 */
async function runValidateThenFetch(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<{
  parsed: ReturnType<typeof parseCompetitorContext>;
  fetchResults: ParallelFetchResults;
  sonarResults: SonarCompetitorResult;
}> {
  const parsed = parseCompetitorContext(context);

  await emitRunnerProgress(onProgress, 'runner',
    `found ${parsed.competitors.length} competitors: ${parsed.competitors.map(c => c.name).join(', ')}`,
  );

  if (parsed.competitors.length === 0) {
    await emitRunnerProgress(onProgress, 'runner',
      'no competitors found in context — synthesis will work from raw context only',
    );
  }

  // Phase 1A: Validate competitors via Sonar (corrects domains via HEAD verification)
  await emitRunnerProgress(onProgress, 'tool',
    `validating ${parsed.competitors.length} competitors via web search`,
  );

  const sonarResults = await fetchSonarCompetitorResearch({
    competitors: parsed.competitors,
    companyName: parsed.companyName,
    productDescription: parsed.productDescription,
    icpDescription: parsed.icpDescription,
    identityCard: parsed.identityCard,
  });

  // Use verified entries with corrected domains for all downstream fetches
  const verifiedEntries = sonarResults.verifiedEntries ?? parsed.competitors;
  const removedCount = sonarResults.removedCompetitors?.length ?? 0;

  if (removedCount > 0) {
    await emitRunnerProgress(onProgress, 'tool',
      `${removedCount} competitor(s) removed by validation, ${verifiedEntries.length} verified`,
    );
  }

  // Phase 1B: Fetch data for verified competitors only (with verified domains)
  await emitRunnerProgress(onProgress, 'tool',
    `researching ${Math.min(verifiedEntries.length, 5)} verified competitors in parallel`,
  );

  // Extract client domain from websiteUrl for ad fetching
  const clientDomain = parsed.websiteUrl
    ? parsed.websiteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    : null;

  // Pass identity card's coreKeywords as category context for ad batch sanity check.
  // This prevents wrong-company ads (e.g., Fathom terrain data for Fathom AI meetings)
  // by rejecting entire ad batches where zero ads mention any category keyword.
  const categoryKeywords = parsed.identityCard?.coreKeywords ?? [];

  const fetchResults = await fetchAllCompetitorData(verifiedEntries, {
    name: parsed.companyName ?? '',
    domain: clientDomain,
  }, categoryKeywords);

  // Report what we got
  const pricingHits = fetchResults.pricing.filter(p => p.success).length;
  const spyfuHits = fetchResults.spyfu.filter(s => !s.error).length;
  const adHits = fetchResults.adLibrary.filter(a => !a.error).length;
  const reviewHits = fetchResults.reviews.filter(r => r.trustpilot || r.g2).length;
  const sonarHits = sonarResults.competitorInsights.length;

  await emitRunnerProgress(onProgress, 'tool',
    `gathered data for ${verifiedEntries.length} competitors — ${pricingHits} pricing, ${adHits} ads, ${reviewHits} reviews, ${sonarHits} insights`,
  );

  return { parsed, fetchResults, sonarResults };
}

/**
 * Phase 2: Single Sonnet synthesis call with all pre-fetched evidence.
 */
async function runSynthesis(
  input: SynthesisInput,
  onProgress?: RunnerProgressReporter,
): Promise<{ resultText: string; stopReason: string | null }> {
  await emitRunnerProgress(onProgress, 'analysis', 'building competitor landscape');

  const result = await synthesizeCompetitorIntel(input);

  await emitRunnerProgress(onProgress, 'analysis',
    'competitor analysis complete',
  );

  return result;
}

/**
 * Full pipeline: validate → fetch → synthesis → post-process.
 */
async function runPipeline(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<PipelineResult> {
  // Phase 1: Validate competitors, then fetch data for verified ones
  const collectionStart = Date.now();
  const { parsed, fetchResults, sonarResults } = await runValidateThenFetch(context, onProgress);
  const fetchDurationMs = Date.now() - collectionStart;

  // Phase 2: Synthesis + gap intelligence in parallel
  const synthesisStart = Date.now();
  const synthInput: SynthesisInput = { parsed, fetchResults, sonarResults };
  const [synthesisResult, gapIntelligence, crossAnalysis] = await Promise.all([
    runSynthesis(synthInput, onProgress),
    analyzeReviewGaps(fetchResults.reviews, parsed.companyName ?? '').catch(() => null),
    analyzeReviewCrossPatterns(fetchResults.reviews).catch(() => null),
  ]);
  const { resultText, stopReason } = synthesisResult;
  const synthesisDurationMs = Date.now() - synthesisStart;

  return { resultText, stopReason, fetchDurationMs, synthesisDurationMs, synthInput, gapIntelligence, crossAnalysis };
}

/**
 * Main entry point — replaces the old runResearchCompetitors.
 * Target: <60s total (typically 30-40s).
 */
export async function runResearchCompetitors(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();

  try {
    await emitRunnerProgress(onProgress, 'runner', 'starting competitor analysis');

    // Run with hard timeout
    const pipelineResult = await Promise.race([
      runPipeline(context, onProgress),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Competitor pipeline timed out after ${PIPELINE_TIMEOUT_MS / 1000}s`)),
          PIPELINE_TIMEOUT_MS,
        ),
      ),
    ]);

    await emitRunnerProgress(onProgress, 'runner',
      `competitor analysis complete in ${Math.round((Date.now() - startTime) / 1000)}s`,
    );

    // Parse the synthesis output
    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = extractJson(pipelineResult.resultText);
    } catch (error) {
      console.error('[competitors] JSON extraction failed:', pipelineResult.resultText.slice(0, 300));
      parseError = error;
    }

    // Post-process: inject library links, validate pricing confidence, inject gap intelligence
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      postProcessSynthesis(
        parsed as Record<string, unknown>,
        pipelineResult.synthInput,
        pipelineResult.gapIntelligence,
        pipelineResult.crossAnalysis,
      );
    }

    const telemetry: RunnerTelemetry = {
      model: 'claude-haiku-4-5-20251001',
      stopReason: pipelineResult.stopReason,
    };

    return finalizeRunnerResult({
      section: 'competitorIntel',
      durationMs: Date.now() - startTime,
      parsed,
      rawText: pipelineResult.resultText,
      parseError,
      telemetry,
    });
  } catch (error) {
    await emitRunnerProgress(onProgress, 'error',
      `competitor pipeline failed: ${error instanceof Error ? error.message : String(error)}`,
    );

    return {
      status: 'error',
      section: 'competitorIntel',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
