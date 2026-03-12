import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JourneyResearchSandboxSequencePanel } from '../journey-research-sandbox-sequence-panel';
import type { JourneyResearchSandboxUnifiedReport } from '@/lib/journey/research-sandbox';

const report: JourneyResearchSandboxUnifiedReport = {
  sections: [
    {
      section: 'industryMarket',
      label: 'Market Overview',
      toolName: 'researchIndustry',
      status: 'complete',
      durationMs: 1000,
      startedAt: '2026-03-11T10:00:00.000Z',
      completedAt: '2026-03-11T10:01:00.000Z',
      lastHeartbeat: '2026-03-11T10:01:00.000Z',
      missingPrerequisites: [],
      logCount: 2,
      latestLog: 'market overview complete',
      logs: [
        {
          at: '2026-03-11T10:00:10.000Z',
          id: 'log-1',
          message: 'worker accepted research job',
          phase: 'runner',
        },
        {
          at: '2026-03-11T10:00:30.000Z',
          id: 'log-2',
          message: 'market overview complete',
          phase: 'output',
        },
      ],
      hasCharts: false,
      chartCount: 0,
      telemetry: {
        model: 'claude-haiku-4-5',
        usage: {
          inputTokens: 1000,
          outputTokens: 200,
          totalTokens: 1200,
        },
        estimatedCostUsd: 0.0016,
      },
      sandboxResult: null,
      liveResult: null,
    },
    {
      section: 'crossAnalysis',
      label: 'Strategic Synthesis',
      toolName: 'synthesizeResearch',
      status: 'running',
      durationMs: null,
      startedAt: '2026-03-11T10:03:00.000Z',
      completedAt: null,
      lastHeartbeat: '2026-03-11T10:03:20.000Z',
      missingPrerequisites: [],
      logCount: 4,
      latestLog: 'generateChart started',
      logs: [
        {
          at: '2026-03-11T10:03:05.000Z',
          id: 'log-3',
          message: 'launching research sub-agent',
          phase: 'runner',
        },
        {
          at: '2026-03-11T10:03:20.000Z',
          id: 'log-4',
          message: 'generateChart started',
          phase: 'tool',
        },
      ],
      hasCharts: true,
      chartCount: 1,
      telemetry: {
        model: 'claude-sonnet-4-6',
        usage: {
          inputTokens: 2100,
          outputTokens: 900,
          totalTokens: 3000,
        },
        estimatedCostUsd: 0.0234,
        charts: [
          {
            chartType: 'pie',
            title: 'Budget Allocation',
            imageUrl: 'https://cdn.example.com/pie.png',
          },
        ],
      },
      sandboxResult: null,
      liveResult: null,
    },
  ],
  totals: {
    completedSections: 1,
    totalDurationMs: 1000,
    totalTokens: 4200,
    totalEstimatedCostUsd: 0.025,
    totalCharts: 1,
  },
};

describe('JourneyResearchSandboxSequencePanel', () => {
  it('renders unified observability metrics, section rows, and chart signals', () => {
    const onRunAll = vi.fn();
    const onSelectSection = vi.fn();
    const onCopyUnifiedOutput = vi.fn();

    render(
      <JourneyResearchSandboxSequencePanel
        report={report}
        isRunning={false}
        activeSection="crossAnalysis"
        sequenceStatus="error"
        sequenceMessage="Run finished with issues. Market Overview failed validation."
        unifiedOutput="# Journey Research Sandbox Unified Output"
        onRunAll={onRunAll}
        onCopyUnifiedOutput={onCopyUnifiedOutput}
        onSelectSection={onSelectSection}
      />,
    );

    expect(screen.getByText('Unified observability')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run first six sections/i })).toBeInTheDocument();
    expect(screen.getByText('4,200')).toBeInTheDocument();
    expect(screen.getByText('$0.0250')).toBeInTheDocument();
    expect(screen.getByText('Market Overview')).toBeInTheDocument();
    expect(screen.getByText('Strategic Synthesis')).toBeInTheDocument();
    expect(screen.getByText('1 chart')).toBeInTheDocument();
    expect(
      screen.getByText('Run finished with issues. Market Overview failed validation.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Unified persisted output')).toBeInTheDocument();
    expect(screen.getByText('# Journey Research Sandbox Unified Output')).toBeInTheDocument();
    expect(screen.getAllByText(/generateChart started/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /strategic synthesis/i }));
    expect(onSelectSection).toHaveBeenCalledWith('crossAnalysis');

    fireEvent.click(screen.getByRole('button', { name: /copy all outputs/i }));
    expect(onCopyUnifiedOutput).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /run first six sections/i }));
    expect(onRunAll).toHaveBeenCalledTimes(1);
  });
});
