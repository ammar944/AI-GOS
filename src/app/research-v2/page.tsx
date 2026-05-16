'use client';

// /research-v2 — top-level page component.
// Owns the 5-state machine (welcome → corpus → onboarding → sections → error).
// Phase 3 mounts the onboarding wizard. Phase 4 will replace the sections stub.

import { useReducer, useEffect, useCallback, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import {
  researchV2Reducer,
  INITIAL_STATE,
} from '@/lib/research-v2/state-machine';
import type {
  OnboardingReviewMetadata,
  OnboardingV2Data,
} from '@/lib/research-v2/onboarding-v2-types';
import {
  inferPersistedResearchV2State,
  type PersistedResearchV2Session,
} from '@/lib/research-v2/session-state';

import { WelcomeForm } from '@/components/research-v2/welcome-form';
import { CorpusStream } from '@/components/research-v2/corpus-stream';
import { ErrorRecovery } from '@/components/research-v2/error-recovery';
import { AgentArtifactSurface } from '@/components/research-v2/agent-artifact-surface';
import { OnboardingWizardV2 } from '@/components/research-v2/onboarding-wizard-v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCorpusContext(websiteUrl: string): string {
  return `websiteUrl: ${websiteUrl}\nWebsite: ${websiteUrl}`;
}

interface JourneySessionResponse {
  runId?: string | null;
  researchResults?: Record<string, unknown> | null;
  jobStatus?: Record<string, unknown> | null;
  onboardingData?: Record<string, unknown> | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

function buildPersistedSession(
  runId: string,
  data: JourneySessionResponse,
): PersistedResearchV2Session {
  return {
    runId,
    researchResults: data.researchResults ?? null,
    onboardingData: data.onboardingData ?? null,
    jobStatus: data.jobStatus ?? null,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResearchV2Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();

  const [state, dispatch] = useReducer(researchV2Reducer, INITIAL_STATE);
  const [isCorpusStarting, setIsCorpusStarting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Track last submitted URL so Retry can re-dispatch
  const lastUrlRef = useRef<string>('');

  // -----------------------------------------------------------------------
  // URL search param sync — persist runId across reloads
  // -----------------------------------------------------------------------

  const runIdFromUrl = searchParams.get('runId');

  const setRunIdInUrl = useCallback((runId: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('runId', runId);
    router.replace(`/research-v2?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const clearRunIdInUrl = useCallback((): void => {
    router.replace('/research-v2', { scroll: false });
  }, [router]);

  // -----------------------------------------------------------------------
  // Resume-on-revisit: on mount, check for an in-flight session
  // -----------------------------------------------------------------------

  const [resumeBanner, setResumeBanner] = useState<{
    hostname: string;
    updatedAt: string;
    runId: string;
  } | null>(null);
  const hasAttemptedResume = useRef(false);
  const activeCorpusRunIdRef = useRef<string | null>(null);
  const corpusTransitionedRunIdsRef = useRef<Set<string>>(new Set());
  const corpusCompletionFetchesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    activeCorpusRunIdRef.current = state.kind === 'corpus' ? state.runId : null;
  }, [state]);

  const hydrateFromRunId = useCallback(async (runId: string): Promise<void> => {
    try {
      const res = await fetch(`/api/journey/session?runId=${runId}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) {
        console.warn('[research-v2] session hydrate failed', {
          runId,
          status: res.status,
        });
        return;
      }
      const data = (await res.json()) as JourneySessionResponse;
      const resumed = inferPersistedResearchV2State(
        buildPersistedSession(runId, data),
      );
      if (resumed) {
        dispatch({ type: 'RESUME', state: resumed });
        setRunIdInUrl(runId);
      }
    } catch (error) {
      console.warn('[research-v2] session hydrate failed', {
        runId,
        error: describeError(error),
      });
    }
  }, [setRunIdInUrl]);

  useEffect(() => {
    if (!isUserLoaded || !user) return;
    if (hasAttemptedResume.current) return;
    hasAttemptedResume.current = true;

    // If URL already has a runId, use that directly
    if (runIdFromUrl) {
      void hydrateFromRunId(runIdFromUrl);
      return;
    }

    // Otherwise, fetch the latest session
    void (async () => {
      try {
        const res = await fetch('/api/journey/session', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          console.warn('[research-v2] latest session lookup failed', {
            status: res.status,
          });
          return;
        }

        const data = (await res.json()) as JourneySessionResponse;

        if (!data.runId) return;

        // Check if session has a website URL in metadata
        const websiteUrl =
          (data.metadata?.websiteUrl as string | undefined) ??
          (data.metadata?.Website as string | undefined) ??
          '';
        let hostname = websiteUrl;
        try {
          hostname = new URL(websiteUrl).hostname;
        } catch {
          // keep raw
        }

        const resumed = inferPersistedResearchV2State(
          buildPersistedSession(data.runId, data),
        );
        if (!resumed) return;

        setResumeBanner({
          hostname,
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          runId: data.runId,
        });
      } catch (error) {
        console.warn('[research-v2] latest session lookup failed', {
          error: describeError(error),
        });
      }
    })();
  }, [hydrateFromRunId, isUserLoaded, runIdFromUrl, user]);

  function handleConfirmResume() {
    if (!resumeBanner) return;
    setResumeBanner(null);
    void hydrateFromRunId(resumeBanner.runId);
  }

  function handleDismissResume() {
    setResumeBanner(null);
  }

  // -----------------------------------------------------------------------
  // Corpus dispatch
  // -----------------------------------------------------------------------

  const startCorpus = useCallback(async (websiteUrl: string) => {
    lastUrlRef.current = websiteUrl;
    setIsCorpusStarting(true);

    try {
      // Create a new session row
      const sessionRes = await fetch('/api/journey/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });

      let runId: string = crypto.randomUUID();
      if (sessionRes.ok) {
        const sessionData = (await sessionRes.json()) as {
          runId?: string | null;
        };
        if (sessionData.runId) {
          runId = sessionData.runId;
        }
      }

      // Transition state to corpus
      dispatch({ type: 'CORPUS_START', runId });
      setRunIdInUrl(runId);

      // Dispatch corpus runner
      const context = buildCorpusContext(websiteUrl);
      const dispatchRes = await fetch('/api/research-v2/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          sectionId: 'deepResearchProgram',
          runId,
          context,
        }),
      });

      if (!dispatchRes.ok) {
        const body = (await dispatchRes.json().catch(() => ({}))) as {
          error?: string;
        };
        dispatch({
          type: 'ERROR',
          from: 'corpus',
          message: body.error ?? `Dispatch failed (HTTP ${dispatchRes.status})`,
        });
        return;
      }

      dispatch({ type: 'CORPUS_STREAMING' });
    } catch (err) {
      dispatch({
        type: 'ERROR',
        from: 'corpus',
        message:
          err instanceof Error ? err.message : 'Failed to start research',
      });
    } finally {
      setIsCorpusStarting(false);
    }
  }, [setRunIdInUrl]);

