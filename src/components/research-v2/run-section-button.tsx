'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

export type SectionRunState = 'idle' | 'pending' | 'running' | 'complete' | 'error';

export interface RunSectionButtonProps {
  runId: string;
  sectionId: PositioningSectionId;
  sectionLabel: string;
  externalState?: SectionRunState;
  onStateChange?: (sectionId: PositioningSectionId, state: SectionRunState) => void;
}

export function RunSectionButton({
  runId,
  sectionId,
  sectionLabel,
  externalState,
  onStateChange,
}: RunSectionButtonProps) {
  const [internalState, setInternalState] = useState<SectionRunState>('idle');
  const state = externalState ?? internalState;

  function setState(next: SectionRunState) {
    setInternalState(next);
    onStateChange?.(sectionId, next);
  }

  async function handleClick() {
    if (state !== 'idle' && state !== 'error') return;

    setState('pending');

    try {
      const res = await fetch('/api/research-v2/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ runId, sectionId }),
      });

      if (res.status === 409) {
        // Already running — treat as running
        setState('running');
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        console.error('[run-section] dispatch failed:', body.error);
        setState('error');
        return;
      }

      const data = (await res.json()) as { status?: string };
      if (data.status === 'already_complete') {
        setState('complete');
      } else {
        setState('running');
      }
    } catch (err) {
      console.error('[run-section] fetch error:', err);
      setState('error');
    }
  }

  if (state === 'pending') {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-48 rounded-md" />
        <span className="text-xs text-muted-foreground">Dispatching…</span>
      </div>
    );
  }

  if (state === 'running') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground animate-pulse">
          Running: {sectionLabel}…
        </span>
      </div>
    );
  }

  if (state === 'complete') {
    return null;
  }

  const isError = state === 'error';

  return (
    <Button
      variant={isError ? 'destructive' : 'default'}
      size="sm"
      className="rounded-md"
      onClick={() => void handleClick()}
    >
      {isError ? `Retry: ${sectionLabel}` : `Run section: ${sectionLabel}`}
    </Button>
  );
}
