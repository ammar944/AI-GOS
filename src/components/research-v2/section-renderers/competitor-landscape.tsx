'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  CompetitorAdEvidence,
  type CompetitorAdEvidenceProps,
} from '@/components/research/competitor-ad-evidence';
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

const AD_PLATFORM_LABEL: Record<string, string> = {
  google: 'Google',
  meta: 'Meta',
  linkedin: 'LinkedIn',
};

type CompetitorRow =
  CompetitorLandscapeArtifact['competitorSet']['competitors'][number];
type PricingPoint =
  CompetitorLandscapeArtifact['pricingReality']['dataPoints'][number];
type ShareOfVoiceSlice =
  CompetitorLandscapeArtifact['shareOfVoice']['slices'][number];
type CompetitorWeakness =
  CompetitorLandscapeArtifact['publicWeaknesses']['items'][number];
type NarrativeArc =
  CompetitorLandscapeArtifact['narrativeArcs']['arcs'][number];
type AdPresenceSignal =
  CompetitorLandscapeArtifact['adPresence']['signals'][number];
type AdEvidenceGroup =
  CompetitorLandscapeArtifact['adEvidence']['advertiserGroups'][number];
type AdEvidenceCreative =
  NonNullable<CompetitorAdEvidenceProps['adCreatives']>[number];
type AdEvidenceCreativeFormat = AdEvidenceCreative['format'];

const AD_CREATIVE_FORMATS: readonly AdEvidenceCreativeFormat[] = [
  'video',
  'image',
  'carousel',
  'text',
  'message',
  'unknown',
];

interface AxisPosition {
  axisName: string;
  ourPosition: string;
  position: string;
  evidenceUrl: string;
}

function CompetitorTypePill({ value }: { value: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground">
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
      className="text-[10px] uppercase tracking-[0.06em] text-primary no-underline hover:underline"
    >
      {hostnameOf(url)} →
    </a>
  );
}

function formatPlatforms(platforms: readonly string[]): string {
  if (platforms.length === 0) return 'No active platform observed';
  return platforms.map((platform) => AD_PLATFORM_LABEL[platform] ?? platform).join(', ');
}

function countTotal(counts: AdEvidenceGroup['rawCounts']): number {
  return counts.google + counts.meta + counts.linkedin;
}

function optionalText(value: string | null): string | undefined {
  return value === null ? undefined : value;
}

function normalizeAdCreativeFormat(format: string): AdEvidenceCreativeFormat {
  return AD_CREATIVE_FORMATS.includes(format as AdEvidenceCreativeFormat)
    ? (format as AdEvidenceCreativeFormat)
    : 'unknown';
}

function mapAdCreative(
  creative: AdEvidenceGroup['creatives'][number],
): AdEvidenceCreative {
  return {
    platform: creative.platform,
    id: creative.id,
    advertiser: creative.advertiserName,
    headline: optionalText(creative.headline),
    body: optionalText(creative.body),
    imageUrl: optionalText(creative.imageUrl),
    videoUrl: optionalText(creative.videoUrl),
    format: normalizeAdCreativeFormat(creative.format),
    isActive: creative.isActive,
    detailsUrl: optionalText(creative.detailsUrl),
    firstSeen: optionalText(creative.firstSeen),
    lastSeen: optionalText(creative.lastSeen),
  };
}

function AdEvidenceNotes({
  group,
}: {
  group: AdEvidenceGroup;
}): React.ReactElement | null {
  const notes = [
    ...group.dataGaps.map((gap) => ({
      key: `gap-${gap.platform ?? 'all'}-${gap.reason}`,
      text: `${gap.platform ? `${AD_PLATFORM_LABEL[gap.platform]}: ` : ''}${gap.reason}`,
    })),
    ...group.sourceErrors.map((error) => ({
      key: `error-${error.platform}-${error.message}`,
      text: `${AD_PLATFORM_LABEL[error.platform]}: ${error.message}`,
    })),
  ];

  if (notes.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-1 text-[12px] leading-[1.5] text-muted-foreground">
      {notes.map((note) => (
        <li key={note.key}>{note.text}</li>
      ))}
    </ul>
  );
}

