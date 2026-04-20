'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import type { SectionKey, SectionPhase } from '@/lib/workspace/types';

interface SectionTabsProps {
  sections: SectionKey[];
  currentSection: SectionKey;
  sectionStates?: Record<SectionKey, SectionPhase>;
  onNavigate: (section: SectionKey) => void;
  mode: 'workspace' | 'document';
  userId?: string | null;
  activeRunId?: string | null;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SectionTabs({
  sections,
  currentSection,
  sectionStates,
  onNavigate,
  mode,
  userId,
  activeRunId,
}: SectionTabsProps) {
  const approvedCount = useMemo(() => {
    if (!sectionStates) return sections.length;
    return sections.filter((key) => sectionStates[key] === 'approved').length;
  }, [sections, sectionStates]);

  const jobActivity = useResearchJobActivity({
    userId: userId ?? undefined,
    activeRunId: activeRunId ?? null,
  });

  // Re-render every second so elapsed timers tick while any section is live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (mode !== 'workspace' || !sectionStates) return;
    const anyActive = sections.some((key) => {
      const p = sectionStates[key];
      return p === 'researching' || p === 'streaming';
    });
    if (!anyActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [mode, sections, sectionStates]);

  const tabBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tabBarRef.current) return;
    const activeTab = tabBarRef.current.querySelector('[data-active="true"]');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [currentSection]);

  return (
    <div
      ref={tabBarRef}
      className="flex min-h-11 items-end gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 overflow-x-auto custom-scrollbar"
    >
      {sections.map((section) => {
        const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;
        const phase = sectionStates?.[section];
        const isActive = section === currentSection;
        const isQueued = mode === 'workspace' && phase === 'queued';
        const isApproved = phase === 'approved';
        const isReview = phase === 'review';
        const isResearching = phase === 'researching' || phase === 'streaming';
        const isError = phase === 'error';

        // Elapsed time pulled from research_telemetry activity stream.
        const activity = jobActivity[section];
        const started = activity?.startedAt ? Date.parse(activity.startedAt) : null;
        const completed = activity?.completedAt ? Date.parse(activity.completedAt) : null;
        const hasStart = started !== null && !Number.isNaN(started);
        const hasCompleted = completed !== null && !Number.isNaN(completed);
        const showTimer =
          mode === 'workspace' &&
          hasStart &&
          (isResearching || isReview || isApproved || isError);
        const elapsedMs = hasStart
          ? hasCompleted
            ? (completed as number) - (started as number)
            : now - (started as number)
          : 0;

        const textColor = (() => {
          if (isQueued) return 'text-[var(--text-quaternary)]';
          if (isApproved) return 'text-[var(--accent-green)]';
          if (isError) return 'text-[var(--accent-red)]';
          if (isResearching) return 'text-[var(--accent-amber)]';
          if (isReview) return 'text-[var(--accent-green)]';
          if (isActive) return 'text-[var(--text-primary)]';
          return 'text-[var(--text-quaternary)]';
        })();

        // Sleek outlined chips: green = done / ready for review, amber = in progress,
        // red = error. Uses full border + light fill so status reads at a glance.
        const statusChrome = (() => {
          if (mode !== 'workspace') {
            return isActive
              ? 'border-[var(--border-default)] bg-[var(--bg-elevated)]'
              : 'border-transparent';
          }
          if (isApproved) {
            return 'border-[var(--accent-green)]/55 bg-[var(--accent-green)]/[0.09]';
          }
          if (isReview) {
            return 'border-[var(--accent-green)]/40 bg-[var(--accent-green)]/[0.06]';
          }
          if (isResearching) {
            return 'border-[var(--accent-amber)]/55 bg-[var(--accent-amber)]/[0.10] shadow-[0_0_20px_-8px_var(--accent-amber)]';
          }
          if (isError) {
            return 'border-[var(--accent-red)]/50 bg-[var(--accent-red)]/[0.08]';
          }
          if (isActive) {
            return 'border-[var(--border-default)] bg-[var(--bg-elevated)]';
          }
          return 'border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]/90';
        })();

        return (
          <button
            key={section}
            type="button"
            data-active={isActive}
            onClick={() => !isQueued && onNavigate(section)}
            disabled={isQueued}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 py-2 rounded-lg',
              'text-[12px] font-mono font-medium whitespace-nowrap shrink-0',
              'border border-solid transition-[color,background-color,border-color,box-shadow] duration-200',
              'outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]',
              textColor,
              statusChrome,
              '-mb-px z-10',
              isQueued && 'cursor-not-allowed opacity-50',
              !isQueued && !isActive && 'cursor-pointer',
            )}
            title={
              showTimer
                ? `${meta.label} · ${formatElapsed(elapsedMs)}${hasCompleted ? '' : ' (running)'}`
                : meta.label
            }
          >
            {/* Status indicator — subtle inline markers */}
            {mode === 'workspace' && (isApproved || isReview) && (
              <span className="text-[10px] leading-none">&#10003;</span>
            )}
            {mode === 'workspace' && isResearching && (
              <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0 animate-pulse" />
            )}
            {mode === 'workspace' && isError && (
              <span className="text-[10px] leading-none">!</span>
            )}

            <span>{meta.label}</span>

            {showTimer && (
              <span
                className={cn(
                  'text-[10px] font-mono tabular-nums leading-none ml-0.5',
                  isApproved || isReview
                    ? 'text-[var(--accent-green)]/70'
                    : isResearching
                      ? 'text-[var(--accent-amber)]/80'
                      : isError
                        ? 'text-[var(--accent-red)]/70'
                        : 'text-[var(--text-quaternary)]',
                )}
              >
                {formatElapsed(elapsedMs)}
              </span>
            )}
          </button>
        );
      })}

      {/* Progress counter */}
      {mode === 'workspace' && (
        <span className="ml-auto flex items-center self-center py-2 pl-2 text-[11px] font-mono text-[var(--text-quaternary)] shrink-0 tabular-nums opacity-90">
          {approvedCount}/{sections.length}
        </span>
      )}
    </div>
  );
}
