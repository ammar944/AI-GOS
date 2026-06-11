'use client';

import dynamic from 'next/dynamic';

import { cn } from '@/lib/utils';
import type { DemandIntentArtifact } from '@/types/positioning-artifact';
import {
  DecisionCard,
  EvidenceChip,
  GapNote,
  KeyFindings,
  QuoteCard,
  ReaderExhibit,
  SectionCoverageNote,
  SubsectionBlock,
  VerdictHero,
  clientGapSentence,
  isReaderPipelineChrome,
  scrubReaderText,
  type EvidenceChipSource,
  type KeyFinding,
} from '@/components/research-v2/primitives';
import type {
  KeywordVolumeChartProps,
  KeywordVolumeDatum,
} from '@/components/research-v2/primitives/keyword-volume-chart';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { StrategicField, StrategicInsightPanel } from './strategic-insight-panel';

export interface DemandIntentRendererProps {
  artifact: DemandIntentArtifact;
  className?: string;
}

type KeywordRow = DemandIntentArtifact['keywordDemand']['keywords'][number];
type QuestionRow = DemandIntentArtifact['questionMining']['questions'][number];
type IntentSignal = DemandIntentArtifact['intentSignals']['items'][number];

const KeywordVolumeChart = dynamic<KeywordVolumeChartProps>(
  () =>
    import('../primitives/keyword-volume-chart').then(
      (mod) => mod.KeywordVolumeChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[220px] border-l border-border pl-4 text-[13px] text-muted-foreground">
        Loading keyword volume chart…
      </div>
    ),
  },
);

const INTENT_TYPE_LABEL: Record<string, string> = {
  informational: 'Informational',
  commercial: 'Commercial',
  transactional: 'Transactional',
  navigational: 'Navigational',
};

const QUESTION_SURFACE_LABEL: Record<string, string> = {
  paa: 'PAA',
  reddit: 'Reddit',
  quora: 'Quora',
  community: 'Community',
  forum: 'Forum',
  'support-thread': 'Support',
};

const FREQUENCY_LABEL: Record<string, string> = {
  recurring: 'Recurring',
  occasional: 'Occasional',
};

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  'job-posting': 'Job posting',
  rfp: 'RFP',
  'news-trigger': 'News trigger',
  funding: 'Funding',
  'leadership-change': 'Leadership change',
};

const VENUE_TYPE_LABEL: Record<string, string> = {
  event: 'Event',
  community: 'Community',
  newsletter: 'Newsletter',
  podcast: 'Podcast',
  slack: 'Slack',
};

function gapAwareValue(value: string): string {
  return /^data gap:/i.test(value) ? '—' : scrubReaderText(value);
}

