'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CardState } from '@/lib/workspace/types';

interface ArtifactCardProps {
  card: CardState;
  children: React.ReactNode;
  index?: number;
}

export function ArtifactCard({ card, children, index = 0 }: ArtifactCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'rounded-[var(--radius-lg)] border p-5',
        'transition-colors duration-200',
        card.status === 'approved'
          ? 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/[0.02]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-card)]',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-wider">
          {card.label}
        </span>
      </div>

      {children}
    </motion.div>
  );
}
