'use client';

interface CampaignCardProps {
  platform?: string;
  name: string;
  objective?: string;
  adSets?: Array<Record<string, unknown>>;
  namingConvention?: string;
}

export function CampaignCard({ platform, name, objective, adSets, namingConvention }: CampaignCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[14px] leading-[1.55] text-[var(--text-primary)]">{name}</p>
        {platform && (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-quaternary)]">
            {platform}
          </span>
        )}
        {adSets && adSets.length > 0 && (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-quaternary)]">
            {adSets.length} ad sets
          </span>
        )}
      </div>
      {objective && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{objective}</p>
      )}
      {namingConvention && (
        <p className="text-[11px] font-mono text-[var(--text-quaternary)] break-all">{namingConvention}</p>
      )}
    </div>
  );
}
