import { cn } from '@/lib/utils';
import type { DemandIntentArtifact } from '@/lib/managed-agents/schemas/demand-intent-signals';
import {
  DataTable,
  SubsectionBlock,
  type DataTableColumn,
} from '../primitives';

export interface DemandIntentRendererProps {
  artifact: DemandIntentArtifact;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function SourceLink({ url }: { url?: string }): React.ReactElement | null {
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

function MonoPill({
  value,
  label,
}: {
  value: string;
  label?: string;
}): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground">
      {label ?? value}
    </span>
  );
}

function DomainChips({ domains }: { domains: ReadonlyArray<string> }): React.ReactElement | null {
  if (!domains || domains.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {domains.map(domain => (
        <span
          key={domain}
          className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
        >
          {domain}
        </span>
      ))}
    </div>
  );
}

export function DemandIntentRenderer({
  artifact,
  className,
}: DemandIntentRendererProps): React.ReactElement {
  const { keywordDemand, questionMining, contentGaps, intentSignals, venueMap } = artifact;

  /* ───────── 1. Keyword Demand ───────── */
  const keywordColumns: ReadonlyArray<
    DataTableColumn<(typeof keywordDemand.keywords)[number]>
  > = [
    {
      key: 'keyword',
      header: 'Keyword',
      render: row => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{row.keyword}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
    {
      key: 'monthlyVolume',
      header: 'Monthly volume',
      numeric: true,
      render: row => <span>{row.monthlyVolume}</span>,
    },
    {
      key: 'intentType',
      header: 'Intent',
      render: row => (
        <MonoPill value={row.intentType} label={INTENT_TYPE_LABEL[row.intentType]} />
      ),
    },
    {
      key: 'top3RankingDomains',
      header: 'Top-3 ranking',
      render: row => <DomainChips domains={row.top3RankingDomains} />,
    },
  ];

  /* ───────── 2. Question Mining ───────── */
  const questionColumns: ReadonlyArray<
    DataTableColumn<(typeof questionMining.questions)[number]>
  > = [
    {
      key: 'question',
      header: 'Question',
      render: row => (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-foreground">{row.question}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
    {
      key: 'surface',
      header: 'Surface',
      render: row => (
        <MonoPill value={row.surface} label={QUESTION_SURFACE_LABEL[row.surface]} />
      ),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: row => (
        <MonoPill value={row.frequency} label={FREQUENCY_LABEL[row.frequency]} />
      ),
    },
  ];

  /* ───────── 3. Content Gaps ───────── */
  const gapColumns: ReadonlyArray<
    DataTableColumn<(typeof contentGaps.gaps)[number]>
  > = [
    {
      key: 'topic',
      header: 'Topic',
      render: row => (
        <span className="font-medium text-foreground">{row.topic}</span>
      ),
    },
    { key: 'evidenceOfDemand', header: 'Evidence of demand' },
    { key: 'weakCompetitorAnswerEvidence', header: 'Weak competitor answer' },
    { key: 'opportunity', header: 'Opportunity' },
  ];

  /* ───────── 4. Intent Signals ───────── */
  const intentColumns: ReadonlyArray<
    DataTableColumn<(typeof intentSignals.items)[number]>
  > = [
    {
      key: 'signalType',
      header: 'Signal type',
      render: row => (
        <MonoPill value={row.signalType} label={SIGNAL_TYPE_LABEL[row.signalType]} />
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: row => (
        <div className="flex flex-col gap-1">
          <span>{row.description}</span>
          <SourceLink url={row.sourceUrl} />
        </div>
      ),
    },
    {
      key: 'exampleCompany',
      header: 'Example',
      render: row =>
        row.exampleCompany ? (
          <span className="text-[11px] text-muted-foreground">
            {row.exampleCompany}
          </span>
        ) : null,
    },
  ];

  /* ───────── 5. Venue Map ───────── */
  const venueColumns: ReadonlyArray<
    DataTableColumn<(typeof venueMap.venues)[number]>
  > = [
    {
      key: 'name',
      header: 'Venue',
      render: row => (
        <span className="font-medium text-foreground">{row.name}</span>
      ),
    },
    {
      key: 'venueType',
      header: 'Type',
      render: row => (
        <MonoPill value={row.venueType} label={VENUE_TYPE_LABEL[row.venueType]} />
      ),
    },
    {
      key: 'audienceSize',
      header: 'Audience',
      render: row => (
        <span className="text-[11px] text-muted-foreground">
          {row.audienceSize}
        </span>
      ),
    },
    {
      key: 'sourceUrl',
      header: 'Source',
      render: row => <SourceLink url={row.sourceUrl} />,
    },
  ];

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      <SubsectionBlock label="1 · Keyword Demand" prose={keywordDemand.prose}>
        <DataTable
          columns={keywordColumns}
          rows={keywordDemand.keywords}
          rowKey={r => r.keyword}
          rowTestId={() => 'keyword-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="2 · Question Mining" prose={questionMining.prose}>
        <DataTable
          columns={questionColumns}
          rows={questionMining.questions}
          rowKey={(r, idx) => `${r.surface}-${idx}`}
          rowTestId={() => 'question-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="3 · Content Gaps" prose={contentGaps.prose}>
        <DataTable
          columns={gapColumns}
          rows={contentGaps.gaps}
          rowKey={r => r.topic}
          rowTestId={() => 'gap-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="4 · Intent Signals" prose={intentSignals.prose}>
        <DataTable
          columns={intentColumns}
          rows={intentSignals.items}
          rowKey={(r, idx) => `${r.signalType}-${idx}`}
          rowTestId={() => 'intent-item'}
        />
      </SubsectionBlock>

      <SubsectionBlock label="5 · Venue Map" prose={venueMap.prose}>
        <DataTable
          columns={venueColumns}
          rows={venueMap.venues}
          rowKey={r => r.name}
          rowTestId={() => 'venue-item'}
        />
      </SubsectionBlock>
    </div>
  );
}
