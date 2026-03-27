'use client';

import { OPS_BOARD_ZONES } from '@/lib/workspace/section-shells';
import type { CardState } from '@/lib/workspace/types';

interface OpsBoardShellProps {
  cards: CardState[];
  renderCard: (card: CardState, index: number) => React.ReactNode;
}

/**
 * Ops Board shell — Media Plan section layout.
 * Layout: hero strategy → stats/budget → charts → platforms (table) → campaigns → execution phases → risks.
 * Most complex section — structured zones prevent flat card dump.
 */
export function OpsBoardShell({ cards, renderCard }: OpsBoardShellProps) {
  const hero = cards.filter(c => OPS_BOARD_ZONES.hero.has(c.cardType));
  const stats = cards.filter(c => OPS_BOARD_ZONES.stats.has(c.cardType));
  const charts = cards.filter(c => OPS_BOARD_ZONES.charts.has(c.cardType));
  const platforms = cards.filter(c => OPS_BOARD_ZONES.platforms.has(c.cardType));
  const campaigns = cards.filter(c => OPS_BOARD_ZONES.campaigns.has(c.cardType));
  const execution = cards.filter(c => OPS_BOARD_ZONES.execution.has(c.cardType));
  const risks = cards.filter(c => OPS_BOARD_ZONES.risks.has(c.cardType));
  const lists = cards.filter(c => OPS_BOARD_ZONES.lists.has(c.cardType));
  const prose = cards.filter(c => OPS_BOARD_ZONES.prose.has(c.cardType));

  let idx = 0;

  return (
    <div className="space-y-4">
      {/* Hero — strategy snapshot, most prominent */}
      {hero.length > 0 && (
        <section>
          {hero.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Stats — budget, KPIs, CAC model as inline stat rows */}
      {stats.length > 0 && (
        <section className="space-y-3">
          {stats.map(card => renderCard(card, idx++))}
        </section>
      )}

      {/* Charts — visual data, 2-column grid where possible */}
      {charts.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Budget & Performance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {charts.map(card => (
              <div key={card.id}>
                {renderCard(card, idx++)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Platform breakdown */}
      {platforms.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Platform Strategy
          </h3>
          <div className="space-y-2">
            {platforms.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Campaigns & segments */}
      {campaigns.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Campaigns & Targeting
          </h3>
          <div className="space-y-2">
            {campaigns.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Execution — phases, format specs, testing plan */}
      {execution.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Execution Plan
          </h3>
          <div className="space-y-2">
            {execution.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Risks */}
      {risks.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Risk Assessment
          </h3>
          <div className="space-y-2">
            {risks.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Supporting content */}
      {lists.length > 0 && (
        <div className="space-y-2">
          {lists.map(card => renderCard(card, idx++))}
        </div>
      )}
      {prose.length > 0 && (
        <div className="space-y-2">
          {prose.map(card => renderCard(card, idx++))}
        </div>
      )}
    </div>
  );
}
