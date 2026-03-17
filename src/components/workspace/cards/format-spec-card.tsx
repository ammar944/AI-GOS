'use client';

interface FormatSpec {
  platform?: string;
  format?: string;
  dimensions?: string;
  fileTypes?: string[];
  maxDuration?: string;
  notes?: string;
}

interface FormatSpecCardProps {
  specs: Array<Record<string, unknown>>;
}

export function FormatSpecCard({ specs }: FormatSpecCardProps) {
  const typed = specs as FormatSpec[];

  if (typed.length === 0) return null;

  return (
    <div className="space-y-2">
      {typed.map((spec, i) => (
        <div
          key={i}
          className="glass-surface rounded-[var(--radius-md)] p-3 space-y-1"
        >
          <div className="flex items-center gap-3">
            {spec.platform && (
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {spec.platform}
              </span>
            )}
            {spec.format && (
              <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
                {spec.format}
              </span>
            )}
            {spec.dimensions && (
              <span className="ml-auto font-mono text-[11px] text-[var(--text-tertiary)]">
                {spec.dimensions}
              </span>
            )}
          </div>
          {(spec.fileTypes && spec.fileTypes.length > 0) || spec.maxDuration ? (
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
              {spec.fileTypes && spec.fileTypes.length > 0 && (
                <span>{spec.fileTypes.join(', ')}</span>
              )}
              {spec.maxDuration && (
                <span>Max: {spec.maxDuration}</span>
              )}
            </div>
          ) : null}
          {spec.notes && (
            <p className="text-sm text-[var(--text-secondary)]">{spec.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
