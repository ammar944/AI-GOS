// GET /api/profiles/:id/sessions — fetch all research sessions linked to a profile

import { getProfileSessions } from '@/lib/profiles/business-profiles';
import {
  requireApiUser,
  fetchBusinessProfileRowById,
  canAccessProfileId,
} from '@/lib/auth/app-access';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireApiUser();
  if (access instanceof Response) return access;

  const { id } = await params;
  const row = await fetchBusinessProfileRowById(id);
  if (!row) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }
  const ownerId = row.user_id as string;
  if (!canAccessProfileId(access, id, ownerId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sessions = await getProfileSessions(ownerId, id);

  return Response.json({ sessions });
}
