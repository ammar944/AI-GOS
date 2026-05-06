'use client';

import { AlertTriangle } from 'lucide-react';
import type {
  JourneyRunEvent,
  JourneyRunView,
  JourneySectionView,
} from '@/lib/journey/run-view';

interface JourneyRunBlockerPanelProps {
  view: JourneyRunView | null;
}

interface BlockerSummary {
  section: JourneySectionView;
  reason: string;
  latestErrorEvent: JourneyRunEvent | null;
  remediation: string;
  diagnostics: Array<{ label: string; value: string }>;
}

const DEFAULT_REMEDIATION =
  'Review the stage details and retry the section when the input or worker issue is resolved';

function sortSections(sections: JourneySectionView[]): JourneySectionView[] {
  return [...sections].sort((left, right) => left.order - right.order);
}

function isErrorLikeEvent(event: JourneyRunEvent | null): boolean {
  if (!event) {
    return false;
  }

  return (
    event.type === 'error' ||
    event.status === 'error' ||
    /\b(?:failed|error|timed?\s*out|timeout|source gap)\b/i.test(event.message)
  );
}

function getLatestEvent(section: JourneySectionView): JourneyRunEvent | null {
  return section.latestEvent ?? section.events.at(-1) ?? null;
}

function isBlockedSection(section: JourneySectionView): boolean {
  return (
    section.status === 'error' ||
    section.status === 'partial' ||
    Boolean(section.blocker) ||
    Boolean(section.result?.error) ||
    Boolean(section.activity?.error) ||
    isErrorLikeEvent(getLatestEvent(section))
  );
}

function getReason(section: JourneySectionView): string {
  const latestEvent = getLatestEvent(section);

  return (
    section.blocker ??
    section.result?.error ??
    section.activity?.error ??
    (isErrorLikeEvent(latestEvent) ? latestEvent?.message : null) ??
    'This run stopped before the section produced a trusted artifact.'
  );
}

function getRemediation(reason: string): string {
  if (/\b(?:source gap|source|evidence|missing)\b/i.test(reason)) {
    return DEFAULT_REMEDIATION;
  }

  return DEFAULT_REMEDIATION;
}

function getDiagnostics(
  section: JourneySectionView,
  latestErrorEvent: JourneyRunEvent | null,
): Array<{ label: string; value: string }> {
  return [
    { label: 'stage', value: section.id },
    { label: 'status', value: section.status },
    { label: 'job', value: section.activity?.jobId ?? 'not recorded' },
    { label: 'event', value: latestErrorEvent?.id ?? 'not recorded' },
  ];
}

function getBlockerSummary(view: JourneyRunView): BlockerSummary | null {
  if (view.status !== 'failed' && view.status !== 'partial') {
    return null;
  }

  const section = sortSections(view.sections).find(isBlockedSection);
  if (!section) {
    return null;
  }

  const latestEvent = getLatestEvent(section);
  const latestErrorEvent = isErrorLikeEvent(latestEvent) ? latestEvent : null;
  const reason = getReason(section);

  return {
    section,
    reason,
    latestErrorEvent,
    remediation: getRemediation(reason),
    diagnostics: getDiagnostics(section, latestErrorEvent),
  };
}

export function JourneyRunBlockerPanel({
  view,
}: JourneyRunBlockerPanelProps): React.ReactElement | null {
  if (!view) {
    return null;
  }

  const summary = getBlockerSummary(view);
  if (!summary) {
    return null;
  }

  return (
    <section
      data-testid="journey-run-blocker-panel"
      className="border-b border-[var(--border-subtle)] bg-[rgba(127,29,29,0.18)] px-4 py-3"
      aria-label="Journey run blocker"
    >
      <div className="flex gap-3 rounded-md border border-[rgba(239,68,68,0.28)] bg-[rgba(7,9,14,0.68)] p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)]">
          <AlertTriangle
            className="h-4 w-4 text-[var(--accent-red)]"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--accent-red)]">
                Run needs attention
              </p>
              <h2 className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                {summary.section.label}
              </h2>
            </div>
            <span className="rounded-full border border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--accent-red)]">
              {summary.section.status}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {summary.reason}
          </p>

          {summary.latestErrorEvent && summary.latestErrorEvent.message !== summary.reason && (
            <p className="mt-2 border-l-2 border-[rgba(239,68,68,0.42)] pl-2 text-xs leading-5 text-[var(--text-tertiary)]">
              Latest event: {summary.latestErrorEvent.message}
            </p>
          )}

          <p className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-xs leading-5 text-[var(--text-secondary)]">
            {summary.remediation}
          </p>

          <details className="mt-2">
            <summary className="cursor-pointer select-none font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              Diagnostic details
            </summary>
            <dl className="mt-2 grid gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-[11px]">
              {summary.diagnostics.map((entry) => (
                <div key={entry.label} className="grid grid-cols-[72px_1fr] gap-2">
                  <dt className="font-mono text-[var(--text-tertiary)]">
                    {entry.label}
                  </dt>
                  <dd className="min-w-0 truncate text-[var(--text-secondary)]">
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </div>
    </section>
  );
}
