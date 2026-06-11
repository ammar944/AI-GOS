'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { VoiceOfCustomerArtifact } from '@/types/positioning-artifact';
import {
  BasisChip,
  EvidenceChip,
  GapNote,
  KeyFindings,
  QuoteCard,
  SectionCoverageNote,
  SubsectionBlock,
  VerdictHero,
  clampReaderText,
  looksLikeNavMenuGarbage,
  scrubReaderText,
  textOrGap,
  type EvidenceChipSource,
  type KeyFinding,
} from '@/components/research-v2/primitives';
import { MonoBadge } from '@/components/research-v2/ui-kit';
import { StrategicField, StrategicInsightPanel } from './strategic-insight-panel';

export interface VoiceOfCustomerRendererProps {
  artifact: VoiceOfCustomerArtifact;
  className?: string;
}

type PainQuote = VoiceOfCustomerArtifact['painLanguage']['quotes'][number];
type SuccessQuote = VoiceOfCustomerArtifact['successLanguage']['quotes'][number];

const VOC_SOURCE_LABEL: Record<string, string> = {
  g2: 'G2',
  reddit: 'Reddit',
  hackernews: 'Hacker News',
  'sales-call': 'Sales call',
  'support-thread': 'Support thread',
  twitter: 'Twitter',
  other: 'Other',
};

const OBJECTION_CATEGORY_LABEL: Record<string, string> = {
  price: 'Price',
  feature: 'Feature',
  trust: 'Trust',
  'switching-cost': 'Switching cost',
  timing: 'Timing',
  stakeholder: 'Stakeholder',
  other: 'Other',
};

const FREQUENCY_LABEL: Record<string, string> = {
  recurring: 'Recurring',
  occasional: 'Occasional',
  'one-off': 'One-off',
};

const DECISION_ROLE_LABEL: Record<string, string> = {
  buyer: 'Buyer',
  champion: 'Champion',
  influencer: 'Influencer',
  blocker: 'Blocker',
};

function sourceAt(
  artifact: VoiceOfCustomerArtifact,
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

function vocKeyFindings(artifact: VoiceOfCustomerArtifact): readonly KeyFinding[] {
  const painQuote = artifact.painLanguage.quotes[0];
  const objection = artifact.objections.items[0];
  const criterion = artifact.decisionCriteria.criteria[0];

  return [
    {
      sentence: artifact.statusSummary,
      basis: 'sourced',
      evidence: [sourceAt(artifact, 0)].filter(
        (source): source is EvidenceChipSource => source !== undefined,
      ),
    },
    painQuote
      ? {
          sentence: looksLikeNavMenuGarbage(painQuote.verbatimText)
            ? `No clean customer quote was retrieved for ${painQuote.painTheme}.`
            : `${painQuote.painTheme}: ${clampReaderText(painQuote.verbatimText, 180)}`,
          basis: looksLikeNavMenuGarbage(painQuote.verbatimText) ? 'gap' : 'sourced',
          evidence: [
            {
              title: VOC_SOURCE_LABEL[painQuote.source] ?? painQuote.source,
              url: painQuote.sourceUrl,
            },
          ],
        }
      : {
          sentence: 'No customer pain quotes were retrieved for this run.',
          basis: 'gap',
        },
    objection
      ? {
          sentence: `${OBJECTION_CATEGORY_LABEL[objection.category] ?? objection.category} objection: ${objection.howToHandle}`,
          basis: 'sourced',
        }
      : {
          sentence: artifact.objections.prose,
          basis: 'assumption',
        },
    criterion
      ? {
          sentence: `${criterion.criterion} is explicit decision language from a ${DECISION_ROLE_LABEL[criterion.statedBy] ?? criterion.statedBy}.`,
          basis: 'sourced',
          evidence: [
            {
              title: criterion.criterion,
              url: criterion.sourceUrl,
              excerpt: criterion.evidenceQuote,
            },
          ],
        }
      : {
          sentence: artifact.decisionCriteria.prose,
          basis: 'assumption',
        },
  ];
}

function ExpandableText({
  text,
  maxChars = 500,
}: {
  text: string;
  maxChars?: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const guarded = textOrGap(text, 'this customer account');
  const clean = guarded.value;
  const needsToggle = guarded.kind === 'text' && clean.length > maxChars;
  const visible = expanded || guarded.kind === 'gap' ? clean : clampReaderText(clean, maxChars);

  return (
    <div className="text-[13px] leading-[1.6] text-muted-foreground">
      <span>{visible}</span>
      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ml-2 font-mono text-[10px] uppercase tracking-[0.06em] text-primary"
        >
          {expanded ? 'show less' : 'show more'}
        </button>
      ) : null}
    </div>
  );
}

