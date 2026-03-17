'use client';

import { BulletList } from './bullet-list';
import { StatGrid } from './stat-grid';

interface TestingPlanCardProps {
  firstTests?: string[];
  methodology?: string;
  minBudgetPerTest?: number;
}

export function TestingPlanCard({ firstTests, methodology, minBudgetPerTest }: TestingPlanCardProps) {
  const stats = [
    ...(minBudgetPerTest !== undefined
      ? [{ label: 'Min Budget / Test', value: `$${minBudgetPerTest.toLocaleString()}` }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {methodology && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{methodology}</p>
      )}
      {firstTests && firstTests.length > 0 && (
        <BulletList title="First Tests" items={firstTests} />
      )}
      {stats.length > 0 && <StatGrid stats={stats} columns={2} />}
    </div>
  );
}
