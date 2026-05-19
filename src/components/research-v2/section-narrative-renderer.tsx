'use client';

import { Fragment, useMemo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  isRecord,
  type PositioningArtifactSource,
  type PositioningTypedArtifact,
} from '@/types/positioning-artifact';

export interface SectionNarrativeRendererProps {
  artifact: PositioningTypedArtifact;
  zoneId: string;
  onCiteClick?: (url: string) => void;
}

const ARTIFACT_META_KEYS = new Set([
  'sectionTitle',
  'verdict',
  'statusSummary',
  'confidence',
  'sources',
]);

const ITEM_LEAD_KEYS = [
  'name',
  'title',
  'competitor',
  'topic',
  'question',
  'keyword',
  'criterion',
  'stageName',
  'channelName',
  'surface',
  'forceType',
  'signalType',
  'axisName',
  'tierName',
  'level',
  'stage',
  'bucketType',
  'triggerType',
] as const;

const ITEM_QUOTE_KEYS = ['verbatimQuote', 'quote', 'verbatim'] as const;

const ITEM_PROSE_KEYS = [
  'evidence',
  'whyItMatters',
  'implication',
  'whyBuyersConfuseIt',
  'disambiguatingSignal',
  'transformationClaim',
  'oneLinePositioning',
  'verbatimHeroCopy',
  'pricingPosition',
  'evidenceSummary',
  'context',
  'description',
] as const;

const ITEM_SOURCE_URL_KEYS = ['sourceUrl', 'url', 'evidenceUrl'] as const;
const ITEM_SOURCE_TITLE_KEYS = ['sourceTitle', 'source'] as const;

interface Footnote {
  n: number;
  url: string;
  title: string;
  whyItMatters?: string;
}

interface FootnoteMap {
  byUrl: Map<string, Footnote>;
  ordered: Footnote[];
}

interface SubSection {
  key: string;
  title: string;
  prose: string | null;
  items: unknown[];
}

function humanizeKey(value: string): string {
  const spaced = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  return spaced
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 8) return 'border-[color:var(--green)] text-[color:var(--green)]';
  if (confidence >= 5) return 'border-[color:var(--amber)] text-[color:var(--amber)]';
  return 'border-[color:var(--red)] text-[color:var(--red)]';
}

function getNonEmptyString(
  obj: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+\.\S+/.test(value);
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function collectItemSource(item: Record<string, unknown>): {
  url: string | null;
  title: string | null;
} {
  const url = getNonEmptyString(item, ITEM_SOURCE_URL_KEYS);
  if (url && !isUrl(url)) return { url: null, title: null };
  const title = getNonEmptyString(item, ITEM_SOURCE_TITLE_KEYS);
  return { url, title };
}

function walkItemsForSources(
  items: unknown[],
  register: (url: string, title: string) => void,
): void {
  for (const item of items) {
    if (!isRecord(item)) continue;
    const { url, title } = collectItemSource(item);
    if (url) register(url, title ?? hostnameOf(url));
    for (const value of Object.values(item)) {
      if (Array.isArray(value)) {
        walkItemsForSources(value, register);
      } else if (isRecord(value)) {
        walkItemsForSources([value], register);
      }
    }
  }
}

function buildFootnotes(
  artifact: PositioningTypedArtifact,
  subSections: SubSection[],
): FootnoteMap {
  const byUrl = new Map<string, Footnote>();
  const ordered: Footnote[] = [];

  const register = (url: string, title: string, whyItMatters?: string): void => {
    if (byUrl.has(url)) return;
    const entry: Footnote = {
      n: ordered.length + 1,
      url,
      title,
      whyItMatters,
    };
    byUrl.set(url, entry);
    ordered.push(entry);
  };

  for (const src of artifact.sources) {
    register(src.url, src.title || hostnameOf(src.url), src.whyItMatters);
  }

  for (const sub of subSections) {
    walkItemsForSources(sub.items, (url, title) => register(url, title));
  }

  return { byUrl, ordered };
}

function pickItems(value: Record<string, unknown>): unknown[] {
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'prose') continue;
    if (Array.isArray(inner)) return inner;
  }
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'prose') continue;
    if (isRecord(inner)) return [inner];
  }
  return [];
}

