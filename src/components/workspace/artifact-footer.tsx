'use client';

import { cn } from '@/lib/utils';

interface ArtifactFooterProps {
  onApprove: () => void;
  disabled?: boolean;
}

export function ArtifactFooter({ onApprove, disabled }: ArtifactFooterProps) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] px-6 py-4">
      <button
        type="button"
        onClick={onApprove}
        disabled={disabled}
        className={cn(
          'rounded-[var(--radius-md)] bg-[var(--accent-blue)] px-5 py-2.5',
          'text-sm font-medium text-white',
          'transition-colors hover:bg-[var(--accent-blue)]/90',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        Looks good &rarr;
      </button>
    </div>
  );
}
