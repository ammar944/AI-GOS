import { describe, expect, it } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

import { hasSixPositioningSectionsComplete } from '../six-sections-complete';

type WorkerState = AuditStateResponse['workerStates'][number];

function worker(
  section_id: WorkerState['section_id'],
  status: WorkerState['status'],
): WorkerState {
  return {
    section_id,
    status,
    phase: 'Queued',
    phaseLabel: 'Queued',
    phaseStartedAt: null,
    latestTool: null,
    latestSource: null,
    latestActivity: null,
    nextStep: null,
    concurrency: null,
    elapsedMs: null,
    capabilityGaps: [],
    executionMode: null,
    runtimeTimings: {},
  };
}

function baseState(
  overrides: Partial<AuditStateResponse> = {},
): AuditStateResponse {
  return {
    parent_audit_run_id: 'run-1',
    parent_status: 'running',
    children_complete: 0,
    children_total: POSITIONING_SECTION_IDS.length,
    workerStates: [],
    sectionsByZone: {},
    eventsByZone: {},
    ...overrides,
  };
}

describe('hasSixPositioningSectionsComplete', () => {
  it('short-circuits true on the SQL-rollup fast-path (children_complete >= 6)', () => {
    expect(
      hasSixPositioningSectionsComplete(
        baseState({ children_complete: POSITIONING_SECTION_IDS.length }),
      ),
    ).toBe(true);
  });

  it('true when every positioning zone has a complete worker row', () => {
    expect(
      hasSixPositioningSectionsComplete(
        baseState({
          workerStates: POSITIONING_SECTION_IDS.map((id) =>
            worker(id, 'complete'),
          ),
        }),
      ),
    ).toBe(true);
  });

  it('true via the artifact-body fallback when a worker row lags (projection race)', () => {
    // The load-bearing Jun-8 fallback: a zone whose worker row is not yet
    // "complete" but whose committed artifact body is already projected into
    // sectionsByZone still counts as done for the open-tab client.
    const [lagging, ...rest] = POSITIONING_SECTION_IDS;
    expect(
      hasSixPositioningSectionsComplete(
        baseState({
          workerStates: rest.map((id) => worker(id, 'complete')),
          sectionsByZone: { [lagging]: { data: {} } },
        }),
      ),
    ).toBe(true);
  });

  it('false when one zone is queued with no artifact body', () => {
    const [pending, ...rest] = POSITIONING_SECTION_IDS;
    expect(
      hasSixPositioningSectionsComplete(
        baseState({
          children_complete: POSITIONING_SECTION_IDS.length - 1,
          workerStates: [
            ...rest.map((id) => worker(id, 'complete')),
            worker(pending, 'queued'),
          ],
        }),
      ),
    ).toBe(false);
  });
});
