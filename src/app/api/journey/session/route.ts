import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getJourneyRunIdFromMetadata } from '@/lib/journey/journey-run';
import { buildJourneyRunView } from '@/lib/journey/run-view';
import { createAdminClient } from '@/lib/supabase/server';
import { persistToSupabase } from '@/lib/journey/session-state.server';
import {
  WorkspaceMessagesValidationError,
  mergeWorkspaceSectionMessages,
  parseWorkspaceSection,
  readWorkspaceSectionMessages,
  serializeWorkspaceMessages,
} from '@/lib/journey/workspace-messages';
import type { SectionKey } from '@/lib/workspace/types';
import type { UIMessage } from 'ai';

/**
 * Phase 2 dual-read helper. Returns the normalized
 * research_artifact_sections rows for a given (userId, runId) keyed by zone,
 * or null when no artifact exists yet (consumers fall back to research_results
 * JSONB in that case).
 */
export interface ArtifactSectionSnapshot {
  zone: string;
  status: string;
  revision: number;
  section_run_id: string | null;
  title: string | null;
  markdown: string | null;
  data: unknown;
  claims: unknown;
  sources: unknown;
  error: unknown;
  updated_at: string | null;
}

async function fetchArtifactSections(
  supabase: SupabaseClient,
  userId: string,
  runId: string,
): Promise<Record<string, ArtifactSectionSnapshot> | null> {
  try {
    const { data: artifact } = await supabase
      .from('research_artifacts')
      .select('id')
      .eq('user_id', userId)
      .eq('run_id', runId)
      .maybeSingle();
    if (!artifact?.id) return null;

    const { data: sections, error } = await supabase
      .from('research_artifact_sections')
      .select(
        'zone, status, revision, section_run_id, title, markdown, data, claims, sources, error, updated_at',
      )
      .eq('artifact_id', artifact.id);
    if (error || !Array.isArray(sections)) return null;

    const map: Record<string, ArtifactSectionSnapshot> = {};
    for (const row of sections as ArtifactSectionSnapshot[]) {
      if (row.zone) map[row.zone] = row;
    }
    return Object.keys(map).length > 0 ? map : null;
  } catch {
    return null;
  }
}

interface JourneySessionPatchRequest {
  activeRunId?: string;
  sessionId?: string;
  fields?: unknown;
  state?: unknown;
  clearResearch?: boolean;
  workspaceMessages?: unknown;
}

interface WorkspaceMessagesPatchRequest {
  section?: unknown;
  messages?: unknown;
}

const JourneySessionPostSchema = z
  .object({
    runId: z.string().trim().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    profileId: z.string().trim().min(1).optional(),
  })
  .strict();

