import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;
  const supabase = createAdminClient();

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: packs, error } = await supabase
    .from('script_packs')
    .select('id, created_at, status, generation_context, style_references_snapshot, diversity_score, diversity_flags, script_count')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .or(`status.neq.generating,created_at.gte.${fifteenMinAgo}`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch script packs' }, { status: 500 });
  }

  return NextResponse.json({ packs: packs ?? [] });
}
