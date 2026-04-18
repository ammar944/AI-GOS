'use client';

import { useEffect, useMemo, useState } from 'react';
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

/**
 * Wave 2 fires after wave 1 approval — keywordIntel + crossAnalysis
 * dispatch in parallel. Mirrors WAVE_2_PARALLEL_SECTIONS in dispatch-client.ts.
 */
const WAVE_2_AGENTS: SectionKey[] = [
  'keywordIntel',
  'crossAnalysis',
];

type Tone = 'queued' | 'active' | 'review' | 'done' | 'error';

interface AgentWaveBoardProps {
  userId?: string | null;
  activeRunId?: string | null;
  agents: SectionKey[];
  waveLabel: string;
}

interface WaveBoardProps {
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

function latestMessage(activity: ResearchJobActivity | undefined): string | null {
  if (!activity?.updates || activity.updates.length === 0) return null;
  return activity.updates[activity.updates.length - 1]?.message ?? null;
}

function phaseTone(phase: SectionPhase | undefined): Tone {
  switch (phase) {
    case 'approved':
      return 'done';
    case 'review':
      return 'review';
    case 'researching':
    case 'streaming':
      return 'active';
    case 'error':
      return 'error';
    default:
      return 'queued';
  }
}

function AgentWaveBoard({ userId, activeRunId, agents, waveLabel }: AgentWaveBoardProps) {
  const { state } = useWorkspace();
  const jobActivity = useResearchJobActivity({
    userId: userId ?? undefined,
    activeRunId,
  });

  // Re-render every second so elapsed time ticks live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const anyActive = agents.some(
      (key) =>
        state.sectionStates[key] === 'researching' ||
        state.sectionStates[key] === 'streaming',
    );
    if (!anyActive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [state.sectionStates, agents]);

  const anyLive = agents.some((key) => {
    const phase = state.sectionStates[key];
    return phase === 'researching' || phase === 'streaming' || phase === 'review';
  });
  const allApproved = agents.every(
    (key) => state.sectionStates[key] === 'approved',
  );
  const isVisible = Boolean(activeRunId) && anyLive && !allApproved;

  const activeCount = agents.filter((key) => {
    const p = state.sectionStates[key];
    return p === 'researching' || p === 'streaming';
  }).length;

  // Pick the currently-active agent with the freshest message for the
  // ticker line below the pills. Falls back to nothing if no narration.
  const tickerLine = useMemo(() => {
    for (const key of agents) {
      const phase = state.sectionStates[key];
      if (phase !== 'researching' && phase !== 'streaming') continue;
      const msg = latestMessage(jobActivity[key]);
      if (msg) {
        const meta = SECTION_META[key] ?? DEFAULT_SECTION_META;
        const short = meta.label.split(' ')[0];
        return { label: short, message: msg };
      }
    }
    return null;
  }, [state.sectionStates, jobActivity, agents]);

  return (
    <AnimatePresence initial={false}>
      {isVisible && (
        <motion.div
          key={`agent-wave-board-${waveLabel}`}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.24 }}
          className="border-b border-[var(--border-subtle)] bg-[var(--bg-base)]"
        >
          <div className="px-4 py-2.5 flex items-center gap-2.5 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-amber)] animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                {waveLabel} · {activeCount} researching
              </span>
            </div>
            <div className="h-3 w-px bg-[var(--border-subtle)] shrink-0" />
            {agents.map((key) => {
              const meta = SECTION_META[key] ?? DEFAULT_SECTION_META;
              const phase = state.sectionStates[key];
              const tone = phaseTone(phase);
              const activity = jobActivity[key];
              const started = activity?.startedAt ? Date.parse(activity.startedAt) : null;
              const completed = activity?.completedAt ? Date.parse(activity.completedAt) : null;
              const elapsed =
                started && !Number.isNaN(started)
                  ? completed && !Number.isNaN(completed)
                    ? completed - started
                    : now - started
                  : 0;

              const pillClasses =
                tone === 'done'
                  ? 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/[0.04] text-[var(--text-primary)]'
                  : tone === 'review'
                    ? 'border-[var(--accent-green)]/45 bg-[var(--accent-green)]/[0.08] text-[var(--text-primary)]'
                    : tone === 'error'
                      ? 'border-[var(--accent-red)]/45 bg-[var(--accent-red)]/[0.05] text-[var(--text-primary)]'
                      : tone === 'active'
                        ? 'border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/[0.05] text-[var(--text-primary)]'
                        : 'border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]';

              const dotClasses =
                tone === 'done' || tone === 'review'
                  ? 'bg-[var(--accent-green)]'
                  : tone === 'error'
                    ? 'bg-[var(--accent-red)]'
                    : tone === 'active'
                      ? 'bg-[var(--accent-amber)] animate-pulse'
                      : 'bg-[var(--text-tertiary)]';

              return (
                <div
                  key={key}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-[4px] border shrink-0 transition-colors duration-200',
                    pillClasses,
                  )}
                  title={meta.label}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClasses)} />
                  <span className="text-[12px] font-medium leading-none">
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-mono leading-none text-[var(--text-tertiary)] tabular-nums">
                    {formatElapsed(elapsed)}
                  </span>
                </div>
              );
            })}
          </div>
          {tickerLine && (
            <div className="px-4 pb-2 flex items-center gap-2 text-[11px] font-mono text-[var(--text-tertiary)]">
              <span className="uppercase tracking-[0.12em] shrink-0 text-[var(--text-secondary)]">
                {tickerLine.label}
              </span>
              <span className="truncate">{tickerLine.message}</span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ParallelAgentBoard({ userId, activeRunId }: WaveBoardProps) {
  return (
    <AgentWaveBoard
      userId={userId}
      activeRunId={activeRunId}
      agents={WAVE_1_AGENTS}
      waveLabel="wave 1"
    />
  );
}

export function Wave2AgentBoard({ userId, activeRunId }: WaveBoardProps) {
  return (
    <AgentWaveBoard
      userId={userId}
      activeRunId={activeRunId}
      agents={WAVE_2_AGENTS}
      waveLabel="wave 2"
    />
  );
}