function deriveSubSections(artifact: PositioningTypedArtifact): SubSection[] {
  const out: SubSection[] = [];
  for (const [key, value] of Object.entries(artifact)) {
    if (ARTIFACT_META_KEYS.has(key)) continue;
    if (!isRecord(value)) continue;
    const prose =
      typeof value.prose === 'string' && value.prose.trim().length > 0
        ? value.prose.trim()
        : null;
    const items = pickItems(value);
    if (!prose && items.length === 0) continue;
    out.push({
      key,
      title: humanizeKey(key),
      prose,
      items,
    });
  }
  return out;
}

function CiteRef({
  n,
  url,
  zoneId,
  onCiteClick,
}: {
  n: number;
  url: string;
  zoneId: string;
  onCiteClick?: (url: string) => void;
}): ReactNode {
  return (
    <sup className="ml-0.5 align-super">
      <a
        href={`#footnote-${zoneId}-${n}`}
        onClick={(event) => {
          if (!onCiteClick) return;
          event.preventDefault();
          onCiteClick(url);
          const target = document.getElementById(`footnote-${zoneId}-${n}`);
          if (target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
        className="font-mono text-[10px] text-[color:var(--accent-blue)] no-underline hover:underline"
        aria-label={`Footnote ${n}`}
        data-testid={`narrative-cite-${zoneId}-${n}`}
      >
        {n}
      </a>
    </sup>
  );
}

function NarrativeItem({
  item,
  index,
  zoneId,
  footnotes,
  onCiteClick,
}: {
  item: unknown;
  index: number;
  zoneId: string;
  footnotes: FootnoteMap;
  onCiteClick?: (url: string) => void;
}): ReactNode {
  const number = String(index + 1).padStart(2, '0');

  if (typeof item === 'string') {
    return (
      <article
        data-testid={`narrative-item-${zoneId}-${index}`}
        className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-1"
      >
        <span className="font-mono text-[12px] leading-[1.8] text-[color:var(--text-tertiary)]">
          {number}
        </span>
        <p className="text-[15px] leading-[1.7] text-[color:var(--text-primary)]">
          {item}
        </p>
      </article>
    );
  }

  if (!isRecord(item)) return null;

  const lead = getNonEmptyString(item, ITEM_LEAD_KEYS);
  const quote = getNonEmptyString(item, ITEM_QUOTE_KEYS);
  const { url } = collectItemSource(item);
  const footnote = url ? footnotes.byUrl.get(url) : null;

  const proseLines: Array<{ key: string; text: string }> = [];
  for (const key of ITEM_PROSE_KEYS) {
    const value = item[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      proseLines.push({ key, text: value.trim() });
    }
  }

  if (!lead && !quote && proseLines.length === 0) return null;

  return (
    <article
      data-testid={`narrative-item-${zoneId}-${index}`}
      className="grid grid-cols-[2.5rem_1fr] gap-x-3 gap-y-2"
    >
      <span className="font-mono text-[12px] leading-[1.8] text-[color:var(--text-tertiary)]">
        {number}
      </span>
      <div className="space-y-2">
        {lead ? (
          <h4 className="text-[16px] font-semibold leading-[1.5] text-[color:var(--text-primary)]">
            {lead}
            {footnote ? (
              <CiteRef
                n={footnote.n}
                url={footnote.url}
                zoneId={zoneId}
                onCiteClick={onCiteClick}
              />
            ) : null}
          </h4>
        ) : null}
        {quote ? (
          <blockquote className="border-l-2 border-[color:var(--accent-blue)] pl-3 text-[14px] italic leading-[1.7] text-[color:var(--text-secondary)]">
            &ldquo;{quote}&rdquo;
          </blockquote>
        ) : null}
        {proseLines.map((entry, proseIdx) => (
          <p
            key={entry.key}
            className="text-[15px] leading-[1.7] text-[color:var(--text-secondary)]"
          >
            {entry.text}
            {!lead && proseIdx === 0 && footnote ? (
              <CiteRef
                n={footnote.n}
                url={footnote.url}
                zoneId={zoneId}
                onCiteClick={onCiteClick}
              />
            ) : null}
          </p>
        ))}
      </div>
    </article>
  );
}

function FootnoteList({
  zoneId,
  ordered,
}: {
  zoneId: string;
  ordered: Footnote[];
}): ReactNode {
  if (ordered.length === 0) return null;
  return (
    <section
      data-testid={`narrative-footnotes-${zoneId}`}
      className="space-y-3"
      aria-label="Sources"
    >
      <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
        Sources
      </h3>
      <ol className="space-y-2">
        {ordered.map((entry) => (
          <li
            key={entry.url}
            id={`footnote-${zoneId}-${entry.n}`}
            className="grid grid-cols-[2rem_1fr] items-baseline gap-x-2 text-[12px] leading-[1.6] text-[color:var(--text-secondary)] scroll-mt-32"
          >
            <span className="font-mono text-[11px] text-[color:var(--text-tertiary)]">
              {entry.n}.
            </span>
            <div className="min-w-0">
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-baseline gap-1 break-words font-medium text-[color:var(--text-primary)] hover:text-[color:var(--accent-blue)]"
              >
                <span>{entry.title}</span>
                <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
              </a>
              <div className="break-all font-mono text-[10px] text-[color:var(--text-tertiary)]">
                {hostnameOf(entry.url)}
              </div>
              {entry.whyItMatters ? (
                <p className="mt-1 text-[11px] leading-[1.5] text-[color:var(--text-tertiary)]">
                  {entry.whyItMatters}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SectionNarrativeRenderer({
  artifact,
  zoneId,
  onCiteClick,
}: SectionNarrativeRendererProps): React.ReactElement {
  const subSections = useMemo(() => deriveSubSections(artifact), [artifact]);
  const footnotes = useMemo(
    () => buildFootnotes(artifact, subSections),
    [artifact, subSections],
  );

  return (
    <div
      data-testid={`narrative-renderer-${zoneId}`}
      className="flex flex-col gap-10"
    >
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[20px] leading-[1.5] text-[color:var(--text-primary)]">
            {artifact.verdict}
          </p>
          <Badge
            variant="outline"
            className={cn('shrink-0 border', getConfidenceClass(artifact.confidence))}
          >
            Confidence {artifact.confidence}/10
          </Badge>
        </div>
        <p className="text-[15px] leading-[1.7] text-[color:var(--text-secondary)]">
          {artifact.statusSummary}
        </p>
      </header>

      {subSections.map((sub, sectionIndex) => (
        <section
          key={sub.key}
          data-testid={`narrative-subsection-${zoneId}-${sub.key}`}
          className="space-y-5"
        >
          <h3 className="flex items-baseline gap-3 text-[22px] font-semibold leading-[1.3] text-[color:var(--text-primary)]">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
              {String(sectionIndex + 1).padStart(2, '0')}
            </span>
            <span>{sub.title}</span>
          </h3>
          {sub.prose ? (
            <div className="prose prose-sm max-w-[66ch] text-[15px] leading-[1.75] text-[color:var(--text-secondary)] dark:prose-invert">
              <ReactMarkdown>{sub.prose}</ReactMarkdown>
            </div>
          ) : null}
          {sub.items.length > 0 ? (
            <div className="space-y-5">
              {sub.items.map((item, itemIndex) => (
                <Fragment key={itemIndex}>
                  <NarrativeItem
                    item={item}
                    index={itemIndex}
                    zoneId={zoneId}
                    footnotes={footnotes}
                    onCiteClick={onCiteClick}
                  />
                </Fragment>
              ))}
            </div>
          ) : null}
        </section>
      ))}

      <Separator />
      <FootnoteList zoneId={zoneId} ordered={footnotes.ordered} />
    </div>
  );
}

// Re-exported for callers that need to derive footnotes outside the renderer
// (e.g. to wire the audit-level Sources Drawer to body anchors).
export type { Footnote, FootnoteMap, PositioningArtifactSource };
export { buildFootnotes, deriveSubSections };
