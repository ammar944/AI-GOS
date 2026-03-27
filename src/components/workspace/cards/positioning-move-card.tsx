'use client';

import { useMemo } from 'react';

interface PositioningMove {
  move: string;
  targetCompetitor: string;
  risk: string;
  reward: string;
  playbook: string;
}

interface PositioningMoveCardProps {
  moves: PositioningMove[];
}

const REWARD_ORDER = { high: 3, medium: 2, low: 1 };

function Badge({ value, type }: { value: string; type: 'risk' | 'reward' }) {
  const color = type === 'risk'
    ? (value === 'low' ? 'var(--accent-green, #22c55e)' : value === 'high' ? 'var(--accent-red, #ef4444)' : 'var(--text-secondary)')
    : (value === 'high' ? 'var(--accent-green, #22c55e)' : value === 'low' ? 'var(--text-quaternary)' : 'var(--text-secondary)');
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color, background: 'rgba(255,255,255,0.04)' }}
    >
      {value}
    </span>
  );
}

export function PositioningMoveCard({ moves }: PositioningMoveCardProps) {
  const sorted = useMemo(
    () => [...moves].sort((a, b) => (REWARD_ORDER[b.reward as keyof typeof REWARD_ORDER] ?? 0) - (REWARD_ORDER[a.reward as keyof typeof REWARD_ORDER] ?? 0)),
    [moves],
  );
  if (!sorted.length) return null;

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Move</th>
          <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>vs.</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Risk</th>
          <th className="px-2.5 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Reward</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((m, i) => (
          <tr key={i} className="transition-colors" style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <td className="px-2.5 py-2" style={{ color: 'var(--text-primary)' }}>
              <div className="font-medium">{m.move}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{m.playbook}</div>
            </td>
            <td className="px-2.5 py-2 text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{m.targetCompetitor}</td>
            <td className="px-2.5 py-2 text-center"><Badge value={m.risk} type="risk" /></td>
            <td className="px-2.5 py-2 text-center"><Badge value={m.reward} type="reward" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
