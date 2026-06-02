import { cn } from '@/lib/utils';
import type { VoiceOfCustomerArtifact } from '@/types/positioning-artifact';
import {
  DataTable,
  Eyebrow,
  MonoBadge,
  QuoteCallout,
  SourceLink,
  type DataTableColumn,
} from '@/components/research-v2/ui-kit';
import { SubsectionBlock } from '../primitives';

export interface VoiceOfCustomerRendererProps {
  artifact: VoiceOfCustomerArtifact;
  className?: string;
}

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

  const objectionColumns: ReadonlyArray<
    DataTableColumn<(typeof objections.items)[number]>
  > = [
    {
      key: 'objectionText',
      header: 'Objection',
      render: row => (
        <div className="flex flex-col gap-1">
          <span className="text-foreground">{row.objectionText}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: row => (
        <MonoBadge>{OBJECTION_CATEGORY_LABEL[row.category] ?? row.category}</MonoBadge>
      ),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: row => (
        <MonoBadge>{FREQUENCY_LABEL[row.frequency] ?? row.frequency}</MonoBadge>
      ),
    },
    { key: 'howToHandle', header: 'How to handle' },
  ];

  const switchingColumns: ReadonlyArray<
    DataTableColumn<(typeof switchingStories.stories)[number]>
  > = [
    {
      key: 'priorSolution',
      header: 'From',
      render: row => (
        <span className="font-medium text-foreground">{row.priorSolution}</span>
      ),
    },
    { key: 'reasonToLeave', header: 'Reason to leave' },
    { key: 'decisionPath', header: 'Decision path' },
    {
      key: 'exampleCompany',
      header: 'Example',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.exampleCompany || '—'}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  const criteriaColumns: ReadonlyArray<
    DataTableColumn<(typeof decisionCriteria.criteria)[number]>
  > = [
    {
      key: 'criterion',
      header: 'Criterion',
      render: row => (
        <span className="font-medium text-foreground">{row.criterion}</span>
      ),
    },
    {
      key: 'statedBy',
      header: 'Stated by',
      render: row => (
        <MonoBadge>{DECISION_ROLE_LABEL[row.statedBy] ?? row.statedBy}</MonoBadge>
      ),
    },
    {
      key: 'evidenceQuote',
      header: 'Evidence quote',
      render: row => (
        <div className="flex flex-col gap-1">
          <span className="italic text-muted-foreground">
            &ldquo;{row.evidenceQuote}&rdquo;
          </span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
  ];

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      <SubsectionBlock label="1 · Pain Language" prose={painLanguage.prose}>
        <div className="flex flex-col gap-6">
          {painLanguage.quotes.map((quote, idx) => (
            <div key={`pain-${idx}`} data-testid="voc-quote" className="flex flex-col gap-2">
              <QuoteCallout
                text={quote.verbatimText}
                source={VOC_SOURCE_LABEL[quote.source] ?? quote.source}
                url={quote.sourceUrl}
              />
              <div className="flex flex-wrap items-center gap-2 pl-5">
                <Eyebrow>{quote.painTheme}</Eyebrow>
                <MonoBadge>{quote.painIntensity}</MonoBadge>
              </div>
            </div>
          ))}
          {painLanguage.quotes.length === 0 ? (
            <Eyebrow>No verbatim pain quotes captured</Eyebrow>
          ) : null}
        </div>
      </SubsectionBlock>

      <SubsectionBlock label="2 · Objections" prose={objections.prose}>
        <DataTable
          columns={objectionColumns}
          rows={objections.items}
          emptyLabel="No objections captured"
          rowTestId={() => 'objection-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="3 · Switching Stories" prose={switchingStories.prose}>
        <DataTable
          columns={switchingColumns}
          rows={switchingStories.stories}
          emptyLabel="No switching stories captured"
          rowTestId={() => 'switching-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="4 · Decision Criteria" prose={decisionCriteria.prose}>
        <DataTable
          columns={criteriaColumns}
          rows={decisionCriteria.criteria}
          emptyLabel="No decision criteria captured"
          rowTestId={() => 'criterion-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="5 · Success Language" prose={successLanguage.prose}>
        <div className="flex flex-col gap-6">
          {successLanguage.quotes.map((quote, idx) => (
            <div key={`success-${idx}`} data-testid="success-quote" className="flex flex-col gap-2">
              <QuoteCallout
                text={quote.verbatimText}
                source={VOC_SOURCE_LABEL[quote.source] ?? quote.source}
                url={quote.sourceUrl}
              />
              <p className="pl-5 text-[15px] leading-[1.6] text-foreground">
                <Eyebrow className="mr-1 inline">after-state</Eyebrow>
                {quote.afterStatePattern}
              </p>
            </div>
          ))}
          {successLanguage.quotes.length === 0 ? (
            <Eyebrow>No verbatim success quotes captured</Eyebrow>
          ) : null}
        </div>
      </SubsectionBlock>
    </div>
  );
}
