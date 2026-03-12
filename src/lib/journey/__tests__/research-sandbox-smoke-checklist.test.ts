import { describe, expect, it } from 'vitest';
import { buildJourneyResearchSandboxSmokeChecklist } from '../research-sandbox-smoke-checklist';

describe('buildJourneyResearchSandboxSmokeChecklist', () => {
  it('blocks downstream sections when prerequisites or backend readiness are missing', () => {
    const checklist = buildJourneyResearchSandboxSmokeChecklist({
      section: 'mediaPlan',
      missingPrerequisites: ['keywordIntel'],
      backendStatus: {
        workerUrlConfigured: true,
        workerReachable: false,
        workerHealth: null,
        capabilities: null,
        warnings: ['Worker check failed: connect ECONNREFUSED'],
      },
      selectedResult: null,
      selectedActivity: undefined,
    });

    expect(checklist.autoChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'dependencies',
          status: 'blocked',
          detail: expect.stringContaining('Keywords'),
        }),
        expect.objectContaining({
          key: 'backend',
          status: 'blocked',
          detail: expect.stringContaining('unreachable'),
        }),
        expect.objectContaining({
          key: 'persistence',
          status: 'pending',
        }),
      ]),
    );
    expect(checklist.manualChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Persisted JSON cues',
          detail: expect.stringContaining('channelPlan[]'),
        }),
        expect.objectContaining({
          title: 'Preview surface',
          detail: expect.stringContaining('inline research cards'),
        }),
      ]),
    );
  });

  it('marks completed sections as verified and exposes section-specific preview guidance', () => {
    const checklist = buildJourneyResearchSandboxSmokeChecklist({
      section: 'crossAnalysis',
      missingPrerequisites: [],
      backendStatus: {
        workerUrlConfigured: true,
        workerReachable: true,
        workerHealth: { status: 'ok' },
        capabilities: {
          webSearch: true,
          spyfu: true,
          firecrawl: true,
          googleAds: true,
          metaAds: true,
          ga4: true,
          charting: true,
        },
        warnings: [],
      },
      selectedActivity: {
        jobId: 'job-1',
        section: 'crossAnalysis',
        status: 'complete',
        tool: 'synthesizeResearch',
        startedAt: '2026-03-11T10:00:00.000Z',
        completedAt: '2026-03-11T10:02:00.000Z',
      },
      selectedResult: {
        status: 'complete',
        section: 'crossAnalysis',
        durationMs: 120000,
        data: {
          positioningStrategy: { recommendedAngle: 'Own revenue accountability, not channel vanity metrics.' },
          platformRecommendations: [{ platform: 'LinkedIn', budgetAllocation: '45% ($9,000)' }],
          nextSteps: ['Validate messaging with founder-led outbound'],
        },
      },
    });

    expect(checklist.autoChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'dependencies',
          status: 'ready',
        }),
        expect.objectContaining({
          key: 'backend',
          status: 'ready',
        }),
        expect.objectContaining({
          key: 'activity',
          status: 'verified',
          detail: expect.stringContaining('completed'),
        }),
        expect.objectContaining({
          key: 'persistence',
          status: 'verified',
          detail: expect.stringContaining('persisted'),
        }),
      ]),
    );
    expect(checklist.manualChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Preview surface',
          detail: expect.stringContaining('subsection reveal'),
        }),
        expect.objectContaining({
          title: 'Persisted JSON cues',
          detail: expect.stringContaining('positioningStrategy.recommendedAngle'),
        }),
      ]),
    );
  });
});
