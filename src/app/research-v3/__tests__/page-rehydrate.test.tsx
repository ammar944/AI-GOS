/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
} from '@/lib/ai/prompts/positioning-skills';
import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';

const routerMock = vi.hoisted(() => ({
  replace: vi.fn(),
}));
const searchParamsMock = vi.hoisted(() => ({
  value: new URLSearchParams(
    'runId=run-normalized-complete&section=positioningPaidMediaPlan',
  ),
}));
const useAuditStateMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock.value,
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isLoaded: true,
    user: { id: 'user_1' },
  }),
}));

vi.mock('@/components/research-v2/welcome-form', () => ({
  WelcomeForm: () => <div data-testid="welcome" />,
}));

vi.mock('@/components/research-v2/corpus-stream', () => ({
  CorpusStream: () => <div data-testid="corpus" />,
}));

vi.mock('@/components/research-v2/error-recovery', () => ({
  ErrorRecovery: () => <div data-testid="error" />,
}));

vi.mock('@/components/onboarding', () => ({
  OnboardingWizard: () => <div data-testid="onboarding" />,
}));

vi.mock('@/lib/research-v2/use-audit-state', () => ({
  useAuditState: useAuditStateMock,
}));

const { default: ResearchV3Page } = await import('../page');

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildCompleteWorker(
  sectionId: AuditStateResponse['workerStates'][number]['section_id'],
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
    concurrency: null,
    elapsedMs: null,
    capabilityGaps: [],
    executionMode: 'lab',
    runtimeTimings: {},
  };
}

function buildArtifactSections(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    [...POSITIONING_SECTION_IDS, PAID_MEDIA_PLAN_SECTION_ID].map((zone) => [
      zone,
      {
        zone,
        status: 'complete',
        revision: 1,
        section_run_id: `section-run-${zone}`,
        title: zone,
        markdown: `# ${zone}`,
        data: zone === PAID_MEDIA_PLAN_SECTION_ID ? paidMediaPlanFixtureArtifact : {},
        claims: null,
        sources: [],
        error: null,
        updated_at: '2026-05-26T12:00:00.000Z',
      },
    ]),
  );
}

describe('ResearchV3Page runId rehydrate', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    searchParamsMock.value = new URLSearchParams(
      `runId=run-normalized-complete&section=${PAID_MEDIA_PLAN_SECTION_ID}`,
    );
    useAuditStateMock.mockReturnValue({
      parent_audit_run_id: 'artifact-run',
      parent_status: 'complete',
      children_complete: 6,
      children_total: 6,
      workerStates: [
        ...POSITIONING_SECTION_IDS.map((sectionId) => buildCompleteWorker(sectionId)),
        buildCompleteWorker(PAID_MEDIA_PLAN_SECTION_ID),
      ],
      sectionsByZone: {
        [PAID_MEDIA_PLAN_SECTION_ID]: {
          data: paidMediaPlanFixtureArtifact,
        },
      },
      eventsByZone: {},
    } satisfies AuditStateResponse);
  });

  afterEach((): void => {
    cleanup();
  });

  it('cold-loads a completed normalized run into the reader with paid media restored', async (): Promise<void> => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        runId: 'run-normalized-complete',
        researchResults: null,
        jobStatus: null,
        onboardingData: null,
        artifactSections: buildArtifactSections(),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ResearchV3Page />);

    await waitFor(() =>
      expect(screen.getByText('Section 7 of 7')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('section-progress-strip')).toBeNull();
    expect(screen.queryByTestId('corpus')).toBeNull();
    expect(
      screen.getByTestId(`typed-artifact-renderer-${PAID_MEDIA_PLAN_SECTION_ID}`),
    ).toBeInTheDocument();
  });
});
