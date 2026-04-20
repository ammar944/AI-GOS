'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectionKey, SectionPhase } from '@/lib/workspace/types';

interface MediaPlanCtaProps {
  sectionStates: Record<SectionKey, SectionPhase>;
  onGenerateMediaPlan: () => void;
  mediaPlanGenerating?: boolean;
}

export function MediaPlanCta({ onGenerateMediaPlan, mediaPlanGenerating }: MediaPlanCtaProps) {
  return (
    <div
      className={cn(
        'mt-8 mb-2 rounded-[var(--radius-lg)]',
        'border-l-2 border-l-[var(--accent-green)] border border-[var(--border-subtle)]',
        'bg-[var(--bg-card)]',
      )}
    >
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <span className="text-[11px] font-mono text-[var(--accent-green)] uppercase tracking-[0.06em]">
              Research Complete
            </span>

            <h2 className="mt-1.5 font-heading text-lg font-semibold text-[var(--text-primary)] leading-snug">
              All research modules approved
            </h2>

            <p className="mt-1 text-sm text-[var(--text-tertiary)] leading-relaxed max-w-[420px]">
              Generate a media plan from your 6 approved research sections.
            </p>
          </div>

          <div className="shrink-0 pt-1">
            <button
              type="button"
              onClick={onGenerateMediaPlan}
              disabled={mediaPlanGenerating || !onGenerateMediaPlan}
              className={cn(
                'inline-flex items-center justify-center gap-2 cursor-pointer rounded-[var(--radius-md)] px-5 py-2.5',
                'text-[13px] font-semibold text-white',
                'bg-[var(--accent-green)]',
                'transition-opacity duration-150 hover:opacity-90',
                mediaPlanGenerating && 'opacity-50 cursor-not-allowed',
              )}
            >
              {mediaPlanGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  <span>Generating&hellip;</span>
                </>
              ) : (
                'Generate Media Plan'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
