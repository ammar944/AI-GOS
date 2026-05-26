import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
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

const { AuditReaderShell } = await import('../audit-reader-shell');

describe('<AuditReaderShell>', () => {
  beforeEach((): void => {
    mocks.useAuditState.mockReturnValue(EMPTY_AUDIT_STATE);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach((): void => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes 0..1 lab confidence values in the header and rail', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 1,
      children_total: 6,
      workerStates: [completeWorker('positioningMarketCategory')],
      sectionsByZone: {
        positioningMarketCategory: {
          data: marketCategoryFixtureArtifact,
        },
      },
    });

    render(<AuditReaderShell runId="00000000-0000-4000-8000-0000000000aa" />);

    expect(screen.getByLabelText('Confidence 6/10')).toBeInTheDocument();
    expect(screen.getByText('6 confidence')).toBeInTheDocument();
    expect(screen.queryByText('0.6 confidence')).not.toBeInTheDocument();
  });

  it('renders the paid media terminal with all twelve sub-sections as the seventh rail item', (): void => {
    mocks.useAuditState.mockReturnValue({
      ...EMPTY_AUDIT_STATE,
      parent_audit_run_id: '11111111-1111-4111-8111-111111111111',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => completeWorker(sectionId)),
        completeWorker(PAID_MEDIA_PLAN_SECTION_ID),
      ],
      sectionsByZone: {
        [PAID_MEDIA_PLAN_SECTION_ID]: {
          data: paidMediaPlanFixtureArtifact,
        },
      },
    });

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId={PAID_MEDIA_PLAN_SECTION_ID}
      />,
    );

    expect(screen.getByText('Section 7 of 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /paid media plan.*7.2 confidence/i })).toBeEnabled();
    expect(
      screen.getByTestId(`typed-artifact-renderer-${PAID_MEDIA_PLAN_SECTION_ID}`),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByTestId(`typed-artifact-renderer-${PAID_MEDIA_PLAN_SECTION_ID}`),
      ).getByText('Confidence 7.2/10'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByTestId(
        new RegExp(`^sub-section-status-${PAID_MEDIA_PLAN_SECTION_ID}-`),
      ),
    ).toHaveLength(12);
  });

  it('uses the controlled section change callback for keyboard navigation', (): void => {
    const onSectionChange = vi.fn();

    render(
      <AuditReaderShell
        runId="00000000-0000-4000-8000-0000000000aa"
        activeSectionId="positioningMarketCategory"
        onSectionChange={onSectionChange}
      />,
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(onSectionChange).toHaveBeenCalledWith('positioningBuyerICP');
  });
});

function completeWorker(
  sectionId: AllPositioningSectionId,
): AuditStateResponse['workerStates'][number] {
  return {
    section_id: sectionId,
    status: 'complete',
    phase: 'Committed',
    phaseLabel: 'Committed',
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
    executionMode: 'lab',
    runtimeTimings: {},
  };
}
