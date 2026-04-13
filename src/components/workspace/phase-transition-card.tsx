'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaleIn, springs } from '@/lib/motion';

export interface PhaseTransitionCardProps {
  tag: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function PhaseTransitionCard({
  tag,
  title,
  description,
  actionLabel,
  onAction,
  isLoading = false,
  disabled = false,
  disabledReason,
}: PhaseTransitionCardProps) {
  const isButtonDisabled = isLoading || disabled;

  return (
    <motion.div
      variants={scaleIn}
      initial="initial"
      animate="animate"
      transition={springs.smooth}
      className={cn(
        'mt-8 mb-2 rounded-2xl border border-[var(--border-default)]',
        'bg-[var(--bg-surface)]',
        'overflow-hidden',
      )}
    >
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent-blue)]/40 to-transparent" />

      <div className="px-7 py-7">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <span className="text-xs font-mono text-[var(--accent-blue)] uppercase tracking-widest">
              {tag}
            </span>

            <h2 className="mt-2 font-heading text-xl font-semibold text-[var(--text-primary)] leading-snug">
              {title}
            </h2>

            <p className="mt-1.5 text-sm text-[var(--text-tertiary)] leading-relaxed max-w-[420px]">
              {description}
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2 pt-1">
            <motion.button
              type="button"
              onClick={onAction}
              disabled={isButtonDisabled}
              whileTap={isButtonDisabled ? undefined : { scale: 0.97 }}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-6 py-3',
                'text-sm font-semibold text-white',
                'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)]',
                'transition-opacity hover:opacity-90',
                isButtonDisabled && 'opacity-50 cursor-not-allowed hover:opacity-50',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  <span>{`${actionLabel}...`}</span>
                </>
              ) : (
                actionLabel
              )}
            </motion.button>

            {disabled && !isLoading && disabledReason ? (
              <p className="max-w-[280px] text-right text-xs text-[var(--text-tertiary)] leading-relaxed">
                {disabledReason}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--accent-blue)]/10 to-transparent" />
    </motion.div>
  );
}
