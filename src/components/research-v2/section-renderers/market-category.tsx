import { cn } from '@/lib/utils';
import type { MarketCategoryArtifact } from '@/types/positioning-artifact';
import {
  DataTable,
  Eyebrow,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { SubsectionBlock } from '../primitives';

export interface MarketCategoryRendererProps {
  artifact: MarketCategoryArtifact;
  className?: string;
}

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  'public-data': 'Public data',
  'funding-flow': 'Funding flow',
  'hiring-velocity': 'Hiring velocity',
  'search-trend': 'Search trend',
  'analyst-report': 'Analyst report',
};

const TRAJECTORY_LABEL: Record<string, string> = {
  expanding: 'Expanding',
  stable: 'Stable',
  contracting: 'Contracting',
  unclear: 'Unclear',
};

const FORCE_TYPE_LABEL: Record<string, string> = {
  regulation: 'Regulation',
  'platform-shift': 'Platform shift',
  'buyer-behavior': 'Buyer behavior',
};

const IMPACT_LABEL: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const DIRECTION_LABEL: Record<string, string> = {
  accelerating: 'Accelerating',
  decelerating: 'Decelerating',
  neutral: 'Neutral',
};

const MATURITY_SIGNAL_LABEL: Record<string, string> = {
  'player-count': 'Player count',
  'buyer-education': 'Buyer education',
  'feature-parity': 'Feature parity',
  'price-pressure': 'Price pressure',
  'platform-bundling': 'Platform bundling',
};

const MATURITY_STAGE_LABEL: Record<string, string> = {
  emerging: 'Emerging',
  growing: 'Growing',
  consolidating: 'Consolidating',
  commoditizing: 'Commoditizing',
};

export function MarketCategoryRenderer({
  artifact,
  className,
}: MarketCategoryRendererProps): React.ReactElement {
  const { categoryDefinition, marketSize, structuralForces, categoryMaturity } = artifact;

  /* ───────── 1. Adjacent categories table ───────── */
  const adjacentColumns: ReadonlyArray<
    DataTableColumn<(typeof categoryDefinition.adjacentCategories)[number]>
  > = [
    {
      key: 'name',
      header: 'Adjacent',
      render: row => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    { key: 'whyBuyersConfuseIt', header: 'Why buyers confuse' },
    { key: 'disambiguatingSignal', header: 'Disambiguator' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => (row.sourceUrl ? <SourceLink url={row.sourceUrl} /> : null),
    },
  ];

  /* ───────── 2. Market size signals table ───────── */
  const signalColumns: ReadonlyArray<
    DataTableColumn<(typeof marketSize.signals)[number]>
  > = [
    {
      key: 'signalType',
      header: 'Signal type',
      render: row => (
        <MonoBadge>{SIGNAL_TYPE_LABEL[row.signalType] ?? row.signalType}</MonoBadge>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: row => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    { key: 'evidence', header: 'Evidence' },
    {
      key: 'trajectory',
      header: 'Trajectory',
      render: row => (
        <MonoBadge>{TRAJECTORY_LABEL[row.trajectory] ?? row.trajectory}</MonoBadge>
      ),
    },
    {
      key: 'methodology',
      header: 'Method',
      render: row => (
        <span className="text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
          {row.methodology}
        </span>
      ),
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => <SourceLink url={row.sourceUrl} />,
    },
  ];

  /* ───────── 3. Structural forces table ───────── */
  const forceColumns: ReadonlyArray<
    DataTableColumn<(typeof structuralForces.forces)[number]>
  > = [
    {
      key: 'forceType',
      header: 'Force type',
      render: row => (
        <MonoBadge>{FORCE_TYPE_LABEL[row.forceType] ?? row.forceType}</MonoBadge>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: row => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    { key: 'implication', header: 'Implication' },
    {
      key: 'impact',
      header: 'Impact',
      render: row => <MonoBadge>{IMPACT_LABEL[row.impact] ?? row.impact}</MonoBadge>,
    },
    {
      key: 'direction',
      header: 'Direction',
      render: row => (
        <MonoBadge>{DIRECTION_LABEL[row.direction] ?? row.direction}</MonoBadge>
      ),
    },
  ];

  /* ───────── 4. Category maturity — single classification ───────── */
  const { classification } = categoryMaturity;
  const stageLabel = MATURITY_STAGE_LABEL[classification.stage] ?? classification.stage;

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      <SubsectionBlock label="1 · Category Definition" prose={categoryDefinition.prose}>
        <DataTable
          columns={adjacentColumns}
          rows={categoryDefinition.adjacentCategories}
          rowKey={r => r.name}
          rowTestId={() => 'adjacent-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="2 · Market Size" prose={marketSize.prose}>
        <DataTable
          columns={signalColumns}
          rows={marketSize.signals}
          rowKey={r => `${r.signalType}-${r.name}`}
          rowTestId={() => 'signal-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="3 · Structural Forces" prose={structuralForces.prose}>
        <DataTable
          columns={forceColumns}
          rows={structuralForces.forces}
          rowKey={r => `${r.forceType}-${r.name}`}
          rowTestId={() => 'force-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="4 · Category Maturity" prose={categoryMaturity.prose}>
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline gap-3">
            <h4 className="text-[20px] font-semibold leading-tight tracking-tight text-foreground">
              {stageLabel}
            </h4>
            <Eyebrow>stage classification</Eyebrow>
          </div>
          <p className="text-[14px] leading-[1.6] text-muted-foreground">
            {classification.evidenceSummary}
          </p>
          {classification.supportingSignals.length > 0 ? (
            <ul className="flex flex-col gap-3 border-l border-border pl-4">
              {classification.supportingSignals.map((signal, idx) => (
                <li
                  key={`${signal.signalType}-${idx}`}
                  className="flex flex-col gap-1 text-[13px] leading-[1.5] text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    <MonoBadge>
                      {MATURITY_SIGNAL_LABEL[signal.signalType] ?? signal.signalType}
                    </MonoBadge>
                    {signal.sourceUrl ? <SourceLink url={signal.sourceUrl} /> : null}
                  </div>
                  <div>
                    <Eyebrow className="mr-1 inline">evidence</Eyebrow>
                    {signal.evidence}
                  </div>
                  <div>
                    <Eyebrow className="mr-1 inline">implication</Eyebrow>
                    {signal.implication}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </SubsectionBlock>
    </div>
  );
}
