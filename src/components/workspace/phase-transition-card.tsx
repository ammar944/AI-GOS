'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div
      className={cn(
        'mt-8 mb-2 rounded-[var(--radius-lg)]',
        'border-l-2 border-l-[var(--accent-blue)] border border-[var(--border-subtle)]',
        'bg-[var(--bg-card)]',
      )}
    >
      <div className="px-6 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <span className="text-[11px] font-mono text-[var(--accent-blue)] uppercase tracking-[0.06em]">
              {tag}
            </span>

            <h2 className="mt-1.5 font-heading text-lg font-semibold text-[var(--text-primary)] leading-snug">
              {title}
            </h2>

            <p className="mt-1 text-sm text-[var(--text-tertiary)] leading-relaxed max-w-[420px]">
              {description}
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-2 pt-1">
            <button
              type="button"
              onClick={onAction}
              disabled={isButtonDisabled}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5',
                'text-[13px] font-semibold text-white cursor-pointer',
                'bg-[var(--accent-blue)]',
                'transition-opacity duration-150 hover:opacity-90',
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
            </button>

            {disabled && !isLoading && disabledReason ? (
              <p className="max-w-[280px] text-right text-xs text-[var(--text-tertiary)] leading-relaxed">
                {disabledReason}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
