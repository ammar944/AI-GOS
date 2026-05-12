/**
 * Shared types + helpers for the Phase 3a AI SDK tool wrappers. The wrappers
 * live worker-side (research-worker can import from its own tools/, the
 * frontend cannot per tsconfig.json:43). Each wrapper exposes the AI SDK v6
 * tool() shape and is consumed by the subagents that land in Phase 3b.
 *
 * Output schema convention: every tool can return either real data OR a
 * "gap" payload that the section runner surfaces as a credential-unavailable
 * claim. This avoids throwing inside the subagent loop and lets the artifact
 * render "data unavailable — wire X_API_KEY" gracefully.
 *
 * Design doc: lines 461-494 (Phase 3a) and Premise 7 (tool wiring per
 * subagent).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Gap envelope — surfaced when a tool can't run due to env / availability.
// ---------------------------------------------------------------------------

export const ToolGapSchema = z.object({
  type: z.literal('gap'),
  reason: z.enum([
    'missing_credential',
    'api_error',
    'rate_limited',
    'not_implemented',
    'aborted',
  ]),
  envVar: z.string().optional(),
  message: z.string(),
});
export type ToolGap = z.infer<typeof ToolGapSchema>;

export function credentialGap(envVar: string): ToolGap {
  return {
    type: 'gap',
    reason: 'missing_credential',
    envVar,
    message: `${envVar} not configured — set the env var to enable this tool.`,
  };
}

export function apiErrorGap(message: string): ToolGap {
  return { type: 'gap', reason: 'api_error', message };
}

export function abortedGap(): ToolGap {
  return { type: 'gap', reason: 'aborted', message: 'Tool call aborted.' };
}

// ---------------------------------------------------------------------------
// Fetch wrapper — propagates abortSignal + per-call timeout.
// ---------------------------------------------------------------------------

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

/**
 * Combines abort signals via AbortSignal.any when available (Node 20+) or
 * a small polyfill otherwise. The worker's package.json declares
 * engines.node >= 18.17 where AbortSignal.timeout is stable; on Railway's
 * Node 22 production runtime AbortSignal.any is also native.
 */
function composeAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0]!;
  if (typeof (AbortSignal as unknown as { any?: typeof AbortSignal.any }).any === 'function') {
    return AbortSignal.any(signals);
  }
  // Polyfill for older runtimes.
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

export async function timedFetch(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 15_000, abortSignal, ...init } = options;
  const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
  if (abortSignal) signals.push(abortSignal);
  return fetch(url, {
    ...init,
    signal: composeAbortSignals(signals),
  });
}

/**
 * Detects an AbortError (external abort or timeout) so wrappers can surface
 * a typed `aborted` gap rather than a generic api_error.
 */
export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; code?: unknown };
  return e.name === 'AbortError' || e.name === 'TimeoutError' || e.code === 'ABORT_ERR';
}

export function errorToGap(err: unknown, prefix: string): ToolGap {
  if (isAbortError(err)) {
    return { type: 'gap', reason: 'aborted', message: `${prefix}: aborted` };
  }
  const message = err instanceof Error ? err.message : String(err);
  return apiErrorGap(`${prefix}: ${message}`);
}

// ---------------------------------------------------------------------------
// Source shape — wrappers normalize their citations into this so the
// projector / subagent has a consistent contract.
// ---------------------------------------------------------------------------

export const ToolSourceSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});
export type ToolSource = z.infer<typeof ToolSourceSchema>;