  // -----------------------------------------------------------------------
  // Authoritative corpus completion polling
  // -----------------------------------------------------------------------

  const attemptCorpusCompletionTransition = useCallback(
    async (runId: string, source: 'activity' | 'poll'): Promise<void> => {
      if (corpusTransitionedRunIdsRef.current.has(runId)) return;
      if (corpusCompletionFetchesRef.current.has(runId)) return;

      corpusCompletionFetchesRef.current.add(runId);
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          console.warn('[research-v2] corpus completion session fetch failed', {
            runId,
            source,
            status: res.status,
          });
          return;
        }

        const data = (await res.json()) as JourneySessionResponse;
        const inferred = inferPersistedResearchV2State(
          buildPersistedSession(runId, data),
        );

        if (activeCorpusRunIdRef.current !== runId) return;

        if (inferred?.kind === 'onboarding') {
          corpusTransitionedRunIdsRef.current.add(runId);
          dispatch({
            type: 'CORPUS_COMPLETE',
            runId,
            prefill: inferred.prefill,
            prefillMetadata: inferred.prefillMetadata,
          });
          return;
        }

        if (inferred?.kind === 'sections') {
          corpusTransitionedRunIdsRef.current.add(runId);
          dispatch({ type: 'RESUME', state: inferred });
        }
      } catch (error) {
        console.warn('[research-v2] corpus completion session fetch failed', {
          runId,
          source,
          error: describeError(error),
        });
      } finally {
        corpusCompletionFetchesRef.current.delete(runId);
      }
    },
    [],
  );

  useEffect(() => {
    if (state.kind !== 'corpus') return;

    const runId = state.runId;
    void attemptCorpusCompletionTransition(runId, 'poll');

    const intervalId = window.setInterval(() => {
      void attemptCorpusCompletionTransition(runId, 'poll');
    }, 2_500);

    return () => window.clearInterval(intervalId);
  }, [attemptCorpusCompletionTransition, state]);

  const handleCorpusComplete = useCallback(() => {
    if (state.kind !== 'corpus') return;
    dispatch({ type: 'CORPUS_FINALIZING' });
    void attemptCorpusCompletionTransition(state.runId, 'activity');
  }, [attemptCorpusCompletionTransition, state]);

  // -----------------------------------------------------------------------
  // Onboarding complete callback (Phase 3 mount)
  // POSTs wizard data to the persist endpoint, then advances state.
  // -----------------------------------------------------------------------

  const handleOnboardingComplete = useCallback(
    async (data: OnboardingV2Data, reviewMetadata: OnboardingReviewMetadata) => {
      if (state.kind !== 'onboarding') return;
      const runId = state.runId;

      try {
        const res = await fetch('/api/research-v2/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ runId, data, reviewMetadata }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          dispatch({
            type: 'ERROR',
            from: 'onboarding',
            message: body.error ?? `Failed to save onboarding data (HTTP ${res.status})`,
          });
          return;
        }
      } catch (err) {
        dispatch({
          type: 'ERROR',
          from: 'onboarding',
          message: err instanceof Error ? err.message : 'Failed to save onboarding data',
        });
        return;
      }

      dispatch({ type: 'ONBOARDING_COMPLETE' });

      // Phase 7.5 kickoff: seed the parent + six queued children and
      // fire-and-forget the worker /orchestrate route. The page-level
      // AgentArtifactSurface polls /api/research-v2/audit-state for live
      // chip + section state once it mounts.
      void fetch('/api/research-v2/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ run_id: runId }),
      }).catch((err) => {
        console.warn('[research-v2] orchestrate kickoff failed:', err);
      });
    },
    [state],
  );

  // -----------------------------------------------------------------------
  // Error recovery
  // -----------------------------------------------------------------------

  const handleRetry = useCallback(async () => {
    if (state.kind !== 'error') return;
    setIsRetrying(true);

    try {
      if (state.from === 'corpus') {
        dispatch({ type: 'CORPUS_START', runId: state.runId });
        const context = buildCorpusContext(lastUrlRef.current);
        const res = await fetch('/api/research-v2/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            sectionId: 'deepResearchProgram',
            runId: state.runId,
            context,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          dispatch({
            type: 'ERROR',
            from: 'corpus',
            message: body.error ?? `Retry failed (HTTP ${res.status})`,
          });
        } else {
          dispatch({ type: 'CORPUS_STREAMING' });
        }
      }
    } finally {
      setIsRetrying(false);
    }
  }, [state]);

  const handleStartFresh = useCallback(async () => {
    // Mark current run abandoned (best-effort; no status column — just clear URL)
    clearRunIdInUrl();
    setResumeBanner(null);
    dispatch({ type: 'RESET_TO_WELCOME' });
  }, [clearRunIdInUrl]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const userId = user?.id ?? null;

  return (
    <>
      {/* Resume banner */}
      {resumeBanner && state.kind === 'welcome' && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-muted px-4 py-2.5 text-sm border-b">
          <span>
            Resuming research on{' '}
            <strong>{resumeBanner.hostname || 'previous session'}</strong> —{' '}
            last updated{' '}
            {new Date(resumeBanner.updatedAt).toLocaleString()}
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleConfirmResume}
              className="underline underline-offset-2 hover:no-underline"
            >
              Resume
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={handleDismissResume}
              className="underline underline-offset-2 hover:no-underline"
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      {/* State machine render */}
      {state.kind === 'welcome' && (
        <WelcomeForm
          onSubmit={startCorpus}
          isLoading={isCorpusStarting}
        />
      )}

      {state.kind === 'corpus' && userId && (
        <CorpusStream
          userId={userId}
          runId={state.runId}
          onComplete={handleCorpusComplete}
        />
      )}

      {state.kind === 'onboarding' && (
        <OnboardingWizardV2
          initialData={state.prefill}
          initialPrefillMetadata={state.prefillMetadata}
          onComplete={handleOnboardingComplete}
        />
      )}

      {state.kind === 'sections' && (
        <AgentArtifactSurface runId={state.runId} />
      )}

      {state.kind === 'error' && (
        <ErrorRecovery
          state={state}
          onRetry={handleRetry}
          onStartFresh={handleStartFresh}
          isRetrying={isRetrying}
        />
      )}
    </>
  );
}
