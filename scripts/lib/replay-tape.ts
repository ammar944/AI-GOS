/**
 * replay-tape.ts — the --record / --replay MECHANISM for offline section runs.
 *
 * A "seam" is any async function on a deps object that a LIVE run would route
 * through a provider or the network (e.g. callStructured, fetchImpl,
 * runAnswerTool). This module lets you:
 *
 *   1. RECORD: wrap real deps with makeRecordingDeps(realDeps, tape). Each seam
 *      call runs the real seam ONCE, captures (argsKey -> response) into `tape`,
 *      and returns the real response unchanged. Run this around ONE live section
 *      capture to fill a tape.
 *
 *   2. REPLAY: replayDepsFromTape(tape) returns deps built from the tape ALONE.
 *      Each seam looks up its recorded response by argsKey and returns it. A key
 *      that was never recorded THROWS an "un-taped seam" error — so a replay can
 *      never silently fall through to the network.
 *
 * The argsKey is a stable, order-insensitive JSON serialization of the call
 * arguments, so identical inputs replay to identical outputs.
 */

interface TapeEntry {
  argsKey: string;
  response: unknown;
}

export interface ReplayTape {
  /** Per-seam ordered list of recorded { argsKey, response } entries. */
  seams: Record<string, TapeEntry[]>;
  /**
   * Every seam name that was wrapped during recording — including seams that
   * were never actually called. Lets replay reconstruct ALL seams (so calling
   * an un-recorded-but-known seam throws rather than being undefined).
   */
  seamNames?: string[];
}

/** Stable JSON: object keys sorted recursively so equal inputs key identically. */
function stableKey(args: unknown[]): string {
  const sortKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        out[k] = sortKeys((value as Record<string, unknown>)[k]);
      }
      return out;
    }
    return value;
  };
  return JSON.stringify(sortKeys(args));
}

type AnyAsyncFn = (...args: unknown[]) => Promise<unknown>;

/**
 * Wrap every function-valued seam on `realDeps` so each call records
 * (argsKey -> response) into `tape` and returns the real response unchanged.
 * Non-function deps are passed through untouched.
 */
export function makeRecordingDeps<T extends Record<string, unknown>>(
  realDeps: T,
  tape: ReplayTape,
): T {
  const wrapped: Record<string, unknown> = {};
  const seamNames: string[] = [];

  for (const [name, value] of Object.entries(realDeps)) {
    if (typeof value !== "function") {
      wrapped[name] = value;
      continue;
    }
    seamNames.push(name);
    const realFn = value as AnyAsyncFn;
    wrapped[name] = async (...args: unknown[]) => {
      const response = await realFn(...args);
      if (!tape.seams[name]) tape.seams[name] = [];
      tape.seams[name].push({ argsKey: stableKey(args), response });
      return response;
    };
  }

  tape.seamNames = [...new Set([...(tape.seamNames ?? []), ...seamNames])];
  return wrapped as T;
}

/**
 * Build deps from a recorded tape ALONE. Each seam returns the recorded
 * response matching the call's argsKey; an un-taped key throws "un-taped seam".
 */
export function replayDepsFromTape(tape: ReplayTape): Record<string, AnyAsyncFn> {
  const deps: Record<string, AnyAsyncFn> = {};
  // Reconstruct every seam that was recorded AND every seam that was wrapped
  // (seamNames) — so calling a known-but-unrecorded seam throws, not undefined.
  const names = new Set<string>([
    ...Object.keys(tape.seams),
    ...(tape.seamNames ?? []),
  ]);

  for (const name of names) {
    deps[name] = async (...args: unknown[]) => {
      const key = stableKey(args);
      const entries = tape.seams[name] ?? [];
      const hit = entries.find((e) => e.argsKey === key);
      if (!hit) {
        throw new Error(
          `[replay-tape] un-taped seam '${name}' called with un-recorded args ` +
            `${key} — refusing to fall through to the network. Re-record this run.`,
        );
      }
      return hit.response;
    };
  }

  return deps;
}
