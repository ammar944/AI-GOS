'use client';

/**
 * Collapsible "Full strategist memo" — the composer's free-markdown deck
 * readout, preserved verbatim alongside the typed deck. The typed deck is the
 * primary billable surface; the memo is the human-readable companion the
 * operator can expand to see the strategist's full reasoning. Renders through
 * SectionNarrativeMarkdown so emphasis/lists/citations format (no raw `**`).
 *
 * Lives in its own file to avoid a circular import between the deck and the
 * inline renderer (the deck imports helpers from the renderer module).
 */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { SectionNarrativeMarkdown } from '@/components/research-v2/primitives';

/**
 * Read the composer's strategist memo off an artifact. The composer stamps
 * `strategistMemo` on the artifact body (run-section.ts); the body may reach
 * the renderer flattened (body fields at root) OR nested under `artifact.body`.
 * Read both paths without trusting the strict artifact type's index signature
 * (Zod-inferred strict bodies do not carry one).
 */
export function readStrategistMemo(
  artifact: { body?: unknown } | Record<string, unknown>,
): string {
  const record = artifact as unknown as Record<string, unknown>;
  const rootMemo = record.strategistMemo;
  if (typeof rootMemo === 'string' && rootMemo.length > 0) return rootMemo;
  const body = record.body;
  if (typeof body === 'object' && body !== null) {
    const bodyMemo = (body as Record<string, unknown>).strategistMemo;
    if (typeof bodyMemo === 'string' && bodyMemo.length > 0) return bodyMemo;
  }
  return '';
}

export function StrategistMemo({
  memo,
}: {
  memo: string;
}): React.ReactElement | null {
  if (memo.trim().length === 0) return null;
  return (
    <Collapsible className="rounded-md border border-border bg-muted/20 p-6">
      <CollapsibleTrigger className="group flex w-full items-center justify-between text-left">
        <div className="grid gap-1">
          <h2 className="text-[15px] font-semibold text-foreground">
            Full strategist memo
          </h2>
          <p className="text-[12px] leading-[1.5] text-muted-foreground">
            The composer&apos;s verbatim markdown readout — the reasoning behind
            the typed deck.
          </p>
        </div>
        <span className="text-[12px] font-medium text-muted-foreground group-data-[state=open]:hidden">
          Expand
        </span>
        <span className="text-[12px] font-medium text-muted-foreground group-data-[state=closed]:hidden">
          Collapse
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4">
        <SectionNarrativeMarkdown prose={memo} />
      </CollapsibleContent>
    </Collapsible>
  );
}