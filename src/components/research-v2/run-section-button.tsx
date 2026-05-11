'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const state = externalState ?? internalState;

  function setState(next: SectionRunState) {
    setInternalState(next);
    onStateChange?.(sectionId, next);
  }

  async function handleClick() {
    console.log('[run-section-button] handleClick entry', { state, runId, sectionId });
    if (state !== 'idle' && state !== 'error') return;

    console.log('[run-section-button] guard passed, dispatching');
    setErrorMessage(null);
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
        console.error('[run-section] dispatch failed (HTTP error):', body.error);
        setErrorMessage(body.error ?? `HTTP ${res.status}`);
        setState('error');
        return;
      }

      const data = (await res.json()) as { status?: string; error?: string };
      console.log('[run-section-button] dispatch response', data);

      if (data.status === 'error') {
        console.error('[run-section] worker dispatch failed:', data.error);
        setErrorMessage(data.error ?? 'Dispatch failed');
        setState('error');
        return;
      }

      if (data.status === 'already_complete') {
        setState('complete');
      } else if (
        data.status === 'queued' ||
        data.status === 'running' ||
        data.status === 'already_running'
      ) {
        setState('running');
      } else {
        console.error('[run-section] unexpected dispatch status:', data.status);
        setErrorMessage(`Unexpected status: ${String(data.status)}`);
        setState('error');
      }
    } catch (err) {
      console.error('[run-section] fetch error:', err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
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
    <div className="flex flex-col gap-2">
      <Button
        variant={isError ? 'destructive' : 'default'}
        size="sm"
        className="rounded-md self-start"
        onClick={() => { console.log('[run-section-button] onClick fired', { runId, sectionId, state }); void handleClick(); }}
      >
        {isError ? `Retry: ${sectionLabel}` : `Run section: ${sectionLabel}`}
      </Button>
      {isError && errorMessage && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
