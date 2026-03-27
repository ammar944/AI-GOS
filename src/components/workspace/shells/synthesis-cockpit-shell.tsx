'use client';

import { SYNTHESIS_ZONES } from '@/lib/workspace/section-shells';
import type { CardState } from '@/lib/workspace/types';

interface SynthesisCockpitShellProps {
  cards: CardState[];
  renderCard: (card: CardState, index: number) => React.ReactNode;
}

/**
 * Synthesis Cockpit shell — strategic synthesis section layout.
 * Zones: insights (callout blocks) → strategy (primary callout) → angles (compact list) → supporting prose/lists.
 * No flat vertical dump — each zone has distinct visual rhythm.
 * crossAnalysis has no approve footer (special-case) — shell must not assume footer exists.
 */
export function SynthesisCockpitShell({ cards, renderCard }: SynthesisCockpitShellProps) {
  const insights = cards.filter(c => SYNTHESIS_ZONES.insights.has(c.cardType));
  const strategy = cards.filter(c => SYNTHESIS_ZONES.strategy.has(c.cardType));
  const angles = cards.filter(c => SYNTHESIS_ZONES.angles.has(c.cardType));
  const lists = cards.filter(c => SYNTHESIS_ZONES.lists.has(c.cardType));
  const prose = cards.filter(c => SYNTHESIS_ZONES.prose.has(c.cardType));

  // Global index counter for consistent keys
  let idx = 0;

  return (
    <div className="space-y-4">
      {/* Strategy — primary recommendation, most prominent */}
      {strategy.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Strategic Direction
          </h3>
          <div className="space-y-3">
            {strategy.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Key Insights — callout blocks with source attribution */}
      {insights.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Key Insights
          </h3>
          <div className="space-y-2">
            {insights.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Messaging Angles — compact list */}
      {angles.length > 0 && (
        <section>
          <h3 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-2">
            Messaging Angles
          </h3>
          <div className="space-y-1">
            {angles.map(card => renderCard(card, idx++))}
          </div>
        </section>
      )}

      {/* Supporting lists (e.g., critical success factors) */}
      {lists.length > 0 && (
        <div className="space-y-2">
          {lists.map(card => renderCard(card, idx++))}
        </div>
      )}

      {/* Prose — supporting narrative at bottom, not dominant */}
      {prose.length > 0 && (
        <div className="space-y-2">
          {prose.map(card => renderCard(card, idx++))}
        </div>
      )}
    </div>
  );
}
