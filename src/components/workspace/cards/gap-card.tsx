'use client';

import { StatGrid } from './stat-grid';

interface GapCardProps {
  gap: string;
  type?: string;
  evidence?: string;
  exploitability?: number;
  impact?: number;
  recommendedAction?: string;
}

export function GapCard({ gap, type, evidence, exploitability, impact, recommendedAction }: GapCardProps) {
  const stats = [
    ...(exploitability !== undefined ? [{ label: 'Exploitability', value: `${exploitability}/10` }] : []),
    ...(impact !== undefined ? [{ label: 'Impact', value: `${impact}/10` }] : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[14px] leading-[1.55] text-[var(--text-primary)]">{gap}</p>
        {type && (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-quaternary)]">
            {type}
          </span>
        )}
      </div>
      {evidence && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{evidence}</p>
      )}
      {stats.length > 0 && <StatGrid stats={stats} columns={2} />}
      {recommendedAction && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{recommendedAction}</p>
      )}
    </div>
  );
}
