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

interface JourneySessionShareRow {
  id: string;
  metadata: Record<string, unknown> | null;
}

interface ParentAuditShareRow {
  id: string;
}

export type ShareSnapshotErrorCode =
  | 'session_not_found'
  | 'v3_artifact_not_found'
  | 'v3_sections_not_found'
  | 'lookup_failed'
  | 'insert_failed';

export class ShareSnapshotError extends Error {
  public readonly code: ShareSnapshotErrorCode;

  public constructor(message: string, code: ShareSnapshotErrorCode) {
    super(message);
    this.name = 'ShareSnapshotError';
    this.code = code;
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

export function buildV3ShareSnapshot(input: {
  runId: string;
  title: string;
  sections: ResearchArtifactSectionShareRow[];
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
  };
}

export function isV3ShareResearchSnapshot(
  value: unknown,
): value is V3ShareResearchSnapshot {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 'research-v3') return false;
  return Array.isArray(value.sections);
}

export async function createV3SharedSession(
  input: CreateV3SharedSessionInput,
): Promise<CreateV3SharedSessionResult> {
  const { data: sessionData, error: sessionError } = await input.supabase
    .from('journey_sessions')
    .select('id, metadata')
    .eq('run_id', input.runId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (sessionError) {
    throw new ShareSnapshotError(
      `journey_sessions share lookup failed for userId=${input.userId} runId=${input.runId}: ${sessionError.message}`,
      'lookup_failed',
    );
  }

  if (!sessionData) {
    throw new ShareSnapshotError(
      `Session not found for userId=${input.userId} runId=${input.runId}`,
      'session_not_found',
    );
  }

  const session = sessionData as JourneySessionShareRow;
  const { data: parentData, error: parentError } = await input.supabase
    .from('research_artifacts')
    .select('id')
    .eq('run_id', input.runId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (parentError) {
    throw new ShareSnapshotError(
      `research_artifacts share lookup failed for userId=${input.userId} runId=${input.runId}: ${parentError.message}`,
      'lookup_failed',
    );
  }

  if (!parentData) {
    throw new ShareSnapshotError(
      `No v3 research artifact found for userId=${input.userId} runId=${input.runId}`,
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
  const snapshot = buildV3ShareSnapshot({
    runId: input.runId,
    title,
    sections: (sectionData ?? []) as ResearchArtifactSectionShareRow[],
  });

  if (snapshot.sections.length === 0) {
    throw new ShareSnapshotError(
      `No complete v3 sections found for userId=${input.userId} runId=${input.runId} artifactId=${parent.id}`,
      'v3_sections_not_found',
    );
  }

  const shareToken = (input.newShareToken ?? generateShareToken)();
  const { error: insertError } = await input.supabase.from('shared_sessions').insert({
    share_token: shareToken,
    session_id: session.id,
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
