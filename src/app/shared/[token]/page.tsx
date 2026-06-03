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
  // A transient DB read failure must not crash the public page. Treat any read
  // error as "not available" (→ notFound) rather than propagating to the error
  // boundary; this mirrors the API route's defensive handling.
  try {
    return await getSharedSessionByToken({
      supabase: createAdminClient(),
      token,
    });
  } catch (error) {
    console.error(`[shared/${token}] session read failed`, error);
    return null;
  }
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
