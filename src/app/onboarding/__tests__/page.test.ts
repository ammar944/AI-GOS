import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createClient: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: mocks.auth,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import OnboardingPage from '../page';

function createProfileQuery(onboardingCompleted: boolean): {
  eq: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
} {
  const query = {
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(async () => ({
      data: { onboarding_completed: onboardingCompleted },
    })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe('OnboardingPage', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('redirects incomplete users to research-v3', async (): Promise<void> => {
    const profileQuery = createProfileQuery(false);
    mocks.auth.mockResolvedValue({ userId: 'user_123' });
    mocks.createClient.mockResolvedValue({
      from: vi.fn(() => profileQuery),
    });

    await expect(OnboardingPage()).rejects.toThrow(
      'NEXT_REDIRECT:/research-v3',
    );
  });
});
