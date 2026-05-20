import { cn } from '@/lib/utils';
import type { CompetitorLandscapeArtifact } from '@/lib/managed-agents/schemas/competitor-landscape';
import {
  BarBreakdown,
  DataTable,
  PositioningAxisStack,
  QuoteCallout,
  SubsectionBlock,
  type DataTableColumn,
  type PositioningAxisItem,
} from '../primitives';

export interface CompetitorLandscapeRendererProps {
  artifact: CompetitorLandscapeArtifact;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const COMPETITOR_TYPE_LABEL: Record<string, string> = {
  direct: 'Direct',
  indirect: 'Indirect',
  'status-quo': 'Status quo',
  diy: 'DIY',
};

function CompetitorTypePill({ value }: { value: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--bg-chip)] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-[color:var(--accent-blue)]">
      {COMPETITOR_TYPE_LABEL[value] ?? value}
    </span>
  );
}

function SourceLink({ url }: { url: string }): React.ReactElement | null {
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

export function CompetitorLandscapeRenderer({
  artifact,
  className,
}: CompetitorLandscapeRendererProps): React.ReactElement {
  const {
    competitorSet,
    positioningTaxonomy,
    pricingReality,
    shareOfVoice,
    publicWeaknesses,
    narrativeArcs,
  } = artifact;

  /* ───────── 1. Competitor set table ───────── */
  const competitorColumns: ReadonlyArray<
    DataTableColumn<(typeof competitorSet.competitors)[number]>
  > = [
    {
      key: 'name',
      header: 'Competitor',
      render: row => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[color:var(--text-primary)]">{row.name}</span>
            <CompetitorTypePill value={row.competitorType} />
          </div>
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-[color:var(--text-tertiary)] no-underline hover:text-[color:var(--accent-blue)] hover:underline"
          >
            {hostnameOf(row.url)} →
          </a>
        </div>
      ),
    },
    { key: 'oneLinePositioning', header: 'Positioning' },
    { key: 'pricingPosition', header: 'Pricing' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => <SourceLink url={row.sourceUrl} />,
    },
  ];

  /* ───────── 2. Positioning axes ───────── */
  const axesForStack: PositioningAxisItem[] = positioningTaxonomy.axes.map(axis => ({
    axisName: axis.axisName,
    evidenceUrl: axis.evidenceUrl,
    positions: [
      { label: 'You', position: axis.ourPosition, isUs: true },
      ...axis.competitorPositions.map(p => ({
        label: p.competitor,
        position: p.position,
      })),
    ],
  }));

  /* ───────── 3. Pricing reality table ───────── */
  const pricingColumns: ReadonlyArray<
    DataTableColumn<(typeof pricingReality.dataPoints)[number]>
  > = [
    {
      key: 'competitor',
      header: 'Competitor',
      render: row => (
        <span className="font-medium text-[color:var(--text-primary)]">{row.competitor}</span>
      ),
    },
    { key: 'tierName', header: 'Tier' },
    { key: 'monthlyPrice', header: 'Monthly', numeric: true },
    { key: 'packagingPattern', header: 'Packaging' },
    { key: 'gatedSignals', header: 'Gates' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => <SourceLink url={row.sourceUrl} />,
    },
  ];

  /* ───────── 4. Share of voice ───────── */
  const shareOfVoiceColumns: ReadonlyArray<
    DataTableColumn<(typeof shareOfVoice.slices)[number]>
  > = [
    {
      key: 'surface',
      header: 'Surface',
      render: row => (
        <span className="font-medium text-[color:var(--text-primary)]">{row.surface}</span>
      ),
    },
    { key: 'winner', header: 'Winner' },
    { key: 'evidence', header: 'Evidence' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => <SourceLink url={row.sourceUrl} />,
    },
  ];

  // Derive a winner-frequency breakdown bar from the slices (optional secondary view).
  const winnerCounts = new Map<string, number>();
  shareOfVoice.slices.forEach(slice => {
    if (slice.winner) {
      winnerCounts.set(slice.winner, (winnerCounts.get(slice.winner) ?? 0) + 1);
    }
  });
  const winnerSegments = Array.from(winnerCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));

  /* ───────── 6. Narrative arcs table ───────── */
  const narrativeColumns: ReadonlyArray<
    DataTableColumn<(typeof narrativeArcs.arcs)[number]>
  > = [
    {
      key: 'competitor',
      header: 'Competitor',
      render: row => (
        <span className="font-medium text-[color:var(--text-primary)]">{row.competitor}</span>
      ),
    },
    { key: 'villain', header: 'Villain' },
    { key: 'hero', header: 'Hero' },
    { key: 'transformationClaim', header: 'Transformation' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => <SourceLink url={row.sourceUrl} />,
    },
  ];

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      <SubsectionBlock label="1 · Competitor Set" prose={competitorSet.prose}>
        <DataTable columns={competitorColumns} rows={competitorSet.competitors} rowKey={r => r.url || r.name} />
      </SubsectionBlock>

      <SubsectionBlock label="2 · Positioning Taxonomy" prose={positioningTaxonomy.prose}>
        <PositioningAxisStack axes={axesForStack} />
      </SubsectionBlock>

      <SubsectionBlock label="3 · Pricing Reality" prose={pricingReality.prose}>
        <DataTable
          columns={pricingColumns}
          rows={pricingReality.dataPoints}
          rowKey={r => `${r.competitor}-${r.tierName}`}
        />
      </SubsectionBlock>

      <SubsectionBlock label="4 · Share of Voice" prose={shareOfVoice.prose}>
        <DataTable
          columns={shareOfVoiceColumns}
          rows={shareOfVoice.slices}
          rowKey={r => `${r.surface}-${r.winner}`}
        />
        {winnerSegments.length > 1 ? (
          <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <BarBreakdown
              caption="Winner frequency across surfaces"
              total={`${shareOfVoice.slices.length} surfaces`}
              segments={winnerSegments}
            />
          </div>
        ) : null}
      </SubsectionBlock>

      <SubsectionBlock label="5 · Public Weaknesses" prose={publicWeaknesses.prose}>
        <div className="flex flex-col gap-6">
          {publicWeaknesses.items.map((item, idx) => (
            <QuoteCallout
              key={`${item.competitor}-${idx}`}
              quote={item.verbatimQuote}
              source={`${item.competitor} · ${item.source}`}
              sourceUrl={item.sourceUrl}
              emphasis={
                item.whyItMatters ? (
                  <span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
                      why it matters ·{' '}
                    </span>
                    {item.whyItMatters}
                  </span>
                ) : undefined
              }
            />
          ))}
          {publicWeaknesses.items.length === 0 ? (
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
              No verbatim weaknesses captured
            </div>
          ) : null}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="6 · Narrative Arcs" prose={narrativeArcs.prose}>
        <DataTable
          columns={narrativeColumns}
          rows={narrativeArcs.arcs}
          rowKey={r => `${r.competitor}-${r.hero}`}
        />
      </SubsectionBlock>
    </div>
  );
}
