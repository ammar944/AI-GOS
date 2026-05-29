import { cn } from '@/lib/utils';
import type { VoiceOfCustomerArtifact } from '@/types/positioning-artifact';
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
  high: 'bg-destructive/10 text-destructive',
  medium: 'bg-secondary text-secondary-foreground',
  low: 'bg-secondary text-muted-foreground',
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
  buyer: 'text-muted-foreground',
  champion: 'text-primary',
  influencer: 'text-muted-foreground',
  blocker: 'text-destructive',
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
        'inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.04em] text-secondary-foreground',
        className,
      )}
    >
      {children}
    </span>
  );
}

function MonoLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
      className="text-[10px] uppercase tracking-[0.06em] text-primary no-underline hover:underline"
    >
      {hostnameOf(url)} →
    </a>
  );
}

const HEADER_CLASS =
  'border-b border-border px-3 py-2 align-bottom text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground';
const ROW_CLASS = 'border-b border-border/60 transition-colors hover:bg-muted/50';
const CELL_CLASS =
  'px-3 py-2.5 align-top text-[13px] leading-[1.5] text-muted-foreground';

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
                        <span className="text-foreground">{item.objectionText}</span>
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
                      <span className="font-medium text-foreground">
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
                      <span className="font-medium text-foreground">
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
                        <span className="italic text-muted-foreground">
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
