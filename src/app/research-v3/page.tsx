'use client';

// /research-v3 — Audit Reader front door.
// Flow (LOCK 2026-06-24): user fills onboarding → submit → research.
// No corpus-before-onboarding gate. Onboarding is user-filled from blank.
//   welcome → onboarding → sections → error

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
import {
  buildUploadedDocumentMetadata,
  type UploadedDocumentContext,
} from '@/lib/research-v2/uploaded-document-context';

import { WelcomeForm } from '@/components/research-v2/welcome-form';
import { ErrorRecovery } from '@/components/research-v2/error-recovery';
import { OnboardingWizard } from '@/components/onboarding';
import { AuditReaderShell } from '@/components/research-v2/audit-reader-shell';
import { useOptionalShell } from '@/components/shell/shell-provider';
import {
  getReaderSectionFromParam,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResearchV3Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();

  const [state, dispatch] = useReducer(researchV2Reducer, INITIAL_STATE);
  const [isStarting, setIsStarting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const lastUrlRef = useRef<string>('');
  const lastUploadedDocumentsRef = useRef<UploadedDocumentContext[]>([]);

  // -----------------------------------------------------------------------
  // Collapse the app nav to its icon strip while a run is in flight.
  // -----------------------------------------------------------------------
  const shell = useOptionalShell();
  const setSidebarCollapsed = shell?.setSidebarCollapsed;
  const sidebarCollapsed = shell?.sidebarCollapsed ?? false;
  const priorSidebarCollapsedRef = useRef<boolean | null>(null);
  const liveSidebarCollapsedRef = useRef(sidebarCollapsed);
  const inSectionsPhase = state.kind === 'sections';

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
  const profileCacheRef = useRef<{
    profileId: string;
    cache: ProfileOnboardingCache | null;
  } | null>(null);

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

  const startProfileRerun = useCallback(
    async (profileId: string): Promise<void> => {
      setIsStarting(true);
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

        const websiteUrl = resolveProfileRerunWebsiteUrl(profileCache);
        lastUrlRef.current = websiteUrl ?? '';
        lastUploadedDocumentsRef.current = [];

        dispatch({
          type: 'RESUME_ONBOARDING',
          runId,
          initialData: profileCache?.cachedOnboarding as
            | Partial<OnboardingV2Data>
            | undefined,
        });
        setRunIdInUrl(runId);
      } catch (error) {
        if (runId) {
          dispatch({ type: 'ONBOARDING_START', runId });
        }
        dispatch({
          type: 'ERROR',
          from: 'onboarding',
          message: describeError(error),
        });
      } finally {
        setIsStarting(false);
      }
    },
    [fetchProfileOnboardingCache, setRunIdInUrl],
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
    [fetchProfileOnboardingCache, profileIdFromUrl, setRunIdInUrl],
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
  // Welcome submit — mint a runId and enter onboarding (user-filled)
  // -----------------------------------------------------------------------

  const startOnboarding = useCallback(
    async (
      websiteUrl: string,
      uploadedDocuments: UploadedDocumentContext[] = [],
    ) => {
      lastUrlRef.current = websiteUrl;
      lastUploadedDocumentsRef.current = uploadedDocuments;
      setIsStarting(true);

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
            from: 'onboarding',
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
            from: 'onboarding',
            message: 'Journey session response missing runId',
          });
          return;
        }
        const runId: string = sessionData.runId;

        dispatch({ type: 'ONBOARDING_START', runId });
        setRunIdInUrl(runId);
      } catch (err) {
        dispatch({
          type: 'ERROR',
          from: 'onboarding',
          message:
            err instanceof Error ? err.message : 'Failed to start onboarding',
        });
      } finally {
        setIsStarting(false);
      }
    },
    [setRunIdInUrl],
  );

  // -----------------------------------------------------------------------
  // Onboarding complete — persist, then orchestrate sections
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
      if (state.from === 'onboarding' && state.runId) {
        // Re-enter the onboarding phase for the same runId so the user can
        // resubmit. The session row already exists.
        dispatch({ type: 'ONBOARDING_START', runId: state.runId });
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

  return (
    <>
      {state.kind === 'welcome' && (
        <div className="flex h-full flex-col">
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
            <WelcomeForm onSubmit={startOnboarding} isLoading={isStarting} />
          </div>
        </div>
      )}

      {state.kind === 'onboarding' && (
        <div className="h-full overflow-y-auto px-4 py-10">
          <OnboardingWizard
            initialData={state.initialData}
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