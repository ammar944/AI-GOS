import type { PaidMediaPlanArtifact } from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import { cn } from '@/lib/utils';
import { isRecord, type PositioningTypedArtifact } from '@/types/positioning-artifact';
import {
  BudgetBar,
  CreativeMatrix,
  FunnelMath,
  GapNote,
  KeyFindings,
  MilestoneTimeline,
  ReaderExhibit,
  SectionCoverageNote,
  StatCallout,
  SubsectionBlock,
  VerdictHero,
  scrubReaderText,
  stripMoneyProvenanceSuffix,
  type BudgetBarSegment,
  type CreativeMatrixItem,
  type FunnelMathStep,
  type KeyFinding,
  type MilestoneItem,
} from '@/components/research-v2/primitives';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  StatusPill,
  type DataTableColumn,
  type StatusPillTone,
} from '@/components/research-v2/ui-kit';
import {
  READER_SECTION_LABELS,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';

export interface PaidMediaPlanRendererProps {
  artifact: PaidMediaPlanArtifact | PositioningTypedArtifact;
  className?: string;
}

const PAID_MEDIA_BODY_KEYS = [
  'campaignOverview',
  'campaignPhases',
  'audienceTypes',
  'anglesToTest',
  'creativeStrategy',
  'creativeFramework',
  'funnelIdeation',
  'salesProcess',
  'competitorMarketingInsights',
  'competitorReviewInsights',
  'channelSuggestions',
  'projectedResults',
  'kpis',
  'crossSectionInsight',
] as const satisfies ReadonlyArray<keyof PaidMediaPlanArtifact['body']>;

type PaidMediaBody = PaidMediaPlanArtifact['body'];
type CampaignPhase = PaidMediaBody['campaignPhases'][number];
type AudienceType = PaidMediaBody['audienceTypes'][number];
type Angle = PaidMediaBody['anglesToTest'][number];
type CreativeSlot = PaidMediaBody['creativeFramework'][number];
type FunnelPath = PaidMediaBody['funnelIdeation'][number];
type SalesAsset = PaidMediaBody['salesProcess'][number];
type CompetitorMarketing = PaidMediaBody['competitorMarketingInsights'][number];
type CompetitorReview = PaidMediaBody['competitorReviewInsights'][number];
type ChannelSuggestion = PaidMediaBody['channelSuggestions'][number];
type ProjectedResultRow = PaidMediaBody['projectedResults'][number];
type Kpi = PaidMediaBody['kpis'][number];

export function getPaidMediaPlanBody(
  artifact: PaidMediaPlanArtifact | PositioningTypedArtifact,
): PaidMediaBody {
  const record = artifact as unknown as Record<string, unknown>;

  if (isRecord(record.body)) {
    return record.body as PaidMediaBody;
  }

  return Object.fromEntries(
    PAID_MEDIA_BODY_KEYS.map((key) => [key, record[key]]),
  ) as PaidMediaBody;
}

function sectionLabel(value: string): string {
  if (value === 'unattributed') return 'Unattributed';
  if (value === 'gtmBrief') return 'GTM Brief';
  return READER_SECTION_LABELS[value as ReaderSectionId] ?? value;
}

// Exhaustive over paidMediaMoneyProvenanceValues — anything unmapped reads as
// an assumption to confirm, never a raw pipeline token.
export function provenanceLabel(value: string | undefined): string {
  if (value === 'user-supplied' || value === 'operator-supplied') {
    return 'from your brief';
  }
  if (value === 'tool-measured') {
    return 'measured';
  }
  if (value === 'source-reported') {
    return 'from a published source';
  }
  if (value === 'derived') {
    return 'computed (modeled)';
  }
  return 'assumption — confirm';
}

export function isMissingSalesAsset(asset: SalesAsset): boolean {
  return asset.url === '' && /^evidence gap:/i.test(asset.note);
}

export function verdictTone(verdict: string): StatusPillTone {
  switch (verdict.trim().toUpperCase()) {
    case 'KILL':
      return 'error';
    case 'KEEP':
    case 'SCALE':
      return 'complete';
    case 'FIX':
    case 'REWORK':
    case 'REVIEW':
      return 'flagged';
    case 'ADD':
      return 'active';
    default:
      return 'neutral';
  }
}

export function formatUsdValue(value: number | undefined): string {
  return value === undefined ? 'not available' : `$${value.toLocaleString()}`;
}

export function numericMoney(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function paidMediaKeyFindings(
  body: PaidMediaBody,
  artifact: PaidMediaPlanArtifact | PositioningTypedArtifact,
): readonly KeyFinding[] {
  const firstInsight = body.crossSectionInsight[0];
  const firstChannel = body.channelSuggestions[0];
  const firstProjection = body.projectedResults[0];

  return [
    {
      sentence: artifact.statusSummary,
      basis: 'sourced',
    },
    {
      sentence: `${body.campaignOverview.monthlyBudget} monthly budget over ${body.campaignOverview.totalMonths} months, optimized to ${body.campaignOverview.primaryKpi}.`,
      basis: provenanceLabel(body.campaignOverview.monthlyBudgetProvenance).includes('assumption')
        ? 'assumption'
        : 'measured',
    },
    firstInsight
      ? {
          sentence: `${firstInsight.tension}: ${firstInsight.implicationForPlan}`,
          basis: 'sourced',
        }
      : {
          sentence: body.campaignOverview.prose,
          basis: 'assumption',
        },
    firstChannel
      ? {
          sentence: `${firstChannel.channel} is marked ${firstChannel.verdict}: ${firstChannel.recommendation}`,
          basis: firstChannel.verdict === 'KILL' ? 'gap' : 'sourced',
        }
      : {
          sentence: 'No channel verdict rows were produced for this plan.',
          basis: 'gap',
        },
    firstProjection
      ? {
          sentence: `${firstProjection.targetIcp} projection tracks ${firstProjection.kpi} against a ${formatUsdValue(firstProjection.kpiCostValue)} KPI cost.`,
          basis: provenanceLabel(firstProjection.kpiCostProvenance).includes('assumption')
            ? 'assumption'
            : 'benchmark',
        }
      : {
          sentence: 'No projection ledger rows were produced for this plan.',
          basis: 'gap',
        },
  ];
}

export function budgetSegments(body: PaidMediaBody): BudgetBarSegment[] {
  return body.audienceTypes.map((audience) => ({
    label: audience.archetype,
    value: numericMoney(audience.dailyBudget),
    displayValue: stripMoneyProvenanceSuffix(audience.dailyBudget),
    basis: provenanceLabel(audience.dailyBudgetProvenance).includes('assumption')
      ? 'assumption'
      : 'measured',
  }));
}

function phaseMilestones(phases: readonly CampaignPhase[]): MilestoneItem[] {
  return phases.map((phase, index) => ({
    label: phase.monthsLabel,
    title: phase.phaseName,
    body: `${phase.monthlyBudget}: ${phase.bullets.join(', ')}`,
    accent: index === 0,
  }));
}

function creativeItems(slots: readonly CreativeSlot[]): CreativeMatrixItem[] {
  return slots.map((slot) => ({
    audience: slot.executesAngle,
    angle: slot.angleType,
    hook: slot.hook,
    format: slot.label,
    status: /proof|case|claim|unknown/i.test(slot.grounding)
      ? 'needs-proof'
      : 'runnable',
    evidence: {
      title: slot.label,
      excerpt: slot.grounding,
    },
  }));
}

function basisForProvenance(
  provenance: string | undefined,
): 'measured' | 'benchmark' | 'assumption' {
  const label = provenanceLabel(provenance);
  if (label.includes('assumption')) return 'assumption';
  if (label === 'measured') return 'measured';
  return 'benchmark';
}

function projectionSteps(row: ProjectedResultRow): FunnelMathStep[] {
  // Forward demand projection: spend -> CPC -> clicks -> blended CVR ->
  // projected count -> implied CAC, shown beside the brief's target CAC so the
  // gap is visible (the count is NOT back-solved from the target).
  if (row.cpcValue !== undefined && row.impliedCacValue !== undefined) {
    return [
      {
        label: 'Budget',
        value: formatUsdValue(row.phaseMonthlyBudgetValue),
        basis: basisForProvenance(row.phaseMonthlyBudgetProvenance),
      },
      { label: 'CPC', value: formatUsdValue(row.cpcValue), basis: 'benchmark' },
      {
        label: 'Clicks',
        value:
          row.projectedClicks === undefined
            ? '—'
            : row.projectedClicks.toLocaleString(),
        basis: 'benchmark',
      },
      {
        label: 'Conversion',
        value:
          row.blendedCvrPercent === undefined
            ? '—'
            : `${row.blendedCvrPercent}%`,
        basis: 'benchmark',
      },
      {
        label: 'Projected count',
        value:
          row.projectedCountValue === undefined
            ? 'not computed'
            : row.projectedCountValue.toLocaleString(),
        basis: 'benchmark',
      },
      {
        label: 'Implied CAC',
        value: formatUsdValue(row.impliedCacValue),
        basis: 'benchmark',
      },
      {
        label: 'Target CAC',
        value: formatUsdValue(row.kpiCostValue),
        basis: basisForProvenance(row.kpiCostProvenance),
      },
    ];
  }

  return [
    {
      label: 'Budget',
      value: formatUsdValue(row.phaseMonthlyBudgetValue),
      basis: basisForProvenance(row.phaseMonthlyBudgetProvenance),
    },
    {
      label: 'KPI cost',
      value: formatUsdValue(row.kpiCostValue),
      basis: basisForProvenance(row.kpiCostProvenance),
    },
    {
      label: 'Projected count',
      value:
        row.projectedCountValue === undefined
          ? 'not computed'
          : row.projectedCountValue.toLocaleString(),
      basis: basisForProvenance(row.projectedCountProvenance),
    },
    { label: 'Duration', value: row.durationLabel, basis: 'assumption' },
  ];
}

export function PaidMediaPlanRenderer({
  artifact,
  className,
}: PaidMediaPlanRendererProps): React.ReactElement {
  const body = getPaidMediaPlanBody(artifact);
  const linkedSalesAssets = body.salesProcess.filter(
    (asset) => !isMissingSalesAsset(asset),
  );
  const missingSalesAssets = body.salesProcess.filter(isMissingSalesAsset);

  const phaseColumns: ReadonlyArray<DataTableColumn<CampaignPhase>> = [
    { key: 'phaseName', header: 'Phase', className: 'font-medium text-foreground' },
    { key: 'monthsLabel', header: 'Timing' },
    { key: 'monthlyBudget', header: 'Budget' },
    { key: 'bullets', header: 'Focus', render: (row) => row.bullets.join(', ') },
  ];
  const angleColumns: ReadonlyArray<DataTableColumn<Angle>> = [
    { key: 'shortName', header: 'Angle', className: 'font-medium text-foreground' },
    { key: 'angleType', header: 'Type' },
    { key: 'description', header: 'Description', wrap: 'clamp', clampLines: 3 },
    { key: 'grounding', header: 'Grounding', wrap: 'clamp', clampLines: 3 },
  ];
  const funnelColumns: ReadonlyArray<DataTableColumn<FunnelPath>> = [
    { key: 'rank', header: 'Rank', className: 'font-medium text-foreground' },
    { key: 'name', header: 'Path' },
    { key: 'description', header: 'Description', wrap: 'clamp', clampLines: 3 },
    { key: 'whatItProves', header: 'What it proves', wrap: 'clamp', clampLines: 3 },
  ];
  const salesColumns: ReadonlyArray<DataTableColumn<SalesAsset>> = [
    { key: 'label', header: 'Asset', className: 'font-medium text-foreground' },
    { key: 'assetType', header: 'Type' },
    { key: 'note', header: 'Note', wrap: 'clamp', clampLines: 3 },
    {
      key: 'url',
      header: 'Link',
      render: (row) => (row.url.length > 0 ? <SourceLink url={row.url} /> : null),
    },
  ];
  const competitorColumns: ReadonlyArray<DataTableColumn<CompetitorMarketing>> = [
    { key: 'competitor', header: 'Competitor', className: 'font-medium text-foreground' },
    { key: 'messaging', header: 'Messaging', wrap: 'clamp', clampLines: 3 },
    { key: 'adPlatforms', header: 'Platforms', wrap: 'clamp', clampLines: 2 },
    { key: 'positioning', header: 'Positioning', wrap: 'clamp', clampLines: 3 },
    { key: 'offer', header: 'Offer', wrap: 'clamp', clampLines: 2 },
  ];
  const reviewColumns: ReadonlyArray<DataTableColumn<CompetitorReview>> = [
    { key: 'complaint', header: 'Complaint', wrap: 'clamp', clampLines: 3 },
    { key: 'howWeLeverage', header: 'Leverage', wrap: 'clamp', clampLines: 3 },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => <MonoBadge>{sectionLabel(row.sourceSection)}</MonoBadge>,
    },
  ];
  const channelColumns: ReadonlyArray<DataTableColumn<ChannelSuggestion>> = [
    { key: 'channel', header: 'Channel', className: 'font-medium text-foreground' },
    { key: 'recommendation', header: 'Recommendation', wrap: 'clamp', clampLines: 3 },
    {
      key: 'verdict',
      header: 'Verdict',
      render: (row) => (
        <StatusPill tone={verdictTone(row.verdict)}>{row.verdict}</StatusPill>
      ),
    },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => <MonoBadge>{sectionLabel(row.sourceSection)}</MonoBadge>,
    },
  ];
  const kpiColumns: ReadonlyArray<DataTableColumn<Kpi>> = [
    { key: 'metric', header: 'Metric', className: 'font-medium text-foreground' },
    { key: 'role', header: 'Role' },
    { key: 'definition', header: 'Definition', wrap: 'clamp', clampLines: 3 },
  ];

  return (
    <div
      data-testid="typed-artifact-renderer-positioningPaidMediaPlan"
      className={cn('space-y-10', className)}
    >
      <VerdictHero
        verdict={artifact.verdict}
        whyItMatters={artifact.statusSummary}
        confidence={artifact.confidence}
      />
      <KeyFindings findings={paidMediaKeyFindings(body, artifact)} />

      <SubsectionBlock label="Plan brief" prose={body.campaignOverview.prose}>
        <div className="grid gap-6">
          <BudgetBar
            segments={budgetSegments(body)}
            totalLabel={`${stripMoneyProvenanceSuffix(body.campaignOverview.dailySpend)} daily spend · ${stripMoneyProvenanceSuffix(body.campaignOverview.monthlyBudget)} monthly`}
          />
          <MilestoneTimeline steps={phaseMilestones(body.campaignPhases)} />
          <div className="grid gap-4 md:grid-cols-3">
            <StatCallout
              value={body.campaignOverview.monthlyBudget}
              label={`Monthly budget · ${provenanceLabel(body.campaignOverview.monthlyBudgetProvenance)}`}
              basis={
                provenanceLabel(body.campaignOverview.monthlyBudgetProvenance).includes('assumption')
                  ? 'assumption'
                  : 'measured'
              }
            />
            <StatCallout
              value={body.campaignOverview.primaryKpi}
              label="Primary KPI"
              basis="measured"
            />
            <StatCallout
              value={body.campaignOverview.platform}
              label="Platform"
              basis="assumption"
            />
          </div>
        </div>
      </SubsectionBlock>

      <section className="grid gap-4">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Cross-section thesis
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {body.crossSectionInsight.map((insight) => (
            <article key={insight.tension} className="border-l border-border pl-4">
              <p className="text-[15px] font-medium leading-[1.45] text-foreground">
                {scrubReaderText(insight.tension)}
              </p>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(insight.implicationForPlan)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {insight.sourceSections.map((section) => (
                  <MonoBadge key={section}>{sectionLabel(section)}</MonoBadge>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <SubsectionBlock label="Creative matrix" prose={body.creativeStrategy.prose}>
        <CreativeMatrix items={creativeItems(body.creativeFramework)} />
        <ReaderExhibit title="angles and creative slots" count={body.creativeFramework.length}>
          <div className="grid gap-5">
            <DataTable columns={angleColumns} rows={body.anglesToTest} />
          </div>
        </ReaderExhibit>
      </SubsectionBlock>

      <SubsectionBlock
        label="Assumptions and funnel ledger"
        prose="Each row projects demand forward — spend ÷ CPC × funnel conversion — to a count and an implied CAC, shown beside your target CAC so any shortfall is explicit. Modeled inputs are marked computed."
      >
        <div className="grid gap-5">
          {body.projectedResults.map((row) => (
            <article key={`${row.targetIcp}-${row.kpi}`} className="grid gap-3 border-l border-border pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {row.targetIcp}
                </h3>
                <MonoBadge>{row.kpi}</MonoBadge>
                <MonoBadge>{sectionLabel(row.sourceSection)}</MonoBadge>
              </div>
              <FunnelMath steps={projectionSteps(row)} />
              {row.goalGapNote ? <GapNote>{row.goalGapNote}</GapNote> : null}
              <p className="text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(row.objective)}
              </p>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <ReaderExhibit title="campaign phase rows" count={body.campaignPhases.length}>
        <DataTable columns={phaseColumns} rows={body.campaignPhases} />
      </ReaderExhibit>

      <ReaderExhibit title="funnel paths" count={body.funnelIdeation.length}>
        <DataTable columns={funnelColumns} rows={body.funnelIdeation} />
      </ReaderExhibit>

      <ReaderExhibit
        title="sales assets"
        count={linkedSalesAssets.length + missingSalesAssets.length}
      >
        <div className="grid gap-4">
          {linkedSalesAssets.length > 0 ? (
            <DataTable columns={salesColumns} rows={linkedSalesAssets} />
          ) : null}
          {missingSalesAssets.length > 0 ? (
            <GapNote
              subject="sales assets required for the paid-media path"
              howToClose={missingSalesAssets.map((asset) => asset.label).join(', ')}
            />
          ) : null}
        </div>
      </ReaderExhibit>

      <ReaderExhibit
        title="competitor marketing and review leverage"
        count={
          body.competitorMarketingInsights.length +
          body.competitorReviewInsights.length
        }
      >
        <div className="grid gap-6">
          <DataTable
            columns={competitorColumns}
            rows={body.competitorMarketingInsights}
          />
          <DataTable columns={reviewColumns} rows={body.competitorReviewInsights} />
        </div>
      </ReaderExhibit>

      <ReaderExhibit title="channel verdicts and KPIs" count={body.channelSuggestions.length + body.kpis.length}>
        <div className="grid gap-6">
          <DataTable columns={channelColumns} rows={body.channelSuggestions} />
          <DataTable columns={kpiColumns} rows={body.kpis} />
        </div>
      </ReaderExhibit>

      <SectionCoverageNote
        verified={[
          `${body.campaignPhases.length} campaign phases`,
          `${body.creativeFramework.length} creative slots`,
          `${body.projectedResults.length} projection rows`,
        ]}
        assumed={[
          ...body.audienceTypes
            .filter((audience: AudienceType) =>
              provenanceLabel(audience.dailyBudgetProvenance).includes('assumption'),
            )
            .map((audience) => `${audience.archetype} budget`),
          ...body.projectedResults
            .filter((row) =>
              provenanceLabel(row.projectedCountProvenance).includes('assumption'),
            )
            .map((row) => `${row.targetIcp} projection`),
        ]}
        missing={missingSalesAssets.map((asset) => asset.label)}
      />
    </div>
  );
}
