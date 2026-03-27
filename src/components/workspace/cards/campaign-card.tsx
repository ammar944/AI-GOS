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
        <p className="text-sm font-medium text-[var(--text-primary)]">{name}</p>
        {platform && (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {platform}
          </span>
        )}
        {adSets && adSets.length > 0 && (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)]">
            {adSets.length} ad sets
          </span>
        )}
      </div>
      {objective && (
        <p className="text-sm text-[var(--text-secondary)]">{objective}</p>
      )}
      {namingConvention && (
        <p className="text-xs font-mono text-[var(--text-tertiary)] break-all">{namingConvention}</p>
      )}
    </div>
  );
}
