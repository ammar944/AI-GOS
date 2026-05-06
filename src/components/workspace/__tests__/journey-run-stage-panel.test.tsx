import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspacePage } from '../workspace-page';
import type { JourneyRunView } from '@/lib/journey/run-view';
import type { SectionKey, SectionPhase } from '@/lib/workspace/types';

const sectionStates: Record<SectionKey, SectionPhase> = {
  industryMarket: 'review',
  icpValidation: 'researching',
  competitors: 'queued',
  offerAnalysis: 'queued',
  keywordIntel: 'queued',
  crossAnalysis: 'queued',
  mediaPlan: 'queued',
  scripts: 'queued',
};

const workspaceMocks = vi.hoisted(() => ({
  setSectionPhase: vi.fn(),
  setCards: vi.fn(),
  updateCard: vi.fn(),
  navigateToSection: vi.fn(),
}));

vi.mock('@/lib/workspace/use-workspace', () => ({
  useWorkspace: () => ({
    state: {
      sessionId: 'run-1',
      phase: 'workspace',
      currentSection: 'industryMarket',
      sectionStates,
      sectionErrors: {},
      cards: {},
    },
    setSectionPhase: workspaceMocks.setSectionPhase,
    setCards: workspaceMocks.setCards,
    updateCard: workspaceMocks.updateCard,
    navigateToSection: workspaceMocks.navigateToSection,
  }),
}));

vi.mock('@/lib/journey/research-realtime', () => ({
  useResearchRealtime: vi.fn(),
}));

vi.mock('@/lib/journey/research-job-activity', () => ({
  useResearchJobActivity: () => ({}),
}));

vi.mock('@/lib/journey/dispatch-client', () => ({
  dispatchResearchSection: vi.fn(),
}));

vi.mock('@/lib/storage/local-storage', () => ({
  getJourneySession: () => null,
}));

vi.mock('@/hooks/use-session-share', () => ({
  useSessionShare: () => ({
    isSharing: false,
    shareUrl: null,
    copied: false,
    error: null,
    handleShare: vi.fn(),
    handleCopyLink: vi.fn(),
  }),
}));

vi.mock('../section-tabs', () => ({
  SectionTabs: () => <div data-testid="section-tabs" />,
}));

vi.mock('../artifact-canvas', () => ({
  ArtifactCanvas: () => <div data-testid="artifact-canvas" />,
}));

vi.mock('../bottom-sheet', () => ({
  BottomSheet: () => null,
}));

vi.mock('../scripts-phase', () => ({
  ScriptsPhaseContent: () => <div data-testid="scripts-phase" />,
}));

vi.mock('../asset-collection-phase', () => ({
  AssetCollectionPhase: () => <div data-testid="asset-collection-phase" />,
}));

vi.mock('@/components/chat/unified-chat', () => ({
  UnifiedChat: () => <div data-testid="unified-chat" />,
}));

