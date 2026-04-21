import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import {
  readImpersonationFromCookies,
  type ImpersonationPayload,
} from '@/lib/auth/impersonation';
import { mapRow, type BusinessProfile } from '@/lib/profiles/business-profiles';
import {
  CLIENT_JOURNEY_LOCKED_ERROR,
  type AppRole,
  type AccountStatus,
  type AuthorizedAppUser,
  isClientJourneyLocked,
} from '@/lib/auth/app-access-guards';

export {
  CLIENT_JOURNEY_LOCKED_ERROR,
  type AppRole,
  type AccountStatus,
  type AuthorizedAppUser,
  getJourneyDataUserId,
  isClientJourneyLocked,
  requireAdmin,
  requireInternalOrAdmin,
  canAccessProfileId,
} from '@/lib/auth/app-access-guards';

export interface UserProfileAccessRow {
  id: string;
  email: string | null;
  app_role: AppRole | null;
  account_status: AccountStatus | null;
  primary_profile_id: string | null;
  client_locked_at: string | null;
  role_assigned_at: string | null;
  role_assigned_by: string | null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== 'string') return null;
  const t = email.trim().toLowerCase();
  return t.length ? t : null;
}

function bootstrapAdminEmails(): Set<string> {
  const raw = process.env.APP_BOOTSTRAP_ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => normalizeEmail(s))
      .filter((e): e is string => Boolean(e)),
  );
}

/** Comma-separated emails that always resolve to internal + active (team), like bootstrap admins. */
function bootstrapInternalEmails(): Set<string> {
  const raw = process.env.APP_BOOTSTRAP_INTERNAL_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => normalizeEmail(s))
      .filter((e): e is string => Boolean(e)),
  );
}

function isAppRole(v: string | null | undefined): v is AppRole {
  return v === 'admin' || v === 'internal' || v === 'client';
}

function isAccountStatus(v: string | null | undefined): v is AccountStatus {
  return v === 'pending' || v === 'active' || v === 'disabled';
}

export async function fetchUserProfileRow(
  userId: string,
): Promise<UserProfileAccessRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select(
      'id, email, app_role, account_status, primary_profile_id, client_locked_at, role_assigned_at, role_assigned_by',
    )
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserProfileAccessRow;
}

/**
 * Sync allowlist + bootstrap rules into user_profiles on each resolution.
 */
export async function syncAccountFromAllowlist(
  clerkUserId: string,
  emailNorm: string | null,
): Promise<UserProfileAccessRow | null> {
  const supabase = createAdminClient();
  const bootstrapAdmins = bootstrapAdminEmails();
  const bootstrapInternal = bootstrapInternalEmails();

  if (emailNorm && bootstrapAdmins.has(emailNorm)) {
    const now = new Date().toISOString();
    await supabase
      .from('user_profiles')
      .update({
        app_role: 'admin',
        account_status: 'active',
        role_assigned_at: now,
        role_assigned_by: 'bootstrap:APP_BOOTSTRAP_ADMIN_EMAILS',
        updated_at: now,
      })
      .eq('id', clerkUserId);
    return fetchUserProfileRow(clerkUserId);
  }

  if (emailNorm && bootstrapInternal.has(emailNorm)) {
    const now = new Date().toISOString();
    await supabase
      .from('user_profiles')
      .update({
        app_role: 'internal',
        account_status: 'active',
        role_assigned_at: now,
        role_assigned_by: 'bootstrap:APP_BOOTSTRAP_INTERNAL_EMAILS',
        updated_at: now,
      })
      .eq('id', clerkUserId);
    return fetchUserProfileRow(clerkUserId);
  }

  if (!emailNorm) {
    return fetchUserProfileRow(clerkUserId);
  }

  const { data: entry } = await supabase
    .from('client_allowlist')
    .select(
      'id, email, intended_role, status, claimed_user_id, claimed_at',
    )
    .eq('email', emailNorm)
    .maybeSingle();

  const now = new Date().toISOString();

  if (!entry) {
    const { data: prior } = await supabase
      .from('user_profiles')
      .select('app_role')
      .eq('id', clerkUserId)
      .maybeSingle();
    const pr = prior?.app_role as string | null;
    if (pr === 'admin' || pr === 'internal') {
      return fetchUserProfileRow(clerkUserId);
    }
    await supabase
      .from('user_profiles')
      .update({
        account_status: 'pending',
        updated_at: now,
      })
      .eq('id', clerkUserId);
    return fetchUserProfileRow(clerkUserId);
  }

  const st = entry.status as string;
  const intended = entry.intended_role as string;

  if (st === 'revoked') {
    await supabase
      .from('user_profiles')
      .update({
        account_status: 'disabled',
        updated_at: now,
      })
      .eq('id', clerkUserId);
    return fetchUserProfileRow(clerkUserId);
  }

  if (st === 'pending') {
    await supabase
      .from('user_profiles')
      .update({
        account_status: 'pending',
        updated_at: now,
      })
      .eq('id', clerkUserId);
    return fetchUserProfileRow(clerkUserId);
  }

  if (st === 'approved') {
    const roleOk = isAppRole(intended) ? intended : 'client';
    const patch: Record<string, unknown> = {
      app_role: roleOk,
      account_status: 'active',
      role_assigned_at: now,
      role_assigned_by: `allowlist:${entry.id}`,
      updated_at: now,
    };

    await supabase.from('user_profiles').update(patch).eq('id', clerkUserId);

    const claimPatch: Record<string, unknown> = { updated_at: now };
    if (!entry.claimed_user_id) {
      claimPatch.claimed_user_id = clerkUserId;
      claimPatch.claimed_at = now;
    }
    await supabase
      .from('client_allowlist')
      .update(claimPatch)
      .eq('id', entry.id);

    return fetchUserProfileRow(clerkUserId);
  }

  return fetchUserProfileRow(clerkUserId);
}

