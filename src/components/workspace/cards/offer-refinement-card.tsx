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
  priorityFixes: string[];
  actionPlan: string[];
  onRerun: () => void;
  onApproveAsIs: () => void;
  isRerunning?: boolean;
  round?: number;
  prevScore?: number | null;
}

function ScoreBar({ label, value, target }: { label: string; value: number; target?: number }) {
  const pct = Math.max(0, Math.min(100, value * 10));
  const targetPct = target ? Math.max(0, Math.min(100, target * 10)) : 0;
  const isWeak = value < 7;
  const color =
    value >= 7
      ? 'var(--accent-green)'
      : value >= 5
        ? 'var(--accent-amber)'
        : 'var(--accent-red)';

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-28 shrink-0 text-[12px] font-mono truncate"
        style={{ color: isWeak ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <div className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
        {/* Target ghost bar */}
        {isWeak && target && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-15"
            style={{ width: `${targetPct}%`, background: 'var(--accent-green)' }}
          />
        )}
        {/* Current bar */}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
      {/* Score display */}
      <div className="flex items-center gap-1 shrink-0">
        <span
          className="text-[12px] font-mono font-semibold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
        {isWeak && target && (
          <>
            <span className="text-[10px]" style={{ color: 'var(--text-quaternary)' }}>→</span>
            <span
              className="text-[12px] font-mono font-semibold tabular-nums"
              style={{ color: 'var(--accent-green)' }}
            >
              {target}+
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ dimension, score, fix }: { dimension: string; score: number; fix: string }) {
  return (
    <div
      className="rounded-xl border border-white/[0.06] p-4 transition-colors hover:border-white/[0.1]"
      style={{ background: 'var(--bg-card)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md tabular-nums"
          style={{
            color: score < 5 ? 'var(--accent-red)' : 'var(--accent-amber)',
            background: score < 5 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${score < 5 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
          }}
        >
          {score}/10 → 8+
        </span>
        <span
          className="text-[12px] font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
        >
          {dimension}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {fix}
      </p>
    </div>
  );
}

export function OfferRefinementCard({
  overallScore,
  dimensions,
  priorityFixes,
  actionPlan,
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
      {/* Overall score header */}
      <div
        className="rounded-2xl border border-white/[0.06] p-5"
        style={{ background: 'var(--bg-card)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3
            className="text-[15px] font-semibold tracking-[-0.01em]"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
          >
            Offer Score
          </h3>
          <div className="flex items-center gap-2">
            {prevScore !== null && prevScore !== undefined && (
              <span className="text-[12px] font-mono line-through" style={{ color: 'var(--text-quaternary)' }}>
                {prevScore}
              </span>
            )}
            <span
              className={cn(
                'text-[18px] font-mono font-bold tabular-nums px-3 py-1 rounded-lg',
                overallScore >= 8
                  ? 'text-[var(--accent-green)] bg-[var(--accent-green)]/10'
                  : overallScore >= 5
                    ? 'text-[var(--accent-amber)] bg-[var(--accent-amber)]/10'
                    : 'text-[var(--accent-red)] bg-[var(--accent-red)]/10',
              )}
            >
              {overallScore}/10
            </span>
            {isLowScore && (
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
                → 8+ to pass
              </span>
            )}
          </div>
        </div>

        {/* Dimension bars with targets */}
        <div className="space-y-2.5">
          {sorted.map((dim) => (
            <ScoreBar
              key={dim.label}
              label={dim.label}
              value={dim.value}
              target={dim.value < 7 ? 8 : undefined}
            />
          ))}
        </div>

        {/* Score >= 8 success */}
        {!isLowScore && (
          <div className="mt-4 rounded-xl border border-[var(--accent-green)]/15 bg-[var(--accent-green)]/[0.04] px-4 py-3">
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--accent-green)' }}>
              Your offer scores strong across all dimensions. Approve to continue.
            </p>
          </div>
        )}
      </div>

      {/* Improvement recommendations — one per weak dimension */}
      {isLowScore && weakDimensions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3
              className="text-[13px] font-semibold"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
            >
              How to reach 8+
            </h3>
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
              {weakDimensions.length} area{weakDimensions.length !== 1 ? 's' : ''} to improve
            </span>
          </div>

          <div className="space-y-2">
            {weakDimensions.map((dim, i) => (
              <RecommendationCard
                key={dim.label}
                dimension={dim.label}
                score={dim.value}
                fix={priorityFixes[i] ?? actionPlan[i] ?? `Improve your ${dim.label.toLowerCase()} to strengthen your offer positioning.`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Structural gap warning */}
      {isStructuralGap && (
        <div className="rounded-xl border border-[var(--accent-amber)]/15 bg-[var(--accent-amber)]/[0.04] px-4 py-3">
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--accent-amber)' }}>
            After {round} refinement round{round !== 1 ? 's' : ''}, the remaining gaps may require
            actual business changes — adjusting your offer, pricing, or proof points.
          </p>
        </div>
      )}

      {/* Action buttons */}
      {isLowScore && (
        <div className="flex items-center gap-3 pt-1">
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
