import type { DemandIntentArtifact } from '@/lib/managed-agents/schemas/demand-intent-signals';
import { cn } from '@/lib/utils';

import {
  BarBreakdown,
  DataTable,
  type DataTableColumn,
} from '../primitives';
import {
  SourceLink,
  SubsectionBlock,
  countBy,
  formatEnumLabel,
  joinList,
} from './shared';

export interface DemandIntentSignalsRendererProps {
  artifact: DemandIntentArtifact;
  className?: string;
}

export function DemandIntentSignalsRenderer({
  artifact,
  className,
}: DemandIntentSignalsRendererProps): React.ReactElement {
  const {
    keywordDemand,
    questionMining,
    contentGaps,
    intentSignals,
    venueMap,
  } = artifact;

  const keywordColumns: ReadonlyArray<
    DataTableColumn<(typeof keywordDemand.keywords)[number]>
  > = [
    {
      key: 'keyword',
      header: 'Keyword',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">
            {row.keyword}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
            {formatEnumLabel(row.intentType)}
          </span>
        </div>
      ),
    },
    { key: 'monthlyVolume', header: 'Volume', numeric: true },
    {
      key: 'top3RankingDomains',
      header: 'Top ranking domains',
      render: (row) => joinList(row.top3RankingDomains),
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} label={row.sourceTitle} />,
    },
  ];

  const questionColumns: ReadonlyArray<
    DataTableColumn<(typeof questionMining.questions)[number]>
  > = [
    {
      key: 'question',
      header: 'Question',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.question}
        </span>
      ),
    },
    {
      key: 'surface',
      header: 'Surface',
      render: (row) => formatEnumLabel(row.surface),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: (row) => formatEnumLabel(row.frequency),
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const contentGapColumns: ReadonlyArray<
    DataTableColumn<(typeof contentGaps.gaps)[number]>
  > = [
    {
      key: 'topic',
      header: 'Topic',
      render: (row) => (
        <span className="font-medium text-[color:var(--text-primary)]">
          {row.topic}
        </span>
      ),
    },
    { key: 'evidenceOfDemand', header: 'Demand evidence' },
    { key: 'weakCompetitorAnswerEvidence', header: 'Weak answer evidence' },
    { key: 'opportunity', header: 'Opportunity' },
  ];

  const signalColumns: ReadonlyArray<
    DataTableColumn<(typeof intentSignals.items)[number]>
  > = [
    {
      key: 'signalType',
      header: 'Signal',
      render: (row) => formatEnumLabel(row.signalType),
    },
    { key: 'description', header: 'Description' },
    { key: 'exampleCompany', header: 'Example company' },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const venueColumns: ReadonlyArray<
    DataTableColumn<(typeof venueMap.venues)[number]>
  > = [
    {
      key: 'name',
      header: 'Venue',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-[color:var(--text-primary)]">
            {row.name}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
            {formatEnumLabel(row.venueType)}
          </span>
        </div>
      ),
    },
    { key: 'audienceSize', header: 'Audience size', numeric: true },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: (row) => <SourceLink url={row.sourceUrl} />,
    },
  ];

  const intentSegments = countBy(
    keywordDemand.keywords,
    (keyword) => keyword.intentType,
  ).map((segment) => ({
    ...segment,
    label: formatEnumLabel(segment.label),
    isAccent: segment.label === 'commercial' || segment.label === 'transactional',
  }));
  const surfaceSegments = countBy(
    questionMining.questions,
    (question) => question.surface,
  ).map((segment) => ({
    ...segment,
    label: formatEnumLabel(segment.label),
  }));

  return (
    <div className={cn('mx-auto flex w-full max-w-[920px] flex-col gap-16', className)}>
      <SubsectionBlock title="Keyword demand" prose={keywordDemand.prose}>
        {intentSegments.length > 0 ? (
          <BarBreakdown
            caption="Intent mix"
            total={`${keywordDemand.keywords.length} keywords`}
            segments={intentSegments}
          />
        ) : null}
        <DataTable
          caption="Search demand"
          columns={keywordColumns}
          rows={keywordDemand.keywords}
          rowKey={(row) => `${row.keyword}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Question mining" prose={questionMining.prose}>
        {surfaceSegments.length > 0 ? (
          <BarBreakdown
            caption="Question surfaces"
            total={`${questionMining.questions.length} questions`}
            segments={surfaceSegments}
          />
        ) : null}
        <DataTable
          caption="Buyer questions"
          columns={questionColumns}
          rows={questionMining.questions}
          rowKey={(row) => `${row.question}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Content gaps" prose={contentGaps.prose}>
        <DataTable
          caption="Demand without a strong answer"
          columns={contentGapColumns}
          rows={contentGaps.gaps}
          rowKey={(row) => row.topic}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Intent signals" prose={intentSignals.prose}>
        <DataTable
          caption="In-market triggers"
          columns={signalColumns}
          rows={intentSignals.items}
          rowKey={(row) => `${row.signalType}-${row.sourceUrl}`}
        />
      </SubsectionBlock>

      <SubsectionBlock title="Venue map" prose={venueMap.prose}>
        <DataTable
          caption="Places demand clusters"
          columns={venueColumns}
          rows={venueMap.venues}
          rowKey={(row) => `${row.name}-${row.sourceUrl}`}
        />
      </SubsectionBlock>
    </div>
  );
}
