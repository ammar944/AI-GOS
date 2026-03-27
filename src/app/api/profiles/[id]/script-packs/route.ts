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

  const { data: packs, error } = await supabase
    .from('script_packs')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch script packs' }, { status: 500 });
  }

  return NextResponse.json({ packs: packs ?? [] });
}
