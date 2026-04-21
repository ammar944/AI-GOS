import type { ImpersonationPayload } from '@/lib/auth/impersonation';

export type AppRole = 'admin' | 'internal' | 'client';
export type AccountStatus = 'pending' | 'active' | 'disabled';

export const CLIENT_JOURNEY_LOCKED_ERROR =
  'Client accounts can refine an existing workspace but cannot start a new journey.';

export interface AuthorizedAppUser {
  actorUserId: string;
  role: AppRole;
  accountStatus: AccountStatus;
  effectiveUserId: string;
  effectiveProfileId: string | null;
  primaryProfileId: string | null;
  clientLockedAt: string | null;
  impersonation: ImpersonationPayload | null;
}

export function getJourneyDataUserId(access: AuthorizedAppUser): string {
  return access.effectiveUserId;
}

export function isClientJourneyLocked(access: AuthorizedAppUser): boolean {
  return (
    access.role === 'client' &&
    Boolean(access.primaryProfileId && access.clientLockedAt)
  );
}

export function requireAdmin(access: AuthorizedAppUser): boolean {
  return access.role === 'admin';
}

export function requireInternalOrAdmin(access: AuthorizedAppUser): boolean {
  return access.role === 'admin' || access.role === 'internal';
}

export function canAccessProfileId(
  access: AuthorizedAppUser,
  profileId: string,
  profileOwnerUserId: string,
): boolean {
  if (access.role === 'admin' || access.role === 'internal') {
    if (access.impersonation) {
      return (
        access.impersonation.effectiveProfileId === profileId &&
        access.impersonation.effectiveUserId === profileOwnerUserId
      );
    }
    return true;
  }

  if (access.role !== 'client') return false;
  if (profileOwnerUserId !== access.actorUserId) return false;
  if (access.primaryProfileId) {
    return profileId === access.primaryProfileId;
  }
  return true;
}
