'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import type { ResearchJobActivity } from '@/lib/journey/research-job-activity';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import type { SectionKey, SectionPhase } from '@/lib/workspace/types';

/**
 * Sections that fan out in parallel after identity resolves.
 * Duplicated from dispatch-client.ts WAVE_1_PARALLEL_SECTIONS to avoid
 * pulling a client-dispatch module into a pure UI component.
 */
const WAVE_1_AGENTS: SectionKey[] = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'offerAnalysis',
];

interface ParallelAgentBoardProps {
  userId?: string | null;
  activeRunId?: string | null;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return '0s';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function latestActivityMessage(activity: ResearchJobActivity | undefined): string | null {
  if (!activity?.updates || activity.updates.length === 0) return null;
  const last = activity.updates[activity.updates.length - 1];
  return last?.message ?? null;
}

function phaseLabel(phase: SectionPhase | undefined): { label: string; tone: 'queued' | 'active' | 'review' | 'done' | 'error' } {
  switch (phase) {
    case 'approved':
      return { label: 'Approved', tone: 'done' };
    case 'review':
      return { label: 'Ready for review', tone: 'review' };
    case 'researching':
    case 'streaming':
      return { label: 'Researching', tone: 'active' };
    case 'error':
      return { label: 'Error', tone: 'error' };
    default:
      return { label: 'Queued', tone: 'queued' };
  }
}

export function ParallelAgentBoard({ userId, activeRunId }: ParallelAgentBoardProps) {
  const { state } = useWorkspace();
  const jobActivity = useResearchJobActivity({
    userId: userId ?? undefined,
    activeRunId,
  });

  // Re-render every second so elapsed time ticks live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const anyActive = WAVE_1_AGENTS.some(
      (key) =>
        state.sectionStates[key] === 'researching' ||
        state.sectionStates[key] === 'streaming',
    );
    if (!anyActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [state.sectionStates]);

  const anyWave1Live = WAVE_1_AGENTS.some((key) => {
    const phase = state.sectionStates[key];
    return (
      phase === 'researching' ||
      phase === 'streaming' ||
      phase === 'review'
    );
  });
  const allWave1Approved = WAVE_1_AGENTS.every(
    (key) => state.sectionStates[key] === 'approved',
  );

  // Show only while a run is active and at least one wave-1 agent is still
  // working or awaiting approval. Collapses away once all four are approved
  // and the UX transitions to the sequential Keywords/Cross/MediaPlan flow.
  const isVisible = Boolean(activeRunId) && anyWave1Live && !allWave1Approved;

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.div
          key="parallel-agent-board"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.24 }}
          className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]"
        >
          <div className="px-4 pt-3 pb-2 flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-[var(--text-tertiary)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse" />
            <span>4 agents running in parallel</span>
          </div>
          <div className="px-4 pb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WAVE_1_AGENTS.map((key) => {
              const meta = SECTION_META[key] ?? DEFAULT_SECTION_META;
              const phase = state.sectionStates[key];
              const { label, tone } = phaseLabel(phase);
              const activity = jobActivity[key];
              const started = activity?.startedAt ? Date.parse(activity.startedAt) : null;
              const completed = activity?.completedAt ? Date.parse(activity.completedAt) : null;
              const elapsed =
                started && !Number.isNaN(started)
                  ? completed && !Number.isNaN(completed)
                    ? completed - started
                    : now - started
                  : 0;
              const message =
                tone === 'done'
                  ? 'Approved'
                  : tone === 'review'
                    ? 'Finished — ready for review'
                    : tone === 'error'
                      ? activity?.error ?? 'Failed — see error detail'
                      : latestActivityMessage(activity) ?? 'Warming up…';

              const toneClasses =
                tone === 'done'
                  ? 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/5'
                  : tone === 'review'
                    ? 'border-[var(--accent-green)]/40 bg-[var(--accent-green)]/5'
                    : tone === 'error'
                      ? 'border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5'
                      : tone === 'active'
                        ? 'border-[var(--accent-blue)]/40 bg-[var(--accent-blue)]/5'
                        : 'border-[var(--border-subtle)] bg-transparent';

              const dotClasses =
                tone === 'done'
                  ? 'bg-[var(--accent-green)]'
                  : tone === 'review'
                    ? 'bg-[var(--accent-green)]'
                    : tone === 'error'
                      ? 'bg-[var(--accent-red)]'
                      : tone === 'active'
                        ? 'bg-[var(--accent-blue)] animate-pulse'
                        : 'bg-[var(--text-tertiary)]';

              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-md border px-3 py-2.5 flex flex-col gap-1.5 transition-colors duration-200',
                    toneClasses,
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('h-2 w-2 rounded-full shrink-0', dotClasses)} />
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)] shrink-0">
                        {meta.moduleNumber}
                      </span>
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-tertiary)] shrink-0">
                      {formatElapsed(elapsed)}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                    {label}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] line-clamp-2 min-h-[2.25em]">
                    {message}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
