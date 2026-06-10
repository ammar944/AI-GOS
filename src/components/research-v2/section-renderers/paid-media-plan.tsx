import type { PaidMediaPlanArtifact } from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import { cn } from '@/lib/utils';
import { isRecord, type PositioningTypedArtifact } from '@/types/positioning-artifact';
import {
  Callout,
  DataTable,
  InlineStats,
  MonoBadge,
  SourceLink,
  StatusPill,
  type DataTableColumn,
  type StatusPillTone,
} from '@/components/research-v2/ui-kit';
import { SubsectionBlock } from '../primitives';

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

function getPaidMediaPlanBody(
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

function hasNeedsReviewBadge(
  artifact: PaidMediaPlanArtifact | PositioningTypedArtifact,
): boolean {
  const record = artifact as unknown as Record<string, unknown>;

  return record.needs_review === true;
}

function provenanceLabel(value: string | undefined): string {
  return value === undefined || value.trim().length === 0 ? 'unknown' : value;
}

function verdictTone(verdict: string): StatusPillTone {
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

function formatUsdValue(value: number | undefined): string {
  return value === undefined ? 'unknown' : `$${value.toLocaleString()}`;
}

function MoneyValue({
  provenance,
  value,
}: {
  provenance: string | undefined;
  value: string;
}): React.ReactElement {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{value}</span>
      <MonoBadge>{provenanceLabel(provenance)}</MonoBadge>
    </span>
  );
}

function MoneyStat({
  label,
  provenance,
  value,
}: {
  label: string;
  provenance: string | undefined;
  value: string;
}): React.ReactElement {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[22px] font-semibold tabular-nums text-foreground">
        <span>{value}</span>
        <MonoBadge>{provenanceLabel(provenance)}</MonoBadge>
      </dd>
    </div>
  );
}

