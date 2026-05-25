import { z } from "zod";

export const ToolGapSchema = z
  .object({
    type: z.literal("gap"),
    reason: z.enum([
      "missing_credential",
      "api_error",
      "rate_limited",
      "not_implemented",
      "aborted",
    ]),
    envVar: z.string().min(1).optional(),
    message: z.string().min(1),
  })
  .strict();

export type ToolGap = z.infer<typeof ToolGapSchema>;

export const ToolSourceSchema = z
  .object({
    url: z.string().min(1),
    title: z.string().min(1).optional(),
    snippet: z.string().min(1).optional(),
  })
  .strict();

export type ToolSource = z.infer<typeof ToolSourceSchema>;

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export function credentialGap(envVar: string): ToolGap {
  return {
    type: "gap",
    reason: "missing_credential",
    envVar,
    message: `${envVar} not configured - set the env var to enable this tool.`,
  };
}

export function apiErrorGap(message: string): ToolGap {
  return { type: "gap", reason: "api_error", message };
}

export function abortedGap(): ToolGap {
  return { type: "gap", reason: "aborted", message: "Tool call aborted." };
}

export function composeAbortSignals(signals: readonly AbortSignal[]): AbortSignal {
  if (signals.length === 0) {
    return new AbortController().signal;
  }

  if (signals.length === 1) {
    const [signal] = signals;
    return signal;
  }

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([...signals]);
  }

  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }

    signal.addEventListener("abort", () => controller.abort(signal.reason), {
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
  const signals = [AbortSignal.timeout(timeoutMs)];

  if (abortSignal !== undefined) {
    signals.push(abortSignal);
  }

  return fetch(url, {
    ...init,
    signal: composeAbortSignals(signals),
  });
}

export function isAbortError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const candidate = err as { code?: unknown; name?: unknown };
  return (
    candidate.name === "AbortError" ||
    candidate.name === "TimeoutError" ||
    candidate.code === "ABORT_ERR"
  );
}

export function errorToGap(err: unknown, prefix: string): ToolGap {
  if (isAbortError(err)) {
    return { type: "gap", reason: "aborted", message: `${prefix}: aborted` };
  }

  const message = err instanceof Error ? err.message : String(err);
  return apiErrorGap(`${prefix}: ${message}`);
}
