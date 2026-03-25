'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CardEditingContext } from '@/lib/workspace/card-editing-context';
import type { CardState } from '@/lib/workspace/types';

const STATIC_EDITING_CONTEXT = {
  isEditing: false,
  draftContent: {},
  updateDraft: () => {},
};

interface ReadOnlyCardProps {
  card: CardState;
  children: React.ReactNode;
  index?: number;
}

/**
 * Lightweight card wrapper for the shared session page.
 * No workspace context, no version history, no editing.
 */
export function ReadOnlyCard({ card, children, index = 0 }: ReadOnlyCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'rounded-[var(--radius-lg)] border p-5',
        'border-[var(--border-subtle)] bg-[var(--bg-card)]',
      )}
    >
      <div className="mb-3">
        <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-wider">
          {card.label}
        </span>
      </div>
      <CardEditingContext value={STATIC_EDITING_CONTEXT}>
        {children}
      </CardEditingContext>
    </motion.div>
  );
}
