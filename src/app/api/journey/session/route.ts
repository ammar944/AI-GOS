import { auth } from '@clerk/nextjs/server';
import { getJourneyRunIdFromMetadata } from '@/lib/journey/journey-run';
import { createAdminClient } from '@/lib/supabase/server';
import { persistToSupabase } from '@/lib/journey/session-state.server';

interface JourneySessionPatchRequest {
  activeRunId?: string;
  sessionId?: string;
  fields?: unknown;
  state?: unknown;
  clearResearch?: boolean;
}

function extractPersistableFields(
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined);
  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
}

async function readLatestJourneySession(userId: string) {
  const supabase = createAdminClient();
  return supabase
    .from('journey_sessions')
    .select('metadata, research_results, job_status, updated_at, run_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function clearResearchState(userId: string, activeRunId?: string) {
  const supabase = createAdminClient();

  const metadata: Record<string, unknown> = {};
  if (activeRunId) {
    metadata.activeJourneyRunId = activeRunId;
  }

  // INSERT a new session row — don't overwrite previous sessions
  return supabase.from('journey_sessions').insert({
    user_id: userId,
    run_id: activeRunId ?? null,
    metadata,
    research_results: null,
    job_status: null,
    updated_at: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const supabase = createAdminClient();

  // ── List mode: return all sessions for this user ──────────────────────
  const listMode = url.searchParams.get('list') === 'true';
  if (listMode) {
    const { data, error } = await supabase
      .from('journey_sessions')
      .select('id, run_id, metadata, created_at, updated_at, research_results')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sessions = (data ?? []).map((s) => ({
      id: s.id,
      runId: s.run_id,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      companyName:
        (s.metadata as Record<string, unknown> | null)?.companyName ?? null,
      sectionCount: s.research_results
        ? Object.keys(s.research_results as Record<string, unknown>).length
        : 0,
    }));

    return new Response(JSON.stringify({ sessions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Specific run: fetch by runId query param ──────────────────────────
  const requestedRunId = url.searchParams.get('runId');

  if (requestedRunId) {
    const { data: runData, error: runError } = await supabase
      .from('journey_sessions')
      .select('metadata, research_results, job_status, updated_at, run_id')
      .eq('user_id', userId)
      .eq('run_id', requestedRunId)
      .maybeSingle();

    if (runError) {
      return new Response(JSON.stringify({ error: runError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const metadata =
      (runData?.metadata as Record<string, unknown> | null | undefined) ?? null;
    const storedRunId = getJourneyRunIdFromMetadata(metadata);

    return new Response(
      JSON.stringify({
        metadata,
        researchResults:
          (runData?.research_results as Record<string, unknown> | null | undefined) ?? null,
        jobStatus:
          (runData?.job_status as Record<string, unknown> | null | undefined) ?? null,
        runId: storedRunId ?? runData?.run_id ?? null,
        updatedAt: runData?.updated_at ?? null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  // ── Default: fetch the latest session ─────────────────────────────────
  const { data, error } = await readLatestJourneySession(userId);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const metadata = (data?.metadata as Record<string, unknown> | null | undefined) ?? null;
  const storedRunId = getJourneyRunIdFromMetadata(metadata);

  return new Response(
    JSON.stringify({
      metadata,
      researchResults:
        (data?.research_results as Record<string, unknown> | null | undefined) ?? null,
      jobStatus:
        (data?.job_status as Record<string, unknown> | null | undefined) ?? null,
      runId: storedRunId ?? data?.run_id ?? null,
      updatedAt: data?.updated_at ?? null,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: JourneySessionPatchRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.clearResearch) {
    const { error } = await clearResearchState(userId, body.activeRunId);
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const fields = extractPersistableFields(body.fields ?? body.state);
  if (!fields) {
    if (typeof body.activeRunId === 'string' && body.activeRunId.trim().length > 0) {
      const runResult = await persistToSupabase(userId, {}, body.activeRunId);
      if (!runResult.ok) {
        return new Response(JSON.stringify({ error: runResult.error ?? 'Failed to persist journey run state' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.clearResearch) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'A valid journey state snapshot is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await persistToSupabase(userId, fields, body.activeRunId);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error ?? 'Failed to persist session state' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
