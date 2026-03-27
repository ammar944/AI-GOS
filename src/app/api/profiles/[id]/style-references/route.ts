import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: profileId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { styleReferences } = body as { styleReferences?: unknown };

  if (!Array.isArray(styleReferences)) {
    return NextResponse.json({ error: 'styleReferences must be an array' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('business_profiles')
    .update({ style_references: styleReferences })
    .eq('id', profileId)
    .eq('user_id', userId);

  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });

  return NextResponse.json({ styleReferences });
}
