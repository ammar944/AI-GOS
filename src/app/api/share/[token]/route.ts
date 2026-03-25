import { NextResponse } from 'next/server';
import { createClient as createAnonClient } from '@/lib/supabase/client';

/**
 * GET /api/share/[token] — Fetch a shared session snapshot by token.
 *
 * Public endpoint — no auth required. Uses anon Supabase client (RLS public SELECT).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from('shared_sessions')
    .select('id, share_token, title, research_snapshot, media_plan_snapshot, created_at')
    .eq('share_token', token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Shared session not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}
