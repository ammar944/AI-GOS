import { cookies } from 'next/headers';

export const IMPERSONATE_USER_COOKIE = 'aigos_imp_euid';
export const IMPERSONATE_PROFILE_COOKIE = 'aigos_imp_pid';

export interface ImpersonationPayload {
  effectiveUserId: string;
  effectiveProfileId: string;
}

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 8,
};

export async function readImpersonationFromCookies(): Promise<ImpersonationPayload | null> {
  const jar = await cookies();
  const effectiveUserId = jar.get(IMPERSONATE_USER_COOKIE)?.value;
  const effectiveProfileId = jar.get(IMPERSONATE_PROFILE_COOKIE)?.value;
  if (!effectiveUserId?.trim() || !effectiveProfileId?.trim()) return null;
  return { effectiveUserId, effectiveProfileId };
}

export async function writeImpersonationCookies(payload: ImpersonationPayload) {
  const jar = await cookies();
  jar.set(IMPERSONATE_USER_COOKIE, payload.effectiveUserId, COOKIE_BASE);
  jar.set(IMPERSONATE_PROFILE_COOKIE, payload.effectiveProfileId, COOKIE_BASE);
}

export async function clearImpersonationCookies() {
  const jar = await cookies();
  jar.delete(IMPERSONATE_USER_COOKIE);
  jar.delete(IMPERSONATE_PROFILE_COOKIE);
}
