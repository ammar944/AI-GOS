import { cn } from '@/lib/utils';
import type { MarketCategoryArtifact } from '@/types/positioning-artifact';
import {
  BasisChip,
  EvidenceChip,
  GapNote,
  KeyFindings,
  ReaderExhibit,
  StatCallout,
  SubsectionBlock,
  VerdictHero,
  clientGapSentence,
  isReaderPipelineChrome,
  scrubReaderText,
  textOrGap,
  type EvidenceBasis,
  type EvidenceChipSource,
  type KeyFinding,
} from '@/components/research-v2/primitives';
import { deriveValueReadinessBadge } from '@/components/research-v2/trust-tier';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { StrategicField, StrategicInsightPanel } from './strategic-insight-panel';

export interface MarketCategoryRendererProps {
  artifact: MarketCategoryArtifact;
  className?: string;
}

type MarketCategoryBottomUpTam = NonNullable<
  MarketCategoryArtifact['marketSize']['bottomUpTam']
>;
type MarketSignal = MarketCategoryArtifact['marketSize']['signals'][number];

const legacyBottomUpTam: MarketCategoryBottomUpTam = {
  recipeName: 'keyword-demand-reachable-revenue',
  formula: 'monthly keyword volume x 12 x commercial-intent share x conversion rate x ACV',
  reachableRevenueEstimate:
    'evidence gap: this saved Market Category artifact predates bottom-up TAM input capture.',
  inputs: [],
  caveats: ['Legacy artifacts require a section rerun to compute bottom-up TAM.'],
};

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  'public-data': 'Public data',
  'funding-flow': 'Funding flow',
  'hiring-velocity': 'Hiring velocity',
  'search-trend': 'Search trend',
  'analyst-report': 'Analyst report',
};

const TRAJECTORY_LABEL: Record<string, string> = {
  expanding: 'Expanding',
  stable: 'Stable',
  contracting: 'Contracting',
  unclear: 'Unclear',
};

const TAM_INPUT_LABEL: Record<string, string> = {
  'keyword-volume': 'Keyword volume',
  'commercial-intent-share': 'Commercial intent',
  'conversion-rate': 'Conversion rate',
  acv: 'ACV',
};

const FORCE_TYPE_LABEL: Record<string, string> = {
  regulation: 'Regulation',
  'platform-shift': 'Platform shift',
  'buyer-behavior': 'Buyer behavior',
};

const MATURITY_SIGNAL_LABEL: Record<string, string> = {
  'player-count': 'Player count',
  'buyer-education': 'Buyer education',
  'feature-parity': 'Feature parity',
  'price-pressure': 'Price pressure',
  'platform-bundling': 'Platform bundling',
};

const MATURITY_STAGE_LABEL: Record<string, string> = {
  emerging: 'Emerging',
  growing: 'Growing',
  consolidating: 'Consolidating',
  commoditizing: 'Commoditizing',
};

