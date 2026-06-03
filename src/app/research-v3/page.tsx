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

interface ProfileOnboardingCache {
  cachedOnboarding: Record<string, unknown> | null;
  websiteUrl: string | null;
}

function buildPersistedSession(
  runId: string,
  data: JourneySessionResponse,
  cachedOnboardingData?: Record<string, unknown> | null,
): PersistedResearchV2Session {
  return {
    runId,
    researchResults: data.researchResults ?? null,
    onboardingData: data.onboardingData ?? null,
    jobStatus: data.jobStatus ?? null,
    artifactSections: data.artifactSections ?? null,
    cachedOnboardingData: cachedOnboardingData ?? null,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const payload = await response.json();
    if (isRecord(payload) && typeof payload.error === 'string') {
      return payload.error;
    }
  } catch {
    return `${fallback} (HTTP ${response.status})`;
  }

  return `${fallback} (HTTP ${response.status})`;
}

function parseProfileOnboardingCache(
  payload: unknown,
): ProfileOnboardingCache | null {
  if (!isRecord(payload)) return null;

  const cachedOnboarding = isRecord(payload.cachedOnboarding)
    ? payload.cachedOnboarding
    : null;
  const websiteUrl =
    typeof payload.websiteUrl === 'string' && payload.websiteUrl.trim().length > 0
      ? payload.websiteUrl.trim()
      : null;

  return { cachedOnboarding, websiteUrl };
}

function normalizeWebsiteUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const candidate = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  try {
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function resolveProfileRerunWebsiteUrl(
  profileCache: ProfileOnboardingCache | null,
  data?: JourneySessionResponse,
): string | null {
  return (
    normalizeWebsiteUrl(profileCache?.websiteUrl) ??
    normalizeWebsiteUrl(data?.metadata?.websiteUrl) ??
    normalizeWebsiteUrl(data?.metadata?.Website) ??
    null
  );
}

function hasCorpusRunStarted(data: JourneySessionResponse): boolean {
  return Boolean(
    data.researchResults?.deepResearchProgram ||
      data.jobStatus?.deepResearchProgram,
  );
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
  const profileIdFromUrl = searchParams.get('profileId');
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
  const profileCacheRef = useRef<{
    profileId: string;
    cache: ProfileOnboardingCache | null;
  } | null>(null);

  useEffect(() => {
    activeCorpusRunIdRef.current = state.kind === 'corpus' ? state.runId : null;
  }, [state]);

  const fetchProfileOnboardingCache = useCallback(
    async (profileId: string): Promise<ProfileOnboardingCache | null> => {
      const cached = profileCacheRef.current;
      if (cached?.profileId === profileId) {
        return cached.cache;
      }

      const res = await fetch(
        `/api/profiles/${encodeURIComponent(profileId)}/cached-onboarding`,
        {
          cache: 'no-store',
          credentials: 'same-origin',
        },
      );

      if (!res.ok) {
        console.warn('[research-v3] profile onboarding cache fetch failed', {
          profileId,
          status: res.status,
        });
        profileCacheRef.current = { profileId, cache: null };
        return null;
      }

      const payload = await res.json().catch((error: unknown) => {
        console.warn('[research-v3] profile onboarding cache returned invalid JSON', {
          profileId,
          error: describeError(error),
        });
        return null;
      });
      const cache = parseProfileOnboardingCache(payload);
      profileCacheRef.current = { profileId, cache };
      return cache;
    },
    [],
  );

  const dispatchCorpusRun = useCallback(
    async ({
      runId,
      websiteUrl,
      uploadedDocuments = [],
    }: {
      runId: string;
      websiteUrl: string;
      uploadedDocuments?: UploadedDocumentContext[];
    }): Promise<void> => {
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
        throw new Error(
          await readErrorMessage(
            dispatchRes,
            `Corpus dispatch failed for run ${runId}`,
          ),
        );
      }
    },
    [],
  );

  const startProfileRerun = useCallback(
    async (profileId: string): Promise<void> => {
      setIsCorpusStarting(true);
      setResumeBanner(null);

      let runId = '';
      try {
        const [profileCache, sessionRes] = await Promise.all([
          fetchProfileOnboardingCache(profileId),
          fetch('/api/journey/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ profileId }),
          }),
        ]);

        if (!sessionRes.ok) {
          throw new Error(
            await readErrorMessage(
              sessionRes,
              `Failed to create journey session for profile ${profileId}`,
            ),
          );
        }

        const sessionData = (await sessionRes.json()) as {
          runId?: string | null;
        };
        if (!sessionData.runId) {
          throw new Error(
            `Journey session response missing runId for profile ${profileId}`,
          );
        }
        runId = sessionData.runId;

        dispatch({ type: 'CORPUS_START', runId });
        setRunIdInUrl(runId);

        const websiteUrl = resolveProfileRerunWebsiteUrl(profileCache);
        if (!websiteUrl) {
          dispatch({
            type: 'ERROR',
            from: 'corpus',
            message: `Profile ${profileId} is missing a website URL for a fresh audit run`,
          });
          return;
        }

        lastUrlRef.current = websiteUrl;
        lastUploadedDocumentsRef.current = [];
        await dispatchCorpusRun({ runId, websiteUrl });
        dispatch({ type: 'CORPUS_STREAMING' });
      } catch (error) {
        if (runId) {
          dispatch({ type: 'CORPUS_START', runId });
        }
        dispatch({
          type: 'ERROR',
          from: 'corpus',
          message: describeError(error),
        });
      } finally {
        setIsCorpusStarting(false);
      }
    },
    [dispatchCorpusRun, fetchProfileOnboardingCache, setRunIdInUrl],
  );

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
        const profileCache = profileIdFromUrl
          ? await fetchProfileOnboardingCache(profileIdFromUrl)
          : null;
        const resumed = inferPersistedResearchV2State(
          buildPersistedSession(runId, data, profileCache?.cachedOnboarding),
        );
        if (resumed) {
          if (
            profileIdFromUrl &&
            resumed.kind === 'corpus' &&
            !hasCorpusRunStarted(data)
          ) {
            dispatch({ type: 'CORPUS_START', runId });
            setRunIdInUrl(runId);

            const websiteUrl = resolveProfileRerunWebsiteUrl(profileCache, data);
            if (!websiteUrl) {
              dispatch({
                type: 'ERROR',
                from: 'corpus',
                message: `Profile ${profileIdFromUrl} is missing a website URL for a fresh audit run`,
              });
              return;
            }

            lastUrlRef.current = websiteUrl;
            lastUploadedDocumentsRef.current = [];
            await dispatchCorpusRun({ runId, websiteUrl });
            dispatch({ type: 'CORPUS_STREAMING' });
            return;
          }

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
    [
      dispatchCorpusRun,
      fetchProfileOnboardingCache,
      profileIdFromUrl,
      setRunIdInUrl,
    ],
  );

  useEffect(() => {
    if (!isUserLoaded || !user) return;
    if (hasAttemptedResume.current) return;
    hasAttemptedResume.current = true;

    if (runIdFromUrl) {
      void hydrateFromRunId(runIdFromUrl);
      return;
    }

    if (profileIdFromUrl) {
      void startProfileRerun(profileIdFromUrl);
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
  }, [
    hydrateFromRunId,
    isUserLoaded,
    profileIdFromUrl,
    runIdFromUrl,
    startProfileRerun,
    user,
  ]);

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

        await dispatchCorpusRun({
          runId,
          websiteUrl,
          uploadedDocuments,
        });

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
    [dispatchCorpusRun, setRunIdInUrl],
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
        const profileCache = profileIdFromUrl
          ? await fetchProfileOnboardingCache(profileIdFromUrl)
          : null;
        const inferred = inferPersistedResearchV2State(
          buildPersistedSession(runId, data, profileCache?.cachedOnboarding),
        );

        if (activeCorpusRunIdRef.current !== runId) return;

        if (inferred?.kind === 'onboarding') {
          corpusTransitionedRunIdsRef.current.add(runId);
          dispatch({
            type: 'CORPUS_COMPLETE',
            runId,
            prefill: inferred.prefill,
            prefillMetadata: inferred.prefillMetadata,
            corpusSources: inferred.corpusSources,
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
    [fetchProfileOnboardingCache, profileIdFromUrl],
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
      {state.kind === 'welcome' && (
        <div className="flex h-full flex-col">
          {/* Resume notice — subtle, in-flow (no longer a fixed bar over the shell) */}
          {resumeBanner && (
            <div className="mx-auto mt-6 flex w-full max-w-lg items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] shadow-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                Continue your audit on{' '}
                <strong className="font-medium text-foreground">
                  {resumeBanner.hostname || 'your last session'}
                </strong>
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmResume}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={handleDismissResume}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div className="min-h-0 flex-1">
            <WelcomeForm onSubmit={startCorpus} isLoading={isCorpusStarting} />
          </div>
        </div>
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
            corpusSources={state.corpusSources}
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
