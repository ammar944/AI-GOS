// src/lib/ai/tools/research/dispatch.ts
// Dispatch a research job to the Railway worker.
// Returns immediately (fire-and-forget from the lead agent's perspective).

import { auth } from '@clerk/nextjs/server';
import type { ToolExecutionOptions } from 'ai';

export interface DispatchResult {
  status: 'queued' | 'error';
  section: string;
  jobId?: string;
  userId?: string;
  error?: string;
}

export interface DispatchResearchOptions {
  activeRunId?: string | null;
}

export interface JourneyToolExecutionContext {
  activeRunId?: string | null;
}

export function getActiveRunIdFromToolExecutionOptions(
  options: ToolExecutionOptions,
): string | null {
  const context = options.experimental_context;
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return null;
  }

  const { activeRunId } = context as JourneyToolExecutionContext;
  return typeof activeRunId === 'string' && activeRunId.trim().length > 0
    ? activeRunId
    : null;
}

// Retry a fetch call up to maxAttempts times on network errors only.
// Does NOT retry on HTTP 4xx/5xx — those are deterministic failures.
async function withRetry(
  fn: () => Promise<Response>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // AbortError is NOT retried — it means the timeout expired (deterministic),
      // not a transient network blip. Retrying a timed-out request multiplies latency.
      const isNetworkError =
        err instanceof Error &&
        err.name !== 'AbortError' &&
        (err.message.includes('fetch failed') ||
          err.message.includes('ECONNREFUSED') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('network'));
      if (!isNetworkError || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
      console.warn(`[dispatch] ${label} attempt ${attempt} failed — retrying in ${delay}ms:`, err);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function dispatchResearchForUser(
  tool: string,
  section: string,
  context: string,
  userId: string,
  options: DispatchResearchOptions = {},
): Promise<DispatchResult> {
  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const apiKey = process.env.RAILWAY_API_KEY;

  if (!workerUrl) {
    console.error(
      '[dispatch] RAILWAY_WORKER_URL not set — research cannot run. ' +
      'Set RAILWAY_WORKER_URL in .env.local (run worker with: cd research-worker && npm run dev)'
    );
    return {
      status: 'error',
      section,
      error: 'Research worker not reachable. RAILWAY_WORKER_URL is not configured.',
    };
  }

  const jobId = crypto.randomUUID();

  try {
    const res = await withRetry(
      () =>
        fetch(`${workerUrl}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            tool,
            context,
            userId,
            jobId,
            ...(typeof options.activeRunId === 'string' && options.activeRunId.length > 0
              ? { runId: options.activeRunId }
              : {}),
          }),
          signal: AbortSignal.timeout(5000),
        }),
      tool,
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`[dispatch] Worker rejected ${tool}: ${res.status} ${body}`);
      return { status: 'error', section, error: `Worker error: ${res.status}` };
    }

    return { status: 'queued', section, jobId, userId };
  } catch (error) {
    console.error(`[dispatch] Failed to reach worker for ${tool} after retries:`, error);
    return {
      status: 'error',
      section,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function dispatchResearch(
  tool: string,
  section: string,
  context: string,
  options: DispatchResearchOptions = {},
): Promise<DispatchResult> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', section, error: 'Unauthorized' };
  }

  return dispatchResearchForUser(tool, section, context, userId, options);
}
