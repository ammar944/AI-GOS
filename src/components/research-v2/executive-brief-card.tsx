'use client';

// W3 executive brief card: the report's spine, rendered once at the top of the
// Audit Reader. Industrial register per DESIGN.md — typography does the work,
// no decoration, color only for state. Renders nothing until the detached
// brief route has written research_artifacts.thesis.

import { Response } from '@/components/ai-elements/response';
import { cn } from '@/lib/utils';
import { DecisionCard, GapNote, ReaderExhibit, scrubReaderText } from './primitives';

// Memo typography, scoped to the brief only (response.tsx defaults stay
// flattened): the first paragraph reads as a lede, h2/h3 get their scale
// back, and paragraphs breathe. A decision memo, not a wall.
export const MEMO_PROSE_CLASS = cn(
  'space-y-4',
  '[&>p:first-of-type]:text-[17px] [&>p:first-of-type]:leading-[1.65] [&>p:first-of-type]:text-foreground',
  '[&_h2]:mt-7 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h2]:tracking-[-0.01em]',
  '[&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-semibold',
);

// Quiet editorial label (matches the restyled ui-kit Eyebrow).
const MEMO_LABEL_CLASS = 'font-sans text-[12px] font-medium text-muted-foreground';

interface BriefMove {
  rank: number;
  move: string;
  provingSections: string[];
}

interface BriefConflict {
  factKey: string;
  label?: string;
  readings: Array<{ sectionId: string; value: string }>;
  resolution: string;
  setAsideCount?: number;
  winningSectionId: string;
}

export interface ExecutiveBriefCardProps {
  brief: Record<string, unknown> | null | undefined;
  sectionLabelOf?: (sectionId: string) => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asMoves(value: unknown): BriefMove[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is BriefMove =>
      isRecord(item) &&
      typeof item.move === 'string' &&
      typeof item.rank === 'number',
  );
}

function asConflicts(value: unknown): BriefConflict[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is BriefConflict =>
      isRecord(item) &&
      typeof item.factKey === 'string' &&
      typeof item.resolution === 'string',
  );
}

function humanizeFactKey(value: string): string {
  return value
    .replace(/^subject-price:/, 'Subject price: ')
    .replace(/^competitor-price:/, 'Competitor price: ')
    .replace(/^ARR$/, 'ARR')
    .replace(/^acv$/, 'ACV')
    .replace(/^cac-target$/, 'CAC target')
    .replace(/^customer-count$/, 'Customer count')
    .replace(/^monthly-budget$/, 'Monthly budget')
    .replace(/^sales-cycle-days$/, 'Sales cycle')
    .replace(/^keyword-cluster:/, 'Keyword cluster: ')
    .replace(/-/g, ' ');
}

function conflictLabel(conflict: BriefConflict): string {
  return typeof conflict.label === 'string' && conflict.label.trim().length > 0
    ? conflict.label
    : humanizeFactKey(conflict.factKey);
}

export function ExecutiveBriefCard({
  brief,
  sectionLabelOf,
}: ExecutiveBriefCardProps): React.ReactElement {
  if (!isRecord(brief)) {
    return (
      <section aria-label="Executive brief" className="mb-10">
        <GapNote subject="the executive decision memo" />
      </section>
    );
  }

  if (brief.status === 'generating') {
    return (
      <div className="mb-8 rounded-lg border border-border bg-muted/20 px-5 py-3">
        <span className={MEMO_LABEL_CLASS}>Composing executive brief…</span>
      </div>
    );
  }

  if (brief.status !== 'complete' || typeof brief.executiveThesis !== 'string') {
    return (
      <section aria-label="Executive brief" className="mb-10">
        <GapNote subject="the executive decision memo" />
      </section>
    );
  }

  const labelOf = sectionLabelOf ?? ((sectionId: string) => sectionId);
  const moves = asMoves(brief.rankedMoves);
  const conflicts = asConflicts(brief.factConflicts)
    .filter(
      (conflict) =>
        conflict.winningSectionId.trim().length > 0 &&
        conflict.resolution.trim().length > 0,
    )
    .slice(0, 6);

  return (
    <section
      aria-label="Executive brief"
      className="mb-10 border-l-2 border-primary pl-5"
    >
      <div className={cn('mb-5', MEMO_LABEL_CLASS)}>Executive decision memo</div>

      {/* Thesis is AI-authored markdown with paragraph breaks — Response gives
          it the shared 68ch body measure; MEMO_PROSE_CLASS restores lede +
          heading scale within the brief only. */}
      <Response className={MEMO_PROSE_CLASS}>
        {scrubReaderText(brief.executiveThesis)}
      </Response>

      {moves.length > 0 ? (
        <div className="mt-8 border-t border-border pt-6">
          <div className={cn('mb-4', MEMO_LABEL_CLASS)}>The Three Moves</div>
          <ol className="space-y-3">
            {moves.map((move) => (
              <li key={move.rank}>
                <DecisionCard
                  number={move.rank}
                  move={move.move}
                  evidence={move.provingSections.map((sectionId) => ({
                    title: labelOf(sectionId),
                  }))}
                />
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="mt-6">
          <ReaderExhibit title="appendix: fact reconciliation" count={conflicts.length}>
          <ul className="space-y-4">
            {conflicts.map((conflict) => (
              <li key={conflict.factKey} className="text-[13px] leading-relaxed">
                <p className="font-medium text-foreground">
                  {scrubReaderText(conflictLabel(conflict))}
                </p>
                <p className="mt-1 max-w-[68ch] text-muted-foreground">
                  {scrubReaderText(conflict.resolution)}
                </p>
              </li>
            ))}
          </ul>
          </ReaderExhibit>
        </div>
      ) : null}
    </section>
  );
}
