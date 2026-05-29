import { cn } from '@/lib/utils';
import type { MarketCategoryArtifact } from '@/types/positioning-artifact';
import {
  DataTable,
  SubsectionBlock,
  type DataTableColumn,
} from '../primitives';

export interface MarketCategoryRendererProps {
  artifact: MarketCategoryArtifact;
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
      className="text-[10px] uppercase tracking-[0.06em] text-primary no-underline hover:underline"
    >
      {hostnameOf(url)} →
    </a>
  );
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

function MonoPill({
  value,
  label,
}: {
  value: string;
  label?: string;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground">
      {label ?? value}
    </span>
  );
}

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
        <MonoPill value={row.signalType} label={SIGNAL_TYPE_LABEL[row.signalType]} />
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
        <MonoPill value={row.trajectory} label={TRAJECTORY_LABEL[row.trajectory]} />
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
        <MonoPill value={row.forceType} label={FORCE_TYPE_LABEL[row.forceType]} />
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
      render: row => <MonoPill value={row.impact} label={IMPACT_LABEL[row.impact]} />,
    },
    {
      key: 'direction',
      header: 'Direction',
      render: row => (
        <MonoPill value={row.direction} label={DIRECTION_LABEL[row.direction]} />
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
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              stage classification
            </span>
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
                    <MonoPill
                      value={signal.signalType}
                      label={MATURITY_SIGNAL_LABEL[signal.signalType] ?? signal.signalType}
                    />
                    {signal.sourceUrl ? <SourceLink url={signal.sourceUrl} /> : null}
                  </div>
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      evidence ·{' '}
                    </span>
                    {signal.evidence}
                  </div>
                  <div>
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      implication ·{' '}
                    </span>
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
