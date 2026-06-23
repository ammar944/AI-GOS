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
  SubsectionBlock,
  VerdictHero,
  clampReaderText,
  looksLikeNavMenuGarbage,
  scrubReaderText,
  textOrGap,
  type KeyFinding,
} from '@/components/research-v2/primitives';
import { deriveValueReadinessBadge } from '@/components/research-v2/trust-tier';
import {
  DataTable,
  MonoBadge,
  SourceLink,
  type DataTableColumn,
  type StatusPillTone,
} from '@/components/research-v2/ui-kit';
import { StrategicField, StrategicInsightPanel } from './strategic-insight-panel';

export interface VoiceOfCustomerRendererProps {
  artifact: VoiceOfCustomerArtifact;
  className?: string;
}

type PainQuote = VoiceOfCustomerArtifact['painLanguage']['quotes'][number];
type SuccessQuote = VoiceOfCustomerArtifact['successLanguage']['quotes'][number];
type AdAngle = NonNullable<VoiceOfCustomerArtifact['adAngles']>[number];
type OutcomeProof = NonNullable<VoiceOfCustomerArtifact['outcomeProof']>[number];
type EvidenceVerdict = NonNullable<VoiceOfCustomerArtifact['evidenceVerdict']>;

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

// An honest-unavailable VoC artifact (deadline/acquisition-exhaustion commit):
// every evidence block committed empty. We detect it deterministically from the
// five block arrays so the reader sees ONE quiet trust note, not five
// carpet-bombed 'rerun to retry' gap panels dressed as a full VoC read.
export function isVoiceOfCustomerHonestlyUnavailable(
  artifact: VoiceOfCustomerArtifact,
): boolean {
  return (
    artifact.painLanguage.quotes.length === 0 &&
    artifact.successLanguage.quotes.length === 0 &&
    artifact.objections.items.length === 0 &&
    artifact.switchingStories.stories.length === 0 &&
    artifact.decisionCriteria.criteria.length === 0
  );
}

