'use client';

import { useMemo } from 'react';

interface Refinement {
  refinement: string;
  segment: string;
  expectedLift: string;
  testMethod: string;
  risk: string;
}

interface RefinementCardProps {
  refinements: Refinement[];
}

const LIFT_ORDER = { high: 3, moderate: 2, low: 1 };

function LiftBadge({ value }: { value: string }) {
  const color = value === 'high' ? 'var(--accent-green)' : value === 'moderate' ? 'var(--accent-amber)' : 'var(--text-quaternary)';
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color, background: 'rgba(255,255,255,0.04)' }}
    >
      {value} lift
    </span>
  );
}

export function RefinementCard({ refinements }: RefinementCardProps) {
  const sorted = useMemo(
    () => [...refinements].sort((a, b) => (LIFT_ORDER[b.expectedLift as keyof typeof LIFT_ORDER] ?? 0) - (LIFT_ORDER[a.expectedLift as keyof typeof LIFT_ORDER] ?? 0)),
    [refinements],
  );
  if (!sorted.length) return null;

  return (
    <div className="space-y-3">
      {sorted.map((r, i) => (
        <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-glass)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{r.refinement}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{r.segment}</div>
            </div>
            <LiftBadge value={r.expectedLift} />
          </div>
          <div className="mt-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Test: </span>
            {r.testMethod}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Risk: </span>
            {r.risk}
          </div>
        </div>
      ))}
    </div>
  );
}
