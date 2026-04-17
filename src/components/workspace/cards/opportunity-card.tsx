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

const SIZE_ORDER = { large: 3, medium: 2, small: 1 };
const BADGE_COLORS: Record<string, string> = {
  large: 'var(--accent-green)',
  medium: 'var(--accent-amber)',
  small: 'var(--text-tertiary)',
  now: 'var(--accent-green)',
  '3-6 months': 'var(--accent-amber)',
  '6-12 months': 'var(--text-tertiary)',
  low: 'var(--accent-green)',
  high: 'var(--accent-red)',
};

function Badge({ value }: { value: string }) {
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color: BADGE_COLORS[value] ?? 'var(--text-tertiary)', background: 'rgba(255,255,255,0.04)' }}
    >
      {value}
    </span>
  );
}

export function OpportunityCard({ opportunities }: OpportunityCardProps) {
  const sorted = useMemo(
    () => [...opportunities].sort((a, b) => (SIZE_ORDER[b.size as keyof typeof SIZE_ORDER] ?? 0) - (SIZE_ORDER[a.size as keyof typeof SIZE_ORDER] ?? 0)),
    [opportunities],
  );

  if (!sorted.length) return null;

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Opportunity</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Size</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Timing</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Difficulty</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((opp, i) => (
          <tr key={i} className="transition-colors" style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <td className="px-2.5 py-2" style={{ color: 'var(--text-primary)' }}>
              <div className="font-medium">{opp.opportunity}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{opp.evidence}</div>
            </td>
            <td className="px-2.5 py-2 text-center"><Badge value={opp.size} /></td>
            <td className="px-2.5 py-2 text-center"><Badge value={opp.timing} /></td>
            <td className="px-2.5 py-2 text-center"><Badge value={opp.difficulty} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
