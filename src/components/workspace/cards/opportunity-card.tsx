'use client';

import { useMemo } from 'react';

interface Opportunity {
  opportunity: string;
  size: string;
  timing: string;
  difficulty: string;
  evidence: string;
}

interface OpportunityCardProps {
  opportunities: Opportunity[];
}

const SIZE_ORDER = { large: 3, medium: 2, small: 1 } as const;

/**
 * Chip color per token. One accent semantic per axis:
 *  - size: green=large, amber=medium, zinc=small
 *  - timing: green=now, amber=3-6mo, zinc=6-12mo
 *  - difficulty: green=low (easy win), amber=mid, red=high
 * Spec ref: 03-design-system-spec.md § "Semantic (dots + retry chips only — not decoration)"
 */
const CHIP_COLOR: Record<string, string> = {
  large: 'var(--accent-green)',
  medium: 'var(--accent-amber)',
  small: 'var(--text-tertiary)',
  now: 'var(--accent-green)',
  '3-6 months': 'var(--accent-amber)',
  '6-12 months': 'var(--text-tertiary)',
  low: 'var(--accent-green)',
  high: 'var(--accent-red)',
};

function Chip({ value }: { value: string }) {
  const color = CHIP_COLOR[value.toLowerCase()] ?? 'var(--text-tertiary)';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[3px] px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-[0.12em]"
      style={{
        color,
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {value}
    </span>
  );
}

export function OpportunityCard({ opportunities }: OpportunityCardProps) {
  const sorted = useMemo(
    () => [...opportunities].sort(
      (a, b) =>
        (SIZE_ORDER[b.size.toLowerCase() as keyof typeof SIZE_ORDER] ?? 0) -
        (SIZE_ORDER[a.size.toLowerCase() as keyof typeof SIZE_ORDER] ?? 0),
    ),
    [opportunities],
  );

  if (!sorted.length) return null;

  return (
    <div className="w-full">
      {/* Column headers — mono label row */}
      <div
        className="grid items-center gap-3 pb-2 text-[10px] font-mono font-medium uppercase tracking-[0.12em]"
        style={{
          gridTemplateColumns: 'minmax(0, 1fr) 72px 88px 88px',
          color: 'var(--text-tertiary)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span>Opportunity</span>
        <span className="text-center">Size</span>
        <span className="text-center">Timing</span>
        <span className="text-center">Difficulty</span>
      </div>

      {/* Rows — each separated by a hairline, prose clamped to readable measure */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {sorted.map((opp, i) => (
          <div
            key={i}
            className="grid items-start gap-3 py-3 transition-colors hover:bg-[var(--bg-hover)]/40"
            style={{ gridTemplateColumns: 'minmax(0, 1fr) 72px 88px 88px' }}
          >
            <div className="min-w-0 max-w-[60ch]">
              <p className="text-[13px] leading-[1.45] font-medium text-[var(--text-primary)]">
                {opp.opportunity}
              </p>
              {opp.evidence ? (
                <p className="mt-1 text-[11px] leading-[1.5] text-[var(--text-tertiary)]">
                  {opp.evidence}
                </p>
              ) : null}
            </div>
            <div className="flex justify-center pt-0.5">
              <Chip value={opp.size} />
            </div>
            <div className="flex justify-center pt-0.5">
              <Chip value={opp.timing} />
            </div>
            <div className="flex justify-center pt-0.5">
              <Chip value={opp.difficulty} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
