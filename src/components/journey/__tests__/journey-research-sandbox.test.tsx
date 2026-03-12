import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JourneyResearchSandbox } from '../journey-research-sandbox';

vi.mock('@/components/journey/artifact-panel', () => ({
  ArtifactPanel: () => <div data-testid="artifact-panel" />,
}));

vi.mock('@/components/journey/journey-keyword-intel-detail', () => ({
  JourneyKeywordIntelDetail: () => <div data-testid="keyword-detail" />,
  getJourneyKeywordIntelDetailData: () => null,
}));

vi.mock('@/components/journey/research-inline-card', () => ({
  ResearchInlineCard: () => <div data-testid="research-inline-card" />,
}));

vi.mock('@/components/journey/keyed-research-subsection-reveal', () => ({
  KeyedResearchSubsectionReveal: () => <div data-testid="keyed-subsection-reveal" />,
}));

vi.mock('@/components/journey/journey-research-sandbox-checklist', () => ({
  JourneyResearchSandboxChecklist: () => <div data-testid="sandbox-checklist" />,
}));

vi.mock('@/lib/journey/research-realtime', () => ({
  useResearchRealtime: vi.fn(),
}));

vi.mock('@/lib/journey/research-job-activity', async () => {
  const actual = await vi.importActual<typeof import('@/lib/journey/research-job-activity')>(
    '@/lib/journey/research-job-activity',
  );

  return {
    ...actual,
    useResearchJobActivity: () => ({}),
  };
});

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('JourneyResearchSandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        section: 'industryMarket',
        sandboxKey: 'default',
        sandboxUserId: 'user-live::journey-research-sandbox::default',
        liveSession: {
          exists: true,
          id: 'live-session',
          userId: 'user-live',
          updatedAt: '2026-03-11T10:00:00.000Z',
          metadata: {
            companyName: { value: 'FlowMetrics' },
            websiteUrl: 'https://flowmetrics.io',
            businessModel: { value: 'B2B SaaS' },
            productDescription: { value: 'Revenue attribution software' },
          },
          researchResults: {},
          jobStatus: {},
          contextDrafts: {},
        },
        sandboxSession: {
          exists: true,
          id: 'sandbox-session',
          userId: 'user-live::journey-research-sandbox::default',
          updatedAt: '2026-03-11T10:00:00.000Z',
          metadata: {
            companyName: { value: 'FlowMetrics' },
            websiteUrl: 'https://flowmetrics.io',
            businessModel: { value: 'B2B SaaS' },
            productDescription: { value: 'Revenue attribution software' },
          },
          researchResults: {},
          jobStatus: {},
          contextDrafts: {},
        },
        backendStatus: {
          workerUrlConfigured: true,
          workerReachable: true,
          workerHealth: { status: 'ok' },
          capabilities: {
            webSearch: true,
            spyfu: true,
            firecrawl: true,
            googleAds: false,
            metaAds: false,
            ga4: false,
            charting: true,
          },
          warnings: [],
        },
        suggestedContext: {
          live: 'Journey research sandbox context\nSection: Market Overview',
          sandbox: 'Journey research sandbox context\nSection: Market Overview',
        },
      }),
    });
  });

  it('renders the unified run-all control on the sandbox page', async () => {
    render(<JourneyResearchSandbox liveUserId="user-live" />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /run first six sections/i }),
      ).toBeInTheDocument();
    });
  });
});
