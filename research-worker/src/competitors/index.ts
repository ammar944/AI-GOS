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

export { parseCompetitorContext } from './parse-context';
export type { ParsedCompetitorContext, CompetitorEntry } from './parse-context';

const PIPELINE_TIMEOUT_MS = 90_000; // Hard cap: 90s (fetch ~16s + synthesis ~60s + buffer)

interface PipelineResult {
  resultText: string;
  stopReason: string | null;
  fetchDurationMs: number;
  synthesisDurationMs: number;
  synthInput: SynthesisInput;
}

/**
 * Phase 1: Run all data collection in parallel.
 * Sonar Pro + Firecrawl + SpyFu + Ad Library — all at once.
 * Wall time = max(individual call time) ≈ 12-15s
 */
async function runParallelCollection(
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

  // Fire ALL data collection in parallel
  await emitRunnerProgress(onProgress, 'tool',
    `researching ${Math.min(parsed.competitors.length, 5)} competitors in parallel`,
  );

  const [fetchResults, sonarResults] = await Promise.all([
    fetchAllCompetitorData(parsed.competitors),
    fetchSonarCompetitorResearch({
      competitors: parsed.competitors,
      companyName: parsed.companyName,
      productDescription: parsed.productDescription,
      icpDescription: parsed.icpDescription,
    }),
  ]);

  // Report what we got
  const pricingHits = fetchResults.pricing.filter(p => p.success).length;
  const spyfuHits = fetchResults.spyfu.filter(s => !s.error).length;
  const adHits = fetchResults.adLibrary.filter(a => !a.error).length;
  const sonarHits = sonarResults.competitorInsights.length;

  await emitRunnerProgress(onProgress, 'tool',
    `gathered data for ${parsed.competitors.length} competitors — ${pricingHits} pricing pages, ${adHits} ad profiles, ${sonarHits} market insights`,
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
 * Full pipeline: parallel collection → synthesis → post-process.
 */
async function runPipeline(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<PipelineResult> {
  // Phase 1: Parallel data collection
  const collectionStart = Date.now();
  const { parsed, fetchResults, sonarResults } = await runParallelCollection(context, onProgress);
  const fetchDurationMs = Date.now() - collectionStart;

  // Phase 2: Synthesis
  const synthesisStart = Date.now();
  const synthInput: SynthesisInput = { parsed, fetchResults, sonarResults };
  const { resultText, stopReason } = await runSynthesis(synthInput, onProgress);
  const synthesisDurationMs = Date.now() - synthesisStart;

  return { resultText, stopReason, fetchDurationMs, synthesisDurationMs, synthInput };
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

    // Post-process: inject library links, validate pricing confidence
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      postProcessSynthesis(
        parsed as Record<string, unknown>,
        pipelineResult.synthInput,
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
