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
    .select('metadata, research_results, job_status, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
}

async function clearResearchState(userId: string, activeRunId?: string) {
  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from('journey_sessions')
    .select('metadata')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    return { error: readError };
  }

  const nextMetadata = {
    ...((existing?.metadata as Record<string, unknown> | null | undefined) ?? {}),
    ...(activeRunId ? { activeJourneyRunId: activeRunId } : {}),
  };

  return supabase.from('journey_sessions').upsert({
      user_id: userId,
      metadata: nextMetadata,
      research_results: null,
      job_status: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await readLatestJourneySession(userId);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const metadata = (data?.metadata as Record<string, unknown> | null | undefined) ?? null;
  const requestedRunId = new URL(request.url).searchParams.get('runId');
  const storedRunId = getJourneyRunIdFromMetadata(metadata);
  const runMatches = !requestedRunId || requestedRunId === storedRunId;

  return new Response(
    JSON.stringify({
      metadata,
      researchResults: runMatches
        ? (data?.research_results as Record<string, unknown> | null | undefined) ?? null
        : null,
      jobStatus: runMatches
        ? (data?.job_status as Record<string, unknown> | null | undefined) ?? null
        : null,
      runId: storedRunId,
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
