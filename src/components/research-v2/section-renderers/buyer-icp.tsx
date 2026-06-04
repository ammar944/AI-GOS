import { cn } from '@/lib/utils';
import type { BuyerICPArtifact } from '@/types/positioning-artifact';

import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { SubsectionBlock } from '../primitives';
import { StrategicInsightPanel } from './strategic-insight-panel';

export interface BuyerICPRendererProps {
  artifact: BuyerICPArtifact;
  className?: string;
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
        <MonoBadge>{CUT_TYPE_LABEL[row.cutType] ?? row.cutType}</MonoBadge>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: row => (
        <span className="font-medium text-foreground">{row.value}</span>
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
          <span className="font-medium text-foreground">{row.name}</span>
          <span className="text-[12px] text-muted-foreground">{row.company}</span>
        </div>
      ),
    },
    { key: 'title', header: 'Title' },
    {
      key: 'seniority',
      header: 'Seniority',
      render: row => (
        <span className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          {row.seniority}
        </span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: row => <MonoBadge>{ROLE_LABEL[row.role] ?? row.role}</MonoBadge>,
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

  const awarenessColumns: ReadonlyArray<
    DataTableColumn<(typeof awarenessDistribution.levels)[number]>
  > = [
    {
      key: 'level',
      header: 'Level',
      render: row => (
        <MonoBadge>{AWARENESS_LABEL[row.level] ?? row.level}</MonoBadge>
      ),
    },
    {
      key: 'share',
      header: 'Share',
      render: row => (
        <span className="font-mono tabular-nums text-foreground">{row.share}</span>
      ),
    },
    {
      key: 'evidence',
      header: 'Evidence',
    },
    {
      key: 'sampleQuery',
      header: 'Sample query',
      render: row =>
        row.sampleQuery ? (
          <span className="italic text-muted-foreground">{row.sampleQuery}</span>
        ) : (
          '—'
        ),
    },
  ];

  /* ───────── 4. Buying Context ───────── */
  const triggerColumns: ReadonlyArray<
    DataTableColumn<(typeof buyingContext.triggers)[number]>
  > = [
    {
      key: 'name',
      header: 'Trigger',
      render: row => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    { key: 'detectionSignal', header: 'Detection signal' },
    {
      key: 'window',
      header: 'Window',
      render: row => <MonoBadge>{WINDOW_LABEL[row.window] ?? row.window}</MonoBadge>,
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
        <MonoBadge>{BUCKET_LABEL[row.bucketType] ?? row.bucketType}</MonoBadge>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: row => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{row.name}</span>
          <span className="text-[12px] text-muted-foreground">
            {row.audienceSize}
          </span>
        </div>
      ),
    },
    {
      key: 'audienceSize',
      header: 'Audience',
      render: row => (
        <span className="tabular-nums text-[12px] text-muted-foreground">
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
      <StrategicInsightPanel insight={artifact.strategicInsight} />

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
        <DataTable
          columns={awarenessColumns}
          rows={awarenessDistribution.levels}
          rowKey={r => r.level}
          rowTestId={() => 'awareness-row'}
        />
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