function makeRunView(): JourneyRunView {
  return {
    run: {
      sessionId: 'session-1',
      profileId: null,
      runId: 'run-1',
      companyName: 'Acme AI',
      createdAt: '2026-05-07T00:00:00.000Z',
      updatedAt: '2026-05-07T00:05:30.000Z',
      raw: null,
    },
    status: 'failed',
    sections: [
      {
        id: 'industryMarket',
        label: 'Market Overview',
        order: 0,
        phase: 'review',
        status: 'complete',
        result: {
          status: 'complete',
          section: 'industryMarket',
          durationMs: 1200,
          data: {
            verdict: 'Synthesized market overview.',
          },
        },
        activity: null,
        cards: [
          {
            id: 'industryMarket-prose-card-research-verdict',
            sectionKey: 'industryMarket',
            cardType: 'prose-card',
            label: 'Research Verdict',
            content: {
              text: 'Synthesized market overview.',
            },
            status: 'draft',
            versions: [],
          },
        ],
        latestEvent: {
          id: 'update-market',
          section: 'industryMarket',
          type: 'analysis',
          message: 'Synthesized market overview.',
          status: 'complete',
          createdAt: '2026-05-07T00:01:00.000Z',
        },
        events: [],
        blocker: null,
        pendingDependencyReason: null,
      },
      {
        id: 'icpValidation',
        label: 'ICP Validation',
        order: 1,
        phase: 'researching',
        status: 'running',
        result: null,
        activity: {
          jobId: 'job-icp',
          section: 'icpValidation',
          status: 'running',
          tool: 'researchICP',
          startedAt: '2026-05-07T00:02:00.000Z',
          lastHeartbeat: '2026-05-07T00:05:30.000Z',
          updates: [],
        },
        cards: [],
        latestEvent: {
          id: 'update-icp',
          section: 'icpValidation',
          type: 'tool',
          message: 'Validating ICP reachability.',
          status: 'running',
          createdAt: '2026-05-07T00:05:00.000Z',
        },
        events: [],
        blocker: null,
        pendingDependencyReason: null,
      },
      {
        id: 'competitors',
        label: 'Competitor Intel',
        order: 2,
        phase: 'queued',
        status: 'queued',
        result: null,
        activity: null,
        cards: [],
        latestEvent: null,
        events: [],
        blocker: null,
        pendingDependencyReason: 'Waiting for ICP Validation to finish.',
      },
      {
        id: 'offerAnalysis',
        label: 'Offer Analysis',
        order: 3,
        phase: 'error',
        status: 'error',
        result: null,
        activity: null,
        cards: [],
        latestEvent: null,
        events: [],
        blocker: 'Offer Analysis timed out after 10 minutes.',
        pendingDependencyReason: null,
      },
      {
        id: 'keywordIntel',
        label: 'Keywords',
        order: 4,
        phase: 'queued',
        status: 'queued',
        result: null,
        activity: null,
        cards: [],
        latestEvent: null,
        events: [],
        blocker: null,
        pendingDependencyReason: 'Waiting for Offer Analysis to recover from an error.',
      },
    ],
    latestEventBySection: {},
    eventsBySection: {},
    artifactsBySection: {},
    artifactsByTool: {},
    messages: [],
    readiness: {
      ready: false,
      missingSections: ['competitors', 'offerAnalysis', 'keywordIntel', 'crossAnalysis', 'mediaPlan'],
      completedSectionKeys: ['industryMarket'],
    },
  };
}

describe('WorkspacePage Journey run stage panel', () => {
  it('renders ordered persisted stages with event, elapsed, dependency, and blocker context', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: null,
        researchResults: null,
        view: makeRunView(),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <WorkspacePage
        userId="user-1"
        activeRunId="run-1"
        companyName="Acme AI"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('journey-run-stage-panel')).toBeInTheDocument();
    });

    const panel = screen.getByTestId('journey-run-stage-panel');
    expect(panel).toHaveTextContent('Run map');
    expect(panel).toHaveTextContent('Market Overview');
    expect(panel).toHaveTextContent('ICP Validation');
    expect(panel).toHaveTextContent('Competitor Intel');
    expect(panel).toHaveTextContent('Validating ICP reachability.');
    expect(panel).toHaveTextContent('3m 30s');
    expect(panel).toHaveTextContent('Waiting for ICP Validation to finish.');
    expect(panel).toHaveTextContent('Offer Analysis timed out after 10 minutes.');
    expect(panel).not.toHaveTextContent('"status"');

    expect(screen.getByTestId('journey-run-blocker-panel')).toHaveTextContent(
      'Run needs attention',
    );
    expect(screen.getByTestId('journey-run-event-log')).toHaveTextContent(
      'Event log',
    );
    expect(screen.getByTestId('journey-run-artifact-visibility-panel')).toHaveTextContent(
      'Artifact visibility',
    );
    expect(screen.getByTestId('journey-run-artifact-visibility-panel')).toHaveTextContent(
      '1 visible card',
    );

    vi.unstubAllGlobals();
  });
});
