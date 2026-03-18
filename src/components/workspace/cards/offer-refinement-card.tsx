'use client';

import { motion } from 'framer-motion';

interface ScoreDimension {
  label: string;
  value: number;
}

export interface OfferRefinementCardProps {
  overallScore: number;
  dimensions: ScoreDimension[];
  priorityFixes: string[];
  actionPlan: string[];
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
        {isWeak && target && (
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-15"
            style={{ width: `${targetPct}%`, background: 'var(--accent-green)' }}
          />
        )}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>
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
  prevScore,
}: OfferRefinementCardProps) {
  const sorted = [...dimensions].sort((a, b) => a.value - b.value);
  const weakDimensions = sorted.filter((d) => d.value < 7);

  return (
    <div className="space-y-4">
      {/* Score breakdown */}
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
              className="text-[18px] font-mono font-bold tabular-nums"
              style={{
                color: overallScore >= 8
                  ? 'var(--accent-green)'
                  : overallScore >= 5
                    ? 'var(--accent-amber)'
                    : 'var(--accent-red)',
              }}
            >
              {overallScore}/10
            </span>
          </div>
        </div>

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
      </div>

      {/* Gap recommendations */}
      {weakDimensions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3
              className="text-[13px] font-semibold"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}
            >
              How to reach 8+
            </h3>
            <span className="text-[11px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
              {weakDimensions.length} gap{weakDimensions.length !== 1 ? 's' : ''}
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
    </div>
  );
}
