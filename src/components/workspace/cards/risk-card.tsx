'use client';

import { StatGrid } from './stat-grid';

interface RiskCardProps {
  risk: string;
  category?: string;
  severity?: string;
  likelihood?: string;
  mitigation?: string;
  earlyWarning?: string;
  launchBlocker?: boolean;
}

function getSeverityColor(severity?: string, launchBlocker?: boolean): string {
  if (launchBlocker) return 'var(--accent-red, #ef4444)';
  const s = severity?.toLowerCase();
  if (s === 'critical' || s === 'high') return 'var(--accent-amber, #f59e0b)';
  return 'var(--text-tertiary)';
}

export function RiskCard({
  risk,
  category,
  severity,
  likelihood,
  mitigation,
  earlyWarning,
  launchBlocker,
}: RiskCardProps) {
  const severityColor = getSeverityColor(severity, launchBlocker);

  const stats = [
    ...(severity ? [{ label: 'Severity', value: severity }] : []),
    ...(likelihood ? [{ label: 'Likelihood', value: likelihood }] : []),
    ...(category ? [{ label: 'Category', value: category }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {launchBlocker && (
          <span className="rounded bg-[var(--accent-red,#ef4444)]/15 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--accent-red,#ef4444)]">
            Launch Blocker
          </span>
        )}
        <p className="text-sm font-medium" style={{ color: severityColor }}>
          {risk}
        </p>
      </div>
      {stats.length > 0 && <StatGrid stats={stats} columns={3} />}
      {mitigation && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{mitigation}</p>
      )}
      {earlyWarning && (
        <div className="rounded-[var(--radius-md)] border border-[var(--accent-amber)]/20 bg-[var(--accent-amber)]/[0.06] px-3 py-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-[var(--accent-amber)]/70 block mb-1">
            Early Warning
          </span>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{earlyWarning}</p>
        </div>
      )}
    </div>
  );
}
