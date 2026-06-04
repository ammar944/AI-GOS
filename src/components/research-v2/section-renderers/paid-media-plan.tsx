import type { PaidMediaPlanArtifact } from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import {
  isRecord,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';
import {
  Callout,
  DataTable,
  Eyebrow,
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
  'strategicThesis',
  'contradictionReconciliation',
  'campaignOverview',
  'campaignPhases',
  'audienceTypes',
  'creativeStrategy',
  'anglesToTest',
  'creativeFramework',
  'competitorReviewInsights',
  'competitorMarketingInsights',
  'funnelIdeation',
  'salesProcess',
  'channelSuggestions',
  'kpis',
  'orderedMoves',
] as const satisfies ReadonlyArray<keyof PaidMediaPlanArtifact['body']>;

function getPaidMediaPlanBody(
  artifact: PaidMediaPlanArtifact | PositioningTypedArtifact,
): PaidMediaPlanArtifact['body'] {
  const record = artifact as unknown as Record<string, unknown>;

  if (isRecord(record.body)) {
    return record.body as PaidMediaPlanArtifact['body'];
  }

  return Object.fromEntries(
    PAID_MEDIA_BODY_KEYS.map((key) => [key, record[key]]),
  ) as PaidMediaPlanArtifact['body'];
}

function creativeSummaryLines(
  creative: PaidMediaPlanArtifact['body']['creativeFramework']['creatives'][number],
): string {
  return [
    creative.uspSentence,
    creative.problem,
    creative.solution,
    creative.transformation,
    creative.objection,
    creative.objectionAnswer,
    creative.founderScriptBeat,
  ]
    .filter((line): line is string => line !== undefined && line.length > 0)
    .join(' · ');
}

function provenanceLabel(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    return 'unknown';
  }

  return value;
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
      <dt>
        <Eyebrow>{label}</Eyebrow>
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
  const phaseColumns: ReadonlyArray<
    DataTableColumn<(typeof body.campaignPhases.phases)[number]>
  > = [
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
    {
      key: 'bullets',
      header: 'Focus',
      render: (row) => row.bullets.join(', '),
    },
  ];
  const audienceColumns: ReadonlyArray<
    DataTableColumn<(typeof body.audienceTypes.audiences)[number]>
  > = [
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
    {
      key: 'detail',
      header: 'Detail',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span>{row.detail}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];
  const angleColumns: ReadonlyArray<
    DataTableColumn<(typeof body.anglesToTest.angles)[number]>
  > = [
    { key: 'angleName', header: 'Angle', className: 'font-medium text-foreground' },
    { key: 'primaryText', header: 'Primary text' },
    { key: 'supportingLine', header: 'Support' },
    {
      key: 'insight',
      header: 'Evidence hook',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span>{row.insight}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];
  const creativeColumns: ReadonlyArray<
    DataTableColumn<(typeof body.creativeFramework.creatives)[number]>
  > = [
    {
      key: 'creativeType',
      header: 'Type',
      width: '140px',
      wrap: 'nowrap',
      render: (row) => (
        <span className="font-medium text-foreground">{row.creativeType}</span>
      ),
    },
    {
      key: 'summary',
      header: 'Framework',
      grow: true,
      wrap: 'clamp',
      clampLines: 2,
      render: (row) => {
        const summary = creativeSummaryLines(row);
        return <span title={summary}>{summary}</span>;
      },
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      width: '88px',
      wrap: 'nowrap',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];
  const reviewColumns: ReadonlyArray<
    DataTableColumn<(typeof body.competitorReviewInsights.insights)[number]>
  > = [
    { key: 'competitor', header: 'Competitor', className: 'font-medium text-foreground' },
    { key: 'verbatimComplaint', header: 'Complaint' },
    {
      key: 'adLeverage',
      header: 'Ad leverage',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span>{row.adLeverage}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];
  const competitorColumns: ReadonlyArray<
    DataTableColumn<(typeof body.competitorMarketingInsights.competitors)[number]>
  > = [
    { key: 'competitor', header: 'Competitor', className: 'font-medium text-foreground' },
    { key: 'messaging', header: 'Messaging' },
    {
      key: 'estSpend',
      header: 'Spend',
      render: (row) => (
        <MoneyValue
          value={row.estSpend}
          provenance={row.estSpendProvenance}
        />
      ),
    },
    { key: 'anglesTested', header: 'Angles' },
    { key: 'offer', header: 'Offer' },
  ];
  const funnelColumns: ReadonlyArray<
    DataTableColumn<(typeof body.funnelIdeation.recommendations)[number]>
  > = [
    { key: 'funnelType', header: 'Funnel', className: 'font-medium text-foreground' },
    { key: 'recommendation', header: 'Recommendation' },
    { key: 'optInToBookedCall', header: 'Click to call' },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => <MonoBadge>{row.sourceSection}</MonoBadge>,
    },
  ];
  const salesColumns: ReadonlyArray<
    DataTableColumn<(typeof body.salesProcess.assets)[number]>
  > = [
    { key: 'label', header: 'Asset', className: 'font-medium text-foreground' },
    { key: 'assetType', header: 'Type' },
    {
      key: 'url',
      header: 'Link',
      render: (row) => <SourceLink url={row.url} />,
    },
  ];
  const channelColumns: ReadonlyArray<
    DataTableColumn<(typeof body.channelSuggestions.suggestions)[number]>
  > = [
    { key: 'channel', header: 'Channel', className: 'font-medium text-foreground' },
    { key: 'observation', header: 'Observation' },
    { key: 'recommendation', header: 'Recommendation' },
    {
      key: 'verdict',
      header: 'Verdict',
      render: (row) => <MonoBadge>{row.verdict}</MonoBadge>,
    },
  ];
  const kpiColumns: ReadonlyArray<DataTableColumn<(typeof body.kpis.kpis)[number]>> = [
    { key: 'metric', header: 'Metric', className: 'font-medium text-foreground' },
    { key: 'role', header: 'Role' },
    { key: 'definition', header: 'Definition' },
  ];
  const thesisSourceColumns: ReadonlyArray<
    DataTableColumn<(typeof body.strategicThesis.sourceSections)[number]>
  > = [
    {
      key: 'sourceSection',
      header: 'Section',
      render: (row) => <MonoBadge>{row.sourceSection}</MonoBadge>,
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];
  const orderedMoveColumns: ReadonlyArray<
    DataTableColumn<(typeof body.orderedMoves.moves)[number]>
  > = [
    { key: 'rank', header: '#', width: '48px', wrap: 'nowrap' },
    { key: 'move', header: 'Move', className: 'font-medium text-foreground' },
    {
      key: 'learningPriority',
      header: 'Learning priority',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span>{row.learningPriority}</span>
          <span className="text-xs text-muted-foreground">{row.thesisTrace}</span>
          <span className="text-xs text-muted-foreground">
            Depends on {row.dependsOn.length === 0 ? 'none' : row.dependsOn.join(', ')}
          </span>
        </div>
      ),
    },
    {
      key: 'provesWrongIf',
      header: 'Kill criterion',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span>{row.provesWrongIf.metric}</span>
          <span className="text-xs text-muted-foreground">
            {row.provesWrongIf.threshold} / {row.provesWrongIf.window}
          </span>
        </div>
      ),
    },
    {
      key: 'sourceSection',
      header: 'Source',
      render: (row) => (
        <div className="flex items-center gap-2">
          <MonoBadge>{row.sourceSection}</MonoBadge>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  return (
    <div
      data-testid="typed-artifact-renderer-positioningPaidMediaPlan"
      className={cn('space-y-10', className)}
    >
      <div data-testid="paid-media-plan-renderer" className="space-y-10">
        {body.strategicThesis ? (
          <SubsectionBlock label="Strategic thesis" prose={body.strategicThesis.thesis}>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Callout label="Segment" tone="accent">
                  {body.strategicThesis.segment}
                </Callout>
                <Callout label="Awareness" tone="good">
                  {body.strategicThesis.awareness}
                </Callout>
                <Callout label="Force" tone="warn">
                  {body.strategicThesis.force}
                </Callout>
                <Callout label="Differentiator" tone="good">
                  {body.strategicThesis.defensibleDifferentiator}
                </Callout>
              </div>
              <DataTable
                columns={thesisSourceColumns}
                rows={body.strategicThesis.sourceSections}
              />
            </div>
          </SubsectionBlock>
        ) : null}

        {body.contradictionReconciliation ? (
          <SubsectionBlock
            label="Contradiction reconciliation"
            prose={body.contradictionReconciliation.contradiction}
          >
            <div className="space-y-4">
              <Callout label="Resolution" tone="accent">
                {body.contradictionReconciliation.resolution}
              </Callout>
              <Callout label="Trade-off accepted" tone="warn">
                {body.contradictionReconciliation.tradeOffAccepted}
              </Callout>
              <DataTable
                columns={thesisSourceColumns}
                rows={body.contradictionReconciliation.sourceSections}
              />
            </div>
          </SubsectionBlock>
        ) : null}

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

        <SubsectionBlock label="Campaign phases" prose={body.campaignPhases.prose}>
          <DataTable columns={phaseColumns} rows={body.campaignPhases.phases} />
        </SubsectionBlock>

        <SubsectionBlock label="Audience types" prose={body.audienceTypes.prose}>
          <DataTable columns={audienceColumns} rows={body.audienceTypes.audiences} />
        </SubsectionBlock>

        <SubsectionBlock label="Creative strategy" prose={body.creativeStrategy.prose}>
          <InlineStats
            items={[
              { label: 'Static', value: body.creativeStrategy.staticCount },
              { label: 'Video', value: body.creativeStrategy.videoCount },
              { label: 'Per audience', value: body.creativeStrategy.totalPerAudience },
              {
                label: 'Angle types',
                value: body.creativeStrategy.angleTypesInMix.length,
              },
            ]}
          />
        </SubsectionBlock>

        <SubsectionBlock label="Angles to test" prose={body.anglesToTest.prose}>
          <DataTable columns={angleColumns} rows={body.anglesToTest.angles} />
        </SubsectionBlock>

        <SubsectionBlock label="Creative framework" prose={body.creativeFramework.prose}>
          <DataTable
            columns={creativeColumns}
            rows={body.creativeFramework.creatives}
            rowKey={(row) => `${row.creativeType}-${row.sourceSection}`}
          />
        </SubsectionBlock>

        <SubsectionBlock
          label="Competitor review insights"
          prose={body.competitorReviewInsights.prose}
        >
          <DataTable
            columns={reviewColumns}
            rows={body.competitorReviewInsights.insights}
          />
        </SubsectionBlock>

        <SubsectionBlock
          label="Competitor marketing insights"
          prose={body.competitorMarketingInsights.prose}
        >
          <DataTable
            columns={competitorColumns}
            rows={body.competitorMarketingInsights.competitors}
          />
        </SubsectionBlock>

        <SubsectionBlock label="Funnel ideation" prose={body.funnelIdeation.prose}>
          <DataTable
            columns={funnelColumns}
            rows={body.funnelIdeation.recommendations}
          />
        </SubsectionBlock>

        <SubsectionBlock label="Sales process" prose={body.salesProcess.prose}>
          <DataTable columns={salesColumns} rows={body.salesProcess.assets} />
        </SubsectionBlock>

        <SubsectionBlock
          label="Channel suggestions"
          prose={body.channelSuggestions.prose}
        >
          <DataTable
            columns={channelColumns}
            rows={body.channelSuggestions.suggestions}
          />
        </SubsectionBlock>

        <SubsectionBlock label="KPIs" prose={body.kpis.prose}>
          <DataTable columns={kpiColumns} rows={body.kpis.kpis} />
        </SubsectionBlock>

        {body.orderedMoves ? (
          <SubsectionBlock label="Ordered moves" prose={body.orderedMoves.prose}>
            <DataTable columns={orderedMoveColumns} rows={body.orderedMoves.moves} />
          </SubsectionBlock>
        ) : null}
      </div>
    </div>
  );
}
