import { cn } from '@/lib/utils';
import type { VoiceOfCustomerArtifact } from '@/lib/managed-agents/schemas/voc-objection-evidence';
import { QuoteCallout, SubsectionBlock } from '../primitives';

export interface VoiceOfCustomerRendererProps {
  artifact: VoiceOfCustomerArtifact;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
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

const PAIN_INTENSITY_TONE: Record<string, string> = {
  high: 'bg-[var(--bg-chip)] text-[color:var(--accent-red)]',
  medium: 'bg-[var(--bg-chip)] text-[color:var(--accent-amber)]',
  low: 'bg-[var(--bg-chip)] text-[color:var(--text-tertiary)]',
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

const DECISION_ROLE_TONE: Record<string, string> = {
  buyer: 'text-[color:var(--text-secondary)]',
  champion: 'text-[color:var(--accent-green)]',
  influencer: 'text-[color:var(--text-secondary)]',
  blocker: 'text-[color:var(--accent-red)]',
};

const DECISION_ROLE_LABEL: Record<string, string> = {
  buyer: 'Buyer',
  champion: 'Champion',
  influencer: 'Influencer',
  blocker: 'Blocker',
};

function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-[var(--bg-chip)] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-[color:var(--text-secondary)]',
        className,
      )}
    >
      {children}
    </span>
  );
}

function MonoLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
      {children}
    </span>
  );
}

function SourceLink({ url }: { url: string }): React.ReactElement | null {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[10px] uppercase tracking-[0.04em] text-[color:var(--accent-blue)] no-underline hover:underline"
    >
      {hostnameOf(url)} →
    </a>
  );
}

const HEADER_CLASS =
  'border-b border-[var(--border-subtle)] px-3 py-2 align-bottom font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[color:var(--text-quaternary)]';
