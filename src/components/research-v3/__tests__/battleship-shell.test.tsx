import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import { PAID_MEDIA_PLAN_SECTION_ID } from '@/lib/ai/prompts/positioning-skills';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';

const mocks = vi.hoisted(() => ({
  useAuditState: vi.fn(),
}));

const EMPTY_AUDIT_STATE: AuditStateResponse = {
  parent_audit_run_id: null,
  parent_status: null,
  children_complete: 0,
  children_total: 0,
  workerStates: [],
  sectionsByZone: {},
  eventsByZone: {},
};

vi.mock('@/lib/research-v2/use-audit-state', () => ({
  useAuditState: mocks.useAuditState,
}));

const { BattleshipShell } = await import('../battleship-shell');

describe('<BattleshipShell>', () => {
  afterEach(() => cleanup());
  beforeEach((): void => {
    mocks.useAuditState.mockReturnValue(EMPTY_AUDIT_STATE);
  });

  it('mounts on a queued/empty run without throwing (needs ShellProvider)', () => {
    // Before the fix, AppShell calls useShell() with no provider mounted and
    // throws "useShell must be used within ShellProvider", crashing to the
    // error boundary. This must render the run label instead.
    expect(() =>
      render(<BattleshipShell runId="aab09d58-86f6-45e1-9bd6-2534f79a9256" />),
    ).not.toThrow();

    expect(screen.getByText(/aab09d58/i)).toBeInTheDocument();
  });

  it('renders the seven-section reader tabstrip with per-tab live status', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      children_complete: 1,
      children_total: 6,
      workerStates: [
        queuedWorker('positioningMarketCategory'),
        {
          ...runningWorker('positioningBuyerICP'),
          wave: 1,
          totalWaves: 2,
        },
        completeWorker('positioningCompetitorLandscape'),
      ],
    });

    render(
      <BattleshipShell
        runId="run_phase_b"
        activeSectionId="positioningBuyerICP"
        onSectionChange={vi.fn()}
      />,
    );

    const tablist = screen.getByRole('tablist', { name: /sections/i });
    const tabs = within(tablist).getAllByRole('tab');

    expect(tabs).toHaveLength(7);
    expect(
      screen.getByRole('tab', { name: /buyer.*icp.*running/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /market.*queued/i })).toBeEnabled();
    expect(screen.getByRole('tab', { name: /competitor.*done/i })).toBeEnabled();
    expect(screen.getByRole('tab', { name: /paid media plan.*locked/i })).toBeEnabled();
    expect(
      screen.getByText('Wave 1 of 2 · 1 running / 1 queued / 1 complete'),
    ).toBeInTheDocument();
  });

  it('paginates one active section at a time in pipeline order', (): void => {
    const onSectionChange = vi.fn();

    render(
      <BattleshipShell
        runId="run_phase_b"
        activeSectionId="positioningMarketCategory"
        onSectionChange={onSectionChange}
      />,
    );

    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'reader-tab-positioningMarketCategory',
    );
    expect(screen.getByRole('button', { name: /previous section/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /next section/i }));

    expect(onSectionChange).toHaveBeenCalledWith('positioningBuyerICP');
  });

  it('keeps the media-plan terminal tab clickable but locked before 6 of 6 sections complete', (): void => {
    render(
      <BattleshipShell
        runId="run_phase_b"
        activeSectionId="positioningPaidMediaPlan"
        onSectionChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('tab', { name: /paid media plan.*locked/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/unlocks after 6\/6/i)).toBeInTheDocument();
  });

  it('renders the paid media plan artifact on the terminal tab after the dependent wave completes', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      children_complete: 6,
      children_total: 6,
      workerStates: [completeWorker(PAID_MEDIA_PLAN_SECTION_ID)],
      sectionsByZone: {
        [PAID_MEDIA_PLAN_SECTION_ID]: {
          data: paidMediaPlanFixtureArtifact,
        },
      },
    });

    render(
      <BattleshipShell
        runId="run_phase_e"
        activeSectionId={PAID_MEDIA_PLAN_SECTION_ID}
        onSectionChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('tab', { name: /paid media plan.*done/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByTestId(
        `typed-artifact-renderer-${PAID_MEDIA_PLAN_SECTION_ID}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        `sub-section-status-${PAID_MEDIA_PLAN_SECTION_ID}-campaignOverview`,
      ),
    ).toHaveTextContent('Committed');
  });

  it('shows live sub-section checklist ticks from section events', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      workerStates: [runningWorker('positioningMarketCategory')],
      eventsByZone: {
        positioningMarketCategory: [
          {
            id: 'event-1',
            event_type: 'sub-section-committed',
            message: 'Category definition committed',
            payload: {
              sectionId: 'positioningMarketCategory',
              subSectionKey: 'categoryDefinition',
              status: 'committed',
            },
            created_at: '2026-05-26T10:00:00.000Z',
          },
        ],
      },
    });

    render(
      <BattleshipShell
        runId="run_phase_c"
        activeSectionId="positioningMarketCategory"
        onSectionChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Category definition and adjacent categories'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        'sub-section-status-positioningMarketCategory-categoryDefinition',
      ),
    ).toHaveTextContent('Committed');
    expect(
      screen.getByTestId('sub-section-status-positioningMarketCategory-marketSize'),
    ).toHaveTextContent('Queued');
  });
});

function queuedWorker(
  sectionId: AuditStateResponse['workerStates'][number]['section_id'],
): AuditStateResponse['workerStates'][number] {
  return buildWorker(sectionId, 'queued', 'Queued');
}

function runningWorker(
  sectionId: AuditStateResponse['workerStates'][number]['section_id'],
): AuditStateResponse['workerStates'][number] {
  return buildWorker(sectionId, 'running', 'Reading sources');
}

function completeWorker(
  sectionId: AuditStateResponse['workerStates'][number]['section_id'],
): AuditStateResponse['workerStates'][number] {
  return buildWorker(sectionId, 'complete', 'Committed');
}

function buildWorker(
  sectionId: AuditStateResponse['workerStates'][number]['section_id'],
  status: AuditStateResponse['workerStates'][number]['status'],
  phase: AuditStateResponse['workerStates'][number]['phase'],
): AuditStateResponse['workerStates'][number] {
  return {
    section_id: sectionId,
    status,
    phase,
    phaseLabel: phase,
    phaseStartedAt: null,
    latestTool: null,
    latestSource: null,
    latestActivity: null,
    nextStep: null,
    wave: null,
    totalWaves: null,
    concurrency: null,
    elapsedMs: null,
    capabilityGaps: [],
    executionMode: null,
    runtimeTimings: {},
  };
}
