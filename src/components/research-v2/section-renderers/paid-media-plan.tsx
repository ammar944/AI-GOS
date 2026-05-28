import { ExternalLink } from 'lucide-react';

import type { PaidMediaPlanArtifact } from '@/lib/lab-engine/artifacts/schemas/paid-media-plan';
import {
  isRecord,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';
import {
  DataTable,
  InlineStats,
  SubsectionBlock,
  type DataTableColumn,
} from '../primitives';

export interface PaidMediaPlanRendererProps {
  artifact: PaidMediaPlanArtifact | PositioningTypedArtifact;
  className?: string;
}

const PAID_MEDIA_BODY_KEYS = [
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
] as const satisfies ReadonlyArray<keyof PaidMediaPlanArtifact['body']>;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SourceLink({ url }: { url?: string }): React.ReactElement | null {
  if (url === undefined || url.length === 0) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.06em] text-primary no-underline hover:underline"
    >
      {hostnameOf(url)}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function SourceSectionPill({ value }: { value: string }): React.ReactElement {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground">
      {value}
    </span>
  );
}

const CHANNEL_VERDICT_CLASS: Record<string, string> = {
  keep: 'bg-secondary text-secondary-foreground',
  fix: 'bg-muted text-foreground',
  cut: 'bg-destructive/10 text-destructive',
  start: 'bg-primary/10 text-primary',
};

function ChannelVerdictPill({ value }: { value: string }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]',
        CHANNEL_VERDICT_CLASS[value] ?? 'bg-secondary text-secondary-foreground',
      )}
    >
      {value}
    </span>
  );
}

function CreativeSummary({
  creative,
}: {
  creative: PaidMediaPlanArtifact['body']['creativeFramework']['creatives'][number];
}): React.ReactElement {
  const lines = [
    creative.uspSentence,
    creative.problem,
    creative.solution,
    creative.transformation,
    creative.objection,
    creative.objectionAnswer,
    creative.founderScriptBeat,
  ].filter((line): line is string => line !== undefined && line.length > 0);

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-foreground">{creative.creativeType}</span>
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
      <SourceLink url={creative.sourceUrl} />
    </div>
  );
}

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
    { key: 'monthlyBudget', header: 'Budget' },
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
    { key: 'dailyBudget', header: 'Daily budget' },
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
      render: (row) => <SourceSectionPill value={row.sourceSection} />,
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
      render: (row) => <ChannelVerdictPill value={row.verdict} />,
    },
  ];
  const kpiColumns: ReadonlyArray<DataTableColumn<(typeof body.kpis.kpis)[number]>> = [
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
        <SubsectionBlock label="Campaign overview" prose={body.campaignOverview.prose}>
          <InlineStats
            items={[
              { label: 'Monthly budget', value: body.campaignOverview.monthlyBudget },
              { label: 'Daily spend', value: body.campaignOverview.dailySpend },
              { label: 'Months', value: body.campaignOverview.totalMonths },
              { label: 'Primary KPI', value: body.campaignOverview.primaryKpi },
              { label: 'Platform', value: body.campaignOverview.platform },
            ]}
          />
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
          <div className="grid gap-3 md:grid-cols-2">
            {body.creativeFramework.creatives.map((creative) => (
              <article
                key={`${creative.creativeType}-${creative.sourceSection}`}
                className="rounded-md border border-border bg-muted/30 p-4 text-[13px] leading-[1.5] text-muted-foreground"
              >
                <CreativeSummary creative={creative} />
              </article>
            ))}
          </div>
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
      </div>
    </div>
  );
}