export function PaidMediaPlanRenderer({
  artifact,
  className,
}: PaidMediaPlanRendererProps): React.ReactElement {
  const body = getPaidMediaPlanBody(artifact);
  const needsReview = hasNeedsReviewBadge(artifact);
  const phaseColumns: ReadonlyArray<DataTableColumn<CampaignPhase>> = [
    { key: 'phaseName', header: 'Phase', className: 'font-medium text-foreground' },
    { key: 'monthsLabel', header: 'Timing' },
    {
      key: 'monthlyBudget',
      header: 'Budget',
      render: (row) => (
        <MoneyValue
          value={row.monthlyBudget}
          provenance={row.monthlyBudgetProvenance}
        />
      ),
    },
    { key: 'bullets', header: 'Focus', render: (row) => row.bullets.join(', ') },
  ];
  const audienceColumns: ReadonlyArray<DataTableColumn<AudienceType>> = [
    { key: 'slot', header: 'Slot', className: 'font-medium text-foreground' },
    { key: 'archetype', header: 'Archetype' },
    {
      key: 'dailyBudget',
      header: 'Daily budget',
      render: (row) => (
        <MoneyValue
          value={row.dailyBudget}
          provenance={row.dailyBudgetProvenance}
        />
      ),
    },
    { key: 'detail', header: 'Detail', wrap: 'wrap' },
    { key: 'grounding', header: 'Grounding', wrap: 'wrap' },
  ];
  const angleColumns: ReadonlyArray<DataTableColumn<Angle>> = [
    { key: 'shortName', header: 'Angle', className: 'font-medium text-foreground' },
    { key: 'angleType', header: 'Type' },
    { key: 'description', header: 'Description', wrap: 'wrap' },
    { key: 'grounding', header: 'Grounding', wrap: 'wrap' },
  ];
  const creativeColumns: ReadonlyArray<DataTableColumn<CreativeSlot>> = [
    { key: 'label', header: 'Slot', className: 'font-medium text-foreground' },
    { key: 'angleType', header: 'Type' },
    { key: 'hook', header: 'Hook', grow: true, wrap: 'wrap' },
    { key: 'executesAngle', header: 'Angle' },
    { key: 'grounding', header: 'Grounding', wrap: 'wrap' },
  ];
  const funnelColumns: ReadonlyArray<DataTableColumn<FunnelPath>> = [
    { key: 'rank', header: 'Rank', className: 'font-medium text-foreground' },
    { key: 'name', header: 'Path' },
    { key: 'description', header: 'Description', wrap: 'wrap' },
    { key: 'whatItProves', header: 'What it proves', wrap: 'wrap' },
  ];
  const salesColumns: ReadonlyArray<DataTableColumn<SalesAsset>> = [
    { key: 'label', header: 'Asset', className: 'font-medium text-foreground' },
    { key: 'assetType', header: 'Type' },
    { key: 'note', header: 'Note' },
    {
      key: 'url',
      header: 'Link',
      render: (row) =>
        row.url.length > 0 ? <SourceLink url={row.url} /> : <MonoBadge>gap</MonoBadge>,
    },
  ];
  const competitorColumns: ReadonlyArray<DataTableColumn<CompetitorMarketing>> = [
    { key: 'competitor', header: 'Competitor', className: 'font-medium text-foreground' },
    { key: 'messaging', header: 'Messaging', wrap: 'wrap' },
    { key: 'adPlatforms', header: 'Platforms', wrap: 'wrap' },
    { key: 'positioning', header: 'Positioning', wrap: 'wrap' },
    { key: 'offer', header: 'Offer', wrap: 'wrap' },
  ];
  const reviewColumns: ReadonlyArray<DataTableColumn<CompetitorReview>> = [
    { key: 'complaint', header: 'Complaint', wrap: 'wrap' },
    { key: 'howWeLeverage', header: 'Leverage', wrap: 'wrap' },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => <MonoBadge>{row.sourceSection}</MonoBadge>,
    },
  ];
  const channelColumns: ReadonlyArray<DataTableColumn<ChannelSuggestion>> = [
    { key: 'channel', header: 'Channel', className: 'font-medium text-foreground' },
    { key: 'recommendation', header: 'Recommendation', wrap: 'wrap' },
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
      render: (row) => <MonoBadge>{row.sourceSection}</MonoBadge>,
    },
  ];
  const projectedResultColumns: ReadonlyArray<DataTableColumn<ProjectedResultRow>> = [
    {
      key: 'targetIcp',
      header: 'Target ICP',
      className: 'font-medium text-foreground',
      wrap: 'wrap',
    },
    { key: 'kpi', header: 'KPI' },
    {
      key: 'kpiCostValue',
      header: 'KPI cost',
      render: (row) => (
        <MoneyValue
          value={formatUsdValue(row.kpiCostValue)}
          provenance={row.kpiCostProvenance}
        />
      ),
    },
    { key: 'objective', header: 'Objective', wrap: 'wrap' },
    { key: 'durationLabel', header: 'Duration' },
    {
      key: 'phaseMonthlyBudgetValue',
      header: 'Budget / mo',
      render: (row) => (
        <MoneyValue
          value={formatUsdValue(row.phaseMonthlyBudgetValue)}
          provenance={row.phaseMonthlyBudgetProvenance}
        />
      ),
    },
    {
      key: 'projectedCountValue',
      header: 'Projected results',
      render: (row) =>
        row.projectedCountValue === undefined ? (
          <MonoBadge>no count — KPI cost unknown</MonoBadge>
        ) : (
          <MoneyValue
            value={`${row.projectedCountValue.toLocaleString()} ${row.kpi} (±${row.marginOfErrorPercent}%)`}
            provenance={row.projectedCountProvenance}
          />
        ),
    },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => <MonoBadge>{row.sourceSection}</MonoBadge>,
    },
  ];
  const kpiColumns: ReadonlyArray<DataTableColumn<Kpi>> = [
    { key: 'metric', header: 'Metric', className: 'font-medium text-foreground' },
    { key: 'role', header: 'Role' },
    { key: 'definition', header: 'Definition' },
  ];
  return (
    <div
      data-testid="typed-artifact-renderer-positioningPaidMediaPlan"
      className={cn('space-y-10', className)}
    >
      <div data-testid="paid-media-plan-renderer" className="space-y-10">
        {needsReview ? (
          <StatusPill tone="flagged" data-testid="paid-media-needs-review-badge">
            Needs review
          </StatusPill>
        ) : null}

        <div
          data-testid="paid-media-driver-strip"
          className="grid gap-3 border-l-2 border-primary/30 pl-4 md:grid-cols-3"
        >
          {body.crossSectionInsight.map((insight) => (
            <div key={insight.tension} className="space-y-2">
              <p className="text-sm font-medium text-foreground">{insight.tension}</p>
              <p className="text-sm text-muted-foreground">{insight.implicationForPlan}</p>
              <div className="flex flex-wrap gap-2">
                {insight.sourceSections.map((section) => (
                  <MonoBadge key={section}>{section}</MonoBadge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div data-testid="pmp-block-campaignOverview">
          <SubsectionBlock label="Campaign overview" prose={body.campaignOverview.prose}>
            <div className="space-y-4">
              <dl className="flex flex-wrap gap-x-10 gap-y-4">
                <MoneyStat
                  label="Monthly budget"
                  value={body.campaignOverview.monthlyBudget}
                  provenance={body.campaignOverview.monthlyBudgetProvenance}
                />
                <MoneyStat
                  label="Daily spend"
                  value={body.campaignOverview.dailySpend}
                  provenance={body.campaignOverview.dailySpendProvenance}
                />
              </dl>
              <InlineStats
                items={[
                  { label: 'Months', value: body.campaignOverview.totalMonths },
                  { label: 'Primary KPI', value: body.campaignOverview.primaryKpi },
                  { label: 'Platform', value: body.campaignOverview.platform },
                ]}
              />
            </div>
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-campaignPhases">
          <SubsectionBlock
            label="Campaign phases"
            prose="Two phases keep the first budget focused on learning before scale."
          >
            <DataTable columns={phaseColumns} rows={body.campaignPhases} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-audienceTypes">
          <SubsectionBlock
            label="Audience types"
            prose="Three fixed audience archetypes run in parallel during Phase 1."
          >
            <DataTable columns={audienceColumns} rows={body.audienceTypes} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-anglesToTest">
          <SubsectionBlock
            label="Angles to test"
            prose="Four distinct angles translate positioning evidence into creative tests."
          >
            <DataTable columns={angleColumns} rows={body.anglesToTest} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-creativeStrategy">
          <SubsectionBlock label="Creative strategy" prose={body.creativeStrategy.prose}>
            <InlineStats
              items={[
                { label: 'Static', value: body.creativeStrategy.staticCount },
                { label: 'Video', value: body.creativeStrategy.videoCount },
                { label: 'Per audience', value: body.creativeStrategy.totalPerAudience },
              ]}
            />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-creativeFramework">
          <SubsectionBlock
            label="Creative framework"
            prose="Eight fixed creative slots execute the selected angles."
          >
            <DataTable columns={creativeColumns} rows={body.creativeFramework} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-funnelIdeation">
          <SubsectionBlock
            label="Funnel ideation"
            prose="Three funnel paths define what each paid click is meant to prove."
          >
            <DataTable columns={funnelColumns} rows={body.funnelIdeation} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-salesProcess">
          <SubsectionBlock
            label="Sales process"
            prose="Sales assets are linked when provided and marked as gaps when absent."
          >
            <DataTable columns={salesColumns} rows={body.salesProcess} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-competitorMarketingInsights">
          <SubsectionBlock
            label="Competitor marketing insights"
            prose="Competitor marketing signals define what the plan exploits or avoids."
          >
            <DataTable columns={competitorColumns} rows={body.competitorMarketingInsights} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-competitorReviewInsights">
          <SubsectionBlock
            label="Competitor review insights"
            prose="Review complaints become ad and sales leverage only when grounded."
          >
            <DataTable columns={reviewColumns} rows={body.competitorReviewInsights} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-channelSuggestions">
          <SubsectionBlock
            label="Channel suggestions"
            prose="Current-funnel recommendations use verdict badges for action priority."
          >
            <DataTable columns={channelColumns} rows={body.channelSuggestions} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-projectedResults">
          <SubsectionBlock
            label="Projected results"
            prose="SOP projections: counts are runner-computed as budget ÷ KPI cost at ±20%; rows without a sourced KPI cost carry no count."
          >
            <DataTable columns={projectedResultColumns} rows={body.projectedResults} />
          </SubsectionBlock>
        </div>

        <div data-testid="pmp-block-kpis">
          <SubsectionBlock
            label="KPIs"
            prose="The plan tracks one primary outcome plus creative health and efficiency."
          >
            <DataTable columns={kpiColumns} rows={body.kpis} />
          </SubsectionBlock>
        </div>

        <Callout label="Grounding" tone="accent">
          Every launchable row carries a source section and grounding note; `UNVERIFIED`
          marks an explicit evidence gap.
        </Callout>
      </div>
    </div>
  );
}
