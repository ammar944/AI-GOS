'use client';

import { SIGNAL_BOARD_ZONES } from '@/lib/workspace/section-shells';
import type { CardState } from '@/lib/workspace/types';

interface SignalBoardShellProps {
  cards: CardState[];
  renderCard: (card: CardState, index: number) => React.ReactNode;
}

/** Semantic pairs to render side-by-side in the lists zone. */
const LIST_PAIRS: [string, string][] = [
  ['pain points', 'demand drivers'],
  ['strengths', 'weaknesses'],
  ['buying triggers', 'barriers to purchase'],
  ['opportunities', 'threats'],
];

/**
 * Signal Board shell — used by Market Overview, ICP Validation, Offer Analysis.
 * Layout: stats at top (inline row) → callouts → tables → lists → prose at bottom.
 */
export function SignalBoardShell({ cards, renderCard }: SignalBoardShellProps) {
  const stats = cards.filter(c => SIGNAL_BOARD_ZONES.stats.has(c.cardType));
  const tables = cards.filter(c => SIGNAL_BOARD_ZONES.tables.has(c.cardType));
  const lists = cards.filter(c => SIGNAL_BOARD_ZONES.lists.has(c.cardType));
  const callouts = cards.filter(c => SIGNAL_BOARD_ZONES.callouts.has(c.cardType));
  const prose = cards.filter(c => SIGNAL_BOARD_ZONES.prose.has(c.cardType));

  let idx = 0;

  // Build label→card map for pair detection (case-insensitive).
  const labelMap = new Map<string, CardState>();
  for (const card of lists) {
    labelMap.set(card.label.toLowerCase().trim(), card);
  }

  // Determine which lists belong to a pair and which are singles.
  const pairedKeys = new Set<string>();
  const pairGroups: [CardState, CardState][] = [];

  for (const [leftKey, rightKey] of LIST_PAIRS) {
    const left = labelMap.get(leftKey);
    const right = labelMap.get(rightKey);
    if (left && right) {
      pairGroups.push([left, right]);
      pairedKeys.add(leftKey);
      pairedKeys.add(rightKey);
    }
  }

  // Singles: any list card whose label is not part of a detected pair.
  const singleLists = lists.filter(
    c => !pairedKeys.has(c.label.toLowerCase().trim()),
  );

  // Separate trend cards from other callouts.
  const trendCards = callouts.filter(c => c.cardType === 'trend-card');
  const otherCallouts = callouts.filter(c => c.cardType !== 'trend-card');

  return (
    <div className="space-y-3">
      {/* Stats — inline row at top, big mono numbers */}
      {stats.length > 0 && (
        <section>
          {stats.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Callouts — insight/strategy/verdict/flag cards first, then trend signals */}
      {callouts.length > 0 && (
        <section>
          {otherCallouts.length > 0 && (
            <div className="space-y-2">
              {otherCallouts.map(card => renderCard(card, idx++))}
            </div>
          )}
          {trendCards.length > 0 && (
            <div className={trendCards.length >= 3 ? 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 mt-2' : 'space-y-2 mt-2'}>
              {trendCards.map(card => renderCard(card, idx++))}
            </div>
          )}
        </section>
      )}

      {/* Tables — ICE table, keyword grid */}
      {tables.length > 0 && (
        <section className="space-y-3">
          {tables.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Lists — paired lists side-by-side, singles at full width */}
      {lists.length > 0 && (
        <section className="space-y-2">
          {pairGroups.map(([left, right]) => (
            <div key={`${left.label}-${right.label}`} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderCard(left, idx++)}
              {renderCard(right, idx++)}
            </div>
          ))}
          {singleLists.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Prose — narrative content at bottom, de-emphasized */}
      {prose.length > 0 && (
        <section className="space-y-2">
          {prose.map(card => renderCard(card, idx++))}
        </section>
      )}
    </div>
  );
}
