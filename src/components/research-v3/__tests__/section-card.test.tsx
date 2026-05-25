/** @vitest-environment jsdom */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import { buyerIcpArtifact } from '@/components/research-v2/section-renderers/__tests__/fixtures';

import { SectionCard } from '../section-card';

const completeWorkerState: AuditStateResponse['workerStates'][number] = {
  section_id: 'positioningBuyerICP',
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
  executionMode: null,
  runtimeTimings: {},
};

const {
  sectionTitle,
  verdict,
  statusSummary,
  confidence,
  sources,
  ...buyerIcpBody
} = buyerIcpArtifact;

const buyerIcpLabEnvelope = {
  id: 'section-row-1',
  runId: 'aab09d58-86f6-45e1-9bd6-2534f79a9256',
  sectionId: 'positioningBuyerICP',
  createdAt: '2026-05-26T00:00:00.000Z',
  sectionTitle,
  verdict,
  statusSummary,
  confidence,
  sources,
  body: buyerIcpBody,
};

describe('<SectionCard>', () => {
  afterEach((): void => cleanup());

  it('renders completed lab-envelope Buyer ICP artifacts without crashing', (): void => {
    render(
      <SectionCard
        zoneId="positioningBuyerICP"
        body={{
          title: 'Buyer & ICP Validation',
          data: buyerIcpLabEnvelope,
        }}
        workerState={completeWorkerState}
      />,
    );

    expect(screen.getAllByTestId('firmographic-item').length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByTestId('awareness-row')).toHaveLength(5);
  });
});
