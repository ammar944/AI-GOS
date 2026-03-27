import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { packId } = await params;
  const supabase = createAdminClient();

  const { data: pack, error } = await supabase
    .from('script_packs')
    .select('*')
    .eq('id', packId)
    .eq('user_id', userId)
    .single();

  if (error || !pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  }

  return NextResponse.json({ pack });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { packId } = await params;
  const body = await request.json();
  const { scriptId, updates } = body;

  if (!scriptId || !updates) {
    return NextResponse.json({ error: 'scriptId and updates required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Read-modify-write (Supabase can't update nested JSONB array elements)
  const { data: pack, error: readErr } = await supabase
    .from('script_packs')
    .select('scripts, updated_at')
    .eq('id', packId)
    .eq('user_id', userId)
    .single();

  if (readErr || !pack) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  }

  const scripts = (typeof pack.scripts === 'string' ? JSON.parse(pack.scripts) : pack.scripts) as Array<Record<string, unknown>>;
  const idx = scripts.findIndex((s) => s.id === scriptId);
  if (idx === -1) {
    return NextResponse.json({ error: 'Script not found in pack' }, { status: 404 });
  }

  scripts[idx] = { ...scripts[idx], ...updates };

  const { error: writeErr } = await supabase
    .from('script_packs')
    .update({ scripts: JSON.stringify(scripts) })
    .eq('id', packId)
    .eq('updated_at', pack.updated_at);

  if (writeErr) {
    return NextResponse.json({ error: 'Concurrent update — retry' }, { status: 409 });
  }

  return NextResponse.json({ script: scripts[idx] });
}
