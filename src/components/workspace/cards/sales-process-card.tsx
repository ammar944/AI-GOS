'use client';

import { BulletList } from './bullet-list';

interface SalesProcessCardProps {
  diagnosticNote?: string;
  improvementLevers?: string[];
  sopReference?: string;
}

export function SalesProcessCard({ diagnosticNote, improvementLevers, sopReference }: SalesProcessCardProps) {
  const levers = (improvementLevers ?? []).filter(Boolean);
  if (!diagnosticNote && levers.length === 0 && !sopReference) return null;
  return (
    <div className="space-y-3">
      {diagnosticNote && (
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{diagnosticNote}</p>
      )}
      {levers.length > 0 && (
        <BulletList title="Improvement levers (conversion lift without changing ads)" items={levers} />
      )}
      {sopReference && (
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">Reference: </span>{sopReference}
        </div>
      )}
    </div>
  );
}
