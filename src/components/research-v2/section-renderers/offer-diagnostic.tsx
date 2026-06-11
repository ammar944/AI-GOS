import { cn } from '@/lib/utils';
import type { OfferPerformanceArtifact } from '@/types/positioning-artifact';
import {
  BasisChip,
  EvidenceChip,
  FunnelMath,
  KeyFindings,
  SectionCoverageNote,
  StatCallout,
  SubsectionBlock,
  VerdictHero,
  scrubReaderText,
  type EvidenceChipSource,
  type FunnelMathStep,
  type KeyFinding,
} from '@/components/research-v2/primitives';
import { MonoBadge } from '@/components/research-v2/ui-kit';
import { StrategicField, StrategicInsightPanel } from './strategic-insight-panel';

export interface OfferDiagnosticRendererProps {
  artifact: OfferPerformanceArtifact;
  className?: string;
}

type FunnelBreak = OfferPerformanceArtifact['funnelDiagnosis']['breaks'][number];

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

function sourceAt(
  artifact: OfferPerformanceArtifact,
  index: number,
): EvidenceChipSource | undefined {
  const source = artifact.sources[index];
  if (!source) return undefined;
  return {
    n: index + 1,
    title: source.title,
    url: source.url,
    whyItMatters: source.whyItMatters,
  };
}

function offerKeyFindings(
  artifact: OfferPerformanceArtifact,
): readonly KeyFinding[] {
  const proofPoint = artifact.offerMarketFit.proofPoints[0];
  const funnelBreak = artifact.funnelDiagnosis.breaks[0];
  const redFlag = artifact.redFlags.items[0];

  return [
    {
      sentence: artifact.statusSummary,
      basis: 'sourced',
      evidence: [sourceAt(artifact, 0)].filter(
        (source): source is EvidenceChipSource => source !== undefined,
      ),
    },
    artifact.singleBindingConstraint
      ? {
          sentence: `${artifact.singleBindingConstraint.constraint} unlocks when ${artifact.singleBindingConstraint.unlockCondition}`,
          basis: 'sourced',
        }
      : {
          sentence: artifact.verdict,
          basis: 'assumption',
        },
    proofPoint
      ? {
          sentence: `${proofPoint.metric}: ${proofPoint.value}`,
          basis: proofPoint.reportedBy === 'company-own' ? 'measured' : 'sourced',
          evidence: [
            {
              title: proofPoint.metric,
              url: proofPoint.sourceUrl,
            },
          ],
        }
      : {
          sentence: artifact.offerMarketFit.prose,
          basis: 'assumption',
        },
    funnelBreak
      ? {
          sentence: `${funnelBreak.stageName} is the visible funnel break: ${funnelBreak.hypothesis}`,
          basis: 'sourced',
        }
      : {
          sentence: artifact.funnelDiagnosis.prose,
          basis: 'assumption',
        },
    redFlag
      ? {
          sentence: `${redFlag.claimedMotion} conflicts with ${redFlag.actualEvidence}`,
          basis: redFlag.severity === 'high' ? 'gap' : 'sourced',
        }
      : {
          sentence: artifact.redFlags.prose,
          basis: 'assumption',
        },
  ];
}

