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
