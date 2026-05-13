// Phase 5 — abort an in-flight positioning section run.
//
// Body: { runId, zone }
//
// Looks up the active section_run_id for (artifact, zone) from the
// research_artifact_sections table, then forwards an /abort call to the
// Railway worker. The worker validates ownership of the section_run_id
// (it has the in-memory AbortController map) and writes aborted_at to
// research_section_runs. Idempotent — repeated calls are safe.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/server';

const ABORT_TIMEOUT_MS = 5_000;

interface AbortSectionRequest {
  runId?: unknown;
  zone?: unknown;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as AbortSectionRequest;
  const runId = readString(body.runId);
  const zone = readString(body.zone);

  if (!runId || !zone) {
    return NextResponse.json(
      { error: 'Missing required fields: runId, zone' },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: artifact, error: artErr } = await supabase
    .from('research_artifacts')
    .select('id')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (artErr || !artifact) {
    return NextResponse.json(
      { error: 'artifact not found for runId' },
      { status: 404 },
    );
  }

  const { data: section } = await supabase
    .from('research_artifact_sections')
    .select('section_run_id, status')
    .eq('artifact_id', artifact.id)
    .eq('zone', zone)
    .maybeSingle();

  const sectionRunId =
    section && typeof section.section_run_id === 'string'
      ? section.section_run_id
      : null;

  if (!sectionRunId) {
    return NextResponse.json(
      { ok: true, aborted: false, reason: 'no active section_run_id' },
      { status: 200 },
    );
  }

  const workerUrl = process.env.RAILWAY_WORKER_URL;
  const workerKey = process.env.RAILWAY_API_KEY;
  if (!workerUrl || !workerKey) {
    return NextResponse.json(
      { error: 'Worker not configured (RAILWAY_WORKER_URL/RAILWAY_API_KEY missing)' },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);
  try {
    const res = await fetch(`${workerUrl}/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerKey}`,
      },
      body: JSON.stringify({ sectionRunId }),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(
      { ok: res.ok, sectionRunId, worker: payload },
      { status: res.ok ? 200 : 502 },
    );
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        error: isAbort
          ? `worker /abort timed out after ${ABORT_TIMEOUT_MS}ms`
          : err instanceof Error
            ? err.message
            : String(err),
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
