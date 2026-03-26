'use client';

interface CreativeAngleCardProps {
  theme: string;
  hook?: string;
  messagingApproach?: string;
  targetSegment?: string;
}

export function CreativeAngleCard({ theme, hook, messagingApproach, targetSegment }: CreativeAngleCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] leading-[1.55] text-[var(--text-primary)]">{theme}</p>
        {targetSegment && (
          <span className="shrink-0 rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-quaternary)]">
            {targetSegment}
          </span>
        )}
      </div>
      {hook && (
        <p className="text-[13px] leading-snug italic text-[var(--text-secondary)]">
          &ldquo;{hook}&rdquo;
        </p>
      )}
      {messagingApproach && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{messagingApproach}</p>
      )}
    </div>
  );
}
