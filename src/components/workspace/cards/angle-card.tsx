'use client';

interface AngleCardProps {
  angle: string;
  exampleHook?: string;
  evidence?: string;
}

export function AngleCard({ angle, exampleHook, evidence }: AngleCardProps) {
  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-3 space-y-2">
      <p className="text-sm font-medium text-[var(--text-primary)]">{angle}</p>
      {exampleHook && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{exampleHook}</p>
      )}
      {evidence && (
        <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{evidence}</p>
      )}
    </div>
  );
}
