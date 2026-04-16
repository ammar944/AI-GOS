/**
 * Unified runner contract types — shared across all research runners.
 *
 * These types formalize the implicit contract that industry.ts and offer.ts
 * already follow. icp.ts, keywords.ts, synthesize.ts, and media-plan.ts are
 * updated to import from here so every runner has the same function signature.
 */

import type { BaselineMetrics } from '../baseline-metrics';
import type { ResearchResult } from '../supabase';
import type { RunnerProgressReporter } from '../runner';
import type {
  CascadeAttemptConfig,
  CascadeAttemptResult,
} from '../runner-cascade';

/** Context passed to every runner function. */
export interface RunnerCtx {
  /** Full research context string (business fields + prior section results). */
  context: string;
  /** Supabase run_id for the active research session. */
  activeRunId?: string;
  /** Clerk user ID. */
  userId?: string;
  /** Baseline metrics injected into the context string by the dispatch layer. */
  baselineMetrics?: BaselineMetrics;
}

/** Injectable dependencies for testing and custom execution paths. */
export interface RunnerDeps {
  /** Override for Date.now() — useful in unit tests. */
  now?: () => number;
  /** Override for JSON extraction — useful in unit tests. */
  parseJson?: (text: string) => unknown;
  /**
   * Override for tool-using attempts (primary passes).
   * Signature matches CascadeDeps.runToolAttempt.
   */
  runToolAttempt?: (
    config: CascadeAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<CascadeAttemptResult>;
  /**
   * Override for no-tool attempts (repair/rescue passes).
   * Signature matches CascadeDeps.runMessageAttempt.
   */
  runMessageAttempt?: (
    config: CascadeAttemptConfig,
    onProgress?: RunnerProgressReporter,
  ) => Promise<CascadeAttemptResult>;
}

/**
 * Standard runner function signature.
 * Every runner exports a function matching this type (or a superset of it).
 */
export type RunnerFn = (
  ctx: RunnerCtx,
  onProgress?: RunnerProgressReporter,
  deps?: RunnerDeps,
) => Promise<ResearchResult>;
