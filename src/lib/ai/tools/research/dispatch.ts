// Dispatch a research job to the Railway worker.
// Returns immediately (fire-and-forget from the lead agent's perspective).

import { auth } from '@clerk/nextjs/server';

export interface DispatchResult {
  status: 'queued' | 'error';
  section: string;
  jobId?: string;
  error?: string;
}

export async function dispatchResearch(
  tool: string,
  section: string,
  context: string,
): Promise<DispatchResult> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'error', section, error: 'Unauthorized' };
  }

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
      error: 'Research worker not reachable. RAILWAY_WORKER_URL is not configured.'
    };
  }

  // Quick health check — fail fast if worker is unreachable
  try {
    const health = await fetch(`${workerUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!health.ok) {
      return { status: 'error', section, error: `Worker unhealthy: ${health.status}` };
    }
  } catch {
    return {
      status: 'error',
      section,
      error: 'Research worker is not reachable. Check RAILWAY_WORKER_URL and ensure the worker is running.'
    };
  }

  const jobId = crypto.randomUUID();

  try {
    const res = await fetch(`${workerUrl}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ tool, context, userId, jobId }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[dispatch] Worker rejected ${tool}: ${res.status} ${body}`);
      return { status: 'error', section, error: `Worker error: ${res.status}` };
    }

    return { status: 'queued', section, jobId };
  } catch (error) {
    console.error(`[dispatch] Failed to reach worker for ${tool}:`, error);
    return { status: 'error', section, error: error instanceof Error ? error.message : String(error) };
  }
}
