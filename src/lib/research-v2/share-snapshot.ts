import type { SupabaseClient } from '@supabase/supabase-js';

import {
  READER_SECTION_IDS,
  READER_SECTION_LABELS,
  isReaderSectionId,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';
import { generateShareToken } from '@/lib/blueprints/share-token';
import {
  readVerificationFlag,
  readVerificationTier,
  type VerificationFlag,
  type VerificationTier,
} from '@/lib/research-v2/verification-tier';

export interface V3ShareSectionSnapshot {
  zone: ReaderSectionId;
  title: string;
  markdown: string | null;
  data: unknown;
  verificationTier: VerificationTier | null;
  verificationFlag: VerificationFlag | null;
  updatedAt: string | null;
}

export interface V3ShareResearchSnapshot {
  schemaVersion: 'research-v3';
  runId: string;
  title: string;
  sections: V3ShareSectionSnapshot[];
  // Executive decision memo rendered from research_artifacts.thesis when the
  // brief has completed. Optional for backward compatibility: snapshots
  // written before this field exists simply omit it.
  executiveBrief?: string | null;
}

export interface ResearchArtifactSectionShareRow {
  zone: string | null;
  title: string | null;
  markdown: string | null;
  data: unknown;
  status: string | null;
  verification_tier: unknown;
  verification_flag: unknown;
  updated_at: string | null;
}

interface CreateV3SharedSessionInput {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  title?: string;
  appUrl?: string;
  newShareToken?: () => string;
}

interface CreateV3SharedSessionResult {
  shareToken: string;
  shareUrl: string;
}

interface RefreshV3SharedSessionSnapshotsInput {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  title?: string;
}

interface JourneySessionShareRow {
  id: string;
  run_id: string;
  metadata: Record<string, unknown> | null;
}

interface ParentAuditShareRow {
  id: string;
  thesis: unknown;
}

interface ExistingSharedSessionRow {
  share_token: string | null;
  title: string | null;
  research_snapshot: unknown;
}

interface V3ShareSnapshotContext {
  session: JourneySessionShareRow;
  runId: string;
  sections: ResearchArtifactSectionShareRow[];
  title: string;
  executiveBrief: string | null;
}

export type ShareSnapshotErrorCode =
  | 'session_not_found'
  | 'v3_artifact_not_found'
  | 'v3_sections_not_found'
  | 'lookup_failed'
  | 'insert_failed'
  | 'update_failed';

export interface ShareSnapshotErrorDetails {
  suppliedId?: string;
  lookupMisses?: readonly string[];
  existsForDifferentAccount?: boolean;
  matchedSessionId?: string;
  matchedRunId?: string;
}

export class ShareSnapshotError extends Error {
  public readonly code: ShareSnapshotErrorCode;
  public readonly details: ShareSnapshotErrorDetails | undefined;

  public constructor(
    message: string,
    code: ShareSnapshotErrorCode,
    details?: ShareSnapshotErrorDetails,
  ) {
    super(message);
    this.name = 'ShareSnapshotError';
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeAppUrl(appUrl: string | undefined): string {
  if (!appUrl) return '';
  return appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
}

function sectionOrder(zone: ReaderSectionId): number {
  const index = READER_SECTION_IDS.indexOf(zone);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function pickTitle(row: ResearchArtifactSectionShareRow, zone: ReaderSectionId): string {
  return nonEmptyString(row.title) ?? READER_SECTION_LABELS[zone];
}

function buildDefaultShareTitle(input: {
  title?: string;
  session: JourneySessionShareRow;
}): string {
  const metadata = isRecord(input.session.metadata) ? input.session.metadata : {};
  return (
    nonEmptyString(input.title) ??
    nonEmptyString(metadata.companyName) ??
    nonEmptyString(metadata.businessName) ??
    'Positioning Audit'
  );
}

// Renders research_artifacts.thesis into the share snapshot's executiveBrief
// string. Only a completed brief ships: generating/error states (and legacy
// rows without a thesis) yield null. The thesis paragraph plus the guarded
// decision list — all fields already passed guardBriefNumbers upstream.
export function readExecutiveBriefFromThesis(thesis: unknown): string | null {
  if (!isRecord(thesis) || thesis.status !== 'complete') {
    return null;
  }

  const thesisText =
    nonEmptyString(thesis.executiveThesis) ?? nonEmptyString(thesis.thesis);
  if (thesisText === null) {
    return null;
  }

  const decisions = Array.isArray(thesis.decisions) ? thesis.decisions : [];
  const decisionLines = decisions
    .map((decision) =>
      isRecord(decision) ? nonEmptyString(decision.decision) : null,
    )
    .filter((decision): decision is string => decision !== null)
    .map((decision, index) => `${index + 1}. ${decision}`);

  return decisionLines.length === 0
    ? thesisText
    : [thesisText, '', ...decisionLines].join('\n');
}

export function buildV3ShareSnapshot(input: {
  runId: string;
  title: string;
  sections: ResearchArtifactSectionShareRow[];
  executiveBrief?: string | null;
}): V3ShareResearchSnapshot {
  const sections = input.sections
    .filter((row): row is ResearchArtifactSectionShareRow & { zone: string } => {
      return row.status === 'complete' && isReaderSectionId(row.zone);
    })
    .map((row): V3ShareSectionSnapshot => {
      const zone = row.zone as ReaderSectionId;
      return {
        zone,
        title: pickTitle(row, zone),
        markdown: row.markdown,
        data: row.data,
        verificationTier: readVerificationTier(row.verification_tier),
        verificationFlag: readVerificationFlag(row.verification_flag),
        updatedAt: row.updated_at,
      };
    })
    .sort((a, b) => sectionOrder(a.zone) - sectionOrder(b.zone));

  return {
    schemaVersion: 'research-v3',
    runId: input.runId,
    title: input.title,
    sections,
    executiveBrief: input.executiveBrief ?? null,
  };
}

export function isV3ShareResearchSnapshot(
  value: unknown,
): value is V3ShareResearchSnapshot {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 'research-v3') return false;
  return Array.isArray(value.sections);
}

async function loadV3ShareSnapshotContext(input: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
  title?: string;
}): Promise<V3ShareSnapshotContext> {
  const session = await loadJourneySessionForShare({
    supabase: input.supabase,
    userId: input.userId,
    suppliedId: input.runId,
  });
  const resolvedRunId = session.run_id;

  const { data: parentData, error: parentError } = await input.supabase
    .from('research_artifacts')
    .select('id, thesis')
    .eq('run_id', resolvedRunId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (parentError) {
    throw new ShareSnapshotError(
      `research_artifacts share lookup failed for userId=${input.userId} runId=${resolvedRunId}: ${parentError.message}`,
      'lookup_failed',
    );
  }

  if (!parentData) {
    throw new ShareSnapshotError(
      `No v3 research artifact found for userId=${input.userId} runId=${resolvedRunId}`,
      'v3_artifact_not_found',
    );
  }

  const parent = parentData as ParentAuditShareRow;
  const { data: sectionData, error: sectionError } = await input.supabase
    .from('research_artifact_sections')
    .select(
      'zone, title, markdown, data, status, verification_tier, verification_flag, updated_at',
    )
    .eq('artifact_id', parent.id)
    .order('updated_at', { ascending: true });

  if (sectionError) {
    throw new ShareSnapshotError(
      `research_artifact_sections share lookup failed for artifactId=${parent.id}: ${sectionError.message}`,
      'lookup_failed',
    );
  }

  const title = buildDefaultShareTitle({ title: input.title, session });
  const sections = (sectionData ?? []) as ResearchArtifactSectionShareRow[];
  const executiveBrief = readExecutiveBriefFromThesis(parent.thesis);
  const snapshot = buildV3ShareSnapshot({
    runId: resolvedRunId,
    title,
    sections,
    executiveBrief,
  });

  if (snapshot.sections.length === 0) {
    throw new ShareSnapshotError(
      `No complete v3 sections found for userId=${input.userId} runId=${resolvedRunId} artifactId=${parent.id}`,
      'v3_sections_not_found',
    );
  }

  return {
    session,
    runId: resolvedRunId,
    sections,
    title,
    executiveBrief,
  };
}

async function loadJourneySessionByColumn(input: {
  supabase: SupabaseClient;
  userId: string;
  suppliedId: string;
  column: 'run_id' | 'id';
}): Promise<JourneySessionShareRow | null> {
  const { data, error } = await input.supabase
    .from('journey_sessions')
    .select('id, run_id, metadata')
    .eq(input.column, input.suppliedId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (error) {
    throw new ShareSnapshotError(
      `journey_sessions share lookup failed for userId=${input.userId} ${input.column}=${input.suppliedId}: ${error.message}`,
      'lookup_failed',
    );
  }

  return data ? (data as JourneySessionShareRow) : null;
}

async function findJourneySessionForDifferentAccount(input: {
  supabase: SupabaseClient;
  suppliedId: string;
}): Promise<{ id: string; run_id: string; user_id: string } | null> {
  const runIdLookup = await input.supabase
    .from('journey_sessions')
    .select('id, run_id, user_id')
    .eq('run_id', input.suppliedId)
    .maybeSingle();

  if (runIdLookup.error) {
    throw new ShareSnapshotError(
      `journey_sessions ownership diagnostic failed for run_id=${input.suppliedId}: ${runIdLookup.error.message}`,
      'lookup_failed',
    );
  }
  if (runIdLookup.data) {
    return runIdLookup.data as { id: string; run_id: string; user_id: string };
  }

  const idLookup = await input.supabase
    .from('journey_sessions')
    .select('id, run_id, user_id')
    .eq('id', input.suppliedId)
    .maybeSingle();

  if (idLookup.error) {
    throw new ShareSnapshotError(
      `journey_sessions ownership diagnostic failed for id=${input.suppliedId}: ${idLookup.error.message}`,
      'lookup_failed',
    );
  }

  return idLookup.data
    ? (idLookup.data as { id: string; run_id: string; user_id: string })
    : null;
}

async function loadJourneySessionForShare(input: {
  supabase: SupabaseClient;
  userId: string;
  suppliedId: string;
}): Promise<JourneySessionShareRow> {
  const byRunId = await loadJourneySessionByColumn({
    ...input,
    column: 'run_id',
  });
  if (byRunId) return byRunId;

  const bySessionId = await loadJourneySessionByColumn({
    ...input,
    column: 'id',
  });
  if (bySessionId) return bySessionId;

  const otherAccountSession = await findJourneySessionForDifferentAccount({
    supabase: input.supabase,
    suppliedId: input.suppliedId,
  });
  const existsForDifferentAccount =
    otherAccountSession !== null && otherAccountSession.user_id !== input.userId;

  throw new ShareSnapshotError(
    `Session not found for userId=${input.userId} suppliedId=${input.suppliedId}`,
    'session_not_found',
    {
      suppliedId: input.suppliedId,
      lookupMisses: ['run_id', 'id'],
      existsForDifferentAccount,
      matchedSessionId: existsForDifferentAccount
        ? otherAccountSession.id
        : undefined,
      matchedRunId: existsForDifferentAccount
        ? otherAccountSession.run_id
        : undefined,
    },
  );
}

export async function createV3SharedSession(
  input: CreateV3SharedSessionInput,
): Promise<CreateV3SharedSessionResult> {
  const context = await loadV3ShareSnapshotContext(input);
  const title = context.title;
  const snapshot = buildV3ShareSnapshot({
    runId: context.runId,
    title,
    sections: context.sections,
    executiveBrief: context.executiveBrief,
  });

  const shareToken = (input.newShareToken ?? generateShareToken)();
  const { error: insertError } = await input.supabase.from('shared_sessions').insert({
    share_token: shareToken,
    session_id: context.session.id,
    owner_user_id: input.userId,
    title,
    research_snapshot: snapshot,
    media_plan_snapshot: null,
  });

  if (insertError) {
    throw new ShareSnapshotError(
      `shared_sessions insert failed for userId=${input.userId} runId=${input.runId}: ${insertError.message}`,
      'insert_failed',
    );
  }

  return {
    shareToken,
    shareUrl: `${normalizeAppUrl(input.appUrl)}/shared/${shareToken}`,
  };
}

export async function refreshV3SharedSessionSnapshots(
  input: RefreshV3SharedSessionSnapshotsInput,
): Promise<number> {
  const context = await loadV3ShareSnapshotContext(input);
  const { data: sharedRows, error: sharedRowsError } = await input.supabase
    .from('shared_sessions')
    .select('share_token, title, research_snapshot')
    .eq('session_id', context.session.id)
    .eq('owner_user_id', input.userId);

  if (sharedRowsError) {
    throw new ShareSnapshotError(
      `shared_sessions refresh lookup failed for userId=${input.userId} runId=${input.runId} sessionId=${context.session.id}: ${sharedRowsError.message}`,
      'lookup_failed',
    );
  }

  if (!Array.isArray(sharedRows)) {
    throw new ShareSnapshotError(
      `shared_sessions refresh lookup returned non-array data for userId=${input.userId} runId=${input.runId} sessionId=${context.session.id}`,
      'lookup_failed',
    );
  }

  let refreshed = 0;
  for (const row of sharedRows as ExistingSharedSessionRow[]) {
    if (!isV3ShareResearchSnapshot(row.research_snapshot)) {
      continue;
    }

    const shareToken = nonEmptyString(row.share_token);
    if (shareToken === null) {
      continue;
    }

    const title = nonEmptyString(row.title) ?? context.title;
    const snapshot = buildV3ShareSnapshot({
      runId: context.runId,
      title,
      sections: context.sections,
      executiveBrief: context.executiveBrief,
    });
    const { error: updateError } = await input.supabase
      .from('shared_sessions')
      .update({
        title,
        research_snapshot: snapshot,
      })
      .eq('share_token', shareToken)
      .eq('owner_user_id', input.userId);

    if (updateError) {
      throw new ShareSnapshotError(
        `shared_sessions refresh update failed for userId=${input.userId} runId=${input.runId} shareToken=${shareToken}: ${updateError.message}`,
        'update_failed',
      );
    }

    refreshed += 1;
  }

  return refreshed;
}

export async function refreshV3SharedSessionSnapshotsBestEffort(
  input: RefreshV3SharedSessionSnapshotsInput,
): Promise<number> {
  try {
    return await refreshV3SharedSessionSnapshots(input);
  } catch (error) {
    console.warn('[share-snapshot] v3 share refresh failed', {
      userId: input.userId,
      runId: input.runId,
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
