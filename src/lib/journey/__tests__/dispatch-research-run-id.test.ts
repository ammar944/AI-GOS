import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchJourneyResearchForUser } from '@/lib/journey/server/dispatch-research';
import { createAdminClient } from '@/lib/supabase/server';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/ai/tools/research/dispatch', () => ({
  dispatchResearchForUser: vi.fn(),
}));

describe('dispatchJourneyResearchForUser run scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an error without touching Supabase or worker dispatch when runId is missing', async () => {
    const result = await dispatchJourneyResearchForUser({
      userId: 'user-1',
      section: 'deepResearchProgram',
      runId: null,
      context: 'Research this active workspace section.',
    });

    expect(result).toEqual({
      status: 'error',
      section: 'deepResearchProgram',
      error: 'Missing required field: runId',
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(dispatchResearchForUser).not.toHaveBeenCalled();
  });

  it('treats blank runId strings as missing run scope', async () => {
    const result = await dispatchJourneyResearchForUser({
      userId: 'user-1',
      section: 'deepResearchProgram',
      runId: '   ',
      context: 'Research this active workspace section.',
    });

    expect(result).toMatchObject({
      status: 'error',
      section: 'deepResearchProgram',
      error: 'Missing required field: runId',
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(dispatchResearchForUser).not.toHaveBeenCalled();
  });
});
