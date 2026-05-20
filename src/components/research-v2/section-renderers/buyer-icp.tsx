import { cn } from '@/lib/utils';
import type { BuyerICPArtifact } from '@/lib/managed-agents/schemas/buyer-icp';

import {
  DataTable,
  SubsectionBlock,
  type DataTableColumn,
} from '../primitives';

export interface BuyerICPRendererProps {
  artifact: BuyerICPArtifact;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SourceLink({ url }: { url?: string }): React.ReactElement | null {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[10px] uppercase tracking-[0.04em] text-[color:var(--accent-blue)] no-underline hover:underline"
    >
      {hostnameOf(url)} →
    </a>
  );
}

function MonoPill({
  value,
  label,
}: {
  value: string;
  label?: string;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--bg-chip)] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-[color:var(--accent-blue)]">
      {label ?? value}
    </span>
  );
}

const CUT_TYPE_LABEL: Record<string, string> = {
  industry: 'Industry',
  employeeBands: 'Employee bands',
  revenueBands: 'Revenue bands',
  geography: 'Geography',
  techStack: 'Tech stack',
};

const ROLE_LABEL: Record<string, string> = {
  champion: 'Champion',
  'economic-buyer': 'Economic buyer',
  'decision-maker': 'Decision maker',
  influencer: 'Influencer',
  'end-user': 'End user',
  gatekeeper: 'Gatekeeper',
};

const AWARENESS_LABEL: Record<string, string> = {
  unaware: 'Unaware',
  'problem-aware': 'Problem-aware',
  'solution-aware': 'Solution-aware',
  'product-aware': 'Product-aware',
  'most-aware': 'Most-aware',
};

const WINDOW_LABEL: Record<string, string> = {
  immediate: 'Immediate',
  weeks: 'Weeks',
  quarters: 'Quarters',
};

const BUCKET_LABEL: Record<string, string> = {
  community: 'Community',
  newsletter: 'Newsletter',
  conference: 'Conference',
  podcast: 'Podcast',
  'slack-group': 'Slack group',
  event: 'Event',
};

export function BuyerICPRenderer({
  artifact,
  className,
}: BuyerICPRendererProps): React.ReactElement {
  const {
    icpExistenceCheck,
    personaReality,
    awarenessDistribution,
    buyingContext,
    clusters,
  } = artifact;

  /* ───────── 1. ICP Existence Check ───────── */
  const cutColumns: ReadonlyArray<
    DataTableColumn<(typeof icpExistenceCheck.firmographicCuts)[number]>
  > = [
    {
      key: 'cutType',
      header: 'Cut',
      render: row => (
        <MonoPill value={row.cutType} label={CUT_TYPE_LABEL[row.cutType]} />
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: row => (
        <span className="font-medium text-[color:var(--text-primary)]">{row.value}</span>
      ),
    },
    {
      key: 'accountCount',
      header: 'Accounts',
      render: row => row.accountCount ?? '—',
    },
    {
      key: 'source',
      header: 'Source',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.source}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  /* ───────── 2. Persona Reality ───────── */
  const personaColumns: ReadonlyArray<
    DataTableColumn<(typeof personaReality.personas)[number]>
  > = [
    {
      key: 'name',
      header: 'Persona',
      render: row => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">{row.name}</span>
          <span className="text-[12px] text-[color:var(--text-tertiary)]">{row.company}</span>
        </div>
      ),
    },
    { key: 'title', header: 'Title' },
    {
      key: 'seniority',
      header: 'Seniority',
      render: row => (
        <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[color:var(--text-tertiary)]">
          {row.seniority}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: row => <MonoPill value={row.role} label={ROLE_LABEL[row.role]} />,
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.evidence}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  /* ───────── 3. Awareness Distribution — fixed 5-rung ladder ───────── */
  const awarenessLevels = awarenessDistribution.levels;

  /* ───────── 4. Buying Context ───────── */
  const triggerColumns: ReadonlyArray<
    DataTableColumn<(typeof buyingContext.triggers)[number]>
  > = [
    {
      key: 'name',
      header: 'Trigger',
      render: row => (
        <span className="font-medium text-[color:var(--text-primary)]">{row.name}</span>
      ),
    },
    { key: 'detectionSignal', header: 'Detection signal' },
    {
      key: 'window',
      header: 'Window',
      render: row => <MonoPill value={row.window} label={WINDOW_LABEL[row.window]} />,
    },
    {
      key: 'evidence',
      header: 'Evidence',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.evidence}</span>
          {row.sourceUrl ? <SourceLink url={row.sourceUrl} /> : null}
        </div>
      ),
    },
  ];

  /* ───────── 5. Clusters & Venues ───────── */
  const venueColumns: ReadonlyArray<
    DataTableColumn<(typeof clusters.venues)[number]>
  > = [
    {
      key: 'bucketType',
      header: 'Bucket',
      render: row => (
        <MonoPill value={row.bucketType} label={BUCKET_LABEL[row.bucketType]} />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: row => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">{row.name}</span>
          <span className="text-[12px] text-[color:var(--text-tertiary)]">
            {row.audienceSize}
          </span>
        </div>
      ),
    },
    {
      key: 'audienceSize',
      header: 'Audience',
      render: row => (
        <span className="font-mono tabular-nums text-[12px] text-[color:var(--text-tertiary)]">
          {row.audienceSize}
        </span>
      ),
    },
    {
      key: 'whyItMatters',
      header: 'Why it matters',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.whyItMatters}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      <SubsectionBlock label="1 · ICP Existence Check" prose={icpExistenceCheck.prose}>
        <DataTable
          columns={cutColumns}
          rows={icpExistenceCheck.firmographicCuts}
          rowKey={r => `${r.cutType}-${r.value}`}
          rowTestId={() => 'firmographic-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="2 · Persona Reality" prose={personaReality.prose}>
        <DataTable
          columns={personaColumns}
          rows={personaReality.personas}
          rowKey={r => `${r.name}-${r.company}`}
          rowTestId={() => 'persona-card'}
        />
      </SubsectionBlock>

      <SubsectionBlock
        label="3 · Awareness Distribution"
        prose={awarenessDistribution.prose}
      >
        <div
          role="list"
          aria-label="Awareness ladder"
          className="flex flex-col divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)]"
        >
          {awarenessLevels.map(level => (
            <div
              key={level.level}
              data-testid="awareness-row"
              role="listitem"
              className="flex flex-col gap-2 p-4 md:flex-row md:items-baseline md:gap-6"
            >
              <div className="flex shrink-0 items-baseline gap-3 md:w-56">
                <MonoPill
                  value={level.level}
                  label={AWARENESS_LABEL[level.level] ?? level.level}
                />
                <span className="font-mono tabular-nums text-[12px] font-medium text-[color:var(--text-primary)]">
                  {level.share}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1 text-[13px] leading-[1.55] text-[color:var(--text-secondary)]">
                <span>{level.evidence}</span>
                {level.sampleQuery ? (
                  <span className="font-mono text-[11px] text-[color:var(--text-tertiary)]">
                    sample query: <em>{level.sampleQuery}</em>
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="4 · Buying Context" prose={buyingContext.prose}>
        <DataTable
          columns={triggerColumns}
          rows={buyingContext.triggers}
          rowKey={r => `${r.name}-${r.window}`}
          rowTestId={() => 'trigger-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="5 · Clusters & Venues" prose={clusters.prose}>
        <DataTable
          columns={venueColumns}
          rows={clusters.venues}
          rowKey={r => `${r.bucketType}-${r.name}`}
          rowTestId={() => 'cluster-item'}
        />
      </SubsectionBlock>
    </div>
  );
}
