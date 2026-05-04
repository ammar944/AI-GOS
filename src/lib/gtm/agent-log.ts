import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { LighthouseSkill } from "@/lib/gtm/types";

export type GtmAgentLogEvent =
  | "dispatch_started"
  | "dispatch_completed"
  | "dispatch_failed";

export interface GtmAgentLogEntryInput {
  run_id: string;
  stage: LighthouseSkill;
  event: GtmAgentLogEvent;
  message: string;
  model_provider?: string;
  model?: string;
  status?: string;
  duration_ms?: number;
  source_gaps_count?: number;
  blocker_source_gaps_count?: number;
  error?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface GtmAgentLogWriteResult {
  file_path: string | null;
  file_written: boolean;
  file_error?: string;
}

interface GtmAgentLogEntry extends GtmAgentLogEntryInput {
  timestamp: string;
}

const LOG_DIR = path.join(process.cwd(), ".omc", "gtm-agent-logs");

export async function writeGtmAgentLog(
  input: GtmAgentLogEntryInput
): Promise<GtmAgentLogWriteResult> {
  const entry: GtmAgentLogEntry = {
    ...input,
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(entry);

  console.log(`[gtm-agent] ${line}`);

  if (!shouldWriteAgentLogFile()) {
    return {
      file_path: null,
      file_written: false,
    };
  }

  const filePath = getGtmAgentLogFilePath(input.run_id);

  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${line}\n`, "utf8");

    return {
      file_path: filePath,
      file_written: true,
    };
  } catch (error) {
    const fileError = getErrorMessage(error);
    console.error(
      `[gtm-agent] ${JSON.stringify({
        timestamp: new Date().toISOString(),
        run_id: input.run_id,
        stage: input.stage,
        event: "agent_log_file_write_failed",
        file_path: filePath,
        error: fileError,
      })}`
    );

    return {
      file_path: filePath,
      file_written: false,
      file_error: fileError,
    };
  }
}

export function getGtmAgentLogFilePath(runId: string): string {
  return path.join(LOG_DIR, `${sanitizeRunId(runId)}.jsonl`);
}

function shouldWriteAgentLogFile(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.AIGOS_GTM_AGENT_LOGS !== "off"
  );
}

function sanitizeRunId(runId: string): string {
  return runId.replace(/[^A-Za-z0-9._-]/g, "_");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
