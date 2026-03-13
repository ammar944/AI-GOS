'use client';

interface PlatformCardProps {
  platform: string;
  role?: string;
  budgetAllocation?: string;
  rationale?: string;
}

export function PlatformCard({ platform, role, budgetAllocation, rationale }: PlatformCardProps) {
  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-3 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-[var(--text-primary)]">{platform}</p>
        {role && (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {role}
          </span>
        )}
      </div>
      {budgetAllocation && (
        <p className="text-sm text-[var(--text-secondary)]">{budgetAllocation}</p>
      )}
      {rationale && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{rationale}</p>
      )}
    </div>
  );
}
