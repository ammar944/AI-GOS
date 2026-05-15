/**
 * One-shot backfill: hydrate the new research_artifacts /
 * research_artifact_sections tables from legacy journey_sessions.research_results
 * JSONB. Idempotent — skips rows that already have a normalized artifact.
 *
 * Usage (from repo root):
 *   tsx supabase/scripts/backfill-research-artifacts.ts
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Internal-user volume only (~5 users); run once after the migration applies.
 *
 * Phase 2 of research-v2 agent-loop rebuild.
 */

import { createClient } from '@supabase/supabase-js';

type LegacyRow = {
  id: string;
  user_id: string;
  run_id: string | null;
  research_results: Record<string, unknown> | null;
  updated_at: string | null;
};

type LegacySection = {
  status?: string | null;
  data?: unknown;
  artifact?: { markdown?: string | null } | null;
  error?: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment',
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function ensureArtifact(userId: string, runId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_artifact', {
    p_user_id: userId,
    p_run_id: runId,
  });
  if (error) throw new Error(`ensure_artifact failed: ${error.message}`);
  if (typeof data !== 'string') {
    throw new Error('ensure_artifact returned non-uuid');
  }
  return data;
}

async function backfillSection(
  artifactId: string,
  zone: string,
  legacy: LegacySection,
): Promise<void> {
  // Skip rows where a live run has already taken the section. We never want
  // backfill to clobber an in-flight or freshly-committed write — the legacy
  // JSONB shape is strictly older than any normalized row that exists.
  const { data: existing } = await supabase
    .from('research_artifact_sections')
    .select('revision, status, section_run_id')
    .eq('artifact_id', artifactId)
    .eq('zone', zone)
    .maybeSingle();
  if (existing) {
    console.log(
      `[backfill] skipped ${artifactId}:${zone} — section already exists (revision ${existing.revision}, status ${existing.status})`,
    );
    return;
  }

  const markdown = legacy.artifact?.markdown ?? null;
  const status = legacy.status ?? 'idle';

  const patch: Record<string, unknown> = {
    status,
    markdown,
    ...(legacy.data !== undefined ? { data: legacy.data } : {}),
    claims: [],
    sources: [],
    error: legacy.error ? { message: legacy.error } : null,
  };

  // section_run_id is null for backfilled rows; the first legitimate write
  // after backfill must pass section_run_id matching the active run (the row
  // we insert here leaves section_run_id pointing at the placeholder, which
  // no live runner will use — so the active-run guard rejects accidental
  // overwrites until start_section_run pins a real run).
  const placeholderRunId = '00000000-0000-0000-0000-000000000000';

  const { data, error } = await supabase.rpc('commit_artifact_section', {
    p_artifact_id: artifactId,
    p_zone: zone,
    p_section_run_id: placeholderRunId,
    p_expected_revision: 0,
    p_patch: patch,
  });

  if (error) {
    console.warn(
      `[backfill] commit_artifact_section failed for ${artifactId}:${zone}: ${error.message}`,
    );
    return;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.conflict) {
    console.log(
      `[backfill] skipped ${artifactId}:${zone} — live revision ${row.revision}`,
    );
  }
}

async function backfillRow(row: LegacyRow): Promise<void> {
  if (!row.run_id || !row.research_results) return;

  const sections = Object.entries(row.research_results).filter(
    ([, value]) => value && typeof value === 'object',
  ) as Array<[string, LegacySection]>;

  if (sections.length === 0) return;

  const artifactId = await ensureArtifact(row.user_id, row.run_id);

  for (const [zone, legacy] of sections) {
    await backfillSection(artifactId, zone, legacy);
  }

  console.log(
    `[backfill] hydrated ${sections.length} sections for ${row.user_id}/${row.run_id}`,
  );
}

async function main(): Promise<void> {
  console.log('[backfill] starting…');
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id, user_id, run_id, research_results, updated_at')
    .not('research_results', 'is', null);

  if (error) throw new Error(`journey_sessions read failed: ${error.message}`);
  if (!Array.isArray(data)) {
    console.log('[backfill] no rows returned');
    return;
  }

  console.log(`[backfill] processing ${data.length} session rows`);

  for (const row of data as LegacyRow[]) {
    try {
      await backfillRow(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[backfill] failed on ${row.user_id}/${row.run_id}: ${message}`,
      );
    }
  }

  console.log('[backfill] done.');
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
