'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { CardState } from '@/lib/workspace/types';
import { ArtifactCard } from './artifact-card';
import { CardContentSwitch } from '@/components/research/card-renderer';

interface CompetitorTabsProps {
  cards: CardState[];
}

export function CompetitorTabs({ cards }: CompetitorTabsProps) {
  const competitorCards = useMemo(
    () => cards.filter((c) => c.cardType === 'competitor-card'),
    [cards],
  );
  const otherCards = useMemo(
    () => cards.filter((c) => c.cardType !== 'competitor-card'),
    [cards],
  );

  const [activeTab, setActiveTab] = useState<string>(
    competitorCards.length >= 2 ? '__overview__' : competitorCards[0]?.label ?? '',
  );

  if (competitorCards.length === 0) return null;

  const showOverview = competitorCards.length >= 2;

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-5 inline-flex gap-0.5 rounded-[5px] p-0.5" style={{ background: 'var(--bg-surface, #0e1018)' }}>
        {showOverview && (
          <button
            type="button"
            className={cn(
              'rounded-[3px] px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
              activeTab === '__overview__'
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
            )}
            style={activeTab === '__overview__' ? { background: 'var(--bg-card, #12141c)' } : undefined}
            onClick={() => setActiveTab('__overview__')}
          >
            Overview
          </button>
        )}
        {competitorCards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={cn(
              'rounded-[3px] px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
              activeTab === card.label
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
            )}
            style={activeTab === card.label ? { background: 'var(--bg-card, #12141c)' } : undefined}
            onClick={() => setActiveTab(card.label)}
          >
            {card.label}
          </button>
        ))}
      </div>

      {/* Overview table */}
      {activeTab === '__overview__' && showOverview && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Competitor</th>
                <th className="px-2.5 py-1.5 text-right font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Price</th>
                <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Confidence</th>
                <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Strengths</th>
                <th className="px-2.5 py-1.5 text-left font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>Weaknesses</th>
              </tr>
            </thead>
            <tbody>
              {competitorCards.map((card) => {
                const d = card.content as Record<string, unknown>;
                const strengths = (d.strengths as string[]) ?? [];
                const weaknesses = (d.weaknesses as string[]) ?? [];
                const website = d.website as string | undefined;
                const confidence = d.pricingConfidence as string | undefined;
                return (
                  <tr
                    key={card.id}
                    className="cursor-pointer transition-colors"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    onClick={() => setActiveTab(card.label)}
                  >
                    <td className="px-2.5 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {website ? (
                        <a
                          href={website.startsWith('http') ? website : `https://${website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                          style={{ color: 'var(--accent-blue)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {card.label}
                        </a>
                      ) : (
                        card.label
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {(d.price as string) || '—'}
                    </td>
                    <td className="px-2.5 py-2">
                      {confidence && (
                        <span
                          className="inline-flex rounded-full px-1.5 py-px font-mono text-[10px] font-medium"
                          style={{
                            color: confidence === 'high' ? 'var(--accent-green, #22c55e)' : confidence === 'unknown' ? 'var(--accent-amber, #eab308)' : 'var(--text-secondary)',
                            background: confidence === 'high' ? 'rgba(34,197,94,0.1)' : confidence === 'unknown' ? 'rgba(234,179,8,0.1)' : 'transparent',
                          }}
                        >
                          {confidence}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {strengths.slice(0, 2).join(', ')}
                    </td>
                    <td className="px-2.5 py-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {weaknesses.slice(0, 2).join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Individual competitor view */}
      {activeTab !== '__overview__' && (
        <div>
          {competitorCards
            .filter((card) => card.label === activeTab)
            .map((card, i) => (
              <ArtifactCard key={card.id} card={card} index={i}>
                <CardContentSwitch card={card} />
              </ArtifactCard>
            ))}
        </div>
      )}

      {/* Non-competitor cards (review cards, market patterns, etc.) */}
      {otherCards.length > 0 && (
        <div className="mt-4 space-y-3">
          {otherCards.map((card, i) => (
            <ArtifactCard key={card.id} card={card} index={i}>
              <CardContentSwitch card={card} />
            </ArtifactCard>
          ))}
        </div>
      )}
    </div>
  );
}
