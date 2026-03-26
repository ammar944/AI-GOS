'use client';

interface AngleCardProps {
  angle: string;
  exampleHook?: string;
  evidence?: string;
}

export function AngleCard({ angle, exampleHook, evidence }: AngleCardProps) {
  return (
    <div className="border-b border-[var(--border-subtle)] py-2.5 last:border-b-0">
      <p className="text-sm font-medium text-[var(--text-primary)]">{angle}</p>
      {exampleHook && (
        <p className="mt-1 text-[13px] italic leading-relaxed text-[var(--text-secondary)]">
          &ldquo;{exampleHook}&rdquo;
        </p>
      )}
      {evidence && (
        <p className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]">{evidence}</p>
      )}
    </div>
  );
}
