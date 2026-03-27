// GET /api/profiles — list all business profiles for the authenticated user
// POST /api/profiles — save/update a business profile from session metadata

import { auth } from '@clerk/nextjs/server';
import {
  getUserProfiles,
  saveBusinessProfile,
} from '@/lib/profiles/business-profiles';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profiles = await getUserProfiles(userId);
  return Response.json({ profiles });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { sessionId } = body as { sessionId?: string };

  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  // Fetch session metadata from Supabase
  // sessionId from frontend is the client-generated run_id, not the DB primary key
  const supabase = createAdminClient();
  const { data: session, error } = await supabase
    .from('journey_sessions')
    .select('id, metadata')
    .eq('run_id', sessionId)
    .eq('user_id', userId)
    .single();

  if (error || !session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const metadata = (session.metadata ?? {}) as Record<string, unknown>;

  // Use the actual DB primary key (session.id) for the FK reference
  const result = await saveBusinessProfile(userId, session.id, metadata);

  if (!result) {
    return Response.json(
      { error: 'Could not create profile — company name missing' },
      { status: 422 },
    );
  }

  // Link session to profile via profile_id FK
  await supabase
    .from('journey_sessions')
    .update({ profile_id: result.id })
    .eq('id', session.id);

  return Response.json({ profileId: result.id });
}
