'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const SECTION_ACTIVITIES: Record<string, string[]> = {
  industryMarket: [
    'Querying market intelligence sources',
    'Analyzing industry vertical and TAM',
    'Extracting market growth indicators',
    'Mapping competitive landscape',
    'Synthesizing market overview',
  ],
  competitors: [
    'Identifying competitor domains',
    'Scraping competitor positioning',
    'Analyzing pricing strategies',
    'Mapping feature comparisons',
    'Building competitive matrix',
  ],
  icpValidation: [
    'Analyzing target audience signals',
    'Validating ICP demographics',
    'Mapping buyer journey stages',
    'Identifying pain point patterns',
    'Scoring ICP confidence',
  ],
  offerAnalysis: [
    'Evaluating value proposition',
    'Analyzing pricing tiers',
    'Mapping offer-to-ICP alignment',
    'Assessing competitive positioning',
    'Generating offer recommendations',
  ],
  keywordIntel: [
    'Querying keyword databases',
    'Analyzing search volume data',
    'Mapping keyword competition',
    'Identifying long-tail opportunities',
    'Building keyword strategy',
  ],
  crossAnalysis: [
    'Cross-referencing all research',
    'Identifying strategic patterns',
    'Scoring section confidence',
    'Generating synthesis insights',
    'Compiling strategic recommendations',
  ],
};

const DEFAULT_ACTIVITIES = [
  'Initializing research pipeline',
  'Gathering intelligence',
  'Processing data sources',
  'Analyzing patterns',
  'Compiling results',
];

interface ResearchActivityLogProps {
  section: string;
  sectionLabel: string;
  phase: 'researching' | 'streaming';
}

export function ResearchActivityLog({ section, sectionLabel, phase }: ResearchActivityLogProps) {
  const activities = SECTION_ACTIVITIES[section] ?? DEFAULT_ACTIVITIES;
  const [visibleCount, setVisibleCount] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setVisibleCount(1);

    intervalRef.current = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev >= activities.length) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 3000 + Math.random() * 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [section, activities.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [visibleCount]);

  const visibleActivities = activities.slice(0, visibleCount);
  const activeIndex = visibleCount - 1;

  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[400px] px-6">
      <div className="w-full max-w-md flex flex-col gap-6">
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
          <span className="text-[12px] font-mono text-white/20">
            {sectionLabel}
          </span>
        </div>

        {/* Activity log */}
        <div
          ref={scrollRef}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-y-auto max-h-[280px] p-4"
        >
          <AnimatePresence mode="popLayout">
            {visibleActivities.map((activity, i) => {
              const isActive = i === activeIndex && visibleCount <= activities.length;
              const isCompleted = i < activeIndex || visibleCount > activities.length;

              return (
                <motion.div
                  key={`${section}-${i}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.21, 0.45, 0.27, 0.9] }}
                  className="flex items-start gap-3 py-2"
                >
                  {/* Status dot */}
                  <div className="mt-1 shrink-0">
                    {isActive ? (
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    ) : (
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        isCompleted ? 'bg-emerald-400/60' : 'bg-white/15',
                      )} />
                    )}
                  </div>

                  {/* Message */}
                  <span className={cn(
                    'text-[13px] font-mono leading-relaxed',
                    isActive ? 'text-white/70' : 'text-white/30',
                  )}>
                    {activity}
                    {isActive && (
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
          {phase === 'streaming' && visibleCount > activities.length && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 py-2 mt-1 border-t border-white/[0.04] pt-3"
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
              className="rounded-xl border border-white/[0.04] bg-white/[0.015] p-4"
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
            >
              <div className="space-y-2">
                <div className="h-2 w-16 rounded bg-white/[0.06]" />
                <div className="h-3 rounded bg-white/[0.03]" style={{ width: `${40 + i * 20}%` }} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
