/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import { VariantD } from '../variant-d';
import { PHASE_META, sectionTitle, type NarrationItem } from '../phase-narration';
import { ZONE_ORDER, type VariantProps } from '../variant-contract';

// jsdom has no matchMedia; the variant reads it on mount. Stub it (reduced
// motion off) so the auto-scroll path is exercised.
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => cleanup());

type Worker = AuditStateResponse['workerStates'][number];

function makeWorker(section_id: Worker['section_id'], status: Worker['status']): Worker {
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

function makeState(): AuditStateResponse {
  return {
    parent_audit_run_id: 'run-d',
    parent_status: 'running',
    children_complete: 1,
    children_total: 6,
    workerStates: [
      makeWorker('positioningMarketCategory', 'complete'),
      makeWorker('positioningBuyerICP', 'running'),
      makeWorker('positioningCompetitorLandscape', 'queued'),
      makeWorker('positioningVoiceOfCustomer', 'queued'),
      makeWorker('positioningDemandIntent', 'queued'),
      makeWorker('positioningOfferDiagnostic', 'queued'),
    ],
    sectionsByZone: {},
    eventsByZone: {},
  };
}

function makeNarration(): NarrationItem[] {
  return [
    {
      id: 'n1',
      zone: 'positioningBuyerICP',
      phase: 'searching',
      label: PHASE_META.searching.label,
      chip: 'best CRM for small business',
      tone: 'active',
      at: '2026-05-29T00:00:01.000Z',
    },
    {
      id: 'n2',
      zone: 'positioningBuyerICP',
      phase: 'refining',
      label: PHASE_META.refining.label,
      detail: 'Strengthening 2 claims with sources',
      tone: 'warning',
      at: '2026-05-29T00:00:02.000Z',
    },
  ];
}

const baseProps = (
  overrides: Partial<VariantProps> = {},
): VariantProps => ({
  state: makeState(),
  narration: makeNarration(),
  elapsedMs: 65_000,
  totalMs: 600_000,
  playing: false,
  ...overrides,
});

describe('VariantD', () => {
  it('renders every section title from ZONE_ORDER in the left nav', () => {
    render(<VariantD {...baseProps()} />);
    for (const zone of ZONE_ORDER) {
      expect(screen.getByText(sectionTitle(zone))).toBeTruthy();
    }
  });

  it('renders the streaming header with sections-complete and elapsed clock', () => {
    render(<VariantD {...baseProps()} />);
    expect(screen.getByText('Streaming')).toBeTruthy();
    expect(screen.getByText('1/6')).toBeTruthy();
    expect(screen.getByText('1:05')).toBeTruthy();
  });

  it('renders narration phase labels, detail, and search-query chip', () => {
    render(<VariantD {...baseProps()} />);
    expect(screen.getByText(PHASE_META.searching.label)).toBeTruthy();
    expect(screen.getByText(PHASE_META.refining.label)).toBeTruthy();
    expect(screen.getByText('best CRM for small business')).toBeTruthy();
    expect(screen.getByText('Strengthening 2 claims with sources')).toBeTruthy();
  });

  it('shows an empty-state line when there is no narration yet', () => {
    render(<VariantD {...baseProps({ narration: [] })} />);
    expect(screen.getByText(/Waiting for the run to start/i)).toBeTruthy();
  });

  it('clamps sections-complete to a max of 6', () => {
    const state = makeState();
    state.children_complete = 9;
    render(<VariantD {...baseProps({ state })} />);
    expect(screen.getByText('6/6')).toBeTruthy();
  });
});
