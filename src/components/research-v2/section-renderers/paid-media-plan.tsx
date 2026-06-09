import type { PaidMediaPlanArtifact } from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import { cn } from '@/lib/utils';
import { isRecord, type PositioningTypedArtifact } from '@/types/positioning-artifact';
import {
  Callout,
  DataTable,
  InlineStats,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
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
type Kpi = PaidMediaBody['kpis'][number];
type CrossSectionInsight = PaidMediaBody['crossSectionInsight'][number];

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

function provenanceLabel(value: string | undefined): string {
  return value === undefined || value.trim().length === 0 ? 'unknown' : value;
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
    { key: 'detail', header: 'Detail' },
    { key: 'grounding', header: 'Grounding', wrap: 'clamp', clampLines: 2 },
  ];
  const angleColumns: ReadonlyArray<DataTableColumn<Angle>> = [
    { key: 'shortName', header: 'Angle', className: 'font-medium text-foreground' },
    { key: 'angleType', header: 'Type' },
    { key: 'description', header: 'Description', wrap: 'clamp', clampLines: 2 },
    { key: 'grounding', header: 'Grounding', wrap: 'clamp', clampLines: 2 },
  ];
  const creativeColumns: ReadonlyArray<DataTableColumn<CreativeSlot>> = [
    { key: 'label', header: 'Slot', className: 'font-medium text-foreground' },
    { key: 'angleType', header: 'Type' },
    { key: 'hook', header: 'Hook', grow: true, wrap: 'clamp', clampLines: 2 },
    { key: 'executesAngle', header: 'Angle' },
  ];
  const funnelColumns: ReadonlyArray<DataTableColumn<FunnelPath>> = [
    { key: 'rank', header: 'Rank', className: 'font-medium text-foreground' },
    { key: 'name', header: 'Path' },
    { key: 'description', header: 'Description', wrap: 'clamp', clampLines: 2 },
    { key: 'whatItProves', header: 'What it proves' },
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
    { key: 'messaging', header: 'Messaging', wrap: 'clamp', clampLines: 2 },
    { key: 'adPlatforms', header: 'Platforms' },
    { key: 'positioning', header: 'Positioning', wrap: 'clamp', clampLines: 2 },
    { key: 'offer', header: 'Offer' },
  ];
  const reviewColumns: ReadonlyArray<DataTableColumn<CompetitorReview>> = [
    { key: 'complaint', header: 'Complaint', wrap: 'clamp', clampLines: 2 },
    { key: 'howWeLeverage', header: 'Leverage', wrap: 'clamp', clampLines: 2 },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => <MonoBadge>{row.sourceSection}</MonoBadge>,
    },
  ];
  const channelColumns: ReadonlyArray<DataTableColumn<ChannelSuggestion>> = [
    { key: 'channel', header: 'Channel', className: 'font-medium text-foreground' },
    { key: 'recommendation', header: 'Recommendation', wrap: 'clamp', clampLines: 2 },
    { key: 'verdict', header: 'Verdict', render: (row) => <MonoBadge>{row.verdict}</MonoBadge> },
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
  const insightColumns: ReadonlyArray<DataTableColumn<CrossSectionInsight>> = [
    { key: 'tension', header: 'Tension', wrap: 'clamp', clampLines: 2 },
    {
      key: 'sourceSections',
      header: 'Sections',
      render: (row) => row.sourceSections.join(', '),
    },
    { key: 'implicationForPlan', header: 'Plan implication', wrap: 'clamp', clampLines: 2 },
    { key: 'contrarianInversion', header: 'Inversion', wrap: 'clamp', clampLines: 2 },
  ];

  return (
    <div
      data-testid="typed-artifact-renderer-positioningPaidMediaPlan"
      className={cn('space-y-10', className)}
    >
      <div data-testid="paid-media-plan-renderer" className="space-y-10">
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

        <SubsectionBlock label="Cross-section insight" prose="Internal driver tensions folded into the plan.">
          <DataTable columns={insightColumns} rows={body.crossSectionInsight} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Campaign phases"
          prose="Two phases keep the first budget focused on learning before scale."
        >
          <DataTable columns={phaseColumns} rows={body.campaignPhases} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Audience types"
          prose="Three fixed audience archetypes run in parallel during Phase 1."
        >
          <DataTable columns={audienceColumns} rows={body.audienceTypes} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Angles to test"
          prose="Four distinct angles translate positioning evidence into creative tests."
        >
          <DataTable columns={angleColumns} rows={body.anglesToTest} />
        </SubsectionBlock>

        <SubsectionBlock label="Creative strategy" prose={body.creativeStrategy.prose}>
          <InlineStats
            items={[
              { label: 'Static', value: body.creativeStrategy.staticCount },
              { label: 'Video', value: body.creativeStrategy.videoCount },
              { label: 'Per audience', value: body.creativeStrategy.totalPerAudience },
            ]}
          />
        </SubsectionBlock>

        <SubsectionBlock
          label="Creative framework"
          prose="Eight fixed creative slots execute the selected angles."
        >
          <DataTable columns={creativeColumns} rows={body.creativeFramework} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Funnel ideation"
          prose="Three funnel paths define what each paid click is meant to prove."
        >
          <DataTable columns={funnelColumns} rows={body.funnelIdeation} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Sales process"
          prose="Sales assets are linked when provided and marked as gaps when absent."
        >
          <DataTable columns={salesColumns} rows={body.salesProcess} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Competitor marketing insights"
          prose="Competitor marketing signals define what the plan exploits or avoids."
        >
          <DataTable columns={competitorColumns} rows={body.competitorMarketingInsights} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Competitor review insights"
          prose="Review complaints become ad and sales leverage only when grounded."
        >
          <DataTable columns={reviewColumns} rows={body.competitorReviewInsights} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Channel suggestions"
          prose="Current-funnel recommendations use verdict badges for action priority."
        >
          <DataTable columns={channelColumns} rows={body.channelSuggestions} />
        </SubsectionBlock>

        <SubsectionBlock
          label="KPIs"
          prose="The plan tracks one primary outcome plus creative health and efficiency."
        >
          <DataTable columns={kpiColumns} rows={body.kpis} />
        </SubsectionBlock>

        <Callout label="Grounding" tone="accent">
          Every launchable row carries a source section and grounding note; `UNVERIFIED`
          marks an explicit evidence gap.
        </Callout>
      </div>
    </div>
  );
}