function sourceAt(
  artifact: MarketCategoryArtifact,
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

function tamBasis(status: string): EvidenceBasis {
  return status === 'sourced' ? 'sourced' : 'gap';
}

function signalBasis(signal: MarketSignal): EvidenceBasis {
  return signal.trajectory === 'unclear' ? 'assumption' : 'sourced';
}

function marketKeyFindings(
  artifact: MarketCategoryArtifact,
): readonly KeyFinding[] {
  const { categoryDefinition, marketSize, structuralForces, categoryMaturity } = artifact;
  const topSignal = marketSize.signals[0];
  const topForce = structuralForces.forces[0];
  return [
    topSignal
      ? {
          sentence: `${topSignal.name}: ${topSignal.evidence}`,
          basis: signalBasis(topSignal),
          evidence: [
            {
              title: topSignal.sourceTitle,
              url: topSignal.sourceUrl,
              date: topSignal.dateObserved,
            },
          ],
        }
      : {
          sentence: categoryDefinition.prose,
          basis: 'assumption',
        },
    topForce
      ? {
          sentence: `${topForce.name} changes the category through ${topForce.implication}`,
          basis: topForce.impact === 'high' ? 'measured' : 'sourced',
          evidence: [
            {
              title: topForce.sourceTitle ?? topForce.name,
              url: topForce.sourceUrl,
              excerpt: topForce.evidence,
            },
          ],
        }
      : {
          sentence: structuralForces.prose,
          basis: 'assumption',
        },
    {
      sentence: `Category maturity reads as ${
        MATURITY_STAGE_LABEL[categoryMaturity.classification.stage] ??
        categoryMaturity.classification.stage
      }: ${categoryMaturity.classification.evidenceSummary}`,
      basis: 'sourced',
      evidence: [sourceAt(artifact, 2)].filter(
        (source): source is EvidenceChipSource => source !== undefined,
      ),
    },
  ];
}

function TamFormulaChain({
  bottomUpTam,
}: {
  bottomUpTam: MarketCategoryBottomUpTam;
}): React.ReactElement {
  const estimate = scrubReaderText(bottomUpTam.reachableRevenueEstimate);
  const estimateIsGap =
    isReaderPipelineChrome(bottomUpTam.reachableRevenueEstimate) ||
    /directional only/i.test(bottomUpTam.reachableRevenueEstimate);

  return (
    <div className="grid gap-4">
      {estimateIsGap ? (
        <GapNote>{clientGapSentence(bottomUpTam.reachableRevenueEstimate, 'a reliable TAM estimate')}</GapNote>
      ) : (
        <StatCallout value={estimate} label="Reachable revenue estimate" basis="sourced" />
      )}
      <div className="grid gap-2 md:grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
        {bottomUpTam.inputs.map((input) => {
          // Gap sentinels ("evidence gap: ...") never render as data values —
          // they become one client-plain sentence.
          const inputValue = textOrGap(
            input.value,
            (TAM_INPUT_LABEL[input.inputType] ?? input.inputType).toLowerCase(),
          );
          return (
          <div key={input.inputType} className="border-l border-border pl-3">
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {TAM_INPUT_LABEL[input.inputType] ?? input.inputType}
            </div>
            <p
              className={cn(
                'mt-1 text-[13px] leading-[1.45]',
                inputValue.kind === 'gap'
                  ? 'text-muted-foreground'
                  : 'text-foreground',
              )}
            >
              {inputValue.value}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <BasisChip basis={tamBasis(input.status)} />
              {input.sourceUrl ? (
                <EvidenceChip
                  source={{
                    title: input.sourceTitle,
                    url: input.sourceUrl,
                    date: input.dateObserved,
                  }}
                  label="source"
                />
              ) : null}
            </div>
          </div>
          );
        })}
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        Formula: {scrubReaderText(bottomUpTam.formula)}
      </p>
      {bottomUpTam.caveats.length > 0 ? (
        <GapNote>{scrubReaderText(bottomUpTam.caveats[0])}</GapNote>
      ) : null}
    </div>
  );
}

export function MarketCategoryRenderer({
  artifact,
  className,
}: MarketCategoryRendererProps): React.ReactElement {
  const { categoryDefinition, marketSize, structuralForces, categoryMaturity } = artifact;
  const bottomUpTam = marketSize.bottomUpTam ?? legacyBottomUpTam;

  const signalColumns: ReadonlyArray<DataTableColumn<MarketSignal>> = [
    {
      key: 'signalType',
      header: 'Signal',
      render: (row) => (
        <MonoBadge>{SIGNAL_TYPE_LABEL[row.signalType] ?? row.signalType}</MonoBadge>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    { key: 'evidence', header: 'Evidence', wrap: 'clamp', clampLines: 3 },
    {
      key: 'trajectory',
      header: 'Trajectory',
      render: (row) => (
        <MonoBadge>{TRAJECTORY_LABEL[row.trajectory] ?? row.trajectory}</MonoBadge>
      ),
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <VerdictHero
        verdict={artifact.verdict}
        whyItMatters={artifact.statusSummary}
        valueReadiness={deriveValueReadinessBadge(artifact.verifierSummary)}
      />
      <KeyFindings findings={marketKeyFindings(artifact)} />

      <SubsectionBlock label="Category definition" prose={categoryDefinition.prose}>
        <div className="grid gap-3 md:grid-cols-2">
          {categoryDefinition.adjacentCategories.slice(0, 4).map((category) => (
            <article key={category.name} className="grid gap-3 border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {category.name}
                </h3>
                {category.sourceUrl ? (
                  <EvidenceChip
                    source={{
                      title: category.sourceTitle ?? category.name,
                      url: category.sourceUrl,
                    }}
                    label="source"
                  />
                ) : null}
              </div>
              <p className="text-[13px] leading-[1.55] text-muted-foreground">
                Confused because {scrubReaderText(category.whyBuyersConfuseIt)}
              </p>
              <p className="text-[13px] leading-[1.55] text-foreground">
                Disambiguator: {scrubReaderText(category.disambiguatingSignal)}
              </p>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Market size" prose={marketSize.prose}>
        <TamFormulaChain bottomUpTam={bottomUpTam} />
        <ReaderExhibit title="market signals" count={marketSize.signals.length}>
          <DataTable
            columns={signalColumns}
            rows={marketSize.signals}
            rowKey={(row) => `${row.signalType}-${row.name}`}
            rowTestId={() => 'signal-item'}
          />
        </ReaderExhibit>
      </SubsectionBlock>

      <SubsectionBlock label="Structural forces" prose={structuralForces.prose}>
        <div className="grid gap-4">
          {structuralForces.forces.map((force) => (
            <article key={`${force.forceType}-${force.name}`} className="border-l-2 border-primary/40 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <MonoBadge>{FORCE_TYPE_LABEL[force.forceType] ?? force.forceType}</MonoBadge>
                <BasisChip basis={force.impact === 'high' ? 'measured' : 'sourced'}>
                  {force.impact}
                </BasisChip>
                <EvidenceChip
                  source={{
                    title: force.sourceTitle ?? force.name,
                    url: force.sourceUrl,
                    excerpt: force.evidence,
                  }}
                  label="source"
                />
              </div>
              <p className="mt-2 text-[15px] font-medium leading-[1.45] text-foreground">
                {scrubReaderText(force.name)}
              </p>
              <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(force.implication)}
              </p>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Category maturity" prose={categoryMaturity.prose}>
        <div className="grid gap-4">
          <StatCallout
            value={
              MATURITY_STAGE_LABEL[categoryMaturity.classification.stage] ??
              categoryMaturity.classification.stage
            }
            label={categoryMaturity.classification.evidenceSummary}
            basis="sourced"
          />
          {categoryMaturity.classification.supportingSignals.map((signal, index) => (
            <div key={`${signal.signalType}-${index}`} className="border-l border-border pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <MonoBadge>
                  {MATURITY_SIGNAL_LABEL[signal.signalType] ?? signal.signalType}
                </MonoBadge>
                {signal.sourceUrl ? (
                  <EvidenceChip
                    source={{
                      title: MATURITY_SIGNAL_LABEL[signal.signalType] ?? signal.signalType,
                      url: signal.sourceUrl,
                      excerpt: signal.evidence,
                    }}
                    label="source"
                  />
                ) : null}
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(signal.implication)}
              </p>
            </div>
          ))}
        </div>
      </SubsectionBlock>

      {artifact.strategicInsight || artifact.categoryPowerBet ? (
        <StrategicInsightPanel insight={artifact.strategicInsight}>
          <StrategicField label="The category bet" value={artifact.categoryPowerBet?.bet} />
          <StrategicField label="Why now" value={artifact.categoryPowerBet?.whyNow} />
          <StrategicField
            label="Risk accepted"
            value={artifact.categoryPowerBet?.riskAccepted}
          />
        </StrategicInsightPanel>
      ) : null}
    </div>
  );
}