function AdEvidenceGroupBlock({
  group,
}: {
  group: AdEvidenceGroup;
}): React.ReactElement {
  const rawTotal = countTotal(group.rawCounts);
  const libraryLinks = {
    metaLibraryUrl: group.libraryLinks.meta,
    linkedInLibraryUrl: group.libraryLinks.linkedin,
    googleAdvertiserUrl: group.libraryLinks.google,
  };

  return (
    <section className="grid gap-3 border-b border-border pb-5 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="grid gap-1">
          <h3 className="text-[15px] font-semibold leading-tight tracking-[0] text-foreground">
            {group.advertiserName}
          </h3>
          <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            raw {rawTotal} / displayable {group.displayableTotal}
          </div>
        </div>
        {group.domain ? (
          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            {group.domain}
          </div>
        ) : null}
      </div>
      <CompetitorAdEvidence
        adCreatives={group.creatives.map(mapAdCreative)}
        libraryLinks={libraryLinks}
      />
      <AdEvidenceNotes group={group} />
    </section>
  );
}

function AdEvidenceSection({
  adEvidence,
}: {
  adEvidence: CompetitorLandscapeArtifact['adEvidence'];
}): React.ReactElement {
  if (adEvidence.advertiserGroups.length === 0) {
    return (
      <div className="grid gap-2 text-[13px] leading-[1.6] text-muted-foreground">
        <p>No live ad creatives captured for this audit.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      {adEvidence.advertiserGroups.map((group) => (
        <AdEvidenceGroupBlock
          key={`${group.advertiserName}-${group.observedAt}`}
          group={group}
        />
      ))}
    </div>
  );
}

function getUniqueCompetitors(
  competitors: readonly CompetitorRow[],
): CompetitorRow[] {
  const seen = new Set<string>();
  return competitors.filter((competitor) => {
    if (seen.has(competitor.name)) return false;
    seen.add(competitor.name);
    return true;
  });
}

function toDomId(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'competitor';
}

function findByCompetitor<T extends { competitor: string }>(
  rows: readonly T[],
  competitorName: string,
): T | null {
  return rows.find((row) => row.competitor === competitorName) ?? null;
}

function getAxisPositions(
  artifact: CompetitorLandscapeArtifact,
  competitorName: string,
): AxisPosition[] {
  return artifact.positioningTaxonomy.axes.flatMap((axis) =>
    axis.competitorPositions
      .filter((position) => position.competitor === competitorName)
      .map((position) => ({
        axisName: axis.axisName,
        ourPosition: axis.ourPosition,
        position: position.position,
        evidenceUrl: axis.evidenceUrl,
      })),
  );
}

function CompetitorFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className="grid gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-[13px] leading-[1.5] text-muted-foreground">
        {children}
      </dd>
    </div>
  );
}

