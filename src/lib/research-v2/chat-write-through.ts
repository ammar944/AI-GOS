// Phase 3 of the orchestrator + artifact UI cycle.
//
// Chat-initiated mutations (patch / edit_card / rerun_section) used to write
// only to journey_sessions.research_results — the legacy JSONB monolith.
// Phase 3 changes the contract: every chat patch is committed to the
// normalized research_artifact_sections row first, then mirrored into the
// legacy JSONB column. The artifact UI reads from the normalized table, so
// chat edits MUST land there or the user sees a stale artifact after the
// model claims success.
//
// This helper centralizes the dual-write so the chat route is not the only
// place that gets it right, and so the contract is testable in isolation.

export type ChatWriteThroughResult =
  | { ok: true; normalized_revision: number; conflict: false }
  | { ok: false; conflict: true; reason: 'stale_revision' }
  | { ok: false; conflict: false; reason: string };

export interface ChatWriteThroughInput {
  userId: string;
  runId: string;
  zone: string;
  /** Full section content after applying the patch — wrapper-or-inner shape. */
  patchedSection: Record<string, unknown>;
  /**
   * When the normalized row is being created for the first time this should
   * be 0. When patching an existing complete row it must equal the current
   * revision so commit_artifact_section can detect concurrent writes.
   */
  expectedRevision: number;
  /**
   * Section_run_id under which the patch is being applied. For chat-initiated
   * patches this should be the section_run_id that produced the current
   * row's content — usually pulled from the artifact_view.
   */
  sectionRunId: string;
}

interface SupabaseRpcLike {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const v = record[key];
  return typeof v === 'string' ? v : undefined;
}

function readArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
  const v = record[key];
  return Array.isArray(v) ? v : undefined;
}

/**
 * Pulls the renderable fields out of a wrapper-or-inner section payload so
 * commit_artifact_section receives a clean patch shape regardless of which
 * envelope the patched section is wrapped in.
 */
export function extractNormalizedPatch(
  section: Record<string, unknown>,
): { markdown?: string; title?: string; claims: unknown[]; sources: unknown[] } {
  const inner = isRecord(section.artifact)
    ? section.artifact
    : isRecord(section.data)
      ? section.data
      : section;

  const markdown =
    readString(inner, 'markdown') ?? readString(section, 'markdown');
  const title =
    readString(inner, 'title') ?? readString(section, 'title');
  const claims =
    readArray(inner, 'claims') ?? readArray(section, 'claims') ?? [];
  const sources =
    readArray(inner, 'sources') ?? readArray(section, 'sources') ?? [];

  return { markdown, title, claims, sources };
}

export async function commitChatPatch(
  supabase: SupabaseRpcLike,
  input: ChatWriteThroughInput,
): Promise<ChatWriteThroughResult> {
  const { ensureArtifactResult, errorMsg } = await ensureArtifactIdFor(
    supabase,
    input.userId,
    input.runId,
  );
  if (!ensureArtifactResult) {
    return { ok: false, conflict: false, reason: errorMsg ?? 'ensure_artifact_failed' };
  }

  const normalizedPatch = extractNormalizedPatch(input.patchedSection);
  const commit = await supabase.rpc('commit_artifact_section', {
    p_artifact_id: ensureArtifactResult,
    p_zone: input.zone,
    p_section_run_id: input.sectionRunId,
    p_expected_revision: input.expectedRevision,
    p_patch: {
      status: 'complete',
      title: normalizedPatch.title,
      markdown: normalizedPatch.markdown,
      claims: normalizedPatch.claims,
      sources: normalizedPatch.sources,
      error: null,
    },
  });

  if (commit.error) {
    return {
      ok: false,
      conflict: false,
      reason: `commit_artifact_section: ${commit.error.message}`,
    };
  }

  const row = Array.isArray(commit.data) ? commit.data[0] : commit.data;
  if (!isRecord(row)) {
    return { ok: false, conflict: false, reason: 'commit_artifact_section_no_row' };
  }
  const ok = row.ok === true;
  const conflict = row.conflict === true;
  const revisionRaw = row.revision;
  const revision = typeof revisionRaw === 'number' ? revisionRaw : 0;

  if (!ok && conflict) {
    return { ok: false, conflict: true, reason: 'stale_revision' };
  }
  if (!ok) {
    return { ok: false, conflict: false, reason: 'commit_artifact_section_failed' };
  }

  // Mirror to the legacy journey_sessions.research_results JSONB. A failure
  // here doesn't fail the chat write — the normalized row is the source of
  // truth — but we log so ops can diff via the capabilities endpoint pair.
  const mirror = await supabase.rpc('merge_journey_session_research_result', {
    p_user_id: input.userId,
    p_run_id: input.runId,
    p_section: input.zone,
    p_result: input.patchedSection,
  });
  if (mirror.error) {
    console.warn(
      `[chat-write-through] legacy mirror failed for ${input.zone}: ${mirror.error.message}`,
    );
  }

  return { ok: true, conflict: false, normalized_revision: revision };
}

