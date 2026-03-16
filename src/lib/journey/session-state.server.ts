// src/lib/journey/session-state.server.ts
import { createAdminClient } from '@/lib/supabase/server';
import {
  JOURNEY_ACTIVE_RUN_METADATA_KEY,
  getJourneyRunIdFromMetadata,
} from '@/lib/journey/journey-run';
import { normalizeStoredResearchResults } from '@/lib/journey/research-result-contract';
import { pipelineStateSchema, type PipelineState } from '@/lib/research/pipeline-types';

// ── Supabase Persistence ───────────────────────────────────────────────────
// General metadata snapshots still use fetch-then-merge JSONB updates.
// Pipeline metadata uses an atomic merge RPC to avoid partial writes.
// Research artifacts use RPC helpers for atomic per-section writes.
//
// Server-only: This file imports @/lib/supabase/server which transitively
// imports @clerk/nextjs/server. Must NOT be imported from client components.

export interface PersistResult {
  ok: boolean;
  error?: string;
  skipped?: boolean;
}

interface PersistedResearchResult {
  runId?: string;
}

// Transient Supabase error codes worth retrying (connection/timeout issues)
const RETRYABLE_PG_CODES = new Set(['08006', '08001', '57014', '40001', '40P01']);

function isRetryableSupabaseError(err: { code?: string; message?: string }): boolean {
  if (err.code && RETRYABLE_PG_CODES.has(err.code)) return true;
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('timeout') || msg.includes('connection') || msg.includes('reset');
}

function getResearchRunId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const runId = (value as PersistedResearchResult).runId;
  return typeof runId === 'string' && runId.length > 0 ? runId : undefined;
}

function getResearchRunIdsBySection(
  research: Record<string, unknown>,
): Map<string, string> {
  const runIdsBySection = new Map<string, string>();

  for (const [section, value] of Object.entries(research)) {
    const runId = getResearchRunId(value);
    if (!runId) {
      continue;
    }

    const normalized = normalizeStoredResearchResults({ [section]: value }, 'canonical');
    const normalizedSection = Object.keys(normalized)[0];
    if (normalizedSection) {
      runIdsBySection.set(normalizedSection, runId);
    }
  }

  return runIdsBySection;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readCurrentJourneyRunId(
  userId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return getJourneyRunIdFromMetadata(
    (data?.metadata as Record<string, unknown> | null | undefined) ?? null,
  );
}

export async function readPipelineState(userId: string): Promise<PipelineState | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read pipeline state for user ${userId}: ${error.message}`);
  }

  if (!isRecord(data?.metadata)) {
    return null;
  }

  const pipelineState = data.metadata.researchPipeline;
  if (!pipelineState) {
    return null;
  }

  const parsedPipelineState = pipelineStateSchema.safeParse(pipelineState);
  if (!parsedPipelineState.success) {
    throw new Error(
      `Invalid persisted pipeline state for user ${userId}: ${parsedPipelineState.error.message}`,
    );
  }

  return parsedPipelineState.data;
}

export async function persistPipelineState(
  userId: string,
  pipelineState: PipelineState,
  extraMetadata: Record<string, unknown> = {},
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc('merge_journey_session_metadata_keys', {
    p_user_id: userId,
    p_keys: {
      ...extraMetadata,
      researchPipeline: pipelineState,
      [JOURNEY_ACTIVE_RUN_METADATA_KEY]: pipelineState.runId,
      lastUpdated: new Date().toISOString(),
    },
  });

  if (error) {
    throw new Error(
      `Failed to persist pipeline state for user ${userId} and run ${pipelineState.runId}: ${error.message}`,
    );
  }
}

export async function persistToSupabase(
  userId: string,
  fields: Record<string, unknown>,
  activeRunId?: string,
): Promise<PersistResult> {
  try {
    if (activeRunId) {
      const currentRunId = await readCurrentJourneyRunId(userId);
      if (currentRunId && currentRunId !== activeRunId) {
        console.warn('[journey] Skipping stale session persist for inactive run:', {
          activeRunId,
          currentRunId,
          userId,
        });
        return { ok: true, skipped: true };
      }
    }

    const supabase = createAdminClient();

    // Fetch current metadata (fetch-then-merge pattern)
    // When activeRunId is available, scope to that specific run row;
    // otherwise fall back to the latest row for this user.
    let existingQuery = supabase
      .from('journey_sessions')
      .select('metadata')
      .eq('user_id', userId);

    if (activeRunId) {
      existingQuery = existingQuery.eq('run_id', activeRunId);
    } else {
      existingQuery = existingQuery.order('created_at', { ascending: false }).limit(1);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    const currentMetadata =
      (existing?.metadata as Record<string, unknown>) || {};

    // Shallow merge — new fields overwrite existing, preserving untouched fields
    const merged = {
      ...currentMetadata,
      ...fields,
      ...(activeRunId ? { [JOURNEY_ACTIVE_RUN_METADATA_KEY]: activeRunId } : {}),
      lastUpdated: new Date().toISOString(),
    };

    // Upsert on composite key (user_id, run_id)
    const { error } = await supabase.from('journey_sessions').upsert(
      {
        user_id: userId,
        run_id: activeRunId ?? null,
        metadata: merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,run_id' },
    );

    if (error) {
      console.error('[journey] Supabase persistToSupabase failed:', error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[journey] Supabase persistence threw unexpectedly:', msg);
    return { ok: false, error: msg };
  }
}

export async function persistResearchToSupabase(
  userId: string,
  research: Record<string, unknown>,
  activeRunId?: string,
  attempt = 1,
): Promise<PersistResult> {
  try {
    if (activeRunId) {
      const currentRunId = await readCurrentJourneyRunId(userId);
      if (currentRunId !== activeRunId) {
        console.warn('[journey] Skipping stale research persist for inactive run:', {
          activeRunId,
          currentRunId,
          userId,
        });
        return { ok: true, skipped: true };
      }
    }

    const supabase = createAdminClient();
    const normalizedResearch = normalizeStoredResearchResults(research, 'canonical');
    const runIdsBySection = getResearchRunIdsBySection(research);

    for (const [section, result] of Object.entries(normalizedResearch)) {
      const runId = runIdsBySection.get(section) ?? activeRunId;
      const { error } = await supabase.rpc(
        'merge_journey_session_research_result',
        {
          p_user_id: userId,
          p_section: section,
          p_result: runId ? { ...result, runId } : result,
        },
      );

      if (error) {
        const shouldRetry = attempt < 2 && isRetryableSupabaseError(error);
        if (shouldRetry) {
          console.warn(
            `[journey] Supabase write failed (attempt ${attempt}) — retrying in 1s:`,
            error.message,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return persistResearchToSupabase(userId, research, activeRunId, attempt + 1);
        }

        console.error(
          `[journey] persistResearchToSupabase failed after ${attempt} attempt(s):`,
          error.message,
        );
        return { ok: false, error: error.message };
      }
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[journey] persistResearchToSupabase threw unexpectedly:', msg);
    return { ok: false, error: msg };
  }
}
