import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { CompetitorLandscapeArtifact } from '@/lib/managed-agents/schemas/competitor-landscape';
import {
  BarBreakdown,
  DataTable,
  NarrativeBlock,
  PositioningAxisStack,
  QuoteCallout,
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

function CompetitorTypeLabel({ value }: { value: string }): React.ReactElement {
  return (
    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
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
      className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)] no-underline hover:text-[color:var(--accent-blue)] hover:underline"
    >
      {hostnameOf(url)} →
    </a>
  );
}

function SubsectionBlock({
  title,
  prose,
  children,
}: {
  title: string;
  prose: string;
  children?: ReactNode;
}): React.ReactElement {
  return (
    <section className="flex flex-col gap-7 border-t border-[var(--border-subtle)] pt-12 first:border-t-0 first:pt-0">
      <NarrativeBlock title={title} prose={prose} />
      {children ? <div className="flex flex-col gap-5">{children}</div> : null}
    </section>
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
            <CompetitorTypeLabel value={row.competitorType} />
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

  const winnerCounts = new Map<string, number>();
  shareOfVoice.slices.forEach(slice => {
    if (slice.winner) {
      winnerCounts.set(slice.winner, (winnerCounts.get(slice.winner) ?? 0) + 1);
    }
  });
  const winnerSegments = Array.from(winnerCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));

  return (
    <div className={cn('mx-auto flex w-full max-w-[920px] flex-col gap-16', className)}>
      <SubsectionBlock title="Competitor set" prose={competitorSet.prose}>
        <DataTable
          caption="Competitor evidence"
          columns={competitorColumns}
          rows={competitorSet.competitors}
          rowKey={r => r.url || r.name}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Positioning taxonomy" prose={positioningTaxonomy.prose}>
        <PositioningAxisStack axes={axesForStack} />
      </SubsectionBlock>

      <SubsectionBlock title="Pricing reality" prose={pricingReality.prose}>
        <DataTable
          caption="Pricing evidence"
          columns={pricingColumns}
          rows={pricingReality.dataPoints}
          rowKey={r => `${r.competitor}-${r.tierName}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Share of voice" prose={shareOfVoice.prose}>
        <DataTable
          caption="Observed surfaces"
          columns={shareOfVoiceColumns}
          rows={shareOfVoice.slices}
          rowKey={r => `${r.surface}-${r.winner}`}
        />
        {winnerSegments.length > 1 ? (
          <BarBreakdown
            caption="Winner frequency across surfaces"
            total={`${shareOfVoice.slices.length} surfaces`}
            segments={winnerSegments}
          />
        ) : null}
      </SubsectionBlock>

      <SubsectionBlock title="Public weaknesses" prose={publicWeaknesses.prose}>
        <div className="flex flex-col gap-8">
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

      <SubsectionBlock title="Narrative arcs" prose={narrativeArcs.prose}>
        <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {narrativeArcs.arcs.map((arc) => (
            <div
              key={`${arc.competitor}-${arc.hero}`}
              className="grid gap-3 py-5 md:grid-cols-[9rem_1fr]"
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-[13px] text-[color:var(--text-primary)]">
                  {arc.competitor}
                </span>
                <SourceLink url={arc.sourceUrl} />
              </div>
              <p className="max-w-[68ch] text-[13px] leading-[1.65] text-[color:var(--text-secondary)]">
                The villain is <span className="text-[color:var(--text-primary)]">{arc.villain}</span>.
                The hero is <span className="text-[color:var(--text-primary)]">{arc.hero}</span>.
                The promised shift: {arc.transformationClaim}.
              </p>
            </div>
          ))}
        </div>
      </SubsectionBlock>
    </div>
  );
}
