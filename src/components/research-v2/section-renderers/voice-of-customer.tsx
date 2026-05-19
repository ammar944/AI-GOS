import type { VoiceOfCustomerArtifact } from '@/lib/managed-agents/schemas/voc-objection-evidence';
import { cn } from '@/lib/utils';

import {
  BarBreakdown,
  DataTable,
  MilestoneTimeline,
  QuoteCallout,
  type DataTableColumn,
  type MilestoneItem,
} from '../primitives';
import {
  SourceLink,
  SubsectionBlock,
  countBy,
  formatEnumLabel,
} from './shared';

export interface VoiceOfCustomerRendererProps {
  artifact: VoiceOfCustomerArtifact;
  className?: string;
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

  const objectionColumns: ReadonlyArray<
    DataTableColumn<(typeof objections.items)[number]>
  > = [
    {
      key: 'objectionText',
      header: 'Objection',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.objectionText}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => formatEnumLabel(row.category),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: (row) => formatEnumLabel(row.frequency),
    },
    { key: 'howToHandle', header: 'How to handle' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const criterionColumns: ReadonlyArray<
    DataTableColumn<(typeof decisionCriteria.criteria)[number]>
  > = [
    {
      key: 'criterion',
      header: 'Criterion',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.criterion}
        </span>
      ),
    },
    {
      key: 'statedBy',
      header: 'Role',
      render: (row) => formatEnumLabel(row.statedBy),
    },
    { key: 'evidenceQuote', header: 'Evidence quote' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const objectionSegments = countBy(
    objections.items,
    (item) => item.category,
  ).map((segment) => ({
    ...segment,
    label: formatEnumLabel(segment.label),
    isAccent: segment.label === 'trust' || segment.label === 'switching-cost',
  }));

  const switchingSteps: MilestoneItem[] = switchingStories.stories.map(
    (story, index) => ({
      label: story.exampleCompany ?? `Story ${index + 1}`,
      title: `${story.priorSolution} → ${story.reasonToLeave}`,
      body: (
        <span>
          {story.decisionPath}{' '}
          <SourceLink url={story.sourceUrl} />
        </span>
      ),
      accent: index === 0,
    }),
  );

  return (
    <div className={cn('mx-auto flex w-full max-w-[920px] flex-col gap-16', className)}>
      <SubsectionBlock title="Pain language" prose={painLanguage.prose}>
        <div className="flex flex-col gap-8">
          {painLanguage.quotes.map((quote, index) => (
            <QuoteCallout
              key={`${quote.sourceUrl}-${index}`}
              quote={quote.verbatimText}
              source={formatEnumLabel(quote.source)}
              sourceUrl={quote.sourceUrl}
              meta={`${quote.painTheme} · ${formatEnumLabel(quote.painIntensity)} intensity`}
            />
          ))}
        </div>
      </SubsectionBlock>

      <SubsectionBlock title="Objections" prose={objections.prose}>
        {objectionSegments.length > 0 ? (
          <BarBreakdown
            caption="Objection mix"
            total={`${objections.items.length} objections`}
            segments={objectionSegments}
          />
        ) : null}
        <DataTable
          caption="Repeated buyer objections"
          columns={objectionColumns}
          rows={objections.items}
          rowKey={(row) => `${row.category}-${row.objectionText}`}
        />
      </SubsectionBlock>

      <SubsectionBlock
        title="Switching stories"
        prose={switchingStories.prose}
      >
        <MilestoneTimeline steps={switchingSteps} />
      </SubsectionBlock>

      <SubsectionBlock
        title="Decision criteria"
        prose={decisionCriteria.prose}
      >
        <DataTable
          caption="What buyers use to decide"
          columns={criterionColumns}
          rows={decisionCriteria.criteria}
          rowKey={(row) => `${row.criterion}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock
        title="Success language"
        prose={successLanguage.prose}
      >
        <div className="flex flex-col gap-8">
          {successLanguage.quotes.map((quote, index) => (
            <QuoteCallout
              key={`${quote.sourceUrl}-${index}`}
              quote={quote.verbatimText}
              source={formatEnumLabel(quote.source)}
              sourceUrl={quote.sourceUrl}
              meta={quote.afterStatePattern}
            />
          ))}
        </div>
      </SubsectionBlock>
    </div>
  );
}