/**
 * Auto-resolves section_run_id + expectedRevision from the current
 * research_artifact_sections row before committing. Use this when the chat
 * route doesn't already have the section_run_id loaded — e.g. the in-place
 * edit_claim / edit_narrative path that operates on a UI-rendered section
 * without first opening a fresh section_run.
 */
export interface CommitChatPatchAutoInput {
  userId: string;
  runId: string;
  zone: string;
  patchedSection: Record<string, unknown>;
}

/**
 * Loose shape so callers can pass a real Supabase client without TS chasing
 * the @supabase/supabase-js generic type instantiation chain into excessive
 * depth. The helper only uses .from()/.select()/.eq()/.maybeSingle() on the
 * `from()` chain and .rpc() on the root, both of which are present on the
 * real client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = SupabaseRpcLike & { from: (table: string) => any };

export async function commitChatPatchAuto(
  supabase: SupabaseLike,
  input: CommitChatPatchAutoInput,
): Promise<ChatWriteThroughResult> {
  const { ensureArtifactResult, errorMsg } = await ensureArtifactIdFor(
    supabase,
    input.userId,
    input.runId,
  );
  if (!ensureArtifactResult) {
    return { ok: false, conflict: false, reason: errorMsg ?? 'ensure_artifact_failed' };
  }

  const { data: sectionRow, error: sectionErr } = await supabase
    .from('research_artifact_sections')
    .select('section_run_id, revision')
    .eq('artifact_id', ensureArtifactResult)
    .eq('zone', input.zone)
    .maybeSingle();

  if (sectionErr) {
    return {
      ok: false,
      conflict: false,
      reason: `section_lookup: ${sectionErr.message}`,
    };
  }

  const sectionRunIdRaw = sectionRow?.section_run_id;
  const sectionRunId =
    typeof sectionRunIdRaw === 'string' ? sectionRunIdRaw : '';
  const revisionRaw = sectionRow?.revision;
  const expectedRevision = typeof revisionRaw === 'number' ? revisionRaw : 0;

  if (!sectionRunId) {
    return {
      ok: false,
      conflict: false,
      reason: 'section_run_id_missing',
    };
  }

  return commitChatPatch(supabase, {
    userId: input.userId,
    runId: input.runId,
    zone: input.zone,
    patchedSection: input.patchedSection,
    sectionRunId,
    expectedRevision,
  });
}

async function ensureArtifactIdFor(
  supabase: SupabaseRpcLike,
  userId: string,
  runId: string,
): Promise<{ ensureArtifactResult: string | null; errorMsg: string | null }> {
  const { data, error } = await supabase.rpc('ensure_artifact', {
    p_user_id: userId,
    p_run_id: runId,
  });
  if (error) return { ensureArtifactResult: null, errorMsg: error.message };
  if (typeof data === 'string') {
    return { ensureArtifactResult: data, errorMsg: null };
  }
  if (Array.isArray(data) && typeof data[0] === 'string') {
    return { ensureArtifactResult: data[0], errorMsg: null };
  }
  return { ensureArtifactResult: null, errorMsg: 'ensure_artifact_no_id' };
}
