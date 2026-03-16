'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { dispatchMediaPlanForSession } from '@/lib/actions/journey-sessions';

interface MediaPlanButtonProps {
  sessionId: string;
  runId: string;
  hasMediaPlan: boolean;
}

export function MediaPlanButton({ sessionId, runId, hasMediaPlan }: MediaPlanButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState(false);

  if (hasMediaPlan) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 px-3 py-1.5 text-xs font-medium text-[var(--accent-green)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
        Media Plan Complete
      </span>
    );
  }

  if (dispatched) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 px-3 py-1.5 text-xs font-medium text-[var(--accent-blue)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)] animate-pulse" />
        Generating Media Plan...
      </span>
    );
  }

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await dispatchMediaPlanForSession(sessionId);
      if (result.success) {
        setDispatched(true);
        // Redirect to workspace where they can see the activity log + cards streaming
        router.push(`/journey?session=${encodeURIComponent(runId)}&mediaPlan=1`);
      } else {
        setError(result.error ?? 'Failed to generate media plan');
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          'cursor-pointer inline-flex items-center gap-2 rounded-full text-[13px] font-semibold px-5 h-9 transition-all',
          'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple,#8b5cf6)]',
          'text-white hover:opacity-90',
          isPending && 'opacity-50 cursor-not-allowed',
        )}
      >
        {isPending ? 'Starting...' : 'Generate Media Plan'}
      </button>
      {error && (
        <span className="text-xs text-[var(--accent-red)]">{error}</span>
      )}
    </div>
  );
}
