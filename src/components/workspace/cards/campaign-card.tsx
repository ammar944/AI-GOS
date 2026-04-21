'use client';

interface CampaignCardProps {
  platform?: string;
  name: string;
  objective?: string;
  adSets?: Array<Record<string, unknown>>;
  singleCampaignRationale?: string;
}

export function CampaignCard({
  platform,
  name,
  objective,
  adSets,
  singleCampaignRationale,
}: CampaignCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
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
      {singleCampaignRationale && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
          <span className="block mb-1 text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            Why one campaign
          </span>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {singleCampaignRationale}
          </p>
        </div>
      )}
    </div>
  );
}
