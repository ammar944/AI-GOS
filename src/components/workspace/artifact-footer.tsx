'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ArtifactFooterProps {
  variant?: 'approve' | 'complete';
  onApprove?: () => void;
  disabled?: boolean;
  docSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  sessionId?: string;
}

export function ArtifactFooter({ variant = 'approve', onApprove, disabled, docSaveStatus, sessionId }: ArtifactFooterProps) {
  if (variant === 'complete') {
    return (
      <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-6 py-4 bg-[var(--accent-green)]/[0.03]">
        <div>
          <p className="text-sm font-medium text-[var(--accent-green)]">Research Complete</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            {docSaveStatus === 'saving'
              ? 'Saving document...'
              : docSaveStatus === 'saved'
                ? 'Document saved'
                : docSaveStatus === 'error'
                  ? 'Failed to save — try viewing anyway'
                  : 'All sections reviewed and approved'}
          </p>
        </div>
        {docSaveStatus === 'saved' && sessionId ? (
          <Link
            href={`/research/${sessionId}`}
            className={cn(
              'rounded-[var(--radius-md)] px-5 py-2.5',
              'text-sm font-semibold text-black',
              'bg-white hover:bg-white/90 transition-colors',
            )}
          >
            View Document &rarr;
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={cn(
              'rounded-[var(--radius-md)] px-5 py-2.5',
              'text-sm font-semibold text-white',
              'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple,#8b5cf6)]',
              'opacity-50 cursor-not-allowed',
            )}
          >
            {docSaveStatus === 'saving' ? 'Saving...' : 'View Document'}
          </button>
        )}
      </div>
    );
  }

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
