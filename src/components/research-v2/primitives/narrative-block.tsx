'use client';

import { Fragment, type JSX, type ReactNode } from 'react';

import { Response } from '@/components/ai-elements/response';
import {
  renderProseWithCitations,
  useReaderSources,
  type ReaderSource,
} from '@/components/research-v2/reader-sources';
import { cn } from '@/lib/utils';
import { GapNote } from './gap-note';
import { scrubReaderText, textOrGap } from './reader-text';

export interface NarrativeBlockProps {
  title?: string;
  prose: string;
  children?: ReactNode;
  className?: string;
}

// Citation preservation strategy: ProseWithCitations operates on raw strings,
// so citations are applied POST-markdown — custom element overrides map the
// string children that Streamdown produces through the existing
// renderProseWithCitations tokenizer. `[n]` markers survive markdown parsing
// as literal text (no matching link-reference definitions exist), so this
// keeps BOTH markdown structure (paragraphs, lists, emphasis) AND inline Cite
// hover-cards — including citations inside bold runs and list items.
function citedChildren(
  children: ReactNode,
  sources: ReaderSource[],
): ReactNode {
  if (typeof children === 'string') {
    return renderProseWithCitations(children, sources);
  }
  if (Array.isArray(children)) {
    return children.map((child, index) =>
      typeof child === 'string' ? (
        <Fragment key={`cited-${index}`}>
          {renderProseWithCitations(child, sources)}
        </Fragment>
      ) : (
        child
      ),
    );
  }
  return children;
}

type MarkdownElementProps<Tag extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[Tag] & { node?: unknown };

function CitedParagraph({
  node,
  children,
  ...rest
}: MarkdownElementProps<'p'>): React.ReactElement {
  void node; // hast node — must not spread onto the DOM
  const sources = useReaderSources();
  return <p {...rest}>{citedChildren(children, sources)}</p>;
}

function CitedListItem({
  node,
  children,
  ...rest
}: MarkdownElementProps<'li'>): React.ReactElement {
  void node;
  const sources = useReaderSources();
  return <li {...rest}>{citedChildren(children, sources)}</li>;
}

function CitedStrong({
  node,
  children,
  ...rest
}: MarkdownElementProps<'strong'>): React.ReactElement {
  void node;
  const sources = useReaderSources();
  return <strong {...rest}>{citedChildren(children, sources)}</strong>;
}

function CitedEmphasis({
  node,
  children,
  ...rest
}: MarkdownElementProps<'em'>): React.ReactElement {
  void node;
  const sources = useReaderSources();
  return <em {...rest}>{citedChildren(children, sources)}</em>;
}

const CITED_MARKDOWN_COMPONENTS = {
  p: CitedParagraph,
  li: CitedListItem,
  strong: CitedStrong,
  em: CitedEmphasis,
};

export function NarrativeBlock({
  title,
  prose,
  children,
  className,
}: NarrativeBlockProps): React.ReactElement {
  const renderedProse = textOrGap(prose, title ?? 'this section narrative');

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {title ? (
        <h4 className="text-[15px] font-semibold leading-[1.4] tracking-[-0.005em] text-foreground">
          {scrubReaderText(title)}
        </h4>
      ) : null}
      {renderedProse.kind === 'gap' ? (
        <GapNote>{renderedProse.value}</GapNote>
      ) : (
        <Response components={CITED_MARKDOWN_COMPONENTS}>
          {renderedProse.value}
        </Response>
      )}
      {children}
    </div>
  );
}

/**
 * Long-form section research markdown — the un-caged GLM body (§4.1). Unlike
 * NarrativeBlock this does NOT route the prose through textOrGap: that guard
 * (looksLikeNavMenuGarbage) collapses any body over 1000 chars OR with >=3
 * markdown links into a generic gap note, which EVERY real ~2000-word research
 * body with cited URLs trips — so the whole feature would render nothing. Here
 * the prose is already deterministically vocab-scrubbed at commit time; we only
 * gate on genuinely-empty content and otherwise render the full markdown
 * (headings, nested lists, links, inline [n] citations) via Streamdown.
 */
export function SectionNarrativeMarkdown({
  prose,
  className,
}: {
  prose: string;
  className?: string;
}): React.ReactElement | null {
  if (prose.trim().length === 0) return null;
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Response components={CITED_MARKDOWN_COMPONENTS}>{prose}</Response>
    </div>
  );
}
