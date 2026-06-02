'use client';

// /research-v3 — light Audit Reader variant.
// Mirrors /research-v2/page.tsx state machine exactly:
//   welcome → corpus → onboarding → sections → error
// Only the sections phase differs: mounts the v3 backend against the light reader shell.

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
import { buildCorpusContext } from '@/lib/research-v2/corpus-context';
import {
  buildUploadedDocumentMetadata,
  type UploadedDocumentContext,
} from '@/lib/research-v2/uploaded-document-context';

import { WelcomeForm } from '@/components/research-v2/welcome-form';
import { CorpusStream } from '@/components/research-v2/corpus-stream';
import { ErrorRecovery } from '@/components/research-v2/error-recovery';
import { OnboardingWizard } from '@/components/onboarding';
import { AuditReaderShell } from '@/components/research-v2/audit-reader-shell';
import { useOptionalShell } from '@/components/shell/shell-provider';
import {
  getReaderSectionFromParam,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';

// ---------------------------------------------------------------------------
// Helpers (identical to research-v2/page.tsx)
// ---------------------------------------------------------------------------

interface JourneySessionResponse {
  runId?: string | null;
  researchResults?: Record<string, unknown> | null;
  jobStatus?: Record<string, unknown> | null;
  onboardingData?: Record<string, unknown> | null;
  artifactSections?: Record<string, unknown> | null;
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
    artifactSections: data.artifactSections ?? null,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResearchV3Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();

  const [state, dispatch] = useReducer(researchV2Reducer, INITIAL_STATE);
  const [isCorpusStarting, setIsCorpusStarting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const lastUrlRef = useRef<string>('');
  const lastUploadedDocumentsRef = useRef<UploadedDocumentContext[]>([]);

  // -----------------------------------------------------------------------
  // Collapse the app nav to its icon strip while a run is in flight.
  // We capture the operator's prior sidebar state on entering the 'sections'
  // phase and restore it when leaving that phase (or on unmount). We read the
  // shell optionally so the page still mounts if rendered outside a provider
  // (e.g. unit tests); collapse is a no-op when no shell is present.
  // -----------------------------------------------------------------------
  const shell = useOptionalShell();
  const setSidebarCollapsed = shell?.setSidebarCollapsed;
  const sidebarCollapsed = shell?.sidebarCollapsed ?? false;
  const priorSidebarCollapsedRef = useRef<boolean | null>(null);
  const liveSidebarCollapsedRef = useRef(sidebarCollapsed);
  const inSectionsPhase = state.kind === 'sections';

  // Keep a live mirror of the current collapsed value so the collapse effect
  // can read the operator's most recent choice without re-running on toggle.
  useEffect(() => {
    liveSidebarCollapsedRef.current = sidebarCollapsed;
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!inSectionsPhase || !setSidebarCollapsed) return undefined;
    priorSidebarCollapsedRef.current = liveSidebarCollapsedRef.current;
    setSidebarCollapsed(true);
    return () => {
      if (priorSidebarCollapsedRef.current !== null) {
        setSidebarCollapsed(priorSidebarCollapsedRef.current);
        priorSidebarCollapsedRef.current = null;
      }
    };
  }, [inSectionsPhase, setSidebarCollapsed]);

  // -----------------------------------------------------------------------
  // URL search param sync
  // -----------------------------------------------------------------------

  const runIdFromUrl = searchParams.get('runId');
  const activeSectionId = getReaderSectionFromParam(searchParams.get('section'));

  const setRunIdInUrl = useCallback(
    (runId: string): void => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('runId', runId);
      router.replace(`/research-v3?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const clearRunIdInUrl = useCallback((): void => {
    router.replace('/research-v3', { scroll: false });
  }, [router]);

  const setReaderSectionInUrl = useCallback(
    (runId: string, sectionId: ReaderSectionId): void => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('runId', runId);
      params.set('section', sectionId);
      router.replace(`/research-v3?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // -----------------------------------------------------------------------
  // Resume-on-revisit
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

  const hydrateFromRunId = useCallback(
    async (runId: string): Promise<void> => {
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) {
          console.warn('[research-v3] session hydrate failed', {
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
        console.warn('[research-v3] session hydrate failed', {
          runId,
          error: describeError(error),
        });
      }
    },
    [setRunIdInUrl],
  );

  useEffect(() => {
    if (!isUserLoaded || !user) return;
    if (hasAttemptedResume.current) return;
    hasAttemptedResume.current = true;

    if (runIdFromUrl) {
      void hydrateFromRunId(runIdFromUrl);
      return;
    }

    void (async () => {
      try {
        const res = await fetch('/api/journey/session', {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!res.ok) return;

        const data = (await res.json()) as JourneySessionResponse;
        if (!data.runId) return;

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
        console.warn('[research-v3] latest session lookup failed', {
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

  const startCorpus = useCallback(
    async (
      websiteUrl: string,
      uploadedDocuments: UploadedDocumentContext[] = [],
    ) => {
      lastUrlRef.current = websiteUrl;
      lastUploadedDocumentsRef.current = uploadedDocuments;
      setIsCorpusStarting(true);

      try {
        const metadata = {
          websiteUrl,
          ...buildUploadedDocumentMetadata(uploadedDocuments),
        };
        const sessionRes = await fetch('/api/journey/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ metadata }),
        });

        if (!sessionRes.ok) {
          const errBody = (await sessionRes.json().catch(() => ({}))) as {
            error?: string;
          };
          dispatch({
            type: 'ERROR',
            from: 'corpus',
            message:
              errBody.error ??
              `Failed to create journey session (HTTP ${sessionRes.status})`,
          });
          return;
        }

        const sessionData = (await sessionRes.json()) as {
          runId?: string | null;
        };
        if (!sessionData.runId) {
          dispatch({
            type: 'ERROR',
            from: 'corpus',
            message: 'Journey session response missing runId',
          });
          return;
        }
        const runId: string = sessionData.runId;

        dispatch({ type: 'CORPUS_START', runId });
        setRunIdInUrl(runId);

        const context = buildCorpusContext({
          websiteUrl,
          uploadedDocuments,
        });
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
            message:
              body.error ?? `Dispatch failed (HTTP ${dispatchRes.status})`,
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
    },
    [setRunIdInUrl],
  );

  // -----------------------------------------------------------------------
  // Corpus completion polling
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
          console.warn('[research-v3] corpus completion session fetch failed', {
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
        console.warn('[research-v3] corpus completion session fetch failed', {
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
  // Onboarding complete
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
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          dispatch({
            type: 'ERROR',
            from: 'onboarding',
            message:
              body.error ??
              `Failed to save onboarding data (HTTP ${res.status})`,
          });
          return;
        }
      } catch (err) {
        dispatch({
          type: 'ERROR',
          from: 'onboarding',
          message:
            err instanceof Error
              ? err.message
              : 'Failed to save onboarding data',
        });
        return;
      }

      dispatch({ type: 'ONBOARDING_COMPLETE' });

      void fetch('/api/research-v2/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ run_id: runId, executionMode: 'lab' }),
      }).catch((err) => {
        console.warn('[research-v3] orchestrate kickoff failed:', err);
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
        const context = buildCorpusContext({
          websiteUrl: lastUrlRef.current,
          uploadedDocuments: lastUploadedDocumentsRef.current,
        });
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
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
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
            last updated {new Date(resumeBanner.updatedAt).toLocaleString()}
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

      {state.kind === 'welcome' && (
        <WelcomeForm onSubmit={startCorpus} isLoading={isCorpusStarting} />
      )}

      {state.kind === 'corpus' && userId && (
        <CorpusStream
          userId={userId}
          runId={state.runId}
          onComplete={handleCorpusComplete}
        />
      )}

      {state.kind === 'onboarding' && (
        <div className="h-full overflow-y-auto px-4 py-10">
          <OnboardingWizard
            initialData={state.prefill}
            initialPrefillMetadata={state.prefillMetadata}
            onComplete={handleOnboardingComplete}
          />
        </div>
      )}

      {state.kind === 'sections' && (
        <AuditReaderShell
          runId={state.runId}
          activeSectionId={activeSectionId}
          onSectionChange={(sectionId: ReaderSectionId): void =>
            setReaderSectionInUrl(state.runId, sectionId)
          }
        />
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
