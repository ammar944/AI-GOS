'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';

interface ArtifactTriggerCardProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  approved?: boolean;
  onClick: () => void;
  className?: string;
}

export function ArtifactTriggerCard({
  section,
  status,
  approved = false,
  onClick,
  className,
}: ArtifactTriggerCardProps) {
  const meta = SECTION_META[section] ?? DEFAULT_SECTION_META;
  const isComplete = approved || status === 'complete';
  const isError = status === 'error';

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      aria-label={`View ${meta.label} artifact`}
      className={cn(
        'w-full glass-surface rounded-[var(--radius-module)] p-5 flex items-center justify-between gap-4',
        'cursor-pointer hover:bg-white/[0.05] transition-colors duration-200',
        'text-left group',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {/* Status indicator */}
        {isError ? (
          <div className="w-2.5 h-2.5 rounded-full bg-accent-red shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
        ) : isComplete ? (
          <div className="w-2.5 h-2.5 rounded-full bg-accent-green shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
        ) : (
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--section-market)] animate-subtle-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--section-market)] animate-subtle-pulse" style={{ animationDelay: '75ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--section-market)] animate-subtle-pulse" style={{ animationDelay: '150ms' }} />
          </div>
        )}

        <div>
          <span className="text-[10px] font-mono text-[var(--section-market-text)] uppercase tracking-widest">
            Module {meta.moduleNumber}
          </span>
          <h3 className="text-sm font-heading font-medium text-text-primary">
            {meta.label}
          </h3>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center gap-2 text-text-tertiary group-hover:text-text-secondary transition-colors">
        <span className="text-xs">
          {isError ? 'View details' : approved ? 'Approved' : isComplete ? 'View artifact' : 'View progress'}
        </span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </motion.button>
  );
}
