'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScoreDimension {
  label: string;
  value: number;
}

export interface OfferRefinementCardProps {
  overallScore: number;
  dimensions: ScoreDimension[];
  onRerun: () => void;
  onApproveAsIs: () => void;
  isRerunning?: boolean;
  round?: number;
  prevScore?: number | null;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value * 10));
  const color =
    value >= 7
      ? 'var(--accent-green)'
      : value >= 5
        ? 'var(--accent-amber)'
        : 'var(--accent-red)';
  const strengthLabel = value >= 7 ? 'strong' : value >= 5 ? 'moderate' : 'weak';

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-28 shrink-0 text-[12px] font-mono truncate"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      <span
        className="w-8 text-right text-[12px] font-mono tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
      <span
        className="w-16 text-[10px] font-mono"
        style={{ color: 'var(--text-quaternary)' }}
      >
        {strengthLabel}
      </span>
    </div>
  );
}

export function OfferRefinementCard({
  overallScore,
  dimensions,
  onRerun,
  onApproveAsIs,
  isRerunning,
  round = 0,
  prevScore,
}: OfferRefinementCardProps) {
  const sorted = [...dimensions].sort((a, b) => a.value - b.value);
  const isLowScore = overallScore < 8;
  const isStructuralGap = round >= 2 && isLowScore;
  const weakDimensions = sorted.filter((d) => d.value < 7);

  return (
    <div className="space-y-4">
      {/* Score breakdown card */}
      <div
        className="rounded-2xl border border-white/[0.06] p-5"
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-[15px] font-semibold tracking-[-0.01em]"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Score Breakdown
          </h3>
          <div className="flex items-center gap-2">
            {prevScore !== null && prevScore !== undefined && (
              <span className="text-[11px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
                {prevScore}/10 →
              </span>
            )}
            <span
              className={cn(
                'text-[13px] font-mono font-semibold tabular-nums px-2.5 py-1 rounded-lg',
                overallScore >= 8
                  ? 'text-[var(--accent-green)] bg-[var(--accent-green)]/10'
                  : overallScore >= 5
                    ? 'text-[var(--accent-amber)] bg-[var(--accent-amber)]/10'
                    : 'text-[var(--accent-red)] bg-[var(--accent-red)]/10',
              )}
            >
              {overallScore}/10
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {sorted.map((dim) => (
            <ScoreBar key={dim.label} label={dim.label} value={dim.value} />
          ))}
        </div>

        {/* Weak areas callout */}
        {isLowScore && weakDimensions.length > 0 && (
          <div
            className="mt-4 rounded-xl border border-[var(--accent-amber)]/10 bg-[var(--accent-amber)]/[0.03] px-4 py-3"
          >
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--accent-amber)' }}>
              {weakDimensions.length} dimension{weakDimensions.length !== 1 ? 's' : ''} below
              target: {weakDimensions.map((d) => d.label).join(', ')}.
              Review the recommendations below and use the chat to improve specific fields.
            </p>
          </div>
        )}

        {/* Structural gap message */}
        {isStructuralGap && (
          <div
            className="mt-4 rounded-xl border border-[var(--accent-amber)]/15 bg-[var(--accent-amber)]/[0.04] px-4 py-3"
          >
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--accent-amber)' }}>
              After {round} refinement round{round !== 1 ? 's' : ''}, the remaining gaps may need
              business-level changes — not just better wording. Consider adjusting your
              actual offer, pricing, or proof points.
            </p>
          </div>
        )}

        {/* Score >= 8 success */}
        {!isLowScore && (
          <div
            className="mt-4 rounded-xl border border-[var(--accent-green)]/15 bg-[var(--accent-green)]/[0.04] px-4 py-3"
          >
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--accent-green)' }}>
              Your offer scores strong across all dimensions. Approve to continue to the next section.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isLowScore && (
        <div className="flex items-center gap-3">
          <button
            onClick={onRerun}
            disabled={isRerunning}
            className={cn(
              'cursor-pointer h-10 rounded-xl font-medium text-[13px] px-6 transition-all',
              isRerunning
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)]',
            )}
          >
            {isRerunning ? 'Re-running...' : 'Re-run Analysis'}
          </button>
          <button
            onClick={onApproveAsIs}
            className="cursor-pointer h-10 rounded-xl border border-white/10 text-[13px] font-medium px-6 transition-all hover:border-white/20"
            style={{ color: 'var(--text-secondary)' }}
          >
            Approve as-is
          </button>
        </div>
      )}
    </div>
  );
}
