import { cn } from '@/lib/utils';
import type { BuyerICPArtifact } from '@/types/positioning-artifact';

import {
  BarBreakdown,
  BasisChip,
  EvidenceChip,
  GapNote,
  KeyFindings,
  ReaderExhibit,
  SubsectionBlock,
  VerdictHero,
  isInvalidReaderUrl,
  scrubReaderText,
  type KeyFinding,
} from '@/components/research-v2/primitives';
import { deriveValueReadinessBadge } from '@/components/research-v2/trust-tier';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { StrategicInsightPanel } from './strategic-insight-panel';

export interface BuyerICPRendererProps {
  artifact: BuyerICPArtifact;
  className?: string;
}

type FirmographicCut =
  BuyerICPArtifact['icpExistenceCheck']['firmographicCuts'][number];
type AwarenessLevel =
  BuyerICPArtifact['awarenessDistribution']['levels'][number];
type Persona = BuyerICPArtifact['personaReality']['personas'][number];
type Venue = BuyerICPArtifact['clusters']['venues'][number];

const CUT_TYPE_LABEL: Record<string, string> = {
  industry: 'Industry',
  employeeBands: 'Employee bands',
  revenueBands: 'Revenue bands',
  geography: 'Geography',
  techStack: 'Tech stack',
};

const ROLE_LABEL: Record<string, string> = {
  champion: 'Champion',
  'economic-buyer': 'Economic buyer',
  'decision-maker': 'Decision maker',
  influencer: 'Influencer',
  'end-user': 'End user',
  gatekeeper: 'Gatekeeper',
};

const AWARENESS_LABEL: Record<string, string> = {
  unaware: 'Unaware',
  'problem-aware': 'Problem-aware',
  'solution-aware': 'Solution-aware',
  'product-aware': 'Product-aware',
  'most-aware': 'Most-aware',
};

const WINDOW_LABEL: Record<string, string> = {
  immediate: 'Immediate',
  weeks: 'Weeks',
  quarters: 'Quarters',
};

const BUCKET_LABEL: Record<string, string> = {
  community: 'Community',
  newsletter: 'Newsletter',
  conference: 'Conference',
  podcast: 'Podcast',
  'slack-group': 'Slack group',
  event: 'Event',
};

// An honest-unavailable buyer-ICP artifact (deadline/acquisition-exhaustion
// commit): every evidence block committed empty. We detect it deterministically
// from the five block arrays so the reader sees ONE quiet trust note, not five
// carpet-bombed 'rerun to retry' gap panels dressed as a full ICP read.
export function isBuyerICPHonestlyUnavailable(
  artifact: BuyerICPArtifact,
): boolean {
  return (
    artifact.icpExistenceCheck.firmographicCuts.length === 0 &&
    artifact.personaReality.personas.length === 0 &&
    artifact.awarenessDistribution.levels.length === 0 &&
    artifact.buyingContext.triggers.length === 0 &&
    artifact.clusters.venues.length === 0
  );
}

