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
import type { OnboardingV2Data } from '@/lib/research-v2/onboarding-v2-types';
import { prefillFromCorpus } from '@/lib/research-v2/prefill-from-corpus';

import { WelcomeForm } from '@/components/research-v2/welcome-form';
import { CorpusStream } from '@/components/research-v2/corpus-stream';
import { ErrorRecovery } from '@/components/research-v2/error-recovery';
import { SectionShell } from '@/components/research-v2/section-shell';
import { OnboardingWizardV2 } from '@/components/research-v2/onboarding-wizard-v2';

const PARALLEL_SECTIONS_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS === 'true';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCorpusContext(websiteUrl: string): string {
  return `websiteUrl: ${websiteUrl}\nWebsite: ${websiteUrl}`;
}

const dispatchAllPositioningSections = async (runId: string): Promise<void> => {
  const sectionIds = [
    'positioningMarketCategory',
    'positioningBuyerICP',
    'positioningCompetitorLandscape',
    'positioningVoiceOfCustomer',
    'positioningDemandIntent',
    'positioningOfferDiagnostic',
  ] as const;

  await Promise.allSettled(
    sectionIds.map((sectionId) =>
      fetch('/api/research-v2/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, runId }),
      }),
    ),
  );
};

/**
 * Infer which research-v2 stage the session is in based on persisted data.
 * Returns null when there is no in-flight session to resume.
 *
 * Routing priority:
 *   1. Any positioning section row in research_results / job_status → 'sections' (audit live)
 *   2. onboarding_data populated → 'sections' (onboarding done, no positioning runs yet)
 *   3. corpus complete                       → 'onboarding'
 *   4. corpus pending / streaming            → 'corpus'
 *   5. no corpus at all                      → 'welcome' (caller treats null as welcome)
 */
function inferResumeState(
  runId: string,
  researchResults: Record<string, unknown> | null,
  onboardingData: Record<string, unknown> | null,
  jobStatus: Record<string, unknown> | null,
): ResearchV2State | null {
  if (!runId) return null;

  const hasPositioningResult = researchResults
    ? Object.keys(researchResults).some((key) => key.startsWith('positioning'))
    : false;
  const hasPositioningJob = jobStatus
    ? Object.keys(jobStatus).some((key) => key.startsWith('positioning'))
    : false;

  // 1. Audit is live — sections in progress or done
  if (hasPositioningResult || hasPositioningJob) {
    return { kind: 'sections', runId, currentSection: null };
  }

  // 2. Onboarding completed but no positioning runs yet — land on section picker
  if (onboardingData && Object.keys(onboardingData).length > 0) {
    return { kind: 'sections', runId, currentSection: null };
  }

  const corpus = researchResults?.deepResearchProgram as
    | { status?: string; data?: unknown }
    | undefined;

  // 4. No corpus result yet — corpus is still streaming
  if (!corpus) {
    return { kind: 'corpus', runId, phase: 'streaming' };
  }

  if (corpus.status !== 'complete') {
    return { kind: 'corpus', runId, phase: 'streaming' };
  }

  // 3. Corpus complete, no onboarding yet — map corpus onboardingFields to V2 prefill
  const corpusData = corpus.data as Record<string, unknown> | undefined;
  const onboardingFields = corpusData?.onboardingFields as
    | Record<string, { value?: unknown }>
    | undefined;

  const prefill: Partial<OnboardingV2Data> = onboardingFields
    ? prefillFromCorpus(onboardingFields)
    : {};

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
          jobStatus?: Record<string, unknown> | null;
          onboardingData?: Record<string, unknown> | null;
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
          data.onboardingData ?? null,
          data.jobStatus ?? null,
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
        jobStatus?: Record<string, unknown> | null;
        onboardingData?: Record<string, unknown> | null;
      };
      const resumed = inferResumeState(
        runId,
        data.researchResults ?? null,
        data.onboardingData ?? null,
        data.jobStatus ?? null,
      );
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
          const prefill: Partial<OnboardingV2Data> = prefillFromCorpus(onboardingFields);
          dispatch({ type: 'CORPUS_COMPLETE', prefill });
          if (PARALLEL_SECTIONS_ENABLED && runId) {
            void dispatchAllPositioningSections(runId);
          }
        } else {
          dispatch({ type: 'CORPUS_COMPLETE', prefill: {} });
          if (PARALLEL_SECTIONS_ENABLED && runId) {
            void dispatchAllPositioningSections(runId);
          }
        }
      } catch {
        dispatch({ type: 'CORPUS_COMPLETE', prefill: {} });
        if (PARALLEL_SECTIONS_ENABLED && runId) {
          void dispatchAllPositioningSections(runId);
        }
      }
    })();
  }, [state]);

  // -----------------------------------------------------------------------
  // Onboarding complete callback (Phase 3 mount)
  // POSTs wizard data to the persist endpoint, then advances state.
  // -----------------------------------------------------------------------

  const handleOnboardingComplete = useCallback(
    async (data: OnboardingV2Data) => {
      if (state.kind !== 'onboarding') return;
      const runId = state.runId;

      try {
        const res = await fetch('/api/research-v2/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ runId, data }),
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
        <OnboardingWizardV2
          initialData={state.prefill}
          onComplete={handleOnboardingComplete}
        />
      )}

      {state.kind === 'sections' && (
        <SectionShell
          runId={state.runId}
          currentSection={state.currentSection}
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
