// GET /api/profiles — list all business profiles for the authenticated user
// POST /api/profiles — save/update a business profile from session metadata

import {
  saveBusinessProfile,
} from '@/lib/profiles/business-profiles';
import { createAdminClient } from '@/lib/supabase/server';
import {
  requireApiUser,
  getJourneyDataUserId,
  listProfilesForApiUser,
  applyPrimaryProfileLockIfNeeded,
  logAccessAudit,
} from '@/lib/auth/app-access';

export async function GET() {
  const access = await requireApiUser();
  if (access instanceof Response) return access;

  const profiles = await listProfilesForApiUser(access);
  return Response.json({ profiles });
}

export async function POST(req: Request) {
  const access = await requireApiUser();
  if (access instanceof Response) return access;

  const dataUserId = getJourneyDataUserId(access);

  if (access.role === 'client' && access.primaryProfileId) {
    return Response.json(
      { error: 'Client accounts are limited to a single company profile.' },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { sessionId } = body as { sessionId?: string };

  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: session, error } = await supabase
    .from('journey_sessions')
    .select('id, metadata')
    .eq('run_id', sessionId)
    .eq('user_id', dataUserId)
    .single();

  if (error || !session) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const metadata = (session.metadata ?? {}) as Record<string, unknown>;

  const result = await saveBusinessProfile(dataUserId, session.id, metadata);

  if (!result) {
    return Response.json(
      { error: 'Could not create profile — company name missing' },
      { status: 422 },
    );
  }

  await supabase
    .from('journey_sessions')
    .update({ profile_id: result.id })
    .eq('id', session.id);

  await applyPrimaryProfileLockIfNeeded(dataUserId, result.id);

  if (access.impersonation) {
    await logAccessAudit({
      actorUserId: access.actorUserId,
      effectiveUserId: access.impersonation.effectiveUserId,
      effectiveProfileId: access.impersonation.effectiveProfileId,
      action: 'profile.save_from_journey',
      resourceType: 'business_profile',
      resourceId: result.id,
    });
  }

  return Response.json({ profileId: result.id });
}