const ROW_CLASS = 'border-b border-transparent transition-colors hover:bg-[var(--bg-hover)]';
const CELL_CLASS =
  'px-3 py-2.5 align-top text-[13px] leading-[1.5] text-[color:var(--text-secondary)]';

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

  return (
    <div className={cn('flex flex-col gap-12', className)}>
      {/* ───────── 1. Pain Language ───────── */}
      <SubsectionBlock label="1 · Pain Language" prose={painLanguage.prose}>
        <div className="flex flex-col gap-6">
          {painLanguage.quotes.map((quote, idx) => (
            <div key={`pain-${idx}`} data-testid="voc-quote">
              <QuoteCallout
                quote={quote.verbatimText}
                source={VOC_SOURCE_LABEL[quote.source] ?? quote.source}
                sourceUrl={quote.sourceUrl}
                emphasis={
                  <span className="flex flex-wrap items-center gap-2">
                    <MonoLabel>{quote.painTheme}</MonoLabel>
                    <Pill className={PAIN_INTENSITY_TONE[quote.painIntensity]}>
                      {quote.painIntensity}
                    </Pill>
                  </span>
                }
              />
            </div>
          ))}
          {painLanguage.quotes.length === 0 ? (
            <MonoLabel>No verbatim pain quotes captured</MonoLabel>
          ) : null}
        </div>
      </SubsectionBlock>

      {/* ───────── 2. Objections ───────── */}
      <SubsectionBlock label="2 · Objections" prose={objections.prose}>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className={HEADER_CLASS}>Objection</th>
                <th scope="col" className={HEADER_CLASS}>Category</th>
                <th scope="col" className={HEADER_CLASS}>Frequency</th>
                <th scope="col" className={HEADER_CLASS}>How to handle</th>
              </tr>
            </thead>
            <tbody>
              {objections.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center">
                    <MonoLabel>No objections captured</MonoLabel>
                  </td>
                </tr>
              ) : (
                objections.items.map((item, idx) => (
                  <tr
                    key={`objection-${idx}`}
                    data-testid="objection-item"
                    className={ROW_CLASS}
                  >
                    <td className={CELL_CLASS}>
                      <div className="flex flex-col gap-1">
                        <span className="text-[color:var(--text-primary)]">{item.objectionText}</span>
                        <SourceLink url={item.sourceUrl} />
                      </div>
                    </td>
                    <td className={CELL_CLASS}>
                      <Pill>{OBJECTION_CATEGORY_LABEL[item.category] ?? item.category}</Pill>
                    </td>
                    <td className={CELL_CLASS}>
                      <Pill>{FREQUENCY_LABEL[item.frequency] ?? item.frequency}</Pill>
                    </td>
                    <td className={CELL_CLASS}>{item.howToHandle}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SubsectionBlock>

      {/* ───────── 3. Switching Stories ───────── */}
      <SubsectionBlock label="3 · Switching Stories" prose={switchingStories.prose}>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className={HEADER_CLASS}>From</th>
                <th scope="col" className={HEADER_CLASS}>Reason to leave</th>
                <th scope="col" className={HEADER_CLASS}>Decision path</th>
                <th scope="col" className={HEADER_CLASS}>Example</th>
              </tr>
            </thead>
            <tbody>
              {switchingStories.stories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center">
                    <MonoLabel>No switching stories captured</MonoLabel>
                  </td>
                </tr>
              ) : (
                switchingStories.stories.map((story, idx) => (
                  <tr
                    key={`switching-${idx}`}
                    data-testid="switching-item"
                    className={ROW_CLASS}
                  >
                    <td className={CELL_CLASS}>
                      <span className="font-medium text-[color:var(--text-primary)]">
                        {story.priorSolution}
                      </span>
                    </td>
                    <td className={CELL_CLASS}>{story.reasonToLeave}</td>
                    <td className={CELL_CLASS}>{story.decisionPath}</td>
                    <td className={CELL_CLASS}>
                      <div className="flex flex-col gap-1">
                        <span>{story.exampleCompany || '—'}</span>
                        <SourceLink url={story.sourceUrl} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SubsectionBlock>

      {/* ───────── 4. Decision Criteria ───────── */}
      <SubsectionBlock label="4 · Decision Criteria" prose={decisionCriteria.prose}>
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th scope="col" className={HEADER_CLASS}>Criterion</th>
                <th scope="col" className={HEADER_CLASS}>Stated by</th>
                <th scope="col" className={HEADER_CLASS}>Evidence quote</th>
              </tr>
            </thead>
            <tbody>
              {decisionCriteria.criteria.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center">
                    <MonoLabel>No decision criteria captured</MonoLabel>
                  </td>
                </tr>
              ) : (
                decisionCriteria.criteria.map((c, idx) => (
                  <tr
                    key={`criterion-${idx}`}
                    data-testid="criterion-item"
                    className={ROW_CLASS}
                  >
                    <td className={CELL_CLASS}>
                      <span className="font-medium text-[color:var(--text-primary)]">
                        {c.criterion}
                      </span>
                    </td>
                    <td className={CELL_CLASS}>
                      <Pill className={DECISION_ROLE_TONE[c.statedBy]}>
                        {DECISION_ROLE_LABEL[c.statedBy] ?? c.statedBy}
                      </Pill>
                    </td>
                    <td className={CELL_CLASS}>
                      <div className="flex flex-col gap-1">
                        <span className="italic text-[color:var(--text-secondary)]">
                          &ldquo;{c.evidenceQuote}&rdquo;
                        </span>
                        <SourceLink url={c.sourceUrl} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SubsectionBlock>

      {/* ───────── 5. Success Language ───────── */}
      <SubsectionBlock label="5 · Success Language" prose={successLanguage.prose}>
        <div className="flex flex-col gap-6">
          {successLanguage.quotes.map((quote, idx) => (
            <div key={`success-${idx}`} data-testid="success-quote">
              <QuoteCallout
                quote={quote.verbatimText}
                source={VOC_SOURCE_LABEL[quote.source] ?? quote.source}
                sourceUrl={quote.sourceUrl}
                emphasis={
                  <span>
                    <MonoLabel>after-state · </MonoLabel>
                    {quote.afterStatePattern}
                  </span>
                }
              />
            </div>
          ))}
          {successLanguage.quotes.length === 0 ? (
            <MonoLabel>No verbatim success quotes captured</MonoLabel>
          ) : null}
        </div>
      </SubsectionBlock>
    </div>
  );
}
