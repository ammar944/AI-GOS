'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ResearchJobActivity, CollapsedResearchJobUpdate } from '@/lib/journey/research-job-activity';
import { collapseResearchJobUpdates } from '@/lib/journey/research-job-activity';
import { SECTION_PIPELINE, RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';
import type { SectionKey } from '@/lib/workspace/types';

// Fallback simulated messages (shown when worker hasn't reported yet)
const SECTION_ACTIVITIES: Record<string, string[]> = {
  industryMarket: [
    'Searching market intelligence databases',
    'Analyzing industry vertical and addressable market',
    'Extracting market growth indicators and trends',
    'Mapping market dynamics and buying behaviours',
    'Compiling market overview',
  ],
  icpValidation: [
    'Loading market research results',
    'Analyzing target audience demographics',
    'Validating ICP against market data',
    'Mapping buyer journey and trigger events',
    'Scoring ICP targeting confidence',
  ],
  offerAnalysis: [
    'Loading ICP and market context',
    'Evaluating value proposition strength',
    'Scraping competitor pricing pages via Firecrawl',
    'Scoring offer across 6 dimensions',
    'Generating improvement recommendations',
  ],
  competitors: [
    'Loading ICP, offer, and market context',
    'Identifying competitor domains via web search',
    'Scraping competitor sites via Firecrawl',
    'Querying SpyFu for keyword spend data',
    'Pulling ad creatives from ad libraries',
    'Building competitive intelligence matrix',
  ],
  keywordIntel: [
    'Loading full research context',
    'Querying SpyFu keyword databases',
    'Analyzing search volume and competition',
    'Identifying competitor keyword gaps',
    'Mapping quick-win opportunities',
    'Building keyword strategy',
  ],
  crossAnalysis: [
    'Loading all research sections',
    'Cross-referencing market, ICP, offer, and competitor data',
    'Identifying strategic patterns and gaps',
    'Scoring section confidence levels',
    'Compiling strategic recommendations',
  ],
  mediaPlan: [
    'Loading approved research and synthesis',
    'Building channel mix and budget allocation',
    'Designing audience and campaign structure',
    'Setting measurement KPIs and guardrails',
    'Planning phased rollout roadmap',
    'Generating strategy snapshot',
  ],
};

const DEFAULT_ACTIVITIES = [
  'Initializing research pipeline',
  'Gathering intelligence',
  'Processing data sources',
  'Analyzing patterns',
  'Compiling results',
];

// Phase icon mapping for visual distinction
const PHASE_COLORS: Record<string, string> = {
  runner: 'var(--accent-blue)',
  tool: 'rgb(168, 85, 247)', // purple
  analysis: 'rgb(234, 179, 8)', // amber
  output: 'rgb(52, 211, 153)', // emerald
  error: 'rgb(239, 68, 68)', // red
};

// Pipeline step labels for the progress tracker
const PIPELINE_STEP_LABELS: Record<string, string> = {
  industryMarket: 'Market',
  icpValidation: 'ICP',
  offerAnalysis: 'Offer',
  competitors: 'Competitors',
  keywordIntel: 'Keywords',
  crossAnalysis: 'Synthesis',
  mediaPlan: 'Media Plan',
};

interface PipelineProgressProps {
  currentSection: string;
  completedSections: Set<string>;
}

function PipelineProgress({ currentSection, completedSections }: PipelineProgressProps) {
  const currentIndex = SECTION_PIPELINE.indexOf(currentSection as SectionKey);

  return (
    <div className="flex items-center gap-1 w-full">
      {SECTION_PIPELINE.map((step, index) => {
        const isCompleted = completedSections.has(step);
        const isCurrent = step === currentSection;
        const isFuture = index > currentIndex;

        return (
          <div key={step} className="flex items-center gap-1 flex-1">
            {/* Step indicator */}
            <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <div className="relative flex items-center w-full">
                {/* Track line */}
                <div
                  className="h-[3px] w-full rounded-full transition-colors duration-500"
                  style={{
                    background: isCompleted
                      ? 'rgb(52, 211, 153)'
                      : isCurrent
                        ? 'var(--accent-blue)'
                        : 'var(--bg-hover)',
                  }}
                />
                {/* Active glow */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 h-[3px] rounded-full"
                    style={{ background: 'var(--accent-blue)' }}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[9px] font-mono uppercase tracking-wider truncate w-full text-center transition-colors duration-300',
                  isCompleted && 'text-emerald-400/70',
                  isCurrent && 'text-[var(--accent-blue)]',
                  isFuture && 'text-[var(--text-quaternary)]',
                )}
              >
                {PIPELINE_STEP_LABELS[step] ?? step}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ResearchActivityLogProps {
  section: string;
  sectionLabel: string;
  phase: 'researching' | 'streaming';
  activity?: ResearchJobActivity;
  completedSections?: Set<string>;
}

interface ActivityEntry {
  id: string;
  message: string;
  phase: string;
  isLive: boolean;
}

export function ResearchActivityLog({ section, sectionLabel, phase, activity, completedSections }: ResearchActivityLogProps) {
  const fallbackActivities = SECTION_ACTIVITIES[section] ?? DEFAULT_ACTIVITIES;
  const scrollRef = useRef<HTMLDivElement>(null);

  // Real updates from worker
  const realUpdates = activity?.updates
    ? collapseResearchJobUpdates(activity.updates)
    : [];
  const hasRealUpdates = realUpdates.length > 0;

  // Simulated fallback when no real updates
  const [simVisibleCount, setSimVisibleCount] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hasRealUpdates) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setSimVisibleCount(1);
    intervalRef.current = setInterval(() => {
      setSimVisibleCount((prev) => {
        if (prev >= fallbackActivities.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 3000 + Math.random() * 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [section, fallbackActivities.length, hasRealUpdates]);

  // Build unified entries list
  const entries: ActivityEntry[] = hasRealUpdates
    ? realUpdates.map((u, i) => ({
        id: u.id,
        message: u.message,
        phase: u.phase,
        isLive: i === realUpdates.length - 1 && activity?.status === 'running',
      }))
    : fallbackActivities.slice(0, simVisibleCount).map((msg, i) => ({
        id: `sim-${section}-${i}`,
        message: msg,
        phase: 'runner',
        isLive: i === simVisibleCount - 1 && simVisibleCount <= fallbackActivities.length,
      }));

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [entries.length]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[400px] px-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Pipeline progress tracker */}
        <PipelineProgress
          currentSection={section}
          completedSections={completedSections ?? new Set()}
        />

        {/* Status header */}
        <div className="flex items-center gap-3">
          <motion.div
            className="w-2 h-2 rounded-full bg-[var(--accent-blue)]"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="text-[12px] font-mono uppercase tracking-[0.14em] text-[var(--accent-blue)]">
            {phase === 'streaming' ? 'Processing results' : 'Running research'}
          </span>
          <span className="text-[12px] font-mono text-[var(--text-quaternary)]">
            {sectionLabel}
          </span>
          {hasRealUpdates && (
            <span className="ml-auto text-[9px] font-mono text-emerald-400/50 uppercase tracking-wider">
              live
            </span>
          )}
        </div>

        {/* Activity log */}
        <div
          ref={scrollRef}
          className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] overflow-y-auto max-h-[280px] p-4"
        >
          <AnimatePresence mode="popLayout">
            {entries.map((entry) => {
              const dotColor = entry.isLive
                ? PHASE_COLORS[entry.phase] ?? 'var(--accent-blue)'
                : 'rgb(52, 211, 153)'; // emerald for completed

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.21, 0.45, 0.27, 0.9] }}
                  className="flex items-start gap-3 py-2"
                >
                  {/* Status dot */}
                  <div className="mt-1 shrink-0">
                    {entry.isLive ? (
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: dotColor }}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    ) : (
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: dotColor, opacity: 0.6 }}
                      />
                    )}
                  </div>

                  {/* Message */}
                  <span className={cn(
                    'text-[13px] font-mono leading-relaxed',
                    entry.isLive ? 'text-[var(--text-secondary)]' : 'text-[var(--text-quaternary)]',
                  )}>
                    {entry.message}
                    {entry.isLive && (
                      <motion.span
                        className="inline-block ml-0.5"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        ...
                      </motion.span>
                    )}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Streaming transition message */}
          {phase === 'streaming' && !hasRealUpdates && simVisibleCount > fallbackActivities.length && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 py-2 mt-1 border-t border-[var(--border-glass)] pt-3"
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-[13px] font-mono text-emerald-400/70">
                Processing incoming results
              </span>
            </motion.div>
          )}
        </div>

        {/* Skeleton cards preview */}
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-xl border border-[var(--border-glass)] bg-[var(--bg-glass-panel)] p-4"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
            >
              <div className="space-y-2">
                <div className="h-2 w-16 rounded bg-[var(--bg-hover)]" />
                <div className="h-3 rounded bg-[var(--bg-surface)]" style={{ width: `${40 + i * 20}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
