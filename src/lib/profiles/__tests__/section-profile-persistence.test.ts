import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';

import {
  buildCommittedSectionProfileInsights,
  persistProfileFromCommittedSection,
} from '../section-profile-persistence';

const userId = 'user_123';
const sessionId = '33333333-3333-4333-8333-333333333333';
const runId = saaslaunchResearchInput.runId;

function createFakeSupabase(): {
  supabase: SupabaseClient;
  from: ReturnType<typeof vi.fn>;
  sessionMaybeSingle: ReturnType<typeof vi.fn>;
  updateEq: ReturnType<typeof vi.fn>;
} {
  const sessionMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: sessionId,
      metadata: { companyName: 'Metadata Co', websiteUrl: 'https://metadata.example' },
      onboarding_data: { companyName: 'SaaSLaunch', monthlyAdBudget: '$25k' },
    },
    error: null,
  });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const selectQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: sessionMaybeSingle,
  };
  selectQuery.select.mockReturnValue(selectQuery);
  selectQuery.eq.mockReturnValue(selectQuery);
  const updateQuery = {
    update: vi.fn().mockReturnValue({ eq: updateEq }),
  };
  const from = vi.fn((table: string) => {
    if (table !== 'journey_sessions') {
      throw new Error(`Unexpected table ${table}`);
    }
    return {
      ...selectQuery,
      ...updateQuery,
    };
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    from,
    sessionMaybeSingle,
    updateEq,
  };
}

describe('section profile persistence', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('builds a stable v3 insight key without overwriting sibling sections', (): void => {
    const insights = buildCommittedSectionProfileInsights({
      sectionId: 'positioningMarketCategory',
      artifact: marketCategoryFixtureArtifact,
    });

    expect(insights).toEqual({
      positioningMarketCategory: {
        sectionTitle: marketCategoryFixtureArtifact.sectionTitle,
        verdict: marketCategoryFixtureArtifact.verdict,
        statusSummary: marketCategoryFixtureArtifact.statusSummary,
        confidence: marketCategoryFixtureArtifact.confidence,
        sourceCount: marketCategoryFixtureArtifact.sources.length,
      },
    });
  });

  it('upserts the business profile, links the run, and writes v3 section insights', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();
    const saveBusinessProfile = vi.fn().mockResolvedValue({ id: 'profile-123' });
    const saveProfileInsights = vi.fn().mockResolvedValue(true);

    await persistProfileFromCommittedSection(
      {
        supabase: fakeSupabase.supabase,
        userId,
        runId,
        researchInput: saaslaunchResearchInput,
        sectionId: 'positioningMarketCategory',
        artifact: marketCategoryFixtureArtifact,
      },
      {
        saveBusinessProfile,
        saveProfileInsights,
      },
    );

    expect(saveBusinessProfile).toHaveBeenCalledWith(
      userId,
      sessionId,
      expect.objectContaining({
        companyName: 'SaaSLaunch',
        websiteUrl: 'https://metadata.example',
        monthlyAdBudget: '$25k',
      }),
    );
    expect(fakeSupabase.from).toHaveBeenCalledWith('journey_sessions');
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('id', sessionId);
    expect(saveProfileInsights).toHaveBeenCalledWith(
      userId,
      'SaaSLaunch',
      expect.objectContaining({
        positioningMarketCategory: expect.objectContaining({
          verdict: marketCategoryFixtureArtifact.verdict,
        }),
      }),
    );
  });
});
