// GET /api/profiles/:id — fetch single profile with insights
// PATCH /api/profiles/:id — update business profile fields

import { z } from 'zod';
import { getProfile, updateProfile } from '@/lib/profiles/business-profiles';
import {
  requireApiUser,
  fetchBusinessProfileRowById,
  canAccessProfileId,
  logAccessAudit,
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

  const profile = await getProfile(ownerId, id);
  if (!profile) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }

  return Response.json({ profile });
}

const PatchSchema = z.object({
  fields: z.record(z.string(), z.string()),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireApiUser();
  if (access instanceof Response) return access;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { fields } = parsed.data;

  if ('companyName' in fields) {
    return Response.json(
      { error: 'company_name is read-only' },
      { status: 400 },
    );
  }

  const row = await fetchBusinessProfileRowById(id);
  if (!row) {
    return Response.json({ error: 'Profile not found' }, { status: 404 });
  }
  const ownerId = row.user_id as string;
  if (!canAccessProfileId(access, id, ownerId)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const success = await updateProfile(ownerId, id, fields);

  if (!success) {
    return Response.json(
      { error: 'Profile not found or update failed' },
      { status: 404 },
    );
  }

  if (access.impersonation) {
    await logAccessAudit({
      actorUserId: access.actorUserId,
      effectiveUserId: access.impersonation.effectiveUserId,
      effectiveProfileId: access.impersonation.effectiveProfileId,
      action: 'profile.patch',
      resourceType: 'business_profile',
      resourceId: id,
    });
  }

  return Response.json({ ok: true });
}
