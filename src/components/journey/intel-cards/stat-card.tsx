'use client';

import { motion } from 'framer-motion';
import { IntelCardHeader } from './intel-card-header';

export interface StatCardProps {
  sectionKey: string;
  label: string;
  value: number;
  max?: number;
}

export function StatCard({ sectionKey, label, value, max = 10 }: StatCardProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const color = pct >= 70 ? 'var(--accent-green, #22c55e)' : pct >= 50 ? '#f59e0b' : 'var(--status-error, #ef4444)';

  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={label} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 36, fontWeight: 700, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>/{max}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--border-default)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ height: '100%', borderRadius: 2, background: color }}
        />
      </div>
    </div>
  );
}
