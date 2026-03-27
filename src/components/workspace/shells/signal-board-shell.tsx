'use client';

import { SIGNAL_BOARD_ZONES } from '@/lib/workspace/section-shells';
import type { CardState } from '@/lib/workspace/types';

interface SignalBoardShellProps {
  cards: CardState[];
  renderCard: (card: CardState, index: number) => React.ReactNode;
}

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

  return (
    <div className="space-y-3">
      {/* Stats — inline row at top, big mono numbers */}
      {stats.length > 0 && (
        <section>
          {stats.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Callouts — insight/strategy/trend/verdict/flag cards as accent-bordered blocks */}
      {callouts.length > 0 && (
        <section className="space-y-2">
          {callouts.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Tables — ICE table, keyword grid */}
      {tables.length > 0 && (
        <section className="space-y-3">
          {tables.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Lists — bullet lists, check lists, offer statements */}
      {lists.length > 0 && (
        <section className="space-y-2">
          {lists.map(card => renderCard(card, idx++))}
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
