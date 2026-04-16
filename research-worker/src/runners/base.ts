/**
 * Unified runner contract — Phase 6.0.4.
 *
 * Every runner in research-worker/src/runners/ exports a function matching
 * RunnerFn. Legacy signatures that accept a string context (instead of RunnerCtx)
 * still work via runtime adaptation — this module defines the TARGET shape the
 * migration converges to.
 */
import type { RunnerProgressReporter } from '../runner';
import type { ResearchResult } from '../supabase';

export interface RunnerCtx {
  /** Compiled research context string built by the dispatch route. */
  context: string;
  /** Current run ID from journey_sessions.run_id, if available. */
  activeRunId?: string;
  /** Clerk/Supabase user id. */
  userId?: string;
}

export interface RunnerDeps {
  now?: () => number;
  parseJson?: (text: string) => unknown;
}

export type RunnerFn = (
  ctx: RunnerCtx,
  onProgress?: RunnerProgressReporter,
  deps?: RunnerDeps,
) => Promise<ResearchResult>;

/** Helper: adapt legacy (context: string, onProgress) signature to RunnerCtx. */
export function toRunnerCtx(
  context: string,
  opts?: { activeRunId?: string; userId?: string },
): RunnerCtx {
  return { context, ...opts };
}
