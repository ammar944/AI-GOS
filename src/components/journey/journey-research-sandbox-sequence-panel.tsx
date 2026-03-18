'use client';

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import type {
  JourneyResearchSandboxSection,
  JourneyResearchSandboxUnifiedReport,
} from '@/lib/journey/research-sandbox';
import { cn } from '@/lib/utils';

interface JourneyResearchSandboxSequencePanelProps {
  report: JourneyResearchSandboxUnifiedReport;
  isRunning: boolean;
  activeSection: JourneyResearchSandboxSection | null;
  sequenceStatus: 'idle' | 'running' | 'complete' | 'error';
  sequenceMessage: string | null;
  unifiedOutput: string;
  onRunAll: () => void;
  onCopyUnifiedOutput: () => void;
  onSelectSection: (section: JourneyResearchSandboxSection) => void;
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`;
}

function formatDuration(
  durationMs: number | null,
  status?: JourneyResearchSandboxUnifiedReport['sections'][number]['status'],
): string {
  if (durationMs == null) {
    if (status === 'running') {
      return 'Running';
    }

    if (status === 'blocked') {
      return 'Blocked';
    }

    if (status === 'idle') {
      return 'Not started';
    }

    return 'Unavailable';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return now;
}

export function JourneyResearchSandboxSequencePanel({
  report,
  isRunning,
  activeSection,
  sequenceStatus,
  sequenceMessage,
  unifiedOutput,
  onRunAll,
  onCopyUnifiedOutput,
  onSelectSection,
}: JourneyResearchSandboxSequencePanelProps) {
  const now = useNow();

  return (
    <div className="rounded-[28px] border border-white/10 bg-[rgba(8,12,20,0.82)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
            Unified observability
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
            Run the first six Journey research sections in sequence on the same worker path as
            production, then inspect timings, logs, token usage, cost, and chart output in one
            place.
          </p>
        </div>

        <button
          type="button"
          onClick={onRunAll}
          disabled={isRunning}
          aria-label="Run First Six Sections"
          className={cn(
            'inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors',
            isRunning
              ? 'cursor-wait bg-white/[0.08] text-text-tertiary'
              : 'bg-[linear-gradient(135deg,rgb(32,97,255),rgb(0,173,181))] hover:opacity-90',
          )}
        >
          {isRunning ? 'Running first six sections' : 'Run First Six Sections'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <MetricCard label="Completed" value={String(report.totals.completedSections)} />
        <MetricCard label="Duration" value={formatDuration(report.totals.totalDurationMs)} />
        <MetricCard label="Tokens" value={formatInteger(report.totals.totalTokens)} />
        <MetricCard label="Cost" value={formatCurrency(report.totals.totalEstimatedCostUsd)} />
      </div>

      {sequenceMessage ? (
        <div
          className={cn(
            'mt-5 rounded-2xl border px-4 py-3 text-sm',
            sequenceStatus === 'error'
              ? 'border-[rgba(255,120,120,0.24)] bg-[rgba(255,120,120,0.08)] text-[rgb(255,198,198)]'
              : 'border-[rgba(48,126,255,0.2)] bg-[rgba(48,126,255,0.08)] text-[rgb(196,220,255)]',
          )}
        >
          {sequenceMessage}
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {report.sections.map((section) => {
          const isActive = activeSection === section.section;
          const tokenCount = section.telemetry?.usage?.totalTokens ?? 0;
          const chartLabel =
            section.chartCount === 1 ? '1 chart' : `${section.chartCount} charts`;
          const latestMessage =
            section.latestLog ??
            (section.status === 'blocked'
              ? 'Blocked by missing completed prerequisites.'
              : 'No worker updates yet.');
          const liveDuration =
            section.durationMs ??
            (section.status === 'running' && section.startedAt
              ? Math.max(0, now - Date.parse(section.startedAt))
              : null);

          return (
            <button
              key={section.section}
              type="button"
              onClick={() => onSelectSection(section.section)}
              className={cn(
                'w-full rounded-2xl border px-4 py-4 text-left transition-colors',
                isActive
                  ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10'
                  : 'border-white/10 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]',
              )}
              aria-label={section.label}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-text-primary">{section.label}</span>
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-mono uppercase tracking-[0.14em]',
                        section.status === 'complete' &&
                          'bg-[rgba(30,170,95,0.16)] text-[rgb(134,255,188)]',
                        section.status === 'running' &&
                          'bg-[rgba(48,126,255,0.18)] text-[rgb(168,205,255)]',
                        section.status === 'error' &&
                          'bg-[rgba(255,120,120,0.16)] text-[rgb(255,188,188)]',
                        section.status === 'partial' &&
                          'bg-[rgba(255,186,59,0.14)] text-[rgb(255,222,158)]',
                        section.status === 'blocked' &&
                          'bg-[rgba(255,120,120,0.12)] text-[rgb(255,206,206)]',
                        section.status === 'idle' && 'bg-[var(--bg-hover)] text-text-tertiary',
                      )}
                    >
                      {section.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-text-tertiary">
                    {latestMessage}
                  </p>
                  {section.logs.length > 0 ? (
                    <div className="mt-3 space-y-1 rounded-xl border border-white/8 bg-[#06101c] px-3 py-3">
                      {section.logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-2 text-[11px] leading-5 text-text-tertiary"
                        >
                          <span className="font-mono uppercase text-[var(--accent-cyan)]">
                            {log.phase}
                          </span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-text-secondary lg:min-w-[360px]">
                  <span>Duration</span>
                  <span className="font-mono text-text-primary">
                    {formatDuration(liveDuration, section.status)}
                  </span>
                  <span>Tokens</span>
                  <span className="font-mono text-text-primary">{formatInteger(tokenCount)}</span>
                  <span>Cost</span>
                  <span className="font-mono text-text-primary">
                    {formatCurrency(section.telemetry?.estimatedCostUsd ?? 0)}
                  </span>
                  <span>Charts</span>
                  <span className="font-mono text-text-primary">
                    {section.hasCharts ? chartLabel : 'No charts'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-[var(--bg-surface)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-blue)]">
              Unified persisted output
            </h3>
            <p className="mt-2 text-xs leading-5 text-text-tertiary">
              Copy the first-six sandbox results in one block instead of opening each section JSON
              card separately.
            </p>
          </div>
          <button
            type="button"
            onClick={onCopyUnifiedOutput}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--bg-hover)] px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy all outputs
          </button>
        </div>
        <pre className="mt-4 max-h-[360px] overflow-auto rounded-2xl bg-[#06101c] px-4 py-4 text-xs leading-6 text-text-secondary">
          {unifiedOutput}
        </pre>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-text-primary">{value}</div>
    </div>
  );
}
