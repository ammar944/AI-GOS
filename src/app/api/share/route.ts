import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

import { createAdminClient } from '@/lib/supabase/server';
import { generateShareToken } from '@/lib/blueprints/share-token';
import { parseResearchToCards, resetCardIdCounter } from '@/lib/workspace/card-taxonomy';
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import { CANONICAL_TO_BOUNDARY_SECTION_MAP } from '@/lib/journey/research-sections';
import {
  createV3SharedSession,
  ShareSnapshotError,
} from '@/lib/research-v2/share-snapshot';
import type { SectionKey, CardState } from '@/lib/workspace/types';

export const maxDuration = 30;

interface ShareRequestBody {
  sessionId?: string;
  title?: string;
}

interface LegacyJourneySessionRow {
  id: string;
  user_id: string;
  research_document: unknown;
  research_results: unknown;
  metadata: Record<string, unknown> | null;
}

interface LegacyShareResult {
  shareUrl: string;
  shareToken: string;
}

function isLegacyFallbackEligible(error: ShareSnapshotError): boolean {
  return (
    error.code === 'v3_artifact_not_found' ||
    error.code === 'v3_sections_not_found'
  );
}

function parseRawResults(
  value: unknown,
): Record<string, { status?: string; data?: Record<string, unknown> }> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, { status?: string; data?: Record<string, unknown> }>)
    : null;
}

export function buildLegacyResearchSnapshot(
  researchDocument: unknown,
  rawResults: Record<string, { status?: string; data?: Record<string, unknown> }> | null,
): Record<string, CardState[]> | null {
  let researchSnapshot =
    researchDocument && typeof researchDocument === 'object' && !Array.isArray(researchDocument)
      ? (researchDocument as Record<string, CardState[]>)
      : null;

  if (researchSnapshot || !rawResults) {
    return researchSnapshot;
  }

  const canonicalToBoundary = CANONICAL_TO_BOUNDARY_SECTION_MAP as Record<string, string>;
  resetCardIdCounter();
  const built: Record<string, CardState[]> = {};
  const intelData = {
    opportunityIntel:
      rawResults.opportunityIntel?.status === 'complete'
        ? rawResults.opportunityIntel.data
        : undefined,
    whiteSpaceGapIntel:
      rawResults.whiteSpaceGapIntel?.status === 'complete'
        ? rawResults.whiteSpaceGapIntel.data
        : undefined,
    offerStatementIntel:
      rawResults.offerStatementIntel?.status === 'complete'
        ? rawResults.offerStatementIntel.data
        : undefined,
    strategicSynthesisIntel:
      rawResults.strategicSynthesisIntel?.status === 'complete'
        ? rawResults.strategicSynthesisIntel.data
        : undefined,
  };

  for (const section of SECTION_PIPELINE) {
    let result = rawResults[section];
    if (!result) {
      for (const [canonical, boundary] of Object.entries(canonicalToBoundary)) {
        if (boundary === section && rawResults[canonical]) {
          result = rawResults[canonical];
          break;
        }
      }
    }
    if (result?.status === 'complete' && result.data) {
      const cards = parseResearchToCards(section as SectionKey, result.data, intelData);
      if (cards.length > 0) built[section] = cards;
    }
  }

  if (Object.keys(built).length > 0) {
    researchSnapshot = built;
  }

  return researchSnapshot;
}

async function createLegacySharedSession(input: {
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
  sessionId: string;
  title?: string;
  appUrl: string;
}): Promise<LegacyShareResult | NextResponse<{ error: string }>> {
  const { data: session, error: fetchError } = await input.supabase
    .from('journey_sessions')
    .select('id, user_id, research_document, research_results, metadata')
    .eq('run_id', input.sessionId)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const legacySession = session as LegacyJourneySessionRow;
  if (legacySession.user_id !== input.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rawResults = parseRawResults(legacySession.research_results);
  const researchSnapshot = buildLegacyResearchSnapshot(
    legacySession.research_document,
    rawResults,
  );
  const mediaPlanRaw = rawResults?.mediaPlan;
  let mediaPlanSnapshot: CardState[] | null = null;
  if (mediaPlanRaw?.status === 'complete' && mediaPlanRaw.data) {
    resetCardIdCounter();
    mediaPlanSnapshot = parseResearchToCards('mediaPlan', mediaPlanRaw.data);
  }

  const snapshotTitle =
    input.title ||
    legacySession.metadata?.businessName ||
    legacySession.metadata?.companyName ||
    'Strategic Blueprint';
  const shareToken = generateShareToken();
  const { error: insertError } = await input.supabase.from('shared_sessions').insert({
    share_token: shareToken,
    session_id: legacySession.id,
    owner_user_id: input.userId,
    title: snapshotTitle,
    research_snapshot: researchSnapshot,
    media_plan_snapshot: mediaPlanSnapshot,
  });

  if (insertError) {
    console.error('[POST /api/share] Legacy insert failed', {
      userId: input.userId,
      sessionId: input.sessionId,
      message: insertError.message,
    });
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }

  return {
    shareUrl: `${input.appUrl}/shared/${shareToken}`,
    shareToken,
  };
}

/**
 * POST /api/share — Create an immutable snapshot of a journey session for sharing.
 *
 * v3 runs snapshot normalized research_artifact_sections. Legacy V1 sessions
 * fall back to research_document/research_results until the old viewer is
 * explicitly retired.
 *
 * Auth: Clerk userId must match session owner.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ShareRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sessionId, title } = body;
  if (!sessionId || sessionId.trim().length === 0) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  try {
    const shared = await createV3SharedSession({
      supabase,
      userId,
      runId: sessionId.trim(),
      title,
      appUrl,
    });
    return NextResponse.json({ success: true, ...shared });
  } catch (error) {
    if (!(error instanceof ShareSnapshotError)) {
      throw error;
    }

    if (!isLegacyFallbackEligible(error)) {
      console.error('[POST /api/share] v3 snapshot failed', {
        userId,
        sessionId,
        code: error.code,
        message: error.message,
      });
      const status = error.code === 'session_not_found' ? 404 : 500;
      return NextResponse.json(
        {
          error:
            status === 404 ? 'Session not found' : 'Failed to create share link',
        },
        { status },
      );
    }
  }

  const legacy = await createLegacySharedSession({
    supabase,
    userId,
    sessionId: sessionId.trim(),
    title,
    appUrl,
  });

  if (legacy instanceof NextResponse) {
    return legacy;
  }

  return NextResponse.json({ success: true, ...legacy });
}
