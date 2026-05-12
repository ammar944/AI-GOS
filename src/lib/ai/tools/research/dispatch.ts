// src/lib/ai/tools/research/dispatch.ts
// Dispatch a research job to the Railway worker.
// Returns immediately (fire-and-forget from the chat's perspective).

import { auth } from '@clerk/nextjs/server';
import type { ToolExecutionOptions } from 'ai';
import type { BaselineMetrics } from '@/lib/journey/baseline-metrics';

export interface DispatchResult {
  status: 'queued' | 'error';
  section: string;
  jobId?: string;
  userId?: string;
  error?: string;
}

export interface DispatchResearchOptions {
  activeRunId?: string | null;
  /**
   * User-provided baseline metrics (current CAC, LTV, lead→customer rate,
   * last 12-month growth). When present, the worker renders a BASELINE
   * METRICS DATA INTEGRITY block into runner system prompts so the model
   * cannot fabricate LTV/CAC/growth claims. When absent or partial, runners
   * emit insufficient-data states for any field that needs a missing metric.
   */
  baselineMetrics?: BaselineMetrics;
  /**
   * Optional chat-driven refinement forwarded from the research-v2 chat
   * surface when the intent classifier returns kind='rerun'. The worker
   * appends this verbatim to the runner context as a USER REFINEMENT block.
   */
  chatRefinement?: string;
}

export interface JourneyToolExecutionContext {
  activeRunId?: string | null;
  baselineMetrics?: BaselineMetrics;
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

/**
 * Extract baseline metrics from the chat agent's experimental_context.
 * Returns undefined when no metrics were attached — the worker will then
 * render NOT PROVIDED for every field and runners will emit insufficient-data.
 */
export function getBaselineMetricsFromToolExecutionOptions(
  options: ToolExecutionOptions,
): BaselineMetrics | undefined {
  const context = options.experimental_context;
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }
  const { baselineMetrics } = context as JourneyToolExecutionContext;
  return baselineMetrics;
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
  const configuredWorkerUrl = process.env.RAILWAY_WORKER_URL?.trim();
  const workerUrl =
    configuredWorkerUrl ??
    (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3001');
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

  if (!configuredWorkerUrl && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[dispatch] RAILWAY_WORKER_URL not set — using local development worker at http://localhost:3001',
    );
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
            ...(options.baselineMetrics !== undefined
              ? { baselineMetrics: options.baselineMetrics }
              : {}),
            ...(typeof options.chatRefinement === 'string' && options.chatRefinement.trim().length > 0
              ? { chatRefinement: options.chatRefinement.trim() }
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
