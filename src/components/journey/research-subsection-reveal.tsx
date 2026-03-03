'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useSubsectionReveal } from '@/hooks/use-subsection-reveal';
import {
  StatCard, VerdictCard, ListCard, CompetitorCard, BudgetBarCard, QuoteCard,
} from './intel-cards';
import type { SubsectionCard } from './intel-cards';
import type { StatCardProps } from './intel-cards';
import type { VerdictCardProps } from './intel-cards';
import type { ListCardProps } from './intel-cards';
import type { CompetitorCardProps } from './intel-cards';
import type { BudgetBarCardProps } from './intel-cards';
import type { QuoteCardProps } from './intel-cards';

function renderCard(card: SubsectionCard) {
  switch (card.type) {
    case 'stat':        return <StatCard        {...(card.props as StatCardProps)} />;
    case 'verdict':     return <VerdictCard     {...(card.props as VerdictCardProps)} />;
    case 'list':        return <ListCard        {...(card.props as ListCardProps)} />;
    case 'competitor':  return <CompetitorCard  {...(card.props as CompetitorCardProps)} />;
    case 'budgetBar':   return <BudgetBarCard   {...(card.props as BudgetBarCardProps)} />;
    case 'quote':       return <QuoteCard       {...(card.props as QuoteCardProps)} />;
  }
}

interface ResearchSubsectionRevealProps {
  sectionKey: string;
  data: Record<string, unknown> | null | undefined;
  status: 'pending' | 'running' | 'complete' | 'error';
  delayMs?: number;
}

export function ResearchSubsectionReveal({
  sectionKey,
  data,
  status,
  delayMs = 1500,
}: ResearchSubsectionRevealProps) {
  const cards = useSubsectionReveal(sectionKey, data, status, delayMs);

  if (cards.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <AnimatePresence>
        {cards.map((card) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderCard(card)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
