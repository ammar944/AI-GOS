'use client';

import {
  createContext,
  Fragment,
  useContext,
  type ReactNode,
} from 'react';

import { Cite as UiKitCite } from '@/components/research-v2/ui-kit/cite';
import { SourcesFooter as UiKitSourcesFooter } from '@/components/research-v2/ui-kit/source';
import type { PositioningArtifactSource } from '@/types/positioning-artifact';

/** Reader-facing numbered source — shared by footer and inline [n] citations. */
export interface ReaderSource {
  n: number;
  title: string;
  url: string;
  whyItMatters?: string;
}

export type CitationToken =
  | { kind: 'text'; value: string }
  | { kind: 'cite'; indices: number[]; raw: string };

const CITATION_MARKER_RE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/** Map artifact sources to 1-based reader indices; preserves order, no re-dedup. */
export function toReaderSources(
  sources: PositioningArtifactSource[],
): ReaderSource[] {
  return sources.map((source, index) => ({
    n: index + 1,
    title: source.title,
    url: source.url,
    ...(source.whyItMatters ? { whyItMatters: source.whyItMatters } : {}),
  }));
}

/** Tokenize prose on `[n]` / `[n, m]` citation markers for rendering or tests. */
export function parseCitationMarkers(text: string): CitationToken[] {
  if (!text) return [];

  const tokens: CitationToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CITATION_MARKER_RE.lastIndex = 0;
  while ((match = CITATION_MARKER_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }

    const indices = match[1]
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isFinite(n));

    tokens.push({ kind: 'cite', indices, raw: match[0] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

function readerSourceByIndex(
  sources: ReaderSource[],
  n: number,
): ReaderSource | undefined {
  return sources.find((source) => source.n === n);
}

/** Canonical inline citation token — re-exported from ui-kit. */
export { UiKitCite as Cite };

/** Numbered collapsible sources footer — re-exported from ui-kit. */
export function SourcesFooter({
  sources,
}: {
  sources: ReaderSource[];
}): React.ReactElement | null {
  return <UiKitSourcesFooter sources={sources} />;
}

const ReaderSourcesContext = createContext<ReaderSource[] | null>(null);

export function ReaderSourcesProvider({
  sources,
  children,
}: {
  sources: ReaderSource[];
  children: ReactNode;
}): React.ReactElement {
  return (
    <ReaderSourcesContext.Provider value={sources}>
      {children}
    </ReaderSourcesContext.Provider>
  );
}

export function useReaderSources(): ReaderSource[] {
  return useContext(ReaderSourcesContext) ?? [];
}

/** Split prose on `[n]` markers and render inline Cite hover-cards where indices resolve. */
export function renderProseWithCitations(
  text: string,
  sources: ReaderSource[],
): ReactNode {
  if (!text || !sources.length) {
    return text;
  }

  const tokens = parseCitationMarkers(text);
  if (!tokens.some((token) => token.kind === 'cite')) {
    return text;
  }

  return tokens.map((token, index) => {
    if (token.kind === 'text') {
      return <Fragment key={`text-${index}`}>{token.value}</Fragment>;
    }

    const parts: ReactNode[] = [];
    let renderedAny = false;

    token.indices.forEach((n, citeIndex) => {
      const source = readerSourceByIndex(sources, n);
      if (source) {
        renderedAny = true;
        parts.push(<UiKitCite key={`cite-${index}-${citeIndex}`} source={source} />);
        return;
      }
      parts.push(`[${n}]`);
    });

    if (!renderedAny) {
      return <Fragment key={`literal-${index}`}>{token.raw}</Fragment>;
    }

    return <Fragment key={`cite-group-${index}`}>{parts}</Fragment>;
  });
}

/** Context-aware wrapper — reads sources from `ReaderSourcesProvider`. */
export function ProseWithCitations({ text }: { text: string }): ReactNode {
  const sources = useReaderSources();
  return renderProseWithCitations(text, sources);
}
