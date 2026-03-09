'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ArtifactTriggerCardProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  onClick: () => void;
  className?: string;
}

const SECTION_META: Record<string, { label: string; moduleNumber: string }> = {
  industryMarket: { label: 'Market Overview', moduleNumber: '01' },
  competitors: { label: 'Competitor Intel', moduleNumber: '02' },
  icpValidation: { label: 'ICP Validation', moduleNumber: '03' },
  offerAnalysis: { label: 'Offer Analysis', moduleNumber: '04' },
  crossAnalysis: { label: 'Strategic Synthesis', moduleNumber: '05' },
};

export function ArtifactTriggerCard({
  section,
  status,
  onClick,
  className,
}: ArtifactTriggerCardProps) {
  const meta = SECTION_META[section] ?? { label: 'Research', moduleNumber: '00' };
  const isComplete = status === 'complete';

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className={cn(
        'w-full glass-surface rounded-[var(--radius-module)] p-5 flex items-center justify-between gap-4',
        'cursor-pointer hover:bg-white/[0.05] transition-colors duration-200',
        'text-left group',
        className,
      )}
    >
      <div className="flex items-center gap-4">
        {/* Status indicator */}
        {isComplete ? (
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
          {isComplete ? 'View artifact' : 'View progress'}
        </span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </motion.button>
  );
}
