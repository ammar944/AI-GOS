'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import type { SectionKey } from '@/lib/workspace/types';

/**
 * Approval Gate — bundle ref: preview/component-approval-gate.html.
 *
 * Three explicit states:
 *   A) complete      → all research approved, primary enabled
 *   B) partial       → some still researching, primary disabled w/ "unlock when done"
 *   C) failure       → one or more errored, primary becomes "Generate without →"
 *                       + secondary is retry CTA (wired to onRetrySection)
 *
 * Layout: 1fr auto auto grid — left caption+title+body, right 2 buttons.
 * Typography: Instrument Serif 22px title, Geist mono-xs caption,
 * Geist 13px body. No blue accent — spec forbids decorative accent,
 * action button uses accent-green (commit semantic).
 */

interface ApprovalGateProps {
  /** Research sections in scope for the gate (excludes mediaPlan + scripts). */
  researchSections: readonly SectionKey[];
  onGenerate: () => void;
  onReview?: () => void;
  onRetryFailed?: (section: SectionKey) => void;
  isGenerating?: boolean;
}

type GateState = 'complete' | 'partial' | 'failure';

const LABEL_BY_SECTION: Record<SectionKey, string> = {
  industryMarket: 'Market',
  icpValidation: 'ICP',
  competitors: 'Competitors',
  offerAnalysis: 'Offer',
  keywordIntel: 'Keywords',
  crossAnalysis: 'Strategy',
  mediaPlan: 'Media plan',
  scripts: 'Scripts',
};

export function ApprovalGate({
  researchSections,
  onGenerate,
  onReview,
  onRetryFailed,
  isGenerating,
}: ApprovalGateProps) {
  const { state } = useWorkspace();

  const summary = useMemo(() => {
    const total = researchSections.length;
    let approved = 0;
    let researching = 0;
    const failed: SectionKey[] = [];

    for (const key of researchSections) {
      const phase = state.sectionStates[key];
      if (phase === 'approved' || phase === 'review') approved += 1;
      if (phase === 'researching' || phase === 'streaming') researching += 1;
      if (phase === 'error') failed.push(key);
    }

    const gateState: GateState =
      failed.length > 0 ? 'failure' : approved === total ? 'complete' : 'partial';

    return { total, approved, researching, failed, gateState };
  }, [researchSections, state.sectionStates]);

  const { total, approved, researching, failed, gateState } = summary;

  // Caption dot + text
  const dotClass =
    gateState === 'complete'
      ? 'bg-[var(--accent-green)]'
      : gateState === 'partial'
        ? 'bg-[var(--accent-amber)] animate-pulse'
        : 'bg-[var(--text-tertiary)]';

  const captionText =
    gateState === 'complete'
      ? `${total} of ${total} · approved`
      : gateState === 'failure'
        ? `${approved} of ${total} · ${failed.length} failed`
        : `${approved} of ${total} · ${researching} researching`;

  // Body copy
  const bodyText =
    gateState === 'complete'
      ? 'Synthesize approved research into a strategic plan with budget, phasing, and creative.'
      : gateState === 'failure'
        ? `${LABEL_BY_SECTION[failed[0]] ?? 'One section'} failed. Retry it or proceed without — projected confidence will drop.`
        : `${researching === 1 ? 'One section is' : `${researching} sections are`} still running. Plan generation will unlock when research is complete.`;

  const primaryDisabled = gateState === 'partial' || isGenerating;
  const primaryLabel =
    gateState === 'failure' ? 'Generate without →' : 'Generate media plan →';

  const firstFailed = failed[0];

  return (
    <div
      className={cn(
        'rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-card)]',
        'grid items-center gap-4',
        'px-5 py-4 sm:px-6 sm:py-5',
      )}
      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto auto' }}
    >
      {/* Left: caption, title, body */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--text-tertiary)] mb-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotClass)} />
          <span>{captionText}</span>
        </div>
        <h3
          className="text-[22px] italic font-normal leading-[1.15] tracking-tight text-[var(--text-primary)] truncate"
          style={{ fontFamily: 'var(--font-instrument-sans)' }}
        >
          Generate media plan
        </h3>
        <p className="mt-1 text-[13px] leading-[1.5] text-[var(--text-secondary)] max-w-[62ch]">
          {bodyText}
        </p>
      </div>

      {/* Secondary button — varies by state */}
      <button
        type="button"
        onClick={
          gateState === 'failure' && firstFailed && onRetryFailed
            ? () => onRetryFailed(firstFailed)
            : onReview
        }
        className={cn(
          'cursor-pointer shrink-0 rounded-[4px] border border-[var(--border-default)]',
          'bg-transparent hover:bg-[var(--bg-hover)] hover:border-[var(--text-tertiary)]',
          'px-3.5 py-2 text-[13px] font-medium text-[var(--text-primary)]',
          'transition-colors duration-150',
        )}
      >
        {gateState === 'failure' && firstFailed
          ? `Retry ${LABEL_BY_SECTION[firstFailed] ?? 'section'}`
          : 'Review sections'}
      </button>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={primaryDisabled}
        className={cn(
          'cursor-pointer shrink-0 inline-flex items-center gap-2 rounded-[4px]',
          'px-3.5 py-2 text-[13px] font-medium text-white',
          'bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90',
          'transition-colors duration-150',
          primaryDisabled && 'opacity-45 cursor-not-allowed hover:bg-[var(--accent-green)]',
        )}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            <span>Generating…</span>
          </>
        ) : (
          primaryLabel
        )}
      </button>
    </div>
  );
}
