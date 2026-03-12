import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JourneyResearchSandboxChecklist } from '../journey-research-sandbox-checklist';

describe('JourneyResearchSandboxChecklist', () => {
  it('renders auto signals and section-specific manual checks', () => {
    render(
      <JourneyResearchSandboxChecklist
        section="keywordIntel"
        missingPrerequisites={[]}
        backendStatus={{
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
        }}
        selectedActivity={{
          jobId: 'job-kw',
          section: 'keywordIntel',
          status: 'running',
          tool: 'researchKeywords',
          startedAt: '2026-03-11T10:00:00.000Z',
        }}
        selectedResult={{
          status: 'complete',
          section: 'keywordIntel',
          durationMs: 90000,
          data: {
            totalKeywordsFound: 124,
            competitorGapCount: 18,
            topOpportunities: [{ keyword: 'b2b attribution software', searchVolume: 1300 }],
          },
        }}
      />,
    );

    expect(screen.getByText('Smoke checklist')).toBeInTheDocument();
    expect(screen.getByText('Auto signals')).toBeInTheDocument();
    expect(screen.getByText('Manual pass')).toBeInTheDocument();
    expect(screen.getByText('Worker activity')).toBeInTheDocument();
    expect(screen.getByText(/topOpportunities\[\]/i)).toBeInTheDocument();
    expect(screen.getByText(/inline research cards/i)).toBeInTheDocument();
  });
});