function funnelStepsFromBreak(row: FunnelBreak): FunnelMathStep[] {
  return [
    { label: 'Stage', value: row.stageName, basis: 'sourced' },
    { label: 'Metric', value: row.metric, basis: 'sourced' },
    { label: 'Magnitude', value: row.magnitude, basis: 'benchmark' },
    { label: 'Constraint', value: row.hypothesis, basis: 'assumption' },
  ];
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
  const constraint = artifact.singleBindingConstraint;

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <VerdictHero
        verdict={constraint?.constraint ?? artifact.verdict}
        whyItMatters={constraint?.unlockCondition ?? artifact.statusSummary}
        confidence={artifact.confidence}
      />
      <KeyFindings findings={offerKeyFindings(artifact)} />

      <SubsectionBlock label="Offer-market fit" prose={offerMarketFit.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {offerMarketFit.proofPoints.map((point) => (
            <StatCallout
              key={`${point.metric}-${point.sourceUrl}`}
              value={point.value}
              label={`${point.metric} · ${REPORTED_BY_LABEL[point.reportedBy] ?? point.reportedBy}`}
              basis={point.reportedBy === 'company-own' ? 'measured' : 'sourced'}
            />
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Funnel diagnosis" prose={funnelDiagnosis.prose}>
        <div className="grid gap-5">
          {funnelDiagnosis.breaks.map((row) => (
            <article key={`${row.stageName}-${row.metric}`} data-testid="funnel-break-item" className="grid gap-3 border-l border-border pl-4">
              <FunnelMath steps={funnelStepsFromBreak(row)} />
              <div className="flex flex-wrap items-center gap-2">
                <EvidenceChip
                  source={{
                    title: row.stageName,
                    url: row.sourceUrl,
                    excerpt: row.hypothesis,
                  }}
                  label="source"
                />
              </div>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Channel truth" prose={channelTruth.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {channelTruth.channels.map((channel) => (
            <article key={channel.channelName} className="border border-border bg-card p-4" data-testid="channel-item">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {channel.channelName}
                </h3>
                <MonoBadge>
                  {CHANNEL_WORKED_LABEL[channel.hasWorked] ?? channel.hasWorked}
                </MonoBadge>
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(channel.quantifiedEvidence)}
              </p>
              <div className="mt-3">
                <EvidenceChip
                  source={{
                    title: channel.channelName,
                    url: channel.sourceUrl,
                    excerpt: channel.quantifiedEvidence,
                  }}
                  label="source"
                />
              </div>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Retention health" prose={retentionHealth.prose}>
        <div className="grid gap-4 md:grid-cols-3">
          {retentionHealth.signals.map((signal) => (
            <article key={`${signal.signalType}-${signal.metric}`} data-testid="retention-item" className="border-l border-border pl-4">
              <MonoBadge>{SIGNAL_TYPE_LABEL[signal.signalType] ?? signal.signalType}</MonoBadge>
              <p className="mt-2 text-[15px] font-semibold text-foreground">
                {signal.metric}
              </p>
              <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(signal.value)}
              </p>
              <div className="mt-2">
                <EvidenceChip
                  source={{
                    title: signal.metric,
                    url: signal.sourceUrl,
                    excerpt: signal.value,
                  }}
                  label="source"
                />
              </div>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Red flags" prose={redFlags.prose}>
        <div className="grid gap-4">
          {redFlags.items.map((flag) => (
            <article key={`${flag.claimedMotion}-${flag.severity}`} data-testid="red-flag-item" className="border-l-2 border-red-500/60 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <BasisChip basis={flag.severity === 'high' ? 'gap' : 'assumption'}>
                  {flag.severity}
                </BasisChip>
                <h3 className="text-[15px] font-semibold text-foreground">
                  {flag.claimedMotion}
                </h3>
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
                Actual evidence: {scrubReaderText(flag.actualEvidence)}
              </p>
              <p className="mt-1 text-[13px] leading-[1.55] text-foreground">
                Contradiction: {scrubReaderText(flag.contradiction)}
              </p>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      {artifact.provesWrongIf ? (
        <section className="grid gap-3">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Tripwire
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCallout
              value={artifact.provesWrongIf.metric}
              label="Metric"
              basis="measured"
            />
            <StatCallout
              value={artifact.provesWrongIf.threshold}
              label="Threshold"
              basis="benchmark"
            />
            <StatCallout
              value={artifact.provesWrongIf.window}
              label="Window"
              basis="assumption"
            />
          </div>
        </section>
      ) : null}

      {artifact.strategicInsight || artifact.orderedMoves ? (
        <StrategicInsightPanel insight={artifact.strategicInsight}>
          <StrategicField
            label="ordered moves"
            value={artifact.orderedMoves
              ?.map((move) => `${move.rank}. ${move.move}`)
              .join(' ')}
          />
        </StrategicInsightPanel>
      ) : null}

      <SectionCoverageNote
        verified={[
          `${offerMarketFit.proofPoints.length} offer proof points`,
          `${funnelDiagnosis.breaks.length} funnel breaks`,
        ]}
        assumed={channelTruth.channels
          .filter((channel) => channel.hasWorked === 'unknown')
          .map((channel) => channel.channelName)}
        missing={redFlags.items
          .filter((flag) => flag.severity === 'high')
          .map((flag) => flag.claimedMotion)}
      />
    </div>
  );
}