function vocKeyFindings(artifact: VoiceOfCustomerArtifact): readonly KeyFinding[] {
  const painQuote = artifact.painLanguage.quotes[0];
  const objection = artifact.objections.items[0];
  const criterion = artifact.decisionCriteria.criteria[0];

  return [
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

const EVIDENCE_VERDICT_TONE: Record<EvidenceVerdict['outcome'], StatusPillTone> = {
  clean: 'complete',
  'unverified-directional': 'flagged',
  overclaim: 'error',
  refuted: 'error',
};

const EVIDENCE_VERDICT_LABEL: Record<EvidenceVerdict['outcome'], string> = {
  clean: 'Evidence: clean',
  'unverified-directional': 'Evidence: directional',
  overclaim: 'Evidence: overclaim',
  refuted: 'Evidence: refuted',
};

// Small trust badge populated deterministically by the provenance gate (Gate E).
// Render only when present; absent on every artifact committed before the gate ran.
export function EvidenceVerdictBadge({
  verdict,
}: {
  verdict: EvidenceVerdict;
}): React.ReactElement {
  const counts = `${verdict.verifiedRowCount} verified · ${verdict.unsupportedRowCount} unsupported`;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="voc-evidence-verdict">
      <MonoBadge tone={EVIDENCE_VERDICT_TONE[verdict.outcome]}>
        {EVIDENCE_VERDICT_LABEL[verdict.outcome] ?? verdict.outcome}
      </MonoBadge>
      <span className="font-mono text-[11px] text-muted-foreground">{counts}</span>
      {verdict.note ? (
        <span className="text-[12px] leading-[1.5] text-muted-foreground">
          {scrubReaderText(verdict.note)}
        </span>
      ) : null}
    </div>
  );
}

function AdAngleCard({ angle }: { angle: AdAngle }): React.ReactElement {
  return (
    <article className="border-l border-border pl-4" data-testid="voc-ad-angle">
      <h3 className="text-[15px] font-semibold text-foreground">{angle.angle}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <MonoBadge>{angle.targeting}</MonoBadge>
      </div>
      <p className="mt-2 text-[13px] leading-[1.55] text-foreground">
        {scrubReaderText(angle.hook)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          from: {angle.sourcePainTheme}
        </span>
        {angle.sourceUrl ? <SourceLink url={angle.sourceUrl} /> : null}
      </div>
    </article>
  );
}

const OUTCOME_PROOF_COLUMNS: ReadonlyArray<DataTableColumn<OutcomeProof>> = [
  {
    key: 'company',
    header: 'Company',
    render: (row) => <span className="font-medium text-foreground">{row.company}</span>,
  },
  {
    key: 'metric',
    header: 'Metric',
    render: (row) => <span>{scrubReaderText(row.metric)}</span>,
  },
  {
    key: 'beforeAfter',
    header: 'Before → after',
    render: (row) => <span>{scrubReaderText(row.beforeAfter)}</span>,
  },
  {
    key: 'sourceUrl',
    header: 'Source',
    render: (row) => <SourceLink url={row.sourceUrl} />,
  },
];

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
    adAngles,
    outcomeProof,
    evidenceVerdict,
  } = artifact;

  if (isVoiceOfCustomerHonestlyUnavailable(artifact)) {
    const sourcingPlan =
      painLanguage.blockGap?.sourcingPlan?.join('; ') ??
      'Rerun this section — it did not gather enough public evidence in its time budget.';

    return (
      <div
        className={cn('flex flex-col gap-4', className)}
        data-testid="voc-honestly-unavailable"
      >
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Voice of customer
        </div>
        <GapNote subject="this voice-of-customer read" howToClose={sourcingPlan}>
          Not enough public evidence was found to read the voice of the customer
          in this run. Nothing here was fabricated — the section is reporting an
          honest gap.
        </GapNote>
      </div>
    );
  }

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
        valueReadiness={deriveValueReadinessBadge(artifact.verifierSummary)}
      />
      {evidenceVerdict ? <EvidenceVerdictBadge verdict={evidenceVerdict} /> : null}
      <KeyFindings findings={vocKeyFindings(artifact)} />

      {(() => {
        // Suppress the strategic hero when every strategic field is an
        // 'evidence gap:' placeholder — a 26px bold "evidence gap: …" verdict is
        // the worst reader experience in the deliverable. Render only fields
        // that classify as real text; drop the panel entirely when none do.
        const fourForces = [
          { label: 'four-forces verdict', value: artifact.fourForcesBalanceVerdict?.balanceVerdict },
          { label: 'push', value: artifact.fourForcesBalanceVerdict?.push },
          { label: 'pull', value: artifact.fourForcesBalanceVerdict?.pull },
          { label: 'anxiety', value: artifact.fourForcesBalanceVerdict?.anxiety },
          { label: 'habit', value: artifact.fourForcesBalanceVerdict?.habit },
        ].filter(
          (field): field is { label: string; value: string } =>
            typeof field.value === 'string' &&
            textOrGap(field.value, field.label).kind === 'text',
        );
        const insightVerdict = artifact.strategicInsight?.strategicVerdict;
        const hasRealInsight =
          typeof insightVerdict === 'string' &&
          textOrGap(insightVerdict, 'strategic verdict').kind === 'text';
        const insight = hasRealInsight ? artifact.strategicInsight : undefined;

        if (!insight && fourForces.length === 0) {
          return null;
        }

        return (
          <StrategicInsightPanel insight={insight}>
            {fourForces.map((field) => (
              <StrategicField key={field.label} label={field.label} value={field.value} />
            ))}
          </StrategicInsightPanel>
        );
      })()}

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

      {outcomeProof && outcomeProof.length > 0 ? (
        <SubsectionBlock
          label="Outcome proof"
          prose="Named customers with quantified before/after outcomes."
        >
          <DataTable
            columns={OUTCOME_PROOF_COLUMNS}
            rows={outcomeProof}
            rowKey={(row) => `${row.company}-${row.metric}`}
            rowTestId={() => 'outcome-proof-item'}
          />
        </SubsectionBlock>
      ) : null}

      {adAngles && adAngles.length > 0 ? (
        <SubsectionBlock
          label="Ad angles to test"
          prose="Ready-to-run hooks, each grounded in a named pain theme from the voice-of-customer evidence above."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {adAngles.map((angle, index) => (
              <AdAngleCard key={`${angle.angle}-${index}`} angle={angle} />
            ))}
          </div>
        </SubsectionBlock>
      ) : null}
    </div>
  );
}