function parseShare(value: string): number {
  const parsed = Number.parseFloat(value.replace('%', ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isRenderableVenue(venue: Venue): boolean {
  return (
    !isInvalidReaderUrl(venue.sourceUrl) &&
    typeof venue.audienceSize === 'string' &&
    venue.audienceSize.trim().length > 0 &&
    !/unknown|placeholder|n\/a/i.test(venue.audienceSize)
  );
}

function buyerKeyFindings(artifact: BuyerICPArtifact): readonly KeyFinding[] {
  const strongestPersona = artifact.personaReality.personas[0];
  const topAwareness = [...artifact.awarenessDistribution.levels].sort(
    (a, b) => parseShare(b.share ?? '0') - parseShare(a.share ?? '0'),
  )[0];
  const topTrigger = artifact.buyingContext.triggers[0];

  return [
    strongestPersona
      ? {
          sentence: `${strongestPersona.title} at ${strongestPersona.company} is the clearest buyer pattern: ${strongestPersona.evidence}`,
          basis: 'sourced',
          evidence: [
            {
              title: strongestPersona.name,
              url: strongestPersona.sourceUrl,
              excerpt: strongestPersona.evidence,
            },
          ],
        }
      : {
          sentence: artifact.personaReality.prose,
          basis: 'assumption',
        },
    topAwareness
      ? {
          sentence: `${AWARENESS_LABEL[topAwareness.level] ?? topAwareness.level} demand is the largest visible awareness band at ${topAwareness.share ?? 'unknown share'}.`,
          basis: 'measured',
        }
      : {
          sentence: artifact.awarenessDistribution.prose,
          basis: 'assumption',
        },
    topTrigger
      ? {
          sentence: `${topTrigger.name} is a concrete buying trigger with a ${WINDOW_LABEL[topTrigger.window] ?? topTrigger.window} window.`,
          basis: 'sourced',
          evidence: [
            {
              title: topTrigger.name,
              url: topTrigger.sourceUrl,
              excerpt: topTrigger.evidence,
            },
          ],
        }
      : {
          sentence: artifact.buyingContext.prose,
          basis: 'assumption',
        },
  ];
}

function IcpThesisCard({
  artifact,
}: {
  artifact: BuyerICPArtifact;
}): React.ReactElement {
  const cuts = artifact.icpExistenceCheck.firmographicCuts;
  const industry = cuts.find((cut) => cut.cutType === 'industry')?.value;
  const employeeBand = cuts.find((cut) => cut.cutType === 'employeeBands')?.value;
  const techStack = cuts.find((cut) => cut.cutType === 'techStack')?.value;
  const persona = artifact.personaReality.personas[0];
  const exclusion = artifact.strategicInsight?.keyTension?.costOfPosition;

  return (
    <section className="grid gap-4 border border-border bg-card p-5">
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        ICP thesis
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-[12px] text-muted-foreground">Who pays</p>
          <p className="mt-1 text-[15px] font-medium leading-[1.45] text-foreground">
            {scrubReaderText(
              [industry, employeeBand, persona?.title].filter(Boolean).join(' · ') ||
                artifact.icpExistenceCheck.prose,
            )}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-muted-foreground">Who does not</p>
          {exclusion ? (
            <p className="mt-1 text-[15px] font-medium leading-[1.45] text-foreground">
              {scrubReaderText(exclusion)}
            </p>
          ) : (
            <div className="mt-2">
              <GapNote subject="ICP exclusion evidence" />
            </div>
          )}
        </div>
        <div>
          <p className="text-[12px] text-muted-foreground">Disqualifiers</p>
          <p className="mt-1 text-[15px] font-medium leading-[1.45] text-foreground">
            {scrubReaderText(techStack ?? 'No visible operations stack or buying trigger.')}
          </p>
        </div>
      </div>
    </section>
  );
}

function PersonaCard({ persona }: { persona: Persona }): React.ReactElement {
  return (
    <article
      className="grid gap-3 border-l-2 border-primary/40 pl-4"
      data-testid="persona-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">{persona.name}</h3>
        <MonoBadge>{ROLE_LABEL[persona.role] ?? persona.role}</MonoBadge>
        {persona.vendorSourced === true ? <BasisChip basis="assumption">vendor sourced</BasisChip> : null}
      </div>
      <p className="text-[13px] leading-[1.55] text-muted-foreground">
        {persona.title} · {persona.company} · {persona.seniority}
      </p>
      <p className="text-[14px] leading-[1.55] text-foreground">
        {scrubReaderText(persona.evidence)}
      </p>
      <EvidenceChip
        source={{
          title: persona.name,
          url: persona.sourceUrl,
          excerpt: persona.evidence,
        }}
        label="source"
      />
    </article>
  );
}

export function BuyerICPRenderer({
  artifact,
  className,
}: BuyerICPRendererProps): React.ReactElement {
  const {
    icpExistenceCheck,
    personaReality,
    awarenessDistribution,
    buyingContext,
    clusters,
  } = artifact;
  if (isBuyerICPHonestlyUnavailable(artifact)) {
    const sourcingPlan =
      icpExistenceCheck.blockGap?.sourcingPlan?.join('; ') ??
      'Rerun this section — it did not gather enough public evidence in its time budget.';

    return (
      <div
        className={cn('flex flex-col gap-4', className)}
        data-testid="buyer-icp-honestly-unavailable"
      >
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Buyer &amp; ICP
        </div>
        <GapNote subject="this buyer & ICP read" howToClose={sourcingPlan}>
          Not enough public evidence was found to validate the buyer and ICP in
          this run. Nothing here was fabricated — the section is reporting an
          honest gap.
        </GapNote>
      </div>
    );
  }

  const renderableVenues = clusters.venues.filter(isRenderableVenue);

  const cutColumns: ReadonlyArray<DataTableColumn<FirmographicCut>> = [
    {
      key: 'cutType',
      header: 'Cut',
      render: (row) => (
        <MonoBadge>{CUT_TYPE_LABEL[row.cutType] ?? row.cutType}</MonoBadge>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (row) => <span className="font-medium text-foreground">{row.value}</span>,
    },
    { key: 'accountCount', header: 'Accounts' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const awarenessSegments = awarenessDistribution.levels.map((level, index) => ({
    label: AWARENESS_LABEL[level.level] ?? level.level,
    value: parseShare(level.share ?? '0'),
    hint: level.sampleQuery,
    isAccent: index === 0,
  }));

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <VerdictHero
        verdict={artifact.verdict}
        whyItMatters={artifact.statusSummary}
        valueReadiness={deriveValueReadinessBadge(artifact.verifierSummary)}
      />
      <KeyFindings findings={buyerKeyFindings(artifact)} />
      <IcpThesisCard artifact={artifact} />

      <SubsectionBlock label="ICP existence" prose={icpExistenceCheck.prose}>
        <ReaderExhibit
          title="firmographic cuts"
          count={icpExistenceCheck.firmographicCuts.length}
        >
          <DataTable
            columns={cutColumns}
            rows={icpExistenceCheck.firmographicCuts}
            rowKey={(row) => `${row.cutType}-${row.value}`}
            rowTestId={() => 'firmographic-item'}
          />
        </ReaderExhibit>
      </SubsectionBlock>

      <SubsectionBlock label="Persona reality" prose={personaReality.prose}>
        <div className="grid gap-5 md:grid-cols-2">
          {personaReality.personas.map((persona) => (
            <PersonaCard key={`${persona.name}-${persona.company}`} persona={persona} />
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock
        label="Awareness distribution"
        prose={awarenessDistribution.prose}
      >
        <BarBreakdown
          caption="Awareness mix"
          total={`${awarenessDistribution.levels.length} levels observed`}
          segments={awarenessSegments}
        />
        <div className="grid gap-3">
          {awarenessDistribution.levels.map((level: AwarenessLevel) => (
            <div key={level.level} className="border-l border-border pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <MonoBadge>{AWARENESS_LABEL[level.level] ?? level.level}</MonoBadge>
                <span className="font-mono text-[12px] tabular-nums text-foreground">
                  {level.share ?? '—'}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(level.evidence)}
              </p>
            </div>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Buying context" prose={buyingContext.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {buyingContext.triggers.map((trigger) => (
            <article key={`${trigger.name}-${trigger.window}`} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {trigger.name}
                </h3>
                <MonoBadge>{WINDOW_LABEL[trigger.window] ?? trigger.window}</MonoBadge>
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(trigger.detectionSignal)}
              </p>
              <p className="mt-2 text-[13px] leading-[1.55] text-foreground">
                {scrubReaderText(trigger.evidence)}
              </p>
              {trigger.sourceUrl ? (
                <div className="mt-3">
                  <EvidenceChip
                    source={{
                      title: trigger.name,
                      url: trigger.sourceUrl,
                      excerpt: trigger.evidence,
                    }}
                    label="source"
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Clusters and venues" prose={clusters.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {renderableVenues.map((venue) => (
            <article
              key={`${venue.bucketType}-${venue.name}`}
              className="grid gap-2 border-l border-border pl-4"
              data-testid="cluster-item"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {venue.name}
                </h3>
                <MonoBadge>{BUCKET_LABEL[venue.bucketType] ?? venue.bucketType}</MonoBadge>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {venue.audienceSize}
                </span>
              </div>
              <p className="text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(venue.whyItMatters)}
              </p>
              <EvidenceChip
                source={{
                  title: venue.name,
                  url: venue.sourceUrl,
                  excerpt: venue.whyItMatters,
                }}
                label="source"
              />
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <StrategicInsightPanel insight={artifact.strategicInsight} />
    </div>
  );
}
