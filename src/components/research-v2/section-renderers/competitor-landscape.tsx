'use client';

import {
  CompetitorAdEvidence,
  type CompetitorAdEvidenceProps,
} from '@/components/research/competitor-ad-evidence';
import { cn } from '@/lib/utils';
import type { CompetitorLandscapeArtifact } from '@/types/positioning-artifact';
import {
  BarBreakdown,
  BasisChip,
  EvidenceChip,
  GapNote,
  KeyFindings,
  Positioning2x2,
  QuoteCard,
  ReaderExhibit,
  SubsectionBlock,
  VerdictHero,
  clientGapSentence,
  scrubReaderText,
  textOrGap,
  type KeyFinding,
  type Positioning2x2Point,
} from '@/components/research-v2/primitives';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { StrategicField, StrategicInsightPanel } from './strategic-insight-panel';

export interface CompetitorLandscapeRendererProps {
  artifact: CompetitorLandscapeArtifact;
  className?: string;
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
type NarrativeArc =
  CompetitorLandscapeArtifact['narrativeArcs']['arcs'][number];
type AdPresenceSignal =
  NonNullable<CompetitorLandscapeArtifact['adPresence']>['signals'][number];
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

function formatPlatforms(platforms: readonly string[]): string {
  if (platforms.length === 0) return 'No active platform observed';
  return platforms.map((platform) => AD_PLATFORM_LABEL[platform] ?? platform).join(', ');
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
  const sourceLink =
    creative.detailsUrl ?? creative.landingUrl ?? creative.sourceUrl;
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
    detailsUrl: optionalText(sourceLink),
    firstSeen: optionalText(creative.firstSeen),
    lastSeen: optionalText(creative.lastSeen),
    source: optionalText(creative.source),
    transcript: optionalText(creative.transcript),
    cta: optionalText(creative.cta),
    verified: creative.verified,
    language: optionalText(creative.language ?? null),
    identityBasis: optionalText(creative.identityBasis ?? null),
  };
}

function toLibraryLinkProps(
  group: AdEvidenceGroup,
): CompetitorAdEvidenceProps['libraryLinks'] {
  return {
    metaLibraryUrl: group.libraryLinks.meta,
    linkedInLibraryUrl: group.libraryLinks.linkedin,
    googleAdvertiserUrl: group.libraryLinks.google,
  };
}

function countVerifiedCreatives(group: AdEvidenceGroup): number {
  return (
    group.verifiedCount ??
    group.creatives.filter((creative) => creative.verified === true).length
  );
}

function findByCompetitor<T extends { competitor: string }>(
  rows: readonly T[],
  competitorName: string,
): T | null {
  return rows.find((row) => row.competitor === competitorName) ?? null;
}

// Hero copy is model-fetched verbatim text; when it carries a gap sentinel or
// nav garbage it must not surface as an evidence excerpt at all.
function heroCopyExcerpt(value: string): string | undefined {
  const result = textOrGap(value, 'hero copy');
  return result.kind === 'text' ? result.value : undefined;
}

function competitorKeyFindings(
  artifact: CompetitorLandscapeArtifact,
): readonly KeyFinding[] {
  const competitor = artifact.competitorSet.competitors[0];
  const pricing = artifact.pricingReality.dataPoints[0];
  const weakness = artifact.publicWeaknesses.items[0];
  const adGroup = artifact.adEvidence.advertiserGroups[0];

  return [
    competitor
      ? {
          sentence: `${competitor.name} sets the clearest comparison frame: ${competitor.oneLinePositioning}`,
          basis: 'sourced',
          evidence: [
            {
              title: competitor.name,
              url: competitor.sourceUrl,
              excerpt: heroCopyExcerpt(competitor.verbatimHeroCopy),
            },
          ],
        }
      : {
          sentence: artifact.competitorSet.prose,
          basis: 'assumption',
        },
    pricing
      ? {
          sentence: `${pricing.competitor} pricing is visible at ${pricing.monthlyPrice} for ${pricing.tierName}.`,
          basis: 'sourced',
          evidence: [
            {
              title: `${pricing.competitor} pricing`,
              url: pricing.sourceUrl,
            },
          ],
        }
      : {
          sentence: artifact.pricingReality.prose,
          basis: 'assumption',
        },
    weakness
      ? {
          sentence: `${weakness.competitor} has a public weakness to exploit: ${weakness.whyItMatters}`,
          basis: 'sourced',
          evidence: [
            {
              title: weakness.source,
              url: weakness.sourceUrl,
              excerpt: weakness.verbatimQuote,
            },
          ],
        }
      : {
          sentence: artifact.publicWeaknesses.prose,
          basis: 'assumption',
        },
    adGroup
      ? {
          sentence: `${adGroup.advertiserName} has ${countVerifiedCreatives(adGroup)} confirmed ad creatives in this run.`,
          basis: countVerifiedCreatives(adGroup) > 0 ? 'measured' : 'gap',
        }
      : {
          sentence: artifact.adEvidence.prose,
          basis: 'gap',
        },
  ];
}

