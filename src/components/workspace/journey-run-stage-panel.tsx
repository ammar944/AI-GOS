'use client';

import { AlertCircle, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  JourneyRunView,
  JourneySectionView,
  JourneySectionViewStatus,
} from '@/lib/journey/run-view';
import type {
  ResearchJobActivity,
  ResearchJobUpdate,
} from '@/lib/journey/research-job-activity';

interface JourneyRunStagePanelProps {
  view: JourneyRunView | null;
  activityBySection?: Record<string, ResearchJobActivity>;
}

type StatusTone = 'success' | 'active' | 'warning' | 'danger' | 'muted';

interface StatusDisplay {
  label: string;
  tone: StatusTone;
}

function getActivity(
  section: JourneySectionView,
  activityBySection: Record<string, ResearchJobActivity> | undefined,
): ResearchJobActivity | null {
  return activityBySection?.[section.id] ?? section.activity;
}

function getDisplayStatus(
  section: JourneySectionView,
  activity: ResearchJobActivity | null,
): JourneySectionViewStatus {
  if (section.status === 'complete' || section.status === 'partial') {
    return section.status;
  }

  if (section.status === 'error' || activity?.status === 'error') {
    return 'error';
  }

  if (activity?.status === 'running') {
    return 'running';
  }

  return section.status;
}

function getStatusDisplay(status: JourneySectionViewStatus): StatusDisplay {
  if (status === 'complete') {
    return { label: 'Done', tone: 'success' };
  }

  if (status === 'running') {
    return { label: 'Running', tone: 'active' };
  }

  if (status === 'partial') {
    return { label: 'Blocked', tone: 'warning' };
  }

  if (status === 'error') {
    return { label: 'Failed', tone: 'danger' };
  }

  return { label: 'Waiting', tone: 'muted' };
}

function getStatusIcon(status: JourneySectionViewStatus): React.ReactNode {
  if (status === 'complete') {
    return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
  }

  if (status === 'partial' || status === 'error') {
    return <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />;
}

function getStatusClassName(tone: StatusTone): string {
  if (tone === 'success') {
    return 'border-[rgba(34,197,94,0.24)] bg-[rgba(34,197,94,0.08)] text-[var(--accent-green)]';
  }

  if (tone === 'active') {
    return 'border-[rgba(54,94,255,0.28)] bg-[rgba(54,94,255,0.10)] text-[var(--accent-blue)]';
  }

  if (tone === 'warning') {
    return 'border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.10)] text-[var(--accent-amber)]';
  }

  if (tone === 'danger') {
    return 'border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]';
  }

  return 'border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[var(--text-tertiary)]';
}

function latestUpdate(activity: ResearchJobActivity | null): ResearchJobUpdate | null {
  const updates = [...(activity?.updates ?? [])].sort((left, right) =>
    left.at.localeCompare(right.at),
  );

  return updates.at(-1) ?? null;
}

function latestMessage(
  section: JourneySectionView,
  activity: ResearchJobActivity | null,
): string | null {
  const update = latestUpdate(activity);
  return update?.message ?? section.latestEvent?.message ?? null;
}

function parseTime(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function elapsedLabel(
  activity: ResearchJobActivity | null,
): string | null {
  const startedAt = parseTime(activity?.startedAt);
  const endedAt = parseTime(activity?.completedAt ?? activity?.lastHeartbeat);
  if (startedAt === null || endedAt === null) {
    return null;
  }

  return formatDuration(endedAt - startedAt);
}

function contextLine(section: JourneySectionView): string | null {
  return section.blocker ?? section.pendingDependencyReason;
}

function sortSections(sections: JourneySectionView[]): JourneySectionView[] {
  return [...sections].sort((left, right) => left.order - right.order);
}

export function JourneyRunStagePanel({
  view,
  activityBySection,
}: JourneyRunStagePanelProps): React.ReactElement | null {
  if (!view || view.sections.length === 0) {
    return null;
  }

  const sections = sortSections(view.sections);

  return (
    <section
      data-testid="journey-run-stage-panel"
      className="border-y border-[var(--border-subtle)] bg-[rgba(7,9,14,0.72)] px-4 py-3"
      aria-label="Journey run stage status"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Run map
          </p>
          <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
            {view.run.companyName ?? 'Journey run'} - persisted stage status
          </p>
        </div>
        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
          {view.status}
        </span>
      </div>

      <ol className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {sections.map((section) => {
          const activity = getActivity(section, activityBySection);
          const status = getDisplayStatus(section, activity);
          const statusDisplay = getStatusDisplay(status);
          const eventMessage = latestMessage(section, activity);
          const elapsed = elapsedLabel(activity);
          const reason = contextLine(section);

          return (
            <li
              key={section.id}
              className="min-w-[168px] flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-[var(--text-tertiary)]">
                    {String(section.order + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]">
                    {section.label}
                  </h3>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                    getStatusClassName(statusDisplay.tone),
                  )}
                >
                  {getStatusIcon(status)}
                  {statusDisplay.label}
                </span>
              </div>

              {eventMessage && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {eventMessage}
                </p>
              )}

              {elapsed && (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  Elapsed {elapsed}
                </p>
              )}

              {reason && (
                <p className="mt-2 line-clamp-2 border-l-2 border-[var(--border-default)] pl-2 text-xs leading-5 text-[var(--text-tertiary)]">
                  {reason}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
