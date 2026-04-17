interface ModelPricing {
  input: number;
  output: number;
}

const DEFAULT_MODEL_PRICING: ModelPricing = {
  input: 3,
  output: 15,
};

const MODEL_PRICING: Array<[matcher: RegExp, pricing: ModelPricing]> = [
  [/haiku/i, { input: 0.8, output: 4 }],
  [/sonnet/i, { input: 3, output: 15 }],
  [/opus/i, { input: 15, output: 75 }],
] as const;

export interface RunnerUsageTelemetry {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  serverToolUseCount?: number;
  iterations?: number;
}

export interface RunnerChartTelemetry {
  chartType: string;
  title: string;
  imageUrl?: string;
}

export interface RunnerTelemetry {
  model?: string;
  stopReason?: string | null;
  usage?: RunnerUsageTelemetry;
  estimatedCostUsd?: number;
  charts?: RunnerChartTelemetry[];
}

interface TelemetryMessageUsageLike {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  server_tool_use?: unknown;
  iterations?: unknown;
}

interface TelemetryMessageLike {
  model?: string;
  stop_reason?: string | null;
  usage: TelemetryMessageUsageLike;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function estimateModelCost(
  model: string | undefined,
  usage: RunnerUsageTelemetry,
): number {
  const pricing =
    MODEL_PRICING.find(([matcher]) => matcher.test(model ?? ''))?.[1] ??
    DEFAULT_MODEL_PRICING;

  return (
    (usage.inputTokens / 1_000_000) * pricing.input +
    (usage.outputTokens / 1_000_000) * pricing.output
  );
}

// ---------------------------------------------------------------------------
// Structured pipeline telemetry events (Phase 0.4)
//
// Emits structured JSON events to stdout for log-based analysis, and optionally
// persists to Supabase `research_telemetry` table for queryable dashboards.
//
// Env flags:
//   RESEARCH_TELEMETRY_VERBOSE=true  -> JSON line per event on stdout
//   RESEARCH_TELEMETRY_PERSIST=true  -> fire-and-forget write to Supabase
//
// Both flags are off by default so existing logs remain quiet.
// ---------------------------------------------------------------------------

export type TelemetryEventName =
  | 'runner.start'
  | 'runner.end'
  | 'runner.error'
  | 'tool.call'
  | 'wiki.extract'
  | 'wiki.write'
  | 'card.synthesize.start'
  | 'card.synthesize.end'
  | 'card.validate.start'
  | 'card.validate.end'
  | 'card.write'
  | 'card.gated'
  | 'card.error'
  | 'evidence.pack'
  | 'pipeline.start'
  | 'pipeline.end';

export interface TelemetryEvent {
  event: TelemetryEventName;
  runId: string;
  userId?: string;
  section?: string;
  card?: string;
  phase?: 'primary' | 'repair' | 'rescue' | 'heuristic';
  durationMs?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  estimatedCostUsd?: number;
  errorMessage?: string;
  extra?: Record<string, unknown>;
  timestamp: string;
}

export interface TelemetryEventInput {
  event: TelemetryEventName;
  runId: string;
  userId?: string;
  section?: string;
  card?: string;
  phase?: TelemetryEvent['phase'];
  durationMs?: number;
  model?: string;
  usage?: RunnerUsageTelemetry;
  estimatedCostUsd?: number;
  errorMessage?: string;
  extra?: Record<string, unknown>;
}

function toEvent(input: TelemetryEventInput): TelemetryEvent {
  return {
    event: input.event,
    runId: input.runId,
    userId: input.userId,
    section: input.section,
    card: input.card,
    phase: input.phase,
    durationMs: input.durationMs,
    model: input.model,
    inputTokens: input.usage?.inputTokens,
    outputTokens: input.usage?.outputTokens,
    cacheCreationTokens: input.usage?.cacheCreationInputTokens,
    cacheReadTokens: input.usage?.cacheReadInputTokens,
    estimatedCostUsd: input.estimatedCostUsd,
    errorMessage: input.errorMessage,
    extra: input.extra,
    timestamp: new Date().toISOString(),
  };
}

let persistFn: ((e: TelemetryEvent) => Promise<void>) | null = null;

/**
 * Lazy-registered persister. Wired from supabase.ts to avoid a circular import.
 * If not registered or if RESEARCH_TELEMETRY_PERSIST is not "true", events are
 * only logged (if verbose) and never written to a DB.
 */
export function registerTelemetryPersister(
  fn: (event: TelemetryEvent) => Promise<void>,
): void {
  persistFn = fn;
}

/**
 * Emit a structured telemetry event. Fire-and-forget for persistence;
 * never blocks the caller or throws.
 */
export function emitTelemetry(input: TelemetryEventInput): void {
  const event = toEvent(input);

  if (process.env.RESEARCH_TELEMETRY_VERBOSE === 'true') {
    // eslint-disable-next-line no-console
    console.log(`[telemetry] ${JSON.stringify(event)}`);
  }

  if (process.env.RESEARCH_TELEMETRY_PERSIST === 'true' && persistFn) {
    persistFn(event).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[telemetry] persist failed (non-fatal):', err?.message ?? err);
    });
  }
}

/**
 * Measure an async operation and emit start/end events.
 * Returns the operation's result; on throw, emits an error event and rethrows.
 */
export async function withTelemetry<T>(
  startEvent: TelemetryEventName,
  endEvent: TelemetryEventName,
  errorEvent: TelemetryEventName,
  base: Omit<TelemetryEventInput, 'event' | 'durationMs'>,
  fn: () => Promise<T>,
): Promise<T> {
  emitTelemetry({ ...base, event: startEvent });
  const t0 = Date.now();
  try {
    const result = await fn();
    emitTelemetry({
      ...base,
      event: endEvent,
      durationMs: Date.now() - t0,
    });
    return result;
  } catch (err) {
    emitTelemetry({
      ...base,
      event: errorEvent,
      durationMs: Date.now() - t0,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------

export function buildRunnerTelemetry(
  finalMessage: TelemetryMessageLike,
): RunnerTelemetry {
  const inputTokens = numberOrUndefined(finalMessage.usage.input_tokens) ?? 0;
  const outputTokens = numberOrUndefined(finalMessage.usage.output_tokens) ?? 0;
  const cacheCreationInputTokens =
    numberOrUndefined(finalMessage.usage.cache_creation_input_tokens);
  const cacheReadInputTokens =
    numberOrUndefined(finalMessage.usage.cache_read_input_tokens);

  const usage: RunnerUsageTelemetry = {
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens +
      outputTokens +
      (cacheCreationInputTokens ?? 0) +
      (cacheReadInputTokens ?? 0),
    cacheCreationInputTokens,
    cacheReadInputTokens,
    serverToolUseCount: numberOrUndefined(finalMessage.usage.server_tool_use),
    iterations: numberOrUndefined(finalMessage.usage.iterations),
  };

  return {
    model: finalMessage.model,
    stopReason: finalMessage.stop_reason,
    usage,
    estimatedCostUsd: estimateModelCost(finalMessage.model, usage),
  };
}
