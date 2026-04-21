import {
  resolveAuthorizedAppUser,
  isClientJourneyLocked,
} from '@/lib/auth/app-access';

/** Lightweight session info for client-side navigation (no secrets). */
export async function GET() {
  const access = await resolveAuthorizedAppUser();
  if (!access) {
    return Response.json({ authenticated: false as const }, { status: 401 });
  }

  return Response.json({
    authenticated: true as const,
    role: access.role,
    accountStatus: access.accountStatus,
    primaryProfileId: access.primaryProfileId,
    clientLocked: isClientJourneyLocked(access),
    impersonation: Boolean(access.impersonation),
  });
}
