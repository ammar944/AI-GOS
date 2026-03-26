'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface IceFix {
  issue: string;
  fix: string;
  impact: number;
  confidence: number;
  ease: number;
  iceScore: number;
}

interface IceTableProps {
  fixes: IceFix[];
}

type SortKey = 'iceScore' | 'impact' | 'confidence' | 'ease';

export function IceTable({ fixes }: IceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('iceScore');

  const sorted = useMemo(
    () => [...fixes].sort((a, b) => b[sortKey] - a[sortKey]),
    [fixes, sortKey],
  );

  if (!fixes.length) {
    return (
      <p className="py-3 text-[13px]" style={{ color: 'var(--text-tertiary)' }}>
        No critical improvements identified
      </p>
    );
  }

  const th = (label: string, key: SortKey, align?: 'right') => (
    <th
      className={cn(
        'cursor-pointer select-none px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase tracking-wider transition-colors hover:text-[var(--text-tertiary)]',
        align === 'right' && 'text-right',
      )}
      style={{ color: sortKey === key ? 'var(--text-secondary)' : 'var(--text-quaternary)' }}
      onClick={() => setSortKey(key)}
    >
      {label}
    </th>
  );

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <th
            className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-quaternary)' }}
          >
            Improvement
          </th>
          {th('I', 'impact', 'right')}
          {th('C', 'confidence', 'right')}
          {th('E', 'ease', 'right')}
          {th('ICE', 'iceScore', 'right')}
        </tr>
      </thead>
      <tbody>
        {sorted.map((fix, i) => (
          <tr
            key={i}
            className="transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <td className="px-2.5 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
              {fix.fix || fix.issue}
            </td>
            <td className="px-2.5 py-2 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {fix.impact}
            </td>
            <td className="px-2.5 py-2 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {fix.confidence}
            </td>
            <td className="px-2.5 py-2 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {fix.ease}
            </td>
            <td
              className="px-2.5 py-2 text-right font-mono font-semibold tabular-nums"
              style={{
                color: fix.iceScore >= 400
                  ? 'var(--accent-green, #22c55e)'
                  : fix.iceScore >= 200
                    ? 'var(--text-primary)'
                    : 'var(--text-quaternary)',
              }}
            >
              {fix.iceScore}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
