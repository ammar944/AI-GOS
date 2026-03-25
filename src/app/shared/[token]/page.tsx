import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { SharedSessionView } from '@/components/shared/shared-session-view';
import type { Metadata } from 'next';

/**
 * Fetch shared session data using anon client (RLS public SELECT).
 */
async function getSharedSession(token: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data, error } = await supabase
    .from('shared_sessions')
    .select('id, share_token, title, research_snapshot, media_plan_snapshot, created_at')
    .eq('share_token', token)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const session = await getSharedSession(token);

  return {
    title: session ? `${session.title} | AIGOS` : 'Shared Session | AIGOS',
    description: 'Strategic research and media plan generated with AIGOS.',
  };
}

export default async function SharedSessionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSharedSession(token);

  if (!session) {
    notFound();
  }

  return (
    <SharedSessionView
      title={session.title ?? 'Strategic Blueprint'}
      createdAt={session.created_at}
      researchSnapshot={session.research_snapshot}
      mediaPlanSnapshot={session.media_plan_snapshot}
    />
  );
}
