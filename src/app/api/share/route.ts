import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { generateShareToken } from '@/lib/blueprints/share-token';

export const maxDuration = 30;

/**
 * POST /api/share — Create an immutable snapshot of a journey session for sharing.
 *
 * Reads research_document (curated cards) and research_results->'mediaPlan'
 * from journey_sessions, writes a snapshot to shared_sessions.
 *
 * Auth: Clerk userId must match session owner.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sessionId: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { sessionId, title } = body;
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch session — verify ownership + get snapshot data
  // sessionId from frontend is the client-generated run_id, not the DB primary key
  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('id, user_id, research_document, research_results, metadata')
    .eq('run_id', sessionId)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Ownership check — prevent snapshotting another user's session
  if (session.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const researchSnapshot = session.research_document ?? null;
  const mediaPlanSnapshot = session.research_results?.mediaPlan ?? null;

  // Derive title from metadata if not provided
  const snapshotTitle =
    title ||
    session.metadata?.businessName ||
    session.metadata?.companyName ||
    'Strategic Blueprint';

  const shareToken = generateShareToken();

  const { error: insertError } = await supabase.from('shared_sessions').insert({
    share_token: shareToken,
    session_id: session.id,
    owner_user_id: userId,
    title: snapshotTitle,
    research_snapshot: researchSnapshot,
    media_plan_snapshot: mediaPlanSnapshot,
  });

  if (insertError) {
    console.error('[POST /api/share] Insert failed:', insertError.message);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/shared/${shareToken}`;

  return NextResponse.json({
    success: true,
    shareUrl,
    shareToken,
  });
}
