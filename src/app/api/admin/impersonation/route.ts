import { z } from 'zod';
import {
  requireApiUser,
  jsonError,
  requireInternalOrAdmin,
  fetchBusinessProfileRowById,
} from '@/lib/auth/app-access';
import { createAdminClient } from '@/lib/supabase/server';
import {
  writeImpersonationCookies,
  clearImpersonationCookies,
} from '@/lib/auth/impersonation';

export async function GET() {
  const access = await requireApiUser();
  if (access instanceof Response) return access;
  if (!access.impersonation) {
    return Response.json({ active: false as const });
  }
  const profile = await fetchBusinessProfileRowById(
    access.impersonation.effectiveProfileId,
  );
  const companyName =
    (profile?.company_name as string | undefined) ?? 'Client workspace';
  return Response.json({
    active: true as const,
    effectiveProfileId: access.impersonation.effectiveProfileId,
    companyName,
  });
}

const PostSchema = z.object({
  profileId: z.string().uuid(),
});

export async function POST(req: Request) {
  const access = await requireApiUser();
  if (access instanceof Response) return access;
  if (!requireInternalOrAdmin(access)) return jsonError('Forbidden', 403);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid payload', 400);

  const profile = await fetchBusinessProfileRowById(parsed.data.profileId);
  if (!profile) return jsonError('Profile not found', 404);

  const supabase = createAdminClient();
  const { data: targetUser } = await supabase
    .from('user_profiles')
    .select('app_role')
    .eq('id', profile.user_id as string)
    .maybeSingle();

  if ((targetUser?.app_role as string | undefined) !== 'client') {
    return jsonError('Impersonation is limited to client workspaces', 400);
  }

  await writeImpersonationCookies({
    effectiveUserId: profile.user_id as string,
    effectiveProfileId: profile.id as string,
  });

  return Response.json({
    ok: true,
    effectiveUserId: profile.user_id,
    effectiveProfileId: profile.id,
  });
}

export async function DELETE() {
  const access = await requireApiUser();
  if (access instanceof Response) return access;
  if (!requireInternalOrAdmin(access)) return jsonError('Forbidden', 403);

  await clearImpersonationCookies();
  return Response.json({ ok: true });
}