type JourneySessionPostRequest = z.infer<typeof JourneySessionPostSchema>;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readLatestJourneySession(userId: string) {
  const supabase = createAdminClient();
  return supabase
    .from('journey_sessions')
    .select('id, profile_id, metadata, research_results, job_status, onboarding_data, messages, updated_at, run_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function persistWorkspaceMessages(
  userId: string,
  activeRunId: string,
  section: SectionKey,
  messages: unknown,
): Promise<Response> {
  let serializedMessages: UIMessage[];
  try {
    serializedMessages = serializeWorkspaceMessages(messages);
  } catch (error) {
    const message =
      error instanceof WorkspaceMessagesValidationError
        ? error.message
        : 'Unknown workspace message validation failure';
    return jsonResponse(
      {
        error: `Invalid workspace message payload for run ${activeRunId} and section ${section}: ${message}`,
      },
      400,
    );
  }

  const supabase = createAdminClient();
  const { data: existing, error: readError } = await supabase
    .from('journey_sessions')
    .select('messages')
    .eq('user_id', userId)
    .eq('run_id', activeRunId)
    .maybeSingle();

  if (readError) {
    return jsonResponse(
      {
        error: `Failed to read workspace messages for run ${activeRunId}: ${readError.message}`,
      },
      500,
    );
  }

  const currentMessages =
    (existing?.messages as Record<string, unknown> | unknown[] | null | undefined) ?? null;
  const nextMessages = mergeWorkspaceSectionMessages(
    currentMessages,
    section,
    serializedMessages,
  );

  const { error: writeError } = await supabase.from('journey_sessions').upsert(
    {
      user_id: userId,
      run_id: activeRunId,
      messages: nextMessages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,run_id' },
  );

  if (writeError) {
    return jsonResponse(
      {
        error: `Failed to persist workspace messages for run ${activeRunId} and section ${section}: ${writeError.message}`,
      },
      500,
    );
  }

  return jsonResponse({ ok: true, messages: nextMessages.workspace[section] ?? [] }, 200);
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

async function validateOwnedProfile(
  supabase: SupabaseClient,
  userId: string,
  profileId: string,
): Promise<Response | null> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return jsonResponse(
      {
        error: `Failed to validate profile ownership for profile ${profileId}: ${error.message}`,
      },
      500,
    );
  }

  if (!data?.id) {
    return jsonResponse(
      { error: `Profile ${profileId} not found for current user` },
      404,
    );
  }

  return null;
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
  const requestedSectionParam = url.searchParams.get('section');
  const requestedSection = requestedSectionParam
    ? parseWorkspaceSection(requestedSectionParam)
    : null;

  if (requestedSectionParam && !requestedSection) {
    return jsonResponse(
      { error: `Invalid workspace section: ${requestedSectionParam}` },
      400,
    );
  }

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
      .select('id, profile_id, metadata, research_results, job_status, onboarding_data, messages, updated_at, run_id, created_at')
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
    const view = runData ? buildJourneyRunView(runData) : null;

    const artifactSections = await fetchArtifactSections(
      supabase,
      userId,
      requestedRunId,
    );

    return new Response(
      JSON.stringify({
        metadata,
        researchResults:
          (runData?.research_results as Record<string, unknown> | null | undefined) ?? null,
        jobStatus:
          (runData?.job_status as Record<string, unknown> | null | undefined) ?? null,
        onboardingData:
          (runData?.onboarding_data as Record<string, unknown> | null | undefined) ?? null,
        runId: storedRunId ?? runData?.run_id ?? null,
        updatedAt: runData?.updated_at ?? null,
        sessionId: runData?.id ?? null,
        profileId: runData?.profile_id ?? null,
        view,
        artifactSections,
        workspaceMessages: requestedSection
          ? readWorkspaceSectionMessages(runData?.messages, requestedSection)
          : undefined,
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
  const view = data ? buildJourneyRunView(data) : null;
  const latestRunId = storedRunId ?? data?.run_id ?? null;
  const artifactSections = latestRunId
    ? await fetchArtifactSections(supabase, userId, latestRunId)
    : null;

  return new Response(
    JSON.stringify({
      metadata,
      researchResults:
        (data?.research_results as Record<string, unknown> | null | undefined) ?? null,
      jobStatus:
        (data?.job_status as Record<string, unknown> | null | undefined) ?? null,
      onboardingData:
        (data?.onboarding_data as Record<string, unknown> | null | undefined) ?? null,
      runId: latestRunId,
      updatedAt: data?.updated_at ?? null,
      sessionId: data?.id ?? null,
      profileId: data?.profile_id ?? null,
      view,
      artifactSections,
      workspaceMessages: requestedSection
        ? readWorkspaceSectionMessages(data?.messages, requestedSection)
        : undefined,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let providedRunId: string | undefined;
  let providedMetadata: Record<string, unknown> = {};
  let providedProfileId: string | undefined;
  try {
    const raw = await request.text();
    if (raw.trim().length > 0) {
      const parsed = JourneySessionPostSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        return jsonResponse(
          { error: 'Invalid journey session payload', details: parsed.error.flatten() },
          400,
        );
      }
      const body: JourneySessionPostRequest = parsed.data;
      providedRunId = body.runId;
      providedProfileId = body.profileId;
      if (body.metadata !== undefined) {
        const metadata = extractPersistableFields(body.metadata);
        if (!metadata) {
          return jsonResponse(
            { error: 'metadata must be an object with at least one field when provided' },
            400,
          );
        }
        providedMetadata = metadata;
      }
    }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const runId = providedRunId ?? crypto.randomUUID();
  const supabase = createAdminClient();
  if (providedProfileId) {
    const validationError = await validateOwnedProfile(
      supabase,
      userId,
      providedProfileId,
    );
    if (validationError) return validationError;
  }

  const { data, error } = await supabase
    .from('journey_sessions')
    .insert({
      user_id: userId,
      run_id: runId,
      profile_id: providedProfileId ?? null,
      metadata: { ...providedMetadata, activeJourneyRunId: runId },
      research_results: null,
      job_status: null,
      updated_at: new Date().toISOString(),
    })
    .select('id, run_id')
    .single();

  if (error) {
    return jsonResponse(
      { error: `Failed to create journey session: ${error.message}` },
      500,
    );
  }

  return jsonResponse(
    {
      runId: data?.run_id ?? runId,
      sessionId: data?.id ?? null,
      profileId: providedProfileId ?? null,
    },
    201,
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

  if (body.workspaceMessages !== undefined) {
    if (typeof body.activeRunId !== 'string' || body.activeRunId.trim().length === 0) {
      return jsonResponse(
        { error: 'activeRunId is required to persist workspace messages' },
        400,
      );
    }

    if (!isRecord(body.workspaceMessages)) {
      return jsonResponse(
        { error: 'workspaceMessages must include a section and messages array' },
        400,
      );
    }

    const workspaceMessages = body.workspaceMessages as WorkspaceMessagesPatchRequest;
    const section = parseWorkspaceSection(workspaceMessages.section);
    if (!section) {
      return jsonResponse(
        { error: `Invalid workspace section: ${String(workspaceMessages.section)}` },
        400,
      );
    }

    return persistWorkspaceMessages(
      userId,
      body.activeRunId.trim(),
      section,
      workspaceMessages.messages,
    );
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
