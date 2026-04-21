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
import { analyzeReviewCrossPatterns } from './review-cross-analysis';

export { parseCompetitorContext } from './parse-context';
export type { ParsedCompetitorContext, CompetitorEntry } from './parse-context';

const PIPELINE_TIMEOUT_MS = 120_000; // Hard cap: 120s (fetch ~45s + synthesis ~60s + buffer for review scraping)

interface CompetitorSourceTag {
  name: string;
  source: 'user-provided' | 'ai-discovered';
  domain?: string;
}

interface PipelineResult {
  resultText: string;
  stopReason: string | null;
  telemetry: RunnerTelemetry;
  fetchDurationMs: number;
  synthesisDurationMs: number;
  synthInput: SynthesisInput;
  crossAnalysis: import('./review-cross-analysis').ReviewCrossAnalysis | null;
  competitorSources: CompetitorSourceTag[];
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

  // Pass identity card's coreKeywords as category context for (a) ad batch
  // sanity check (prevents wrong-company ads like Fathom terrain data for
  // Fathom AI meetings) and (b) the category keyword ad sweep (6th tab).
  //
  // Fallback chain handles sessions where the identity runner didn't emit
  // coreKeywords OR the dispatch context lost them in transit. Without this,
  // the 6th "Category Ads" tab silently stays empty.
  let categoryKeywords: string[] = Array.isArray(parsed.identityCard?.coreKeywords)
    ? parsed.identityCard!.coreKeywords.filter(
        (k): k is string => typeof k === 'string' && k.trim().length > 0,
      )
    : [];
  if (categoryKeywords.length === 0) {
    const fallback: string[] = [];
    const category = parsed.identityCard?.category?.trim();
    if (category) fallback.push(category);
    if (parsed.productDescription) {
      const firstSentence = parsed.productDescription.split(/[.!?]\s/)[0]?.trim();
      if (firstSentence && firstSentence.length >= 4 && firstSentence.length <= 80) {
        fallback.push(firstSentence);
      }
    }
    categoryKeywords = fallback;
    console.log(
      `[competitors] coreKeywords empty — using fallback (${fallback.length}): ${JSON.stringify(fallback)} (identityCard=${parsed.identityCard ? 'present' : 'null'})`,
    );
  }

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
): Promise<{ resultText: string; stopReason: string | null; telemetry: RunnerTelemetry }> {
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

  // Build competitor source tags: mark user-provided vs AI-discovered.
  // parsed.competitors = original user-provided list.
  // sonarResults.verifiedEntries = user-provided + any AI-discovered additions.
  const userProvidedNames = new Set(parsed.competitors.map(c => c.name.toLowerCase()));
  const allVerified = sonarResults.verifiedEntries ?? parsed.competitors;
  const competitorSources: CompetitorSourceTag[] = allVerified.map(entry => ({
    name: entry.name,
    source: userProvidedNames.has(entry.name.toLowerCase()) ? 'user-provided' : 'ai-discovered',
    ...(entry.domain ? { domain: entry.domain } : {}),
  }));

  // Phase 2: Synthesis + cross-review pattern analysis in parallel.
  // Per-competitor gap intelligence was removed in Phase 6.3 — the new
  // whiteSpaceGapIntel card (cross-competitor, evidence-cited) subsumes it.
  const synthesisStart = Date.now();
  const synthInput: SynthesisInput = { parsed, fetchResults, sonarResults };
  const [synthesisResult, crossAnalysis] = await Promise.all([
    runSynthesis(synthInput, onProgress),
    analyzeReviewCrossPatterns(fetchResults.reviews).catch(() => null),
  ]);
  const { resultText, stopReason, telemetry } = synthesisResult;
  const synthesisDurationMs = Date.now() - synthesisStart;

  return { resultText, stopReason, telemetry, fetchDurationMs, synthesisDurationMs, synthInput, crossAnalysis, competitorSources };
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

    // Post-process: inject library links, validate pricing confidence, inject gap intelligence, tag sources
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      postProcessSynthesis(
        parsed as Record<string, unknown>,
        pipelineResult.synthInput,
        pipelineResult.crossAnalysis,
        pipelineResult.competitorSources,
      );
    }

    return finalizeRunnerResult({
      section: 'competitorIntel',
      durationMs: Date.now() - startTime,
      parsed,
      rawText: pipelineResult.resultText,
      parseError,
      telemetry: pipelineResult.telemetry,
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
