import { notFound } from 'next/navigation';

import { SharedSessionView } from '@/components/shared/shared-session-view';
import { getSharedSessionByToken } from '@/lib/research-v2/shared-session-read';
import { createAdminClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

/**
 * Fetch shared session data server-side. Public sharing is token-gated, but the
 * database read must not depend on anon-key RLS because Stage 1 removes RLS.
 */
async function getSharedSession(token: string) {
  return getSharedSessionByToken({
    supabase: createAdminClient(),
    token,
  });
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