function competitor2x2(
  artifact: CompetitorLandscapeArtifact,
): React.ReactElement | null {
  const [xAxis, yAxis] = artifact.positioningTaxonomy.axes;
  if (!xAxis || !yAxis) return null;

  const names = Array.from(
    new Set([
      ...xAxis.competitorPositions.map((position) => position.competitor),
      ...yAxis.competitorPositions.map((position) => position.competitor),
    ]),
  );
  const points: Positioning2x2Point[] = [
    { label: 'You', x: 50, y: 50, isUs: true },
    ...names.map((name, index) => {
      const xIndex = xAxis.competitorPositions.findIndex(
        (position) => position.competitor === name,
      );
      const yIndex = yAxis.competitorPositions.findIndex(
        (position) => position.competitor === name,
      );
      return {
        label: name,
        x: 15 + ((xIndex >= 0 ? xIndex : index) % 5) * 18,
        y: 20 + ((yIndex >= 0 ? yIndex : index) % 5) * 16,
      };
    }),
  ];

  return (
    <Positioning2x2
      xAxisLabel={xAxis.axisName}
      yAxisLabel={yAxis.axisName}
      points={points}
    />
  );
}

function AdvertiserSummary({
  group,
  adPresence,
}: {
  group: AdEvidenceGroup;
  adPresence?: AdPresenceSignal | null;
}): React.ReactElement {
  const verifiedCount = countVerifiedCreatives(group);
  const verifiedThemeCreative = group.creatives.find(
    (creative) => creative.verified !== false,
  );
  const theme =
    adPresence?.evidence ??
    verifiedThemeCreative?.headline ??
    verifiedThemeCreative?.body;

  return (
    <article className="grid gap-3 border border-border bg-card p-4" data-testid="ad-evidence-group">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">
          {group.advertiserName}
        </h3>
        <BasisChip basis={verifiedCount > 0 ? 'measured' : 'gap'}>
          {verifiedCount} verified
        </BasisChip>
      </div>
      <p className="text-[12px] leading-[1.5] text-muted-foreground">
        {formatPlatforms(group.platforms)}
      </p>
      {theme ? (
        <p className="text-[13px] leading-[1.55] text-foreground">
          {scrubReaderText(theme)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {group.libraryLinks.google ? <SourceLink url={group.libraryLinks.google} /> : null}
        {group.libraryLinks.meta ? <SourceLink url={group.libraryLinks.meta} /> : null}
        {group.libraryLinks.linkedin ? <SourceLink url={group.libraryLinks.linkedin} /> : null}
      </div>
    </article>
  );
}

function CuratedAdGallery({
  group,
}: {
  group: AdEvidenceGroup;
}): React.ReactElement {
  const curated = group.creatives
    .filter((creative) => creative.verified !== false)
    .slice(0, 4);

  if (curated.length === 0) {
    return (
      <GapNote
        subject={`confirmed ad creatives for ${group.advertiserName}`}
        howToClose="Open the transparency library links and confirm advertiser identity."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {group.advertiserName} creative gallery
      </div>
      <CompetitorAdEvidence
        adCreatives={curated.map(mapAdCreative)}
        libraryLinks={toLibraryLinkProps(group)}
      />
    </section>
  );
}

function Diagnostics({
  groups,
}: {
  groups: readonly AdEvidenceGroup[];
}): React.ReactElement {
  return (
    <ReaderExhibit title="evidence diagnostics" count={groups.length}>
      <div className="grid gap-4">
        {groups.map((group) => {
          const notes = [
            ...group.dataGaps.map((gap) =>
              clientGapSentence(gap.reason, `${group.advertiserName} ${gap.platform ?? 'ad'} evidence`),
            ),
            ...group.sourceErrors.map((error) =>
              clientGapSentence(error.message, `${group.advertiserName} ${error.platform} evidence`),
            ),
          ];
          return (
            <div key={group.advertiserName} className="border-l border-border pl-4">
              <p className="font-medium text-foreground">{group.advertiserName}</p>
              {notes.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No renderer-level evidence diagnostics for this advertiser.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1 text-[13px] text-muted-foreground">
                  {notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </ReaderExhibit>
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

  const competitorColumns: ReadonlyArray<DataTableColumn<CompetitorRow>> = [
    {
      key: 'name',
      header: 'Competitor',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{row.name}</span>
            <MonoBadge>
              {COMPETITOR_TYPE_LABEL[row.competitorType] ?? row.competitorType}
            </MonoBadge>
          </div>
          <SourceLink url={row.url} />
        </div>
      ),
    },
    { key: 'oneLinePositioning', header: 'Positioning', wrap: 'clamp', clampLines: 3 },
    { key: 'pricingPosition', header: 'Pricing', wrap: 'clamp', clampLines: 2 },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const pricingColumns: ReadonlyArray<DataTableColumn<PricingPoint>> = [
    {
      key: 'competitor',
      header: 'Competitor',
      width: '120px',
      wrap: 'wrap',
      render: (row) => <span className="font-medium text-foreground">{row.competitor}</span>,
    },
    { key: 'tierName', header: 'Tier', width: '120px', wrap: 'wrap' },
    { key: 'monthlyPrice', header: 'Monthly', width: '120px', wrap: 'wrap' },
    { key: 'packagingPattern', header: 'Packaging', grow: true, wrap: 'wrap' },
    { key: 'gatedSignals', header: 'Gates', width: '140px', wrap: 'wrap' },
    {
      key: 'sourceUrl',
      header: 'Source',
      width: '90px',
      wrap: 'nowrap',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const shareOfVoiceColumns: ReadonlyArray<DataTableColumn<ShareOfVoiceSlice>> = [
    {
      key: 'surface',
      header: 'Surface',
      render: (row) => <span className="font-medium text-foreground">{row.surface}</span>,
    },
    { key: 'winner', header: 'Winner' },
    { key: 'evidence', header: 'Evidence', wrap: 'clamp', clampLines: 3 },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const narrativeColumns: ReadonlyArray<DataTableColumn<NarrativeArc>> = [
    {
      key: 'competitor',
      header: 'Competitor',
      render: (row) => <span className="font-medium text-foreground">{row.competitor}</span>,
    },
    { key: 'villain', header: 'Villain', wrap: 'clamp', clampLines: 2 },
    { key: 'hero', header: 'Hero', wrap: 'clamp', clampLines: 2 },
    { key: 'transformationClaim', header: 'Transformation', wrap: 'clamp', clampLines: 3 },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const winnerCounts = new Map<string, number>();
  shareOfVoice.slices.forEach((slice) => {
    if (slice.winner) {
      winnerCounts.set(slice.winner, (winnerCounts.get(slice.winner) ?? 0) + 1);
    }
  });
  const winnerSegments = Array.from(winnerCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([label, value]) => ({ label, value }));

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <VerdictHero
        verdict={artifact.verdict}
        whyItMatters={artifact.statusSummary}
      />
      <KeyFindings findings={competitorKeyFindings(artifact)} />

      {artifact.strategicInsight ||
      artifact.whereToAttackVsConcede ||
      artifact.incumbentBlindSpot ? (
        <StrategicInsightPanel insight={artifact.strategicInsight}>
          <StrategicField
            label="attack"
            value={artifact.whereToAttackVsConcede?.attack}
          />
          <StrategicField
            label="concede"
            value={artifact.whereToAttackVsConcede?.concede}
          />
          <StrategicField
            label="blind spot"
            value={artifact.incumbentBlindSpot?.blindSpot}
          />
          <StrategicField
            label="why they miss it"
            value={artifact.incumbentBlindSpot?.whyTheyMissIt}
          />
        </StrategicInsightPanel>
      ) : null}

      <SubsectionBlock label="Competitor set" prose={competitorSet.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {competitorSet.competitors.map((competitor) => {
            const adSignal = adPresence
              ? findByCompetitor(adPresence.signals, competitor.name)
              : null;
            const pricing = findByCompetitor(pricingReality.dataPoints, competitor.name);
            return (
              <article key={competitor.name} className="grid gap-3 border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-foreground">
                    {competitor.name}
                  </h3>
                  <MonoBadge>
                    {COMPETITOR_TYPE_LABEL[competitor.competitorType] ??
                      competitor.competitorType}
                  </MonoBadge>
                  <EvidenceChip
                    source={{
                      title: competitor.name,
                      url: competitor.sourceUrl,
                      excerpt: heroCopyExcerpt(competitor.verbatimHeroCopy),
                    }}
                    label="source"
                  />
                </div>
                <p className="text-[13px] leading-[1.55] text-foreground">
                  {scrubReaderText(competitor.oneLinePositioning)}
                </p>
                <p className="text-[12px] leading-[1.5] text-muted-foreground">
                  Pricing: {pricing?.monthlyPrice ?? competitor.pricingPosition}
                </p>
                {adSignal ? (
                  <p className="text-[12px] leading-[1.5] text-muted-foreground">
                    {(() => {
                      // estSpend can arrive as a gap sentinel — never print it
                      // beside the platform list as if it were a number.
                      const spend = textOrGap(adSignal.estSpend, 'ad spend');
                      return spend.kind === 'text'
                        ? `Ads: ${formatPlatforms(adSignal.platforms)} · ${spend.value}`
                        : `Ads: ${formatPlatforms(adSignal.platforms)}`;
                    })()}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
        <ReaderExhibit title="full competitor comparison" count={competitorSet.competitors.length}>
          <DataTable
            columns={competitorColumns}
            rows={competitorSet.competitors}
            rowKey={(row) => row.url || row.name}
          />
        </ReaderExhibit>
      </SubsectionBlock>

      <SubsectionBlock label="Positioning taxonomy" prose={positioningTaxonomy.prose}>
        {competitor2x2(artifact)}
      </SubsectionBlock>

      <SubsectionBlock label="Pricing reality" prose={pricingReality.prose}>
        <DataTable
          className="max-w-[960px]"
          columns={pricingColumns}
          rows={pricingReality.dataPoints}
          rowKey={(row) => `${row.competitor}-${row.tierName}`}
        />
      </SubsectionBlock>

      <SubsectionBlock label="Share of voice" prose={shareOfVoice.prose}>
        {winnerSegments.length > 1 ? (
          <BarBreakdown
            caption="Winner frequency across surfaces"
            total={`${shareOfVoice.slices.length} surfaces`}
            segments={winnerSegments}
          />
        ) : null}
        <ReaderExhibit title="share-of-voice rows" count={shareOfVoice.slices.length}>
          <DataTable
            columns={shareOfVoiceColumns}
            rows={shareOfVoice.slices}
            rowKey={(row) => `${row.surface}-${row.winner}`}
          />
        </ReaderExhibit>
      </SubsectionBlock>

      <SubsectionBlock label="Public weaknesses" prose={publicWeaknesses.prose}>
        <div className="grid gap-6">
          {publicWeaknesses.items.map((item, index) => (
            <div key={`${item.competitor}-${index}`} className="grid gap-2">
              <QuoteCard
                quote={item.verbatimQuote}
                venue={`${item.competitor} · ${item.source}`}
                url={item.sourceUrl}
              />
              {item.whyItMatters ? (
                <p className="pl-5 text-[14px] leading-[1.6] text-foreground">
                  {scrubReaderText(item.whyItMatters)}
                </p>
              ) : null}
            </div>
          ))}
          {publicWeaknesses.items.length === 0 ? (
            <GapNote subject="public competitor weaknesses" />
          ) : null}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Narrative arcs" prose={narrativeArcs.prose}>
        <ReaderExhibit title="narrative arc table" count={narrativeArcs.arcs.length}>
          <DataTable
            columns={narrativeColumns}
            rows={narrativeArcs.arcs}
            rowKey={(row) => `${row.competitor}-${row.hero}`}
          />
        </ReaderExhibit>
      </SubsectionBlock>

      <SubsectionBlock label="Ad evidence" prose={adEvidence.prose}>
        {adEvidence.advertiserGroups.length === 0 ? (
          <GapNote
            subject="confirmed competitor ad creatives"
            howToClose="Open transparency libraries for the named competitors and rerun the ad evidence pass."
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {adEvidence.advertiserGroups.map((group) => (
                <AdvertiserSummary
                  key={group.advertiserName}
                  group={group}
                  adPresence={
                    adPresence
                      ? findByCompetitor(adPresence.signals, group.advertiserName)
                      : null
                  }
                />
              ))}
            </div>
            <div className="grid gap-8">
              {adEvidence.advertiserGroups.map((group) => (
                <CuratedAdGallery key={group.advertiserName} group={group} />
              ))}
            </div>
            <Diagnostics groups={adEvidence.advertiserGroups} />
          </>
        )}
      </SubsectionBlock>
    </div>
  );
}
