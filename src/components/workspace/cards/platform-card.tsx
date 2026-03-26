'use client';

interface PlatformCardProps {
  platform: string;
  role?: string;
  budgetAllocation?: string;
  rationale?: string;
}

export function PlatformCard({ platform, role, budgetAllocation, rationale }: PlatformCardProps) {
  return (
    <div className="py-1 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[14px] leading-[1.55] text-[var(--text-primary)]">{platform}</p>
        {role && (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-quaternary)]">
            {role}
          </span>
        )}
      </div>
      {budgetAllocation && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{budgetAllocation}</p>
      )}
      {rationale && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{rationale}</p>
      )}
    </div>
  );
}
