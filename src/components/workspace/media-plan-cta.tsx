'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { scaleIn, springs } from '@/lib/motion';
import { RESEARCH_SECTIONS } from '@/lib/workspace/pipeline';
import type { SectionKey, SectionPhase } from '@/lib/workspace/types';

const SECTION_LABELS: Record<Exclude<SectionKey, 'mediaPlan'>, string> = {
  industryMarket: 'Market Overview',
  competitors: 'Competitor Intel',
  icpValidation: 'ICP Validation',
  offerAnalysis: 'Offer Analysis',
  keywordIntel: 'Keyword Intelligence',
  crossAnalysis: 'Strategic Synthesis',
};

interface MediaPlanCtaProps {
  sectionStates: Record<SectionKey, SectionPhase>;
  onGenerateMediaPlan: () => void;
  mediaPlanGenerating?: boolean;
}

export function MediaPlanCta({ sectionStates, onGenerateMediaPlan, mediaPlanGenerating }: MediaPlanCtaProps) {
  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={springs.smooth}
      className={cn(
        'mt-8 mb-2 rounded-2xl border border-[var(--border-default)]',
        'bg-[var(--bg-surface)]',
        'overflow-hidden',
      )}
    >
      {/* Top accent bar */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent-blue)]/40 to-transparent" />

      <div className="px-7 py-7">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            {/* Module tag */}
            <span className="text-xs font-mono text-[var(--accent-blue)] uppercase tracking-widest">
              Research Complete
            </span>

            <h2 className="mt-2 font-heading text-xl font-semibold text-[var(--text-primary)] leading-snug">
              All research modules ready
            </h2>

            <p className="mt-1.5 text-sm text-[var(--text-tertiary)] leading-relaxed max-w-[420px]">
              Your 6 research modules are complete. Generate a comprehensive media plan based on the findings.
            </p>
          </div>

          {/* CTA button */}
          <div className="shrink-0 pt-1">
            <motion.button
              type="button"
              onClick={onGenerateMediaPlan}
              disabled={mediaPlanGenerating || !onGenerateMediaPlan}
              whileTap={mediaPlanGenerating ? undefined : { scale: 0.97 }}
              className={cn(
                'cursor-pointer rounded-[var(--radius-md)] px-6 py-3',
                'text-sm font-semibold text-white',
                'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)]',
                'transition-opacity hover:opacity-90',
                mediaPlanGenerating && 'opacity-50 cursor-not-allowed',
              )}
            >
              {mediaPlanGenerating ? 'Generating\u2026' : 'Generate Media Plan \u2192'}
            </motion.button>
          </div>
        </div>

        {/* Completed section checklist */}
        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
          {RESEARCH_SECTIONS.map((section, i) => {
            const phase = sectionStates[section];
            const isApproved = phase === 'approved';
            return (
              <motion.div
                key={section}
                className="flex items-center gap-2.5"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, ...springs.snappy }}
              >
                {/* Check icon */}
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    isApproved
                      ? 'bg-[var(--accent-green)]/15 text-[var(--accent-green)]'
                      : 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]',
                  )}
                >
                  <svg
                    className="h-2.5 w-2.5"
                    viewBox="0 0 10 10"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 5.5L4 7.5L8 3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>

                {/* Label */}
                <span
                  className={cn(
                    'text-xs font-mono',
                    isApproved ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]',
                  )}
                >
                  {SECTION_LABELS[section as Exclude<SectionKey, 'mediaPlan'>]}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent-blue)]/10 to-transparent" />
    </motion.div>
  );
}
