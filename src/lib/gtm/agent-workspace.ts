import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import type { GtmStageStatus } from "@/lib/gtm/stage-state";

export interface GtmAgentConsoleEvent extends GtmStageEvent {
  stage_label: string;
}

export interface GtmStageDisplayState {
  stage: string;
  label: string;
  status: GtmStageStatus | "pending";
  state: {
    started_at?: string;
    completed_at?: string;
    accepted_at?: string;
    output?: unknown;
    raw_output?: unknown;
    summary?: string;
    source_gaps?: unknown[];
    tool_calls?: unknown[];
    artifacts?: Record<string, string>;
    validation?: unknown;
    duration_ms?: number;
    error?: string;
  };
  last_event?: GtmAgentConsoleEvent;
  waiting_reason?: string;
  elapsed_ms?: number;
}