function PainQuoteCard({ quote }: { quote: PainQuote }): React.ReactElement {
  return (
    <div className="grid gap-2" data-testid="voc-quote">
      <QuoteCard
        quote={quote.verbatimText}
        venue={VOC_SOURCE_LABEL[quote.source] ?? quote.source}
        role={quote.painTheme}
        url={quote.sourceUrl}
      />
      <div className="flex flex-wrap items-center gap-2 pl-5">
        <MonoBadge>{quote.painIntensity}</MonoBadge>
      </div>
    </div>
  );
}

function SuccessQuoteCard({
  quote,
}: {
  quote: SuccessQuote;
}): React.ReactElement {
  return (
    <div className="grid gap-2" data-testid="success-quote">
      <QuoteCard
        quote={quote.verbatimText}
        venue={VOC_SOURCE_LABEL[quote.source] ?? quote.source}
        role="success language"
        url={quote.sourceUrl}
      />
      <div className="pl-5">
        <ExpandableText text={`After-state: ${quote.afterStatePattern}`} />
      </div>
    </div>
  );
}

export function VoiceOfCustomerRenderer({
  artifact,
  className,
}: VoiceOfCustomerRendererProps): React.ReactElement {
  const {
    painLanguage,
    objections,
    switchingStories,
    decisionCriteria,
    successLanguage,
  } = artifact;

  const unusablePainQuotes = painLanguage.quotes.filter((quote) =>
    looksLikeNavMenuGarbage(quote.verbatimText),
  );
  const usablePainQuotes = painLanguage.quotes.filter(
    (quote) => !looksLikeNavMenuGarbage(quote.verbatimText),
  );

  return (
    <div className={cn('flex flex-col gap-10', className)}>
      <VerdictHero
        verdict={artifact.verdict}
        whyItMatters={artifact.statusSummary}
        confidence={artifact.confidence}
      />
      <KeyFindings findings={vocKeyFindings(artifact)} />

      {artifact.strategicInsight || artifact.fourForcesBalanceVerdict ? (
        <StrategicInsightPanel insight={artifact.strategicInsight}>
          <StrategicField
            label="four-forces verdict"
            value={artifact.fourForcesBalanceVerdict?.balanceVerdict}
          />
          <StrategicField label="push" value={artifact.fourForcesBalanceVerdict?.push} />
          <StrategicField label="pull" value={artifact.fourForcesBalanceVerdict?.pull} />
          <StrategicField
            label="anxiety"
            value={artifact.fourForcesBalanceVerdict?.anxiety}
          />
          <StrategicField label="habit" value={artifact.fourForcesBalanceVerdict?.habit} />
        </StrategicInsightPanel>
      ) : null}

      <SubsectionBlock label="Pain language" prose={painLanguage.prose}>
        {usablePainQuotes.length === 0 ? (
          <GapNote
            subject="customer pain quotes"
            howToClose="Pull permalinked review, Reddit, forum, support, or call-transcript quotes before treating VoC as complete."
          />
        ) : (
          <div className="grid gap-6">
            {usablePainQuotes.map((quote, index) => (
              <PainQuoteCard key={`${quote.sourceUrl}-${index}`} quote={quote} />
            ))}
          </div>
        )}
        {unusablePainQuotes.length > 0 ? (
          <GapNote
            subject="clean customer pain quotes"
            howToClose="The saved artifact included long navigation or scrape text; rerun with quote admission enabled."
          />
        ) : null}
      </SubsectionBlock>

      <SubsectionBlock label="Objections" prose={objections.prose}>
        {objections.items.some((item) => looksLikeNavMenuGarbage(item.objectionText)) ? (
          <GapNote
            subject="clean objection language"
            howToClose="The saved artifact included scraped page text in objection fields; rerun with quote admission enabled."
          />
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          {objections.items.filter((item) => !looksLikeNavMenuGarbage(item.objectionText)).map((item) => (
            <article key={`${item.category}-${item.objectionText}`} className="border border-border bg-card p-4" data-testid="objection-item">
              <div className="flex flex-wrap items-center gap-2">
                <BasisChip basis="sourced" />
                <MonoBadge>{OBJECTION_CATEGORY_LABEL[item.category] ?? item.category}</MonoBadge>
                <MonoBadge>{FREQUENCY_LABEL[item.frequency] ?? item.frequency}</MonoBadge>
              </div>
              <p className="mt-3 text-[14px] font-medium leading-[1.5] text-foreground">
                {scrubReaderText(item.objectionText)}
              </p>
              <ExpandableText text={item.howToHandle} />
              <div className="mt-3">
                <EvidenceChip
                  source={{
                    title: item.category,
                    url: item.sourceUrl,
                    excerpt: item.objectionText,
                  }}
                  label="source"
                />
              </div>
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Switching stories" prose={switchingStories.prose}>
        <div className="grid gap-4 md:grid-cols-2">
          {switchingStories.stories.map((story, index) => (
            <article key={`${story.priorSolution}-${index}`} className="border-l border-border pl-4" data-testid="switching-item">
              <h3 className="text-[15px] font-semibold text-foreground">
                From {story.priorSolution}
              </h3>
              <ExpandableText text={story.reasonToLeave} />
              <ExpandableText text={story.decisionPath} />
              {story.sourceUrl ? (
                <EvidenceChip
                  source={{
                    title: story.exampleCompany || story.priorSolution,
                    url: story.sourceUrl,
                  }}
                  label="source"
                />
              ) : null}
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Decision criteria" prose={decisionCriteria.prose}>
        <div className="grid gap-4">
          {decisionCriteria.criteria.map((criterion) => (
            <article key={criterion.criterion} className="border-l border-border pl-4" data-testid="criterion-item">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {criterion.criterion}
                </h3>
                <MonoBadge>
                  {DECISION_ROLE_LABEL[criterion.statedBy] ?? criterion.statedBy}
                </MonoBadge>
              </div>
              <QuoteCard
                quote={criterion.evidenceQuote}
                venue="decision language"
                url={criterion.sourceUrl}
              />
            </article>
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="Success language" prose={successLanguage.prose}>
        {successLanguage.quotes.length === 0 ? (
          <GapNote
            subject="success-language quotes"
            howToClose="Pull customer outcome quotes with permalinks."
          />
        ) : (
          <div className="grid gap-6">
            {successLanguage.quotes.map((quote, index) => (
              <SuccessQuoteCard key={`${quote.sourceUrl}-${index}`} quote={quote} />
            ))}
          </div>
        )}
      </SubsectionBlock>

      <SectionCoverageNote
        verified={[
          `${usablePainQuotes.length} usable pain quotes`,
          `${successLanguage.quotes.length} success quotes`,
          `${decisionCriteria.criteria.length} decision criteria`,
        ]}
        assumed={objections.items
          .filter(
            (item) =>
              item.frequency === 'one-off' &&
              !looksLikeNavMenuGarbage(item.objectionText),
          )
          .map((item) => clampReaderText(item.objectionText, 140))}
        missing={[
          ...unusablePainQuotes.map(() => 'A clean permalinked pain quote'),
          ...(usablePainQuotes.length === 0 ? ['Customer pain quote set'] : []),
        ]}
      />
    </div>
  );
}