function CompetitorFocusPanel({
  artifact,
}: {
  artifact: CompetitorLandscapeArtifact;
}): React.ReactElement | null {
  const competitors = useMemo(
    () => getUniqueCompetitors(artifact.competitorSet.competitors),
    [artifact.competitorSet.competitors],
  );
  const [selectedName, setSelectedName] = useState(
    competitors[0]?.name ?? '',
  );

  useEffect(() => {
    if (competitors.some((competitor) => competitor.name === selectedName)) {
      return;
    }
    setSelectedName(competitors[0]?.name ?? '');
  }, [competitors, selectedName]);

  if (competitors.length === 0) return null;

  const selectedCompetitor =
    competitors.find((competitor) => competitor.name === selectedName) ??
    competitors[0];
  const selectedId = toDomId(selectedCompetitor.name);
  const pricingPoint: PricingPoint | null = findByCompetitor(
    artifact.pricingReality.dataPoints,
    selectedCompetitor.name,
  );
  const shareOfVoiceSlice: ShareOfVoiceSlice | null =
    artifact.shareOfVoice.slices.find(
      (slice) => slice.winner === selectedCompetitor.name,
    ) ?? null;
  const weakness: CompetitorWeakness | null = findByCompetitor(
    artifact.publicWeaknesses.items,
    selectedCompetitor.name,
  );
  const narrativeArc: NarrativeArc | null = findByCompetitor(
    artifact.narrativeArcs.arcs,
    selectedCompetitor.name,
  );
  const adSignal: AdPresenceSignal | null = artifact.adPresence
    ? findByCompetitor(artifact.adPresence.signals, selectedCompetitor.name)
    : null;
  const axisPositions = getAxisPositions(artifact, selectedCompetitor.name);

  return (
    <section className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Competitors"
        className="flex gap-2 overflow-x-auto border-b border-border"
      >
        {competitors.map((competitor) => {
          const selected = competitor.name === selectedCompetitor.name;
          const tabId = toDomId(competitor.name);
          return (
            <button
              key={competitor.name}
              id={`competitor-tab-${tabId}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`competitor-panel-${tabId}`}
              onClick={() => setSelectedName(competitor.name)}
              className={cn(
                'shrink-0 border-b-2 px-1 pb-2 pt-1 text-left font-mono text-[11px] uppercase tracking-[0.06em] transition-colors',
                selected
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-muted-foreground',
              )}
            >
              {competitor.name}
            </button>
          );
        })}
      </div>

      <div
        id={`competitor-panel-${selectedId}`}
        role="tabpanel"
        aria-labelledby={`competitor-tab-${selectedId}`}
        data-testid="competitor-focus-panel"
        className="grid gap-5 border-b border-border pb-6"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold leading-tight tracking-[0] text-foreground">
              {selectedCompetitor.name}
            </h3>
            <CompetitorTypePill value={selectedCompetitor.competitorType} />
          </div>
          <p className="max-w-[72ch] text-[14px] leading-[1.65] text-muted-foreground">
            {selectedCompetitor.oneLinePositioning}
          </p>
          <SourceLink url={selectedCompetitor.sourceUrl} />
        </div>

        <dl className="grid gap-4 md:grid-cols-2">
          <CompetitorFact label="Hero copy">
            {selectedCompetitor.verbatimHeroCopy}
          </CompetitorFact>
          <CompetitorFact label="Pricing position">
            {pricingPoint
              ? `${pricingPoint.tierName} · ${pricingPoint.monthlyPrice} · ${pricingPoint.packagingPattern}`
              : selectedCompetitor.pricingPosition}
          </CompetitorFact>
          {shareOfVoiceSlice ? (
            <CompetitorFact label="Share of voice">
              {shareOfVoiceSlice.surface}: {shareOfVoiceSlice.evidence}
            </CompetitorFact>
          ) : null}
          {adSignal ? (
            <CompetitorFact label="Ad presence">
              {formatPlatforms(adSignal.platforms)} · {adSignal.estSpend}
            </CompetitorFact>
          ) : null}
          {narrativeArc ? (
            <CompetitorFact label="Narrative arc">
              {narrativeArc.villain} → {narrativeArc.hero}: {narrativeArc.transformationClaim}
            </CompetitorFact>
          ) : null}
          {weakness ? (
            <CompetitorFact label="Public weakness">
              {weakness.verbatimQuote} · {weakness.whyItMatters}
            </CompetitorFact>
          ) : null}
        </dl>

        {axisPositions.length > 0 ? (
          <div className="grid gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              Positioning axes
            </div>
            <ul className="grid gap-2">
              {axisPositions.map((axis) => (
                <li
                  key={`${axis.axisName}-${axis.position}`}
                  className="grid gap-1 text-[13px] leading-[1.5] text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {axis.axisName}
                  </span>
                  <span>{selectedCompetitor.name}: {axis.position}</span>
                  <span className="text-muted-foreground">
                    Us: {axis.ourPosition}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
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
    adPresence,
    adEvidence,
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
            <span className="font-medium text-foreground">{row.name}</span>
            <CompetitorTypePill value={row.competitorType} />
          </div>
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground no-underline hover:text-primary hover:underline"
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
        <span className="font-medium text-foreground">{row.competitor}</span>
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
        <span className="font-medium text-foreground">{row.surface}</span>
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
        <span className="font-medium text-foreground">{row.competitor}</span>
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

  const adPresenceRows = adPresence?.signals ?? [];
  const adPresenceColumns: ReadonlyArray<
    DataTableColumn<(typeof adPresenceRows)[number]>
  > = [
    {
      key: 'competitor',
      header: 'Competitor',
      render: row => (
        <span className="font-medium text-foreground">{row.competitor}</span>
      ),
    },
    {
      key: 'platforms',
      header: 'Platforms',
      render: row => formatPlatforms(row.platforms),
    },
    { key: 'estSpend', header: 'Spend Signal' },
    { key: 'evidence', header: 'Evidence' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => <SourceLink url={row.sourceUrl} />,
    },
  ];

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      <CompetitorFocusPanel artifact={artifact} />

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
          <div className="mt-2 rounded-md border border-border bg-card p-4">
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
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      why it matters ·{' '}
                    </span>
                    {item.whyItMatters}
                  </span>
                ) : undefined
              }
            />
          ))}
          {publicWeaknesses.items.length === 0 ? (
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
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

      {adPresence ? (
        <SubsectionBlock label="7 · Ad Presence" prose={adPresence.prose}>
          <DataTable
            columns={adPresenceColumns}
            rows={adPresenceRows}
            rowKey={r => `${r.competitor}-${r.sourceUrl}`}
          />
        </SubsectionBlock>
      ) : null}

      <SubsectionBlock label="8 · Ad Evidence" prose={adEvidence.prose}>
        <AdEvidenceSection adEvidence={adEvidence} />
      </SubsectionBlock>
    </div>
  );
}
