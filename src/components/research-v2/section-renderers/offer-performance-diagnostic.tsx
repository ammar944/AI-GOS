import type { OfferPerformanceArtifact } from '@/lib/managed-agents/schemas/offer-performance-diagnostic';
import { cn } from '@/lib/utils';

import {
  BarBreakdown,
  DataTable,
  QuoteCallout,
  type DataTableColumn,
} from '../primitives';
import {
  SourceLink,
  SubsectionBlock,
  countBy,
  formatEnumLabel,
} from './shared';

export interface OfferPerformanceDiagnosticRendererProps {
  artifact: OfferPerformanceArtifact;
  className?: string;
}

export function OfferPerformanceDiagnosticRenderer({
  artifact,
  className,
}: OfferPerformanceDiagnosticRendererProps): React.ReactElement {
  const {
    offerMarketFit,
    funnelDiagnosis,
    channelTruth,
    retentionHealth,
    redFlags,
  } = artifact;

  const proofPointColumns: ReadonlyArray<
    DataTableColumn<(typeof offerMarketFit.proofPoints)[number]>
  > = [
    {
      key: 'metric',
      header: 'Metric',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.metric}
        </span>
      ),
    },
    { key: 'value', header: 'Value' },
    {
      key: 'reportedBy',
      header: 'Reported by',
      render: (row) => formatEnumLabel(row.reportedBy),
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: (row) => formatEnumLabel(row.confidence),
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const funnelColumns: ReadonlyArray<
    DataTableColumn<(typeof funnelDiagnosis.breaks)[number]>
  > = [
    {
      key: 'stageName',
      header: 'Stage',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.stageName}
        </span>
      ),
    },
    { key: 'metric', header: 'Metric' },
    { key: 'magnitude', header: 'Magnitude' },
    { key: 'hypothesis', header: 'Hypothesis' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const channelColumns: ReadonlyArray<
    DataTableColumn<(typeof channelTruth.channels)[number]>
  > = [
    {
      key: 'channelName',
      header: 'Channel',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.channelName}
        </span>
      ),
    },
    {
      key: 'hasWorked',
      header: 'Worked?',
      render: (row) => formatEnumLabel(row.hasWorked),
    },
    { key: 'quantifiedEvidence', header: 'Evidence' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const retentionColumns: ReadonlyArray<
    DataTableColumn<(typeof retentionHealth.signals)[number]>
  > = [
    {
      key: 'signalType',
      header: 'Signal',
      render: (row) => formatEnumLabel(row.signalType),
    },
    { key: 'metric', header: 'Metric' },
    { key: 'value', header: 'Value' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const channelSegments = countBy(
    channelTruth.channels,
    (channel) => channel.hasWorked,
  ).map((segment) => ({
    ...segment,
    label: formatEnumLabel(segment.label),
    isAccent: segment.label === 'yes',
  }));

  return (
    <div className={cn('mx-auto flex w-full max-w-[920px] flex-col gap-16', className)}>
      <SubsectionBlock title="Offer-market fit" prose={offerMarketFit.prose}>
        <DataTable
          caption="Fit proof points"
          columns={proofPointColumns}
          rows={offerMarketFit.proofPoints}
          rowKey={(row) => `${row.metric}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Funnel diagnosis" prose={funnelDiagnosis.prose}>
        <DataTable
          caption="Observed breaks"
          columns={funnelColumns}
          rows={funnelDiagnosis.breaks}
          rowKey={(row) => `${row.stageName}-${row.metric}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Channel truth" prose={channelTruth.prose}>
        {channelSegments.length > 0 ? (
          <BarBreakdown
            caption="Channel evidence mix"
            total={`${channelTruth.channels.length} channels`}
            segments={channelSegments}
          />
        ) : null}
        <DataTable
          caption="Channel evidence"
          columns={channelColumns}
          rows={channelTruth.channels}
          rowKey={(row) => `${row.channelName}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock
        title="Retention health"
        prose={retentionHealth.prose}
      >
        <DataTable
          caption="Retention signals"
          columns={retentionColumns}
          rows={retentionHealth.signals}
          rowKey={(row) => `${row.signalType}-${row.metric}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Red flags" prose={redFlags.prose}>
        <div className="flex flex-col gap-8">
          {redFlags.items.map((item, index) => (
            <QuoteCallout
              key={`${item.claimedMotion}-${index}`}
              quote={item.contradiction}
              source={item.claimedMotion}
              meta={`${formatEnumLabel(item.severity)} severity`}
              emphasis={
                <span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
                    actual evidence ·{' '}
                  </span>
                  {item.actualEvidence}
                </span>
              }
            />
          ))}
        </div>
      </SubsectionBlock>
    </div>
  );
}
