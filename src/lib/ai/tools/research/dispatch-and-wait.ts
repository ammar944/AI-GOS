import { dispatchResearch } from './dispatch';
import { pollForResult } from './poll-result';
import { buildErrorResponse, type ToolErrorResult } from './error-response';

export interface ResearchToolResult {
  status: 'complete' | 'partial' | 'error';
  section: string;
  data?: unknown;
  gaps?: string[];
  errorDetail?: ToolErrorResult;
  durationMs: number;
}

export async function dispatchAndWait(
  tool: string,
  section: string,
  context: string,
): Promise<ResearchToolResult> {
  const startTime = Date.now();

  // Step 1: Dispatch to Railway worker
  const dispatchResult = await dispatchResearch(tool, section, context);

  if (dispatchResult.status === 'error') {
    return {
      status: 'error',
      section,
      errorDetail: buildErrorResponse(
        tool,
        dispatchResult.error ?? 'Dispatch failed',
        Date.now() - startTime,
      ),
      durationMs: Date.now() - startTime,
    };
  }

  // Step 2: Poll Supabase for result
  const jobId = dispatchResult.jobId!;
  const userId = dispatchResult.userId ?? '';

  const pollResult = await pollForResult(userId, section, jobId);

  if (pollResult.status === 'complete') {
    return {
      status: 'complete',
      section,
      data: pollResult.data,
      durationMs: pollResult.durationMs,
    };
  }

  if (pollResult.status === 'error') {
    return {
      status: 'error',
      section,
      errorDetail: buildErrorResponse(
        tool,
        pollResult.error ?? 'Research job failed',
        pollResult.durationMs,
      ),
      durationMs: pollResult.durationMs,
    };
  }

  // Timeout — return whatever partial data we have
  return {
    status: 'partial',
    section,
    data: pollResult.data,
    gaps: [`Timed out after ${(pollResult.durationMs / 1000).toFixed(1)}s`],
    durationMs: pollResult.durationMs,
  };
}
