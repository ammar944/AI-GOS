import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buyerICPFixtureArtifact } from '@/lib/lab-engine/fixtures/buyer-icp-artifact';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { offerDiagnosticFixtureArtifact } from '@/lib/lab-engine/fixtures/offer-diagnostic-artifact';
import { positioningSynthesisFixtureArtifact } from '@/lib/lab-engine/fixtures/positioning-synthesis-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';

import {
  buildCommittedSectionProfileInsights,
  persistAuditProfile,
} from '../section-profile-persistence';

const userId = 'user_123';
const sessionId = '33333333-3333-4333-8333-333333333333';
const runId = saaslaunchResearchInput.runId;
const parentAuditRunId = '44444444-4444-4444-8444-444444444444';

interface FakeResearchArtifactSectionRow {
  zone: string;
  title: string;
  markdown: string;
  data: unknown;
  status: string;
  updated_at: string;
}

function createSectionRow(input: {
  zone: string;
  data: unknown;
  status?: string;
}): FakeResearchArtifactSectionRow {
  return {
    zone: input.zone,
    title: input.zone,
    markdown: `# ${input.zone}`,
    data: input.data,
    status: input.status ?? 'complete',
    updated_at: '2026-06-03T05:00:00.000Z',
  };
}

function createFakeSupabase(sectionRows: FakeResearchArtifactSectionRow[] = []): {
  supabase: SupabaseClient;
  from: ReturnType<typeof vi.fn>;
  sessionMaybeSingle: ReturnType<typeof vi.fn>;
  sectionEq: ReturnType<typeof vi.fn>;
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
  const sectionEq = vi.fn().mockResolvedValue({
    data: sectionRows,
    error: null,
  });
  const sectionQuery = {
    select: vi.fn(),
    eq: sectionEq,
  };
  sectionQuery.select.mockReturnValue(sectionQuery);
  const updateQuery = {
    update: vi.fn().mockReturnValue({ eq: updateEq }),
  };
  const from = vi.fn((table: string) => {
    if (table === 'journey_sessions') {
      return {
        ...selectQuery,
        ...updateQuery,
      };
    }

    if (table === 'research_artifact_sections') {
      return sectionQuery;
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    supabase: { from } as unknown as SupabaseClient,
    from,
    sessionMaybeSingle,
    sectionEq,
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

  it('persists an audit profile with one merged insight write for completed sections', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase([
      createSectionRow({
        zone: 'positioningMarketCategory',
        data: marketCategoryFixtureArtifact,
      }),
      createSectionRow({
        zone: 'positioningBuyerICP',
        data: buyerICPFixtureArtifact,
      }),
      createSectionRow({
        zone: 'positioningOfferDiagnostic',
        data: offerDiagnosticFixtureArtifact,
      }),
      createSectionRow({
        zone: 'positioningSynthesis',
        data: positioningSynthesisFixtureArtifact,
      }),
      createSectionRow({
        zone: 'positioningVoiceOfCustomer',
        data: marketCategoryFixtureArtifact,
        status: 'running',
      }),
    ]);
    const saveBusinessProfile = vi.fn().mockResolvedValue({ id: 'profile-123' });
    const saveProfileInsights = vi.fn().mockResolvedValue(true);

    await persistAuditProfile(
      {
        supabase: fakeSupabase.supabase,
        userId,
        runId,
        researchInput: saaslaunchResearchInput,
        parentAuditRunId,
      },
      {
        saveBusinessProfile,
        saveProfileInsights,
      },
    );

    expect(saveBusinessProfile).toHaveBeenCalledTimes(1);
    expect(saveBusinessProfile).toHaveBeenCalledWith(
      userId,
      sessionId,
      expect.objectContaining({
        companyName: 'SaaSLaunch',
        websiteUrl: 'https://metadata.example',
        monthlyAdBudget: '$25k',
      }),
    );
    expect(fakeSupabase.sectionEq).toHaveBeenCalledWith(
      'artifact_id',
      parentAuditRunId,
    );
    expect(fakeSupabase.updateEq).toHaveBeenCalledTimes(1);
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('id', sessionId);
    expect(saveProfileInsights).toHaveBeenCalledTimes(1);
    expect(saveProfileInsights).toHaveBeenCalledWith(
      userId,
      'SaaSLaunch',
      expect.objectContaining({
        positioningMarketCategory: expect.objectContaining({
          verdict: marketCategoryFixtureArtifact.verdict,
        }),
        positioningBuyerICP: expect.objectContaining({
          verdict: buyerICPFixtureArtifact.verdict,
        }),
        positioningOfferDiagnostic: expect.objectContaining({
          verdict: offerDiagnosticFixtureArtifact.verdict,
        }),
        positioningSynthesis: expect.objectContaining({
          verdict: positioningSynthesisFixtureArtifact.verdict,
        }),
        offerScore: expect.objectContaining({
          verdict: offerDiagnosticFixtureArtifact.verdict,
          body: offerDiagnosticFixtureArtifact.body,
        }),
        positioningStrategy: expect.objectContaining({
          verdict: positioningSynthesisFixtureArtifact.verdict,
          body: positioningSynthesisFixtureArtifact.body,
        }),
      }),
    );
  });
});
