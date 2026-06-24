'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ResearchV2State } from '@/lib/research-v2/state-machine';

interface ErrorRecoveryProps {
  state: Extract<ResearchV2State, { kind: 'error' }>;
  onRetry: () => void;
  onStartFresh: () => void;
  isRetrying?: boolean;
}

const FROM_LABELS: Record<
  Extract<ResearchV2State, { kind: 'error' }>['from'],
  string
> = {
  onboarding: 'Onboarding',
  section: 'Section research',
};

export function ErrorRecovery({
  state,
  onRetry,
  onStartFresh,
  isRetrying = false,
}: ErrorRecoveryProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <Alert variant="destructive" className="rounded-lg">
          <AlertTitle className="font-semibold">
            {FROM_LABELS[state.from]} failed
          </AlertTitle>
          <AlertDescription className="mt-1 text-sm">
            {state.message}
          </AlertDescription>
        </Alert>

        <div className="flex gap-3">
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            className="flex-1 h-10 rounded-md"
          >
            {isRetrying ? 'Retrying…' : 'Retry'}
          </Button>
          <Button
            variant="outline"
            onClick={onStartFresh}
            disabled={isRetrying}
            className="flex-1 h-10 rounded-md"
          >
            Start fresh
          </Button>
        </div>
      </div>
    </div>
  );
}