async function validateImpersonation(
  actorUserId: string,
  actorRole: AppRole,
  payload: ImpersonationPayload,
): Promise<boolean> {
  if (actorRole !== 'admin' && actorRole !== 'internal') return false;

  const supabase = createAdminClient();
  const { data: profile, error } = await supabase
    .from('business_profiles')
    .select('id, user_id')
    .eq('id', payload.effectiveProfileId)
    .maybeSingle();

  if (error || !profile) return false;
  if (profile.user_id !== payload.effectiveUserId) return false;

  const { data: target } = await supabase
    .from('user_profiles')
    .select('app_role')
    .eq('id', payload.effectiveUserId)
    .maybeSingle();

  if ((target?.app_role as string | undefined) !== 'client') return false;
  return true;
}

/**
 * Resolve the signed-in actor, sync allowlist state, and attach validated impersonation.
 */
export async function resolveAuthorizedAppUser(): Promise<AuthorizedAppUser | null> {
  const { userId: actorUserId } = await auth();
  if (!actorUserId) return null;

  const clerk = await currentUser();
  const emailNorm = normalizeEmail(clerk?.primaryEmailAddress?.emailAddress);

  let row = await fetchUserProfileRow(actorUserId);
  row = await syncAccountFromAllowlist(actorUserId, emailNorm);

  if (!row) return null;

  let role: AppRole =
    row.app_role && isAppRole(row.app_role) ? row.app_role : 'internal';
  let accountStatus: AccountStatus =
    row.account_status && isAccountStatus(row.account_status)
      ? row.account_status
      : 'active';

  if (row.app_role === null && row.account_status === null) {
    role = 'internal';
    accountStatus = 'active';
  }

  const rawImpersonation = await readImpersonationFromCookies();
  let impersonation: ImpersonationPayload | null = null;

  if (rawImpersonation) {
    const ok = await validateImpersonation(actorUserId, role, rawImpersonation);
    if (ok) impersonation = rawImpersonation;
  }

  const effectiveUserId = impersonation?.effectiveUserId ?? actorUserId;
  const effectiveProfileId = impersonation?.effectiveProfileId ?? null;

  return {
    actorUserId,
    role,
    accountStatus,
    effectiveUserId,
    effectiveProfileId,
    primaryProfileId: row.primary_profile_id,
    clientLockedAt: row.client_locked_at,
    impersonation,
  };
}

export function requireJourneyCreationAllowed(access: AuthorizedAppUser): void {
  if (!isClientJourneyLocked(access)) return;
  throw new JourneyNotAllowedError(CLIENT_JOURNEY_LOCKED_ERROR);
}

export class JourneyNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JourneyNotAllowedError';
  }
}

export async function applyPrimaryProfileLockIfNeeded(
  clientClerkUserId: string,
  profileId: string,
) {
  const supabase = createAdminClient();
  const { data: prof } = await supabase
    .from('user_profiles')
    .select('app_role, primary_profile_id')
    .eq('id', clientClerkUserId)
    .maybeSingle();
  if ((prof?.app_role as string | undefined) !== 'client') return;
  if (prof?.primary_profile_id) return;
  const now = new Date().toISOString();
  await supabase
    .from('user_profiles')
    .update({
      primary_profile_id: profileId,
      client_locked_at: now,
      updated_at: now,
    })
    .eq('id', clientClerkUserId);
}

export async function logAccessAudit(input: {
  actorUserId: string;
  effectiveUserId: string | null;
  effectiveProfileId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from('access_audit_logs').insert({
      actor_user_id: input.actorUserId,
      effective_user_id: input.effectiveUserId,
      effective_profile_id: input.effectiveProfileId,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId,
    });
  } catch (e) {
    console.warn('[access_audit_logs]', e);
  }
}

/** Server pages: block pending/disabled before rendering app surfaces. */
export async function requireActiveAccount(): Promise<AuthorizedAppUser> {
  const access = await resolveAuthorizedAppUser();
  if (!access) redirect('/sign-in');
  if (access.accountStatus === 'pending') redirect('/access-pending');
  if (access.accountStatus === 'disabled') redirect('/access-disabled');
  return access;
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function requireApiUser(): Promise<
  AuthorizedAppUser | Response
> {
  const access = await resolveAuthorizedAppUser();
  if (!access) return jsonError('Unauthorized', 401);
  if (access.accountStatus === 'pending') {
    return jsonError('Access pending approval', 403);
  }
  if (access.accountStatus === 'disabled') {
    return jsonError('Account disabled', 403);
  }
  return access;
}

export interface BusinessProfileRow {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

export async function fetchBusinessProfileRowById(
  profileId: string,
): Promise<BusinessProfileRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BusinessProfileRow;
}

export async function listProfilesForApiUser(
  access: AuthorizedAppUser,
): Promise<BusinessProfile[]> {
  const supabase = createAdminClient();

  if (access.role === 'client') {
    if (access.primaryProfileId) {
      const { data } = await supabase
        .from('business_profiles')
        .select('*')
        .eq('id', access.primaryProfileId)
        .eq('user_id', access.actorUserId)
        .maybeSingle();
      return data ? [mapRow(data as Record<string, unknown>)] : [];
    }
    const { data } = await supabase
      .from('business_profiles')
      .select('*')
      .eq('user_id', access.actorUserId)
      .order('updated_at', { ascending: false });
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  }

  const { data, error } = await supabase
    .from('business_profiles')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[listProfilesForApiUser]', error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}
