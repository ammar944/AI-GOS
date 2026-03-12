export interface ResearchUsageTelemetry {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  serverToolUseCount?: number;
  iterations?: number;
}

export interface ResearchChartTelemetry {
  chartType: string;
  title: string;
  imageUrl?: string;
}

export interface ResearchTelemetry {
  model?: string;
  stopReason?: string | null;
  usage?: ResearchUsageTelemetry;
  estimatedCostUsd?: number;
  charts?: ResearchChartTelemetry[];
}
