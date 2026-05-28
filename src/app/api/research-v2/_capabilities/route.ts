// Research-v2 capabilities endpoint — single source of truth for the
// orchestrator/artifact UI cycle flags and the live worker version.
//
// GET /api/research-v2/_capabilities
//
// Returns the local frontend feature-flag state plus a best-effort reflection
// of the worker's /capabilities response. Worker failures remain HTTP 200 for
// dashboards, but the JSON carries explicit worker_reachable + lastError fields.

import { NextResponse } from 'next/server';

// Phase 7: rollout-gate flags (orchestrator_enabled, parallel_sections_enabled,
// artifact_ui_v2) removed — the orchestrator + centered artifact UI are the
// only path. Only worker reachability + capability remain.
export interface ResearchV2Capabilities {
  worker_url: string;
  worker_version: string;
  worker_reachable: boolean;
  orchestrate_supported: boolean;
  lastError: string | null;
}

const WORKER_FETCH_TIMEOUT_MS = 1500;

async function fetchWorkerCapabilities(
  workerUrl: string,
  apiKey: string | undefined,
): Promise<
  Pick<
    ResearchV2Capabilities,
    'lastError' | 'orchestrate_supported' | 'worker_reachable' | 'worker_version'
  >
> {
  if (!workerUrl) {
    return {
      worker_version: 'unconfigured',
      worker_reachable: false,
      orchestrate_supported: false,
      lastError: 'RAILWAY_WORKER_URL is not configured',
    };
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
      return {
        worker_version: 'unreachable',
        worker_reachable: false,
        orchestrate_supported: false,
        lastError: `Worker /capabilities returned HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as unknown;
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const version =
        typeof record.worker_version === 'string'
          ? record.worker_version
          : 'unknown';
      const supported = record.orchestrate_supported === true;
      return {
        worker_version: version,
        worker_reachable: true,
        orchestrate_supported: supported,
        lastError: null,
      };
    }
    return {
      worker_version: 'unknown',
      worker_reachable: true,
      orchestrate_supported: false,
      lastError: null,
    };
  } catch (error) {
    return {
      worker_version: 'unreachable',
      worker_reachable: false,
      orchestrate_supported: false,
      lastError: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(): Promise<NextResponse<ResearchV2Capabilities>> {
  const workerUrl = process.env.RAILWAY_WORKER_URL?.trim() ?? '';
  const apiKey = process.env.RAILWAY_API_KEY?.trim();

  const {
    lastError,
    orchestrate_supported,
    worker_reachable,
    worker_version,
  } =
    await fetchWorkerCapabilities(workerUrl, apiKey);

  const payload: ResearchV2Capabilities = {
    worker_url: workerUrl,
    worker_version,
    worker_reachable,
    orchestrate_supported,
    lastError,
  };

  return NextResponse.json(payload, { status: 200 });
}
