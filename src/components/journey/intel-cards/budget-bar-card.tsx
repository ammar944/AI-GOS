'use client';

import { motion } from 'framer-motion';
import { IntelCardHeader } from './intel-card-header';

const PLATFORM_COLORS: Record<string, string> = {
  LinkedIn:  'var(--accent-blue)',
  Google:    '#ef4444',
  Meta:      '#3b5998',
  Facebook:  '#3b5998',
  Instagram: '#e1306c',
  Twitter:   '#1da1f2',
  TikTok:    '#000000',
};

export interface BudgetAllocation {
  platform: string;
  percentage: number;
  amount: string;
}

export interface BudgetBarCardProps {
  sectionKey: string;
  totalBudget?: string;
  allocations: BudgetAllocation[];
}

export function BudgetBarCard({ sectionKey, totalBudget, allocations }: BudgetBarCardProps) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}>
      <IntelCardHeader sectionKey={sectionKey} label={totalBudget ? `Budget · ${totalBudget}` : 'Budget Allocation'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allocations.map((alloc, i) => {
          const color = PLATFORM_COLORS[alloc.platform] ?? 'var(--accent-purple, #a855f7)';
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{alloc.platform}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {alloc.percentage}%&nbsp;&nbsp;{alloc.amount}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--border-default)', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${alloc.percentage}%` }}
                  transition={{ duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', borderRadius: 3, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
