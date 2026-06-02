import { NextResponse } from 'next/server';
import { getSharedSessionByToken } from '@/lib/research-v2/shared-session-read';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/share/[token] — Fetch a shared session snapshot by token.
 *
 * Public endpoint — no auth required. Uses a server-side admin client so this
 * route survives the Stage 1 RLS removal.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  let data;
  try {
    data = await getSharedSessionByToken({
      supabase: createAdminClient(),
      token,
    });
  } catch (error) {
    console.error('[GET /api/share/[token]] shared session lookup failed', {
      token,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch shared session' },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Shared session not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
