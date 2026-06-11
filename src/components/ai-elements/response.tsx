'use client';

// Vendored minimal equivalent of AI Elements' <Response> — a thin wrapper
// around streamdown's <Streamdown> for rendering AI-generated markdown.
// Styled per DESIGN.md: DM Sans 14px body on a 68ch measure, lists/strong/em
// at body register, and model-emitted headings flattened to body size with
// medium weight so a stray "##" can never shout inside a reader card. Links
// carry the single accent; no decorative color.
//
// Defaults are tuned for the Audit Reader's poll-based, commit-on-complete
// surfaces: `mode="static"` + `parseIncompleteMarkdown={false}` so committed
// text is rendered verbatim and trailing tokens (e.g. a final `[3]` citation
// marker) are never withheld by streaming-repair heuristics. Streaming
// consumers can override both via props.

import { memo, type ComponentProps, type ReactElement } from 'react';

import { Streamdown } from 'streamdown';

import { cn } from '@/lib/utils';

export type ResponseProps = ComponentProps<typeof Streamdown>;

const PROSE_CLASS = cn(
  'max-w-[68ch] space-y-3 font-sans text-[14px] font-normal leading-[1.6] text-foreground',
  // Inline emphasis stays within the DM Sans 400/500 body register.
  '[&_strong]:font-medium [&_strong]:text-foreground [&_em]:italic',
  // Lists.
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_li]:mt-1',
  // Flatten model-emitted headings to body size + medium weight.
  '[&_h1]:text-[14px] [&_h2]:text-[14px] [&_h3]:text-[14px] [&_h4]:text-[14px] [&_h5]:text-[14px] [&_h6]:text-[14px]',
  '[&_h1]:font-medium [&_h2]:font-medium [&_h3]:font-medium [&_h4]:font-medium [&_h5]:font-medium [&_h6]:font-medium',
  // One accent for links; underline on hover only.
  '[&_a]:text-primary [&_a:hover]:underline',
  // Inline code at the mono data-sm register.
  '[&_code]:font-mono [&_code]:text-[13px]',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_hr]:border-border',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
);

function ResponseBase({
  className,
  mode = 'static',
  parseIncompleteMarkdown = false,
  ...props
}: ResponseProps): ReactElement {
  return (
    <Streamdown
      className={cn(PROSE_CLASS, className)}
      mode={mode}
      parseIncompleteMarkdown={parseIncompleteMarkdown}
      {...props}
    />
  );
}

export const Response = memo(ResponseBase);
Response.displayName = 'Response';
