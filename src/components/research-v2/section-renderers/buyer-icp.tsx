import type { BuyerICPArtifact } from '@/lib/managed-agents/schemas/buyer-icp';
import { cn } from '@/lib/utils';

import {
  DataTable,
  MilestoneTimeline,
  PositioningAxisStack,
  type DataTableColumn,
  type MilestoneItem,
  type PositioningAxisItem,
} from '../primitives';
import {
  SourceLink,
  SubsectionBlock,
  formatEnumLabel,
} from './shared';

export interface BuyerICPRendererProps {
  artifact: BuyerICPArtifact;
  className?: string;
}

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

  const firmographicColumns: ReadonlyArray<
    DataTableColumn<(typeof icpExistenceCheck.firmographicCuts)[number]>
  > = [
    {
      key: 'cutType',
      header: 'Dimension',
      render: (row) => formatEnumLabel(row.cutType),
    },
    {
      key: 'value',
      header: 'Best-fit cut',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.value}
        </span>
      ),
    },
    { key: 'accountCount', header: 'Accounts', numeric: true },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} label={row.source} />,
    },
  ];

  const personaColumns: ReadonlyArray<
    DataTableColumn<(typeof personaReality.personas)[number]>
  > = [
    {
      key: 'name',
      header: 'Person',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">
            {row.name}
          </span>
          <span className="text-[12px] text-[color:var(--text-tertiary)]">
            {row.title}, {row.company}
          </span>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => formatEnumLabel(row.role),
    },
    { key: 'seniority', header: 'Seniority' },
    { key: 'evidence', header: 'Evidence' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const awarenessAxis: PositioningAxisItem[] = [
    {
      axisName: 'Awareness distribution',
      positions: awarenessDistribution.levels.map((level, index) => ({
        label: formatEnumLabel(level.level),
        position: `${level.share} · ${level.evidence}`,
        isUs: index === awarenessDistribution.levels.length - 1,
      })),
    },
  ];

  const triggerSteps: MilestoneItem[] = buyingContext.triggers.map(
    (trigger, index) => ({
      label: formatEnumLabel(trigger.window),
      title: trigger.name,
      body: (
        <span>
          {trigger.detectionSignal}. {trigger.evidence}{' '}
          <SourceLink url={trigger.sourceUrl} />
        </span>
      ),
      accent: index === 0,
    }),
  );

  const venueColumns: ReadonlyArray<
    DataTableColumn<(typeof clusters.venues)[number]>
  > = [
    {
      key: 'name',
      header: 'Venue',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">
            {row.name}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
            {formatEnumLabel(row.bucketType)}
          </span>
        </div>
      ),
    },
    { key: 'audienceSize', header: 'Audience size', numeric: true },
    { key: 'whyItMatters', header: 'Why it matters' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  return (
    <div className={cn('mx-auto flex w-full max-w-[920px] flex-col gap-16', className)}>
      <SubsectionBlock
        title="ICP existence check"
        prose={icpExistenceCheck.prose}
      >
        <DataTable
          caption="Firmographic proof"
          columns={firmographicColumns}
          rows={icpExistenceCheck.firmographicCuts}
          rowKey={(row) => `${row.cutType}-${row.value}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Persona reality" prose={personaReality.prose}>
        <DataTable
          caption="Named ICP evidence"
          columns={personaColumns}
          rows={personaReality.personas}
          rowKey={(row) => `${row.name}-${row.company}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock
        title="Awareness distribution"
        prose={awarenessDistribution.prose}
      >
        <PositioningAxisStack axes={awarenessAxis} />
      </SubsectionBlock>

      <SubsectionBlock title="Buying context" prose={buyingContext.prose}>
        <MilestoneTimeline steps={triggerSteps} />
      </SubsectionBlock>

      <SubsectionBlock title="Where they cluster" prose={clusters.prose}>
        <DataTable
          caption="Cluster venues"
          columns={venueColumns}
          rows={clusters.venues}
          rowKey={(row) => `${row.bucketType}-${row.name}`}
        />
      </SubsectionBlock>
    </div>
  );
}
