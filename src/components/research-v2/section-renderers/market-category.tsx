import type { MarketCategoryArtifact } from '@/lib/managed-agents/schemas/market-category';
import { cn } from '@/lib/utils';

import {
  DataTable,
  InlineStats,
  PositioningAxisStack,
  type DataTableColumn,
  type PositioningAxisItem,
} from '../primitives';
import {
  SourceLink,
  SubsectionBlock,
  countBy,
  formatEnumLabel,
} from './shared';

export interface MarketCategoryRendererProps {
  artifact: MarketCategoryArtifact;
  className?: string;
}

export function MarketCategoryRenderer({
  artifact,
  className,
}: MarketCategoryRendererProps): React.ReactElement {
  const {
    categoryDefinition,
    marketSize,
    structuralForces,
    categoryMaturity,
  } = artifact;

  const adjacentCategoryColumns: ReadonlyArray<
    DataTableColumn<(typeof categoryDefinition.adjacentCategories)[number]>
  > = [
    {
      key: 'name',
      header: 'Adjacent category',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">
            {row.name}
          </span>
          <SourceLink url={row.sourceUrl} label={row.sourceTitle} />
        </div>
      ),
    },
    { key: 'whyBuyersConfuseIt', header: 'Why buyers confuse it' },
    { key: 'disambiguatingSignal', header: 'Disambiguating signal' },
  ];

  const marketSignalColumns: ReadonlyArray<
    DataTableColumn<(typeof marketSize.signals)[number]>
  > = [
    {
      key: 'name',
      header: 'Signal',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">
            {row.name}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
            {formatEnumLabel(row.signalType)} · {formatEnumLabel(row.methodology)}
          </span>
        </div>
      ),
    },
    { key: 'evidence', header: 'Evidence' },
    {
      key: 'trajectory',
      header: 'Trajectory',
      render: (row) => formatEnumLabel(row.trajectory),
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} label={row.sourceTitle} />,
    },
  ];

  const structuralForceColumns: ReadonlyArray<
    DataTableColumn<(typeof structuralForces.forces)[number]>
  > = [
    {
      key: 'name',
      header: 'Force',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">
            {row.name}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
            {formatEnumLabel(row.forceType)} · {formatEnumLabel(row.impact)} impact
          </span>
        </div>
      ),
    },
    { key: 'evidence', header: 'Evidence' },
    { key: 'implication', header: 'Implication' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} label={row.sourceTitle} />,
    },
  ];

  const maturitySignalColumns: ReadonlyArray<
    DataTableColumn<
      (typeof categoryMaturity.classification.supportingSignals)[number]
    >
  > = [
    {
      key: 'signalType',
      header: 'Signal type',
      render: (row) => formatEnumLabel(row.signalType),
    },
    { key: 'evidence', header: 'Evidence' },
    { key: 'implication', header: 'Implication' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const maturityAxis: PositioningAxisItem[] = [
    {
      axisName: 'Category maturity',
      positions: [
        {
          label: formatEnumLabel(categoryMaturity.classification.stage),
          position: categoryMaturity.classification.evidenceSummary,
          isUs: true,
        },
        ...categoryMaturity.classification.supportingSignals.map((signal) => ({
          label: formatEnumLabel(signal.signalType),
          position: signal.implication,
        })),
      ],
    },
  ];

  return (
    <div className={cn('mx-auto flex w-full max-w-[920px] flex-col gap-16', className)}>
      <SubsectionBlock
        title="Category definition"
        prose={categoryDefinition.prose}
      >
        <DataTable
          caption="Adjacent category confusion"
          columns={adjacentCategoryColumns}
          rows={categoryDefinition.adjacentCategories}
          rowKey={(row) => row.name}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Market size" prose={marketSize.prose}>
        <InlineStats
          items={[
            {
              label: 'Signals',
              value: marketSize.signals.length,
            },
            {
              label: 'Methodologies',
              value: countBy(marketSize.signals, (signal) => signal.methodology)
                .length,
            },
            {
              label: 'Trajectories',
              value: countBy(marketSize.signals, (signal) => signal.trajectory)
                .length,
            },
          ]}
        />
        <DataTable
          caption="Public market trajectory signals"
          columns={marketSignalColumns}
          rows={marketSize.signals}
          rowKey={(row) => `${row.signalType}-${row.name}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock
        title="Structural forces"
        prose={structuralForces.prose}
      >
        <DataTable
          caption="Category movement"
          columns={structuralForceColumns}
          rows={structuralForces.forces}
          rowKey={(row) => `${row.forceType}-${row.name}`}
        />
      </SubsectionBlock>

      <SubsectionBlock
        title="Category maturity"
        prose={categoryMaturity.prose}
      >
        <PositioningAxisStack axes={maturityAxis} />
        <DataTable
          caption="Maturity evidence"
          columns={maturitySignalColumns}
          rows={categoryMaturity.classification.supportingSignals}
          rowKey={(row, index) => `${row.signalType}-${index}`}
        />
      </SubsectionBlock>
    </div>
  );
}
