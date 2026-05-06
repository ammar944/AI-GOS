'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  JourneyRunEvent,
  JourneyRunView,
  JourneySectionView,
} from '@/lib/journey/run-view';

interface JourneyRunEventLogProps {
  view: JourneyRunView | null;
}

type EventTone = 'danger' | 'warning' | 'success' | 'muted';

interface DiagnosticEntry {
  key: string;
  value: string;
}

function sortSections(sections: JourneySectionView[]): JourneySectionView[] {
  return [...sections].sort((left, right) => left.order - right.order);
}

function getSectionEvents(section: JourneySectionView): JourneyRunEvent[] {
  if (section.events.length > 0) {
    return [...section.events].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  return section.latestEvent ? [section.latestEvent] : [];
}

function getLatestEvent(section: JourneySectionView): JourneyRunEvent | null {
  return section.latestEvent ?? getSectionEvents(section).at(-1) ?? null;
}

function isAttentionEvent(
  section: JourneySectionView,
  event: JourneyRunEvent | null,
): boolean {
  if (section.blocker || section.status === 'error' || section.status === 'partial') {
    return true;
  }

  if (!event) {
    return false;
  }

  return (
    event.type === 'error' ||
    event.status === 'error' ||
    /\b(?:blocked|blocker|failed|error|timed?\s*out|timeout)\b/i.test(event.message)
  );
}

function getAttentionContext(
  section: JourneySectionView,
  event: JourneyRunEvent | null,
): string | null {
  if (!isAttentionEvent(section, event)) {
    return null;
  }

  return section.blocker ?? event?.message ?? 'This stage needs operator review.';
}

function getEventTone(event: JourneyRunEvent): EventTone {
  if (event.type === 'error' || event.status === 'error') {
    return 'danger';
  }

  if (event.status === 'running') {
    return 'warning';
  }

  if (event.status === 'complete') {
    return 'success';
  }

  return 'muted';
}

function getEventToneClassName(tone: EventTone): string {
  if (tone === 'danger') {
    return 'border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] text-[var(--accent-red)]';
  }

  if (tone === 'warning') {
    return 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] text-[var(--accent-amber)]';
  }

  if (tone === 'success') {
    return 'border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)] text-[var(--accent-green)]';
  }

  return 'border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[var(--text-tertiary)]';
}

function formatTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(parsed);
}

function formatDiagnosticValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} item${value.length === 1 ? '' : 's'}`;
  }

  if (value && typeof value === 'object') {
    return 'object';
  }

  return 'not set';
}

function getDiagnostics(event: JourneyRunEvent): DiagnosticEntry[] {
  return Object.entries(event.metadata ?? {}).map(([key, value]) => ({
    key,
    value: formatDiagnosticValue(value),
  }));
}

function EventHistoryItem({
  event,
}: {
  event: JourneyRunEvent;
}): React.ReactElement {
  const diagnostics = getDiagnostics(event);
  const tone = getEventTone(event);

  return (
    <li className="rounded-md border border-[var(--border-subtle)] bg-[rgba(7,9,14,0.55)] p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs leading-5 text-[var(--text-secondary)]">
            {event.message}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {formatTimestamp(event.createdAt)}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
            getEventToneClassName(tone),
          )}
        >
          {event.type}
        </span>
      </div>

      {diagnostics.length > 0 && (
        <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
            Diagnostics
          </p>
          <dl className="mt-1 grid gap-1 text-[11px]">
            {diagnostics.map((entry) => (
              <div key={entry.key} className="grid grid-cols-[96px_1fr] gap-2">
                <dt className="font-mono text-[var(--text-tertiary)]">
                  {entry.key}
                </dt>
                <dd className="min-w-0 truncate text-[var(--text-secondary)]">
                  {entry.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </li>
  );
}

export function JourneyRunEventLog({
  view,
}: JourneyRunEventLogProps): React.ReactElement | null {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  if (!view || view.sections.length === 0) {
    return null;
  }

  const toggleSection = (sectionId: string): void => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <section
      data-testid="journey-run-event-log"
      className="border-b border-[var(--border-subtle)] bg-[rgba(7,9,14,0.56)] px-4 py-3"
      aria-label="Journey run event log"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Event log
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Persisted worker events grouped by stage
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          {view.sections.reduce((count, section) => count + getSectionEvents(section).length, 0)} events
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {sortSections(view.sections).map((section) => {
          const events = getSectionEvents(section);
          const latest = getLatestEvent(section);
          const attentionContext = getAttentionContext(section, latest);
          const isExpanded = expandedSections.has(section.id);

          return (
            <article
              key={section.id}
              data-testid={`journey-run-event-log-${section.id}`}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-[var(--text-tertiary)]">
                    {String(section.order + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                    {section.label}
                  </h3>
                </div>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  {section.status}
                </span>
              </div>

              {latest ? (
                <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">Latest:</span>{' '}
                  {latest.message}
                </p>
              ) : (
                <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                  No persisted events yet.
                </p>
              )}

              {attentionContext && (
                <div className="mt-2 flex gap-2 rounded-md border border-[rgba(245,158,11,0.26)] bg-[rgba(245,158,11,0.08)] p-2 text-xs leading-5 text-[var(--text-secondary)]">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-amber)]"
                    aria-hidden="true"
                  />
                  <p>
                    <span className="font-medium text-[var(--text-primary)]">Needs attention:</span>{' '}
                    {attentionContext}
                  </p>
                </div>
              )}

              {events.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleSection(section.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-default)] hover:text-[var(--text-secondary)]"
                  >
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform',
                        isExpanded && 'rotate-180',
                      )}
                      aria-hidden="true"
                    />
                    {isExpanded ? 'Hide' : 'Show'} full history for {section.label}
                  </button>

                  {isExpanded && (
                    <ol className="mt-2 grid gap-2">
                      {events.map((event) => (
                        <EventHistoryItem key={event.id} event={event} />
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
