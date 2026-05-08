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
  type ResearchV2State,
} from '@/lib/research-v2/state-machine';
import type { OnboardingFormData } from '@/lib/onboarding/types';

import { WelcomeForm } from '@/components/research-v2/welcome-form';
import { CorpusStream } from '@/components/research-v2/corpus-stream';
import { ErrorRecovery } from '@/components/research-v2/error-recovery';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCorpusContext(websiteUrl: string): string {
  return `websiteUrl: ${websiteUrl}\nWebsite: ${websiteUrl}`;
}

/**
 * Infer which research-v2 stage the session is in based on persisted data.
 * Returns null when there is no in-flight session to resume.
 */
function inferResumeState(
  runId: string,
  researchResults: Record<string, unknown> | null,
): ResearchV2State | null {
  if (!runId) return null;

  const corpus = researchResults?.deepResearchProgram as
    | { status?: string; data?: unknown }
    | undefined;

  // No corpus result yet — corpus is still streaming
  if (!corpus) {
    return { kind: 'corpus', runId, phase: 'streaming' };
  }

  if (corpus.status !== 'complete') {
    return { kind: 'corpus', runId, phase: 'streaming' };
  }

  // Corpus complete — infer onboarding prefill from corpus data
  const corpusData = corpus.data as Record<string, unknown> | undefined;
  const onboardingFields = corpusData?.onboardingFields as
    | Record<string, { value?: unknown }>
    | undefined;

  const prefill: Partial<OnboardingFormData> = {};
  if (onboardingFields) {
    for (const [key, field] of Object.entries(onboardingFields)) {
      if (field?.value && typeof field.value === 'string') {
        (prefill as Record<string, unknown>)[key] = field.value;
      }
    }
  }

  // TODO Phase 3+: detect if onboarding was completed (no marker in DB yet)
  // For now, always resume at onboarding if corpus is complete.
  return { kind: 'onboarding', runId, prefill };
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

  function setRunIdInUrl(runId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('runId', runId);
    router.replace(`/research-v2?${params.toString()}`, { scroll: false });
  }

  function clearRunIdInUrl() {
    router.replace('/research-v2', { scroll: false });
  }

  // -----------------------------------------------------------------------
  // Resume-on-revisit: on mount, check for an in-flight session
  // -----------------------------------------------------------------------

  const [resumeBanner, setResumeBanner] = useState<{
    hostname: string;
    updatedAt: string;
    runId: string;
  } | null>(null);
  const hasAttemptedResume = useRef(false);

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
        if (!res.ok) return;

        const data = (await res.json()) as {
          runId?: string | null;
          researchResults?: Record<string, unknown> | null;
          updatedAt?: string | null;
          metadata?: Record<string, unknown> | null;
        };

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

        const resumed = inferResumeState(
          data.runId,
          data.researchResults ?? null,
        );
        if (!resumed) return;

        setResumeBanner({
          hostname,
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          runId: data.runId,
        });
      } catch {
        // Silently ignore — resume is best-effort
      }
    })();
  }, [isUserLoaded, user, runIdFromUrl]);

  async function hydrateFromRunId(runId: string) {
    try {
      const res = await fetch(`/api/journey/session?runId=${runId}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        researchResults?: Record<string, unknown> | null;
      };
      const resumed = inferResumeState(runId, data.researchResults ?? null);
      if (resumed) {
        dispatch({ type: 'RESUME', state: resumed });
        setRunIdInUrl(runId);
      }
    } catch {
      // Silently ignore
    }
  }

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
      const dispatchRes = await fetch('/api/journey/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          section: 'deepResearchProgram',
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Corpus complete callback
  // -----------------------------------------------------------------------

  const handleCorpusComplete = useCallback(() => {
    if (state.kind !== 'corpus') return;
    dispatch({ type: 'CORPUS_FINALIZING' });

    // Fetch corpus results and build prefill, then advance to onboarding
    const runId = state.runId;
    void (async () => {
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = (await res.json()) as {
            researchResults?: Record<string, unknown> | null;
          };
          const corpus = data.researchResults?.deepResearchProgram as
            | { data?: { onboardingFields?: Record<string, { value?: unknown }> } }
            | undefined;
          const onboardingFields = corpus?.data?.onboardingFields ?? {};
          const prefill: Partial<OnboardingFormData> = {};
          for (const [key, field] of Object.entries(onboardingFields)) {
            if (field?.value && typeof field.value === 'string') {
              (prefill as Record<string, unknown>)[key] = field.value;
            }
          }
          dispatch({ type: 'CORPUS_COMPLETE', prefill });
        } else {
          dispatch({ type: 'CORPUS_COMPLETE', prefill: {} });
        }
      } catch {
        dispatch({ type: 'CORPUS_COMPLETE', prefill: {} });
      }
    })();
  }, [state]);

  // -----------------------------------------------------------------------
  // Onboarding complete callback (Phase 3 mount)
  // Wizard persists its own data to Supabase via the existing journey path.
  // Page just needs the trigger to advance to the sections stage.
  // -----------------------------------------------------------------------

  const handleOnboardingComplete = useCallback(
    (_data: OnboardingFormData) => {
      dispatch({ type: 'ONBOARDING_COMPLETE' });
    },
    [],
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
        const res = await fetch('/api/journey/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            section: 'deepResearchProgram',
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <OnboardingWizard
          initialData={state.prefill}
          onComplete={handleOnboardingComplete}
        />
      )}

      {state.kind === 'sections' && (
        // Phase 4 will mount the section UI here.
        <div className="p-8 text-muted-foreground">
          Section view — Phase 4 will mount the section shell here.
        </div>
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