function numericVolume(value: string): number {
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceAt(
  artifact: DemandIntentArtifact,
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

function demandKeyFindings(artifact: DemandIntentArtifact): readonly KeyFinding[] {
  const topKeyword = [...artifact.keywordDemand.keywords].sort(
    (a, b) => numericVolume(b.monthlyVolume) - numericVolume(a.monthlyVolume),
  )[0];
  const recurringQuestion = artifact.questionMining.questions.find(
    (question) => question.frequency === 'recurring',
  );
  const firstGap = artifact.contentGaps.gaps[0];

  return [
    {
      sentence: artifact.statusSummary,
      basis: 'sourced',
      evidence: [sourceAt(artifact, 0)].filter(
        (source): source is EvidenceChipSource => source !== undefined,
      ),
    },
    topKeyword
      ? {
          sentence: `${topKeyword.keyword} is the largest visible demand cluster at ${gapAwareValue(topKeyword.monthlyVolume)} monthly searches.`,
          basis: 'measured',
          evidence: [
            {
              title: topKeyword.sourceTitle,
              url: topKeyword.sourceUrl,
              date: topKeyword.dateObserved,
            },
          ],
        }
      : {
          sentence: artifact.keywordDemand.prose,
          basis: 'assumption',
        },
    recurringQuestion
      ? {
          sentence: `${recurringQuestion.question} recurs on ${QUESTION_SURFACE_LABEL[recurringQuestion.surface] ?? recurringQuestion.surface}.`,
          basis: 'sourced',
          evidence: [
            {
              title: recurringQuestion.question,
              url: recurringQuestion.sourceUrl,
            },
          ],
        }
      : {
          sentence: artifact.questionMining.prose,
          basis: 'assumption',
        },
    firstGap
      ? {
          sentence: `${firstGap.topic}: ${firstGap.opportunity}`,
          basis: 'sourced',
        }
      : {
          sentence: artifact.contentGaps.prose,
          basis: 'assumption',
        },
  ];
}

function chartData(keywords: readonly KeywordRow[]): KeywordVolumeDatum[] {
  return keywords
    .map((keyword) => ({
      keyword: keyword.keyword,
      volume: numericVolume(keyword.monthlyVolume),
    }))
    .filter((item) => item.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
}

function QuestionCard({ question }: { question: QuestionRow }): React.ReactElement {
  return (
    <QuoteCard
      quote={question.question}
      venue={QUESTION_SURFACE_LABEL[question.surface] ?? question.surface}
      role={FREQUENCY_LABEL[question.frequency] ?? question.frequency}
      url={question.sourceUrl}
    />
  );
}

function IntentSignalBlock({
  signal,
}: {
  signal: IntentSignal;
}): React.ReactElement {
  if (isReaderPipelineChrome(signal.description)) {
    return <GapNote>{clientGapSentence(signal.description, 'this intent signal')}</GapNote>;
  }

  return (
    <article className="border-l border-border pl-4" data-testid="intent-item">
      <div className="flex flex-wrap items-center gap-2">
        <MonoBadge>{SIGNAL_TYPE_LABEL[signal.signalType] ?? signal.signalType}</MonoBadge>
        {signal.exampleCompany ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            {signal.exampleCompany}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-[1.55] text-foreground">
        {scrubReaderText(signal.description)}
      </p>
      {signal.sourceUrl ? (
        <div className="mt-2">
          <EvidenceChip
            source={{
              title: signal.exampleCompany ?? SIGNAL_TYPE_LABEL[signal.signalType] ?? signal.signalType,
              url: signal.sourceUrl,
              excerpt: signal.description,
            }}
            label="source"
          />
        </div>
      ) : null}
    </article>
  );
}

export function DemandIntentRenderer({
  artifact,
  className,
}: DemandIntentRendererProps): React.ReactElement {
  const { keywordDemand, questionMining, contentGaps, intentSignals, venueMap } = artifact;

  const keywordColumns: ReadonlyArray<DataTableColumn<KeywordRow>> = [
    {
      key: 'keyword',
      header: 'Keyword',
      render: (row) => <span className="font-medium text-foreground">{row.keyword}</span>,
    },
    {
      key: 'monthlyVolume',
      header: 'Volume',
      numeric: true,
      render: (row) => <span>{gapAwareValue(row.monthlyVolume)}</span>,
    },
    {
      key: 'intentType',
      header: 'Intent',
      render: (row) => (
        <MonoBadge>{INTENT_TYPE_LABEL[row.intentType] ?? row.intentType}</MonoBadge>
      ),
    },
    {
      key: 'cpc',
      header: 'CPC',
      numeric: true,
      render: (row) => <span>{row.cpc ?? '—'}</span>,
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => (
        <EvidenceChip
          source={{
            title: row.sourceTitle,
            url: row.sourceUrl,
            date: row.dateObserved,
          }}
          label="source"
        />
      ),
    },
  ];

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <VerdictHero
        verdict={artifact.verdict}
        whyItMatters={artifact.statusSummary}
        confidence={artifact.confidence}
      />
      <KeyFindings findings={demandKeyFindings(artifact)} />

      {artifact.orderedMoves || artifact.provesWrongIf ? (
        <section className="grid gap-4">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Ordered moves
          </div>
          <div className="grid gap-4">
            {artifact.orderedMoves?.map((move) => (
              <DecisionCard
                key={move.rank}
                number={move.rank}
                move={move.move}
                meta={move.rationale}
              />
            ))}
          </div>
          <StrategicField
            label="proves wrong if"
            value={
              artifact.provesWrongIf
                ? `${artifact.provesWrongIf.metric}: ${artifact.provesWrongIf.threshold} in ${artifact.provesWrongIf.window}`
                : undefined
            }
          />
        </section>
      ) : null}

      <SubsectionBlock label="Keyword demand" prose={keywordDemand.prose}>
        <KeywordVolumeChart data={chartData(keywordDemand.keywords)} />
        <ReaderExhibit title="keyword table" count={keywordDemand.keywords.length}>
          <DataTable
            columns={keywordColumns}
            rows={keywordDemand.keywords}
            rowKey={(row) => row.keyword}
            rowTestId={() => 'keyword-item'}
          />
        </ReaderExhibit>
      </SubsectionBlock>

      <SubsectionBlock label="Question mining" prose={questionMining.prose}>
        {questionMining.questions.length === 0 ? (
          <GapNote
            subject="buyer questions"
            howToClose="Pull People Also Ask, Reddit, forum, or support-thread URLs with permalinks."
          />
        ) : (
          <div className="grid gap-5">
            {questionMining.questions.map((question, index) => (
              <QuestionCard key={`${question.surface}-${index}`} question={question} />
            ))}
          </div>
        )}
      </SubsectionBlock>

      <SubsectionBlock label="Content gaps" prose={contentGaps.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {contentGaps.gaps.map((gap) => (
            <article key={gap.topic} className="border border-border bg-card p-4" data-testid="gap-item">
              <h3 className="text-[15px] font-semibold text-foreground">{gap.topic}</h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
                {scrubReaderText(gap.evidenceOfDemand)}
              </p>
              <p className="mt-2 text-[13px] leading-[1.55] text-foreground">
                {scrubReaderText(gap.opportunity)}
              </p>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Intent signals" prose={intentSignals.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {intentSignals.items.map((signal, index) => (
            <IntentSignalBlock key={`${signal.signalType}-${index}`} signal={signal} />
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Venue map" prose={venueMap.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {venueMap.venues.map((venue) => (
            <article key={venue.name} className="border-l border-border pl-4" data-testid="venue-item">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {venue.name}
                </h3>
                <MonoBadge>{VENUE_TYPE_LABEL[venue.venueType] ?? venue.venueType}</MonoBadge>
              </div>
              <p className="mt-1 text-[13px] leading-[1.55] text-muted-foreground">
                {venue.audienceSize}
              </p>
              <div className="mt-2">
                <SourceLink url={venue.sourceUrl} />
              </div>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <StrategicInsightPanel insight={artifact.strategicInsight} />

      <SectionCoverageNote
        verified={[
          `${keywordDemand.keywords.length} keyword rows`,
          `${questionMining.questions.length} buyer-question rows`,
        ]}
        assumed={keywordDemand.keywords
          .filter((keyword) => !keyword.cpc)
          .map((keyword) => `${keyword.keyword} CPC`)}
        missing={intentSignals.items
          .filter((signal) => isReaderPipelineChrome(signal.description))
          .map((signal) => SIGNAL_TYPE_LABEL[signal.signalType] ?? signal.signalType)}
      />
    </div>
  );
}
