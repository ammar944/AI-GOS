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
        <p className="text-sm font-medium text-[var(--text-primary)]">{theme}</p>
        {targetSegment && (
          <span className="shrink-0 rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {targetSegment}
          </span>
        )}
      </div>
      {hook && (
        <p className="text-sm italic leading-relaxed text-[var(--text-secondary)]">
          &ldquo;{hook}&rdquo;
        </p>
      )}
      {messagingApproach && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{messagingApproach}</p>
      )}
    </div>
  );
}
