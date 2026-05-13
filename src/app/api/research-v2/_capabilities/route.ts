// Research-v2 capabilities endpoint — single source of truth for the
// orchestrator/artifact UI cycle flags and the live worker version.
//
// GET /api/research-v2/_capabilities
//
// Returns the local frontend feature-flag state plus a best-effort reflection
// of the worker's /capabilities response (worker_version, orchestrate_supported).
// If the worker is unreachable within a short timeout, worker_version is
// reported as "unreachable" and orchestrate_supported is false.

import { NextResponse } from 'next/server';

// Phase 7: rollout-gate flags (orchestrator_enabled, parallel_sections_enabled,
// artifact_ui_v2) removed — the orchestrator + centered artifact UI are the
// only path. Only worker reachability + capability remain.
export interface ResearchV2Capabilities {
  worker_url: string;
  worker_version: string;
  orchestrate_supported: boolean;
}

const WORKER_FETCH_TIMEOUT_MS = 1500;

async function fetchWorkerCapabilities(
  workerUrl: string,
  apiKey: string | undefined,
): Promise<{ worker_version: string; orchestrate_supported: boolean }> {
  if (!workerUrl) {
    return { worker_version: 'unconfigured', orchestrate_supported: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/capabilities`, {
      method: 'GET',
      headers: apiKey ? { 'x-api-key': apiKey } : {},
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      return { worker_version: 'unreachable', orchestrate_supported: false };
    }
    const body = (await res.json()) as unknown;
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const version =
        typeof record.worker_version === 'string'
          ? record.worker_version
          : 'unknown';
      const supported = record.orchestrate_supported === true;
      return { worker_version: version, orchestrate_supported: supported };
    }
    return { worker_version: 'unknown', orchestrate_supported: false };
  } catch {
    return { worker_version: 'unreachable', orchestrate_supported: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(): Promise<NextResponse<ResearchV2Capabilities>> {
  const workerUrl = process.env.RAILWAY_WORKER_URL?.trim() ?? '';
  const apiKey = process.env.RAILWAY_API_KEY?.trim();

  const { worker_version, orchestrate_supported } =
    await fetchWorkerCapabilities(workerUrl, apiKey);

  const payload: ResearchV2Capabilities = {
    worker_url: workerUrl,
    worker_version,
    orchestrate_supported,
  };

  return NextResponse.json(payload, { status: 200 });
}
