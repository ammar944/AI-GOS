import { describe, it, expect } from 'vitest';
import {
  canAccessProfileId,
  isClientJourneyLocked,
  CLIENT_JOURNEY_LOCKED_ERROR,
  type AuthorizedAppUser,
} from './app-access-guards';

function baseAccess(
  overrides: Partial<AuthorizedAppUser> = {},
): AuthorizedAppUser {
  return {
    actorUserId: 'actor_1',
    role: 'internal',
    accountStatus: 'active',
    effectiveUserId: 'actor_1',
    effectiveProfileId: null,
    primaryProfileId: null,
    clientLockedAt: null,
    impersonation: null,
    ...overrides,
  };
}

describe('isClientJourneyLocked', () => {
  it('is false for internal', () => {
    expect(isClientJourneyLocked(baseAccess({ role: 'internal' }))).toBe(false);
  });

  it('is true for locked client', () => {
    expect(
      isClientJourneyLocked(
        baseAccess({
          role: 'client',
          primaryProfileId: 'p1',
          clientLockedAt: new Date().toISOString(),
        }),
      ),
    ).toBe(true);
  });

  it('is false for client without lock timestamp', () => {
    expect(
      isClientJourneyLocked(
        baseAccess({ role: 'client', primaryProfileId: 'p1', clientLockedAt: null }),
      ),
    ).toBe(false);
  });
});

describe('canAccessProfileId', () => {
  it('allows client only for primary when set', () => {
    const a = baseAccess({
      role: 'client',
      primaryProfileId: 'p1',
      effectiveUserId: 'actor_1',
    });
    expect(canAccessProfileId(a, 'p1', 'actor_1')).toBe(true);
    expect(canAccessProfileId(a, 'p2', 'actor_1')).toBe(false);
  });

  it('allows internal for any profile', () => {
    const a = baseAccess({ role: 'internal' });
    expect(canAccessProfileId(a, 'px', 'someone_else')).toBe(true);
  });

  it('scopes impersonation to the target profile', () => {
    const a = baseAccess({
      role: 'internal',
      effectiveUserId: 'client_1',
      effectiveProfileId: 'p9',
      impersonation: {
        effectiveUserId: 'client_1',
        effectiveProfileId: 'p9',
      },
    });
    expect(canAccessProfileId(a, 'p9', 'client_1')).toBe(true);
    expect(canAccessProfileId(a, 'p8', 'client_1')).toBe(false);
  });
});

describe('CLIENT_JOURNEY_LOCKED_ERROR', () => {
  it('matches API contract string', () => {
    expect(CLIENT_JOURNEY_LOCKED_ERROR).toContain('Client accounts');
  });
});
