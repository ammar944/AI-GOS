import { cn } from '@/lib/utils';
import type { OfferPerformanceArtifact } from '@/lib/managed-agents/schemas/offer-performance-diagnostic';
import {
  DataTable,
  SubsectionBlock,
  type DataTableColumn,
} from '../primitives';

export interface OfferDiagnosticRendererProps {
  artifact: OfferPerformanceArtifact;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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

/* ───────── Pills ───────── */

const REPORTED_BY_LABEL: Record<string, string> = {
  'company-own': 'Company-own',
  'external-source': 'External',
};

function ReportedByPill({ value }: { value: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground">
      {REPORTED_BY_LABEL[value] ?? value}
    </span>
  );
}

const CONFIDENCE_PILL_CLASS: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-600',
  medium: 'bg-amber-500/10 text-amber-600',
  low: 'bg-rose-500/10 text-rose-600',
};

function ConfidencePill({ value }: { value: string }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]',
        CONFIDENCE_PILL_CLASS[value] ?? 'bg-secondary text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

const CHANNEL_WORKED_LABEL: Record<string, string> = {
  yes: 'Yes',
  partial: 'Partial',
  no: 'No',
  unknown: 'Unknown',
};
const CHANNEL_WORKED_CLASS: Record<string, string> = {
  yes: 'bg-emerald-500/10 text-emerald-600',
  partial: 'bg-amber-500/10 text-amber-600',
  no: 'bg-rose-500/10 text-rose-600',
  unknown: 'bg-secondary text-muted-foreground',
};

function HasWorkedPill({ value }: { value: string }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]',
        CHANNEL_WORKED_CLASS[value] ?? 'bg-secondary text-muted-foreground',
      )}
    >
      {CHANNEL_WORKED_LABEL[value] ?? value}
    </span>
  );
}

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  activation: 'Activation',
  retention: 'Retention',
  'first-value-moment': 'First value',
};

function SignalTypePill({ value }: { value: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground">
      {SIGNAL_TYPE_LABEL[value] ?? value}
    </span>
  );
}

const SEVERITY_CLASS: Record<string, string> = {
  high: 'bg-rose-500/10 text-rose-600',
  medium: 'bg-amber-500/10 text-amber-600',
  low: 'bg-secondary text-muted-foreground',
};

function SeverityPill({ value }: { value: string }): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em]',
        SEVERITY_CLASS[value] ?? 'bg-secondary text-muted-foreground',
      )}
    >
      {value}
    </span>
  );
}

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

  /* ───────── 1. Offer-Market Fit ───────── */
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
      render: row => <ReportedByPill value={row.reportedBy} />,
    },
    {
      key: 'confidence',
      header: 'Confidence',
      render: row => <ConfidencePill value={row.confidence} />,
    },
  ];

  /* ───────── 2. Funnel Diagnosis ───────── */
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

  /* ───────── 3. Channel Truth ───────── */
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
      render: row => <HasWorkedPill value={row.hasWorked} />,
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

  /* ───────── 4. Retention Health ───────── */
  const retentionColumns: ReadonlyArray<
    DataTableColumn<(typeof retentionHealth.signals)[number]>
  > = [
    {
      key: 'signalType',
      header: 'Signal type',
      render: row => (
        <span data-testid="retention-item">
          <SignalTypePill value={row.signalType} />
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

  /* ───────── 5. Red Flags ───────── */
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
      render: row => <SeverityPill value={row.severity} />,
    },
  ];

  return (
    <div className={cn('flex flex-col gap-12', className)}>
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
