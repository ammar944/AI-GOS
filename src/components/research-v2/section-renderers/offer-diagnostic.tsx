import { cn } from '@/lib/utils';
import type { OfferPerformanceArtifact } from '@/types/positioning-artifact';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { SubsectionBlock } from '../primitives';
import { StrategicField, StrategicInsightPanel } from './strategic-insight-panel';

export interface OfferDiagnosticRendererProps {
  artifact: OfferPerformanceArtifact;
  className?: string;
}

const REPORTED_BY_LABEL: Record<string, string> = {
  'company-own': 'Company-own',
  'external-source': 'External',
};

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  activation: 'Activation',
  retention: 'Retention',
  'first-value-moment': 'First value',
};

const CHANNEL_WORKED_LABEL: Record<string, string> = {
  yes: 'Yes',
  partial: 'Partial',
  no: 'No',
  unknown: 'Unknown',
};

export function OfferDiagnosticRenderer({
  artifact,
  className,
}: OfferDiagnosticRendererProps): React.ReactElement {
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
      render: row => (
        <span
          data-testid="proof-point-item"
          className="font-medium text-foreground"
        >
          {row.metric}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.value}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
    {
      key: 'reportedBy',
      header: 'Reported by',
      render: row => (
        <MonoBadge>{REPORTED_BY_LABEL[row.reportedBy] ?? row.reportedBy}</MonoBadge>
      ),
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: row => <MonoBadge>{row.confidence}</MonoBadge>,
    },
  ];

  const funnelColumns: ReadonlyArray<
    DataTableColumn<(typeof funnelDiagnosis.breaks)[number]>
  > = [
    {
      key: 'stageName',
      header: 'Stage',
      render: row => (
        <span
          data-testid="funnel-break-item"
          className="font-medium text-foreground"
        >
          {row.stageName}
        </span>
      ),
    },
    { key: 'metric', header: 'Metric' },
    { key: 'magnitude', header: 'Magnitude' },
    {
      key: 'hypothesis',
      header: 'Hypothesis',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.hypothesis}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  const channelColumns: ReadonlyArray<
    DataTableColumn<(typeof channelTruth.channels)[number]>
  > = [
    {
      key: 'channelName',
      header: 'Channel',
      render: row => (
        <span
          data-testid="channel-item"
          className="font-medium text-foreground"
        >
          {row.channelName}
        </span>
      ),
    },
    {
      key: 'hasWorked',
      header: 'Has worked',
      render: row => (
        <MonoBadge>{CHANNEL_WORKED_LABEL[row.hasWorked] ?? row.hasWorked}</MonoBadge>
      ),
    },
    {
      key: 'quantifiedEvidence',
      header: 'Quantified evidence',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.quantifiedEvidence}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  const retentionColumns: ReadonlyArray<
    DataTableColumn<(typeof retentionHealth.signals)[number]>
  > = [
    {
      key: 'signalType',
      header: 'Signal type',
      render: row => (
        <span data-testid="retention-item">
          <MonoBadge>{SIGNAL_TYPE_LABEL[row.signalType] ?? row.signalType}</MonoBadge>
        </span>
      ),
    },
    {
      key: 'metric',
      header: 'Metric',
      render: row => (
        <span className="font-medium text-foreground">{row.metric}</span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.value}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  const redFlagColumns: ReadonlyArray<
    DataTableColumn<(typeof redFlags.items)[number]>
  > = [
    {
      key: 'claimedMotion',
      header: 'Claimed',
      render: row => (
        <span
          data-testid="red-flag-item"
          className="font-medium text-foreground"
        >
          {row.claimedMotion}
        </span>
      ),
    },
    { key: 'actualEvidence', header: 'Actual evidence' },
    { key: 'contradiction', header: 'Contradiction' },
    {
      key: 'severity',
      header: 'Severity',
      render: row => <MonoBadge>{row.severity}</MonoBadge>,
    },
  ];

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      {artifact.strategicInsight ||
      artifact.singleBindingConstraint ||
      artifact.orderedMoves ||
      artifact.provesWrongIf ? (
        <StrategicInsightPanel insight={artifact.strategicInsight}>
          <StrategicField
            label="single binding constraint"
            value={artifact.singleBindingConstraint?.constraint}
          />
          <StrategicField
            label="unlock condition"
            value={artifact.singleBindingConstraint?.unlockCondition}
          />
          <StrategicField
            label="ordered moves"
            value={artifact.orderedMoves
              ?.map((move) => `${move.rank}. ${move.move}`)
              .join(' ')}
          />
          <StrategicField
            label="proves wrong if"
            value={
              artifact.provesWrongIf
                ? `${artifact.provesWrongIf.metric}: ${artifact.provesWrongIf.threshold} in ${artifact.provesWrongIf.window}`
                : undefined
            }
          />
        </StrategicInsightPanel>
      ) : null}

      <SubsectionBlock label="1 · Offer-Market Fit" prose={offerMarketFit.prose}>
        <DataTable
          columns={proofPointColumns}
          rows={offerMarketFit.proofPoints}
          rowKey={r => `${r.metric}-${r.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock label="2 · Funnel Diagnosis" prose={funnelDiagnosis.prose}>
        <DataTable
          columns={funnelColumns}
          rows={funnelDiagnosis.breaks}
          rowKey={r => `${r.stageName}-${r.metric}`}
        />
      </SubsectionBlock>

      <SubsectionBlock label="3 · Channel Truth" prose={channelTruth.prose}>
        <DataTable
          columns={channelColumns}
          rows={channelTruth.channels}
          rowKey={r => r.channelName}
        />
      </SubsectionBlock>

      <SubsectionBlock label="4 · Retention Health" prose={retentionHealth.prose}>
        <DataTable
          columns={retentionColumns}
          rows={retentionHealth.signals}
          rowKey={r => `${r.signalType}-${r.metric}`}
        />
      </SubsectionBlock>

      <SubsectionBlock label="5 · Red Flags" prose={redFlags.prose}>
        <DataTable
          columns={redFlagColumns}
          rows={redFlags.items}
          rowKey={r => `${r.claimedMotion}-${r.severity}`}
        />
      </SubsectionBlock>
    </div>
  );
}
