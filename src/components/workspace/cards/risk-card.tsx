'use client';

import { StatGrid } from './stat-grid';

interface RiskCardProps {
  risk: string;
  category?: string;
  severity?: string;
  likelihood?: string;
  mitigation?: string;
  earlyWarning?: string;
}

function getSeverityColor(severity?: string): string {
  const s = severity?.toLowerCase();
  if (s === 'critical') return 'var(--accent-red, #ef4444)';
  if (s === 'high') return '#f59e0b';
  return 'var(--text-tertiary)';
}

export function RiskCard({ risk, category, severity, likelihood, mitigation, earlyWarning }: RiskCardProps) {
  const severityColor = getSeverityColor(severity);

  const stats = [
    ...(severity ? [{ label: 'Severity', value: severity }] : []),
    ...(likelihood ? [{ label: 'Likelihood', value: likelihood }] : []),
    ...(category ? [{ label: 'Category', value: category }] : []),
  ];

  return (
    <div className="space-y-2">
      <p className="text-[14px] leading-[1.55] font-medium" style={{ color: severityColor }}>
        {risk}
      </p>
      {stats.length > 0 && <StatGrid stats={stats} columns={3} />}
      {mitigation && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{mitigation}</p>
      )}
      {earlyWarning && (
        <div className="border-l-2 border-l-[var(--accent-amber)] py-2 pl-3 pr-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-quaternary)] block mb-0.5">
            Early Warning
          </span>
          <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{earlyWarning}</p>
        </div>
      )}
    </div>
  );
}
