'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
} from 'ai';
import { useUser } from '@clerk/nextjs';
import { AppShell, AppSidebar, ShellProvider } from '@/components/shell';
import { ResumePrompt } from '@/components/journey/resume-prompt';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import { getJourneyApprovalState, type JourneyReviewSection } from '@/lib/ai/journey-review-gates';
import { shouldAutoSendJourneyMessages } from '@/lib/journey/chat-auto-send';
import { extractResearchDispatchState } from '@/lib/journey/research-dispatch-state';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import {
  shouldIgnoreDispatchError,
} from '@/lib/journey/research-recovery';
import {
  getJourneySession,
  clearJourneySession,
} from '@/lib/storage/local-storage';
import {
  hasAnsweredFields,
  getAnsweredFields,
} from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
import type { TerminalLogEntry } from '@/components/journey/terminal-stream';
import { WorkspaceProvider } from '@/components/workspace/workspace-provider';
import { WorkspacePage } from '@/components/workspace/workspace-page';
import { JourneyManusWelcome } from '@/components/journey/journey-manus-welcome';
import { AnimatePresence, motion } from 'framer-motion';
import {
  createJourneyGuardedFetch,
} from '@/lib/journey/http';
import {
  createJourneyRunId,
  getStoredJourneyRunId,
  setStoredJourneyRunId,
  setStoredJourneyPhase,
  getStoredJourneyCompanyName,
  setStoredJourneyCompanyName,
  clearStoredJourneySession,
} from '@/lib/journey/journey-run';
import {
  getAutoOpenSectionDecision,
  resetTrackedSection,
} from '@/lib/journey/journey-section-orchestration';
import { PrefillStreamView } from '@/components/journey/prefill-stream-view';
import {
  dispatchResearchSection,
} from '@/lib/journey/dispatch-client';
import { buildJourneyResearchContext } from '@/lib/journey/context-string';
import type { SectionKey } from '@/lib/workspace/types';

const REVIEW_ARTIFACT_SECTIONS = new Set<string>([
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
]);

type JourneyPhaseView = 'welcome' | 'prefilling' | 'resume' | 'workspace';
type LinkDeepResearchStatus = 'idle' | 'starting' | 'queued' | 'complete' | 'error';

const LINK_DEEP_RESEARCH_POLL_INTERVAL_MS = 2_000;
const LINK_DEEP_RESEARCH_MAX_POLLS = 450;

function normalizeLaunchUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readDeepResearchFieldValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const raw = value.value;
  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractDeepResearchOnboardingFields(result: unknown): Record<string, string> {
  if (!isRecord(result)) {
    return {};
  }

  const data = isRecord(result.data) ? result.data : result;
  const onboardingFields = isRecord(data.onboardingFields)
    ? data.onboardingFields
    : {};
  const fields: Record<string, string> = {};

  for (const [key, value] of Object.entries(onboardingFields)) {
    const fieldValue = readDeepResearchFieldValue(value);
    if (fieldValue) {
      fields[key] = fieldValue;
    }
  }

  return fields;
}

async function fetchDeepResearchOnboardingFields(
  runId: string,
): Promise<Record<string, string>> {
  const response = await fetch(
    `/api/journey/session?runId=${encodeURIComponent(runId)}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load deep research onboarding fields for run ${runId}: HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    researchResults?: Record<string, unknown> | null;
  };

  return extractDeepResearchOnboardingFields(
    payload.researchResults?.deepResearchProgram,
  );
}

async function waitForResearchSectionComplete(
  runId: string,
  section: string,
): Promise<void> {
  for (let attempt = 0; attempt < LINK_DEEP_RESEARCH_MAX_POLLS; attempt++) {
    const response = await fetch(
      `/api/journey/research-status?runId=${encodeURIComponent(runId)}&section=${encodeURIComponent(section)}`,
    );

    if (!response.ok) {
      throw new Error(
        `Failed to read ${section} status for run ${runId}: HTTP ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      complete?: boolean;
      error?: string;
      status?: string;
    };

    if (payload.status === 'error') {
      throw new Error(
        payload.error ??
          `${section} failed for run ${runId} before the workspace could open`,
      );
    }

    if (payload.status === 'partial') {
      throw new Error(
        payload.error ??
          `${section} returned a partial result for run ${runId}; workspace launch requires complete deep research fields`,
      );
    }

    if (payload.complete && payload.status === 'complete') {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, LINK_DEEP_RESEARCH_POLL_INTERVAL_MS),
    );
  }

  throw new Error(
    `${section} did not finish for run ${runId} before the workspace launch timeout`,
  );
}

export default function JourneyPage() {
  return (
    <ShellProvider>
      <JourneyPageContent />
    </ShellProvider>
  );
}

function JourneyPageContent() {
  const searchParams = useSearchParams();

  // Deep-link support: ?session=X&section=offerAnalysis jumps to workspace with that section
  const deepLinkSession = searchParams.get('session');
  const deepLinkMediaPlan = searchParams.get('mediaPlan') === '1';
  const deepLinkSection = searchParams.get('section');
  const shouldRestoreStoredRun = searchParams.get('restore') === '1';

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const journeyPhaseRef = useRef<JourneyPhaseView>('welcome');
  // Guard ref to prevent double workspace transitions.
  const hasTransitionedToWorkspaceRef = useRef(false);
  const loggedResearchStartsRef = useRef<Set<string>>(new Set());
  const loggedResearchErrorsRef = useRef<Set<string>>(new Set());
  const loggedResearchTimeoutFallbacksRef = useRef<Set<string>>(new Set());

  // Journey phase: controls which view renders
  // Priority: deep-link > sessionStorage restore > welcome
  const [journeyPhase, setJourneyPhase] = useState<JourneyPhaseView>(() => {
    if (deepLinkSession || deepLinkSection) return 'workspace';
    return 'welcome';
  });
  const [savedSession, setSavedSession] = useState<OnboardingState | null>(null);
  const [, setIsResuming] = useState(false);
  const [prefillWebsiteUrl, setPrefillWebsiteUrl] = useState('');
  const [deepResearchOnboardingFields, setDeepResearchOnboardingFields] = useState<Record<string, string>>({});
  const [linkDeepResearchStatus, setLinkDeepResearchStatus] =
    useState<LinkDeepResearchStatus>('idle');
  const [linkDeepResearchError, setLinkDeepResearchError] = useState<string | null>(null);
  const [journeyCompanyName, setJourneyCompanyName] = useState<string | null>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(deepLinkSession);
  const [resumeTransportState, setResumeTransportState] = useState<Record<string, unknown> | undefined>(undefined);
  const activeRunIdRef = useRef<string | null>(activeRunId);
  const resumeTransportStateRef = useRef<Record<string, unknown> | undefined>(
    resumeTransportState,
  );

  useEffect(() => {
    activeRunIdRef.current = activeRunId;
  }, [activeRunId]);

  useEffect(() => {
    resumeTransportStateRef.current = resumeTransportState;
  }, [resumeTransportState]);

  // Research state tracking
  const [researchResults, setResearchResults] = useState<Record<string, ResearchSectionResult | null>>({});
  const [activeResearch, setActiveResearch] = useState<Set<string>>(new Set());
  const [, setDispatchTimeoutFallbackSections] = useState<Set<string>>(new Set());
  const [, setTerminalLogs] = useState<TerminalLogEntry[]>([]);

  // Artifact panel state
  const [, setArtifactOpen] = useState(false);
  const [, setArtifactSection] = useState<string>('industryMarket');
  const [artifactFeedbackSection, setArtifactFeedbackSection] = useState<string | null>(null);
  const [recentlyApprovedArtifactSection, setRecentlyApprovedArtifactSection] = useState<string | null>(null);
  const artifactAutoOpenedSectionsRef = useRef<Set<string>>(new Set());

  // Session reset signal — increment to clear stale research data from Realtime hook
  const [realtimeResetSignal, setRealtimeResetSignal] = useState(0);
  const [researchResetAt, setResearchResetAt] = useState<string | null>(null);
  // Clear stale research data from Supabase and reset local state.
  // Called when starting a new Journey workspace from a durable deep research profile.
  const resetResearchState = useCallback((userId: string, nextRunId: string) => {
    const resetAt = new Date().toISOString();

    // 1. Clear local React state
    setResearchResults({});
    setActiveResearch(new Set());
    setDispatchTimeoutFallbackSections(new Set());
    setTerminalLogs([]);
    setArtifactOpen(false);
    setArtifactFeedbackSection(null);
    setRecentlyApprovedArtifactSection(null);
    artifactAutoOpenedSectionsRef.current = new Set();
    loggedResearchStartsRef.current = new Set();
    loggedResearchErrorsRef.current = new Set();
    loggedResearchTimeoutFallbacksRef.current = new Set();

    // 2. Reset the Realtime hook's internal seen-sections tracking
    setResearchResetAt(resetAt);
    setRealtimeResetSignal((n) => n + 1);

    // 3. Clear stale server-side research data so the next Journey run cannot re-hydrate old artifacts
    void createJourneyGuardedFetch('Journey')('/api/journey/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearResearch: true, activeRunId: nextRunId }),
    }).catch((error) => {
      console.error('[journey] Failed to clear stale research data:', error);
    });
  }, []);

  const resetArtifactSectionTracking = useCallback((section: string) => {
    setArtifactFeedbackSection((prev) => (prev === section ? null : prev));
    setRecentlyApprovedArtifactSection((prev) => (prev === section ? null : prev));
    artifactAutoOpenedSectionsRef.current = resetTrackedSection(
      artifactAutoOpenedSectionsRef.current,
      section,
    );
  }, []);

  const showArtifactSection = useCallback(
    (
      section: string,
      options?: {
        automatic?: boolean;
      },
    ) => {
      setArtifactSection(section);

      if (options?.automatic) {
        const decision = getAutoOpenSectionDecision(
          artifactAutoOpenedSectionsRef.current,
          section,
        );
        artifactAutoOpenedSectionsRef.current = decision.nextAutoOpenedSections;
        if (!decision.shouldOpen) {
          return;
        }
      }

      setArtifactOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (deepLinkSession || deepLinkSection) {
      return;
    }

    if (!shouldRestoreStoredRun) {
      clearStoredJourneySession();
      return;
    }

    const storedRunId = getStoredJourneyRunId();
    const storedCompanyName = getStoredJourneyCompanyName();

    if (storedRunId) {
      setActiveRunId(storedRunId);
    }
    if (storedCompanyName) {
      setJourneyCompanyName(storedCompanyName);
    }
    if (storedRunId) {
      setJourneyPhase('workspace');
    }
  }, [deepLinkSection, deepLinkSession, shouldRestoreStoredRun]);

  useEffect(() => {
    const saved = getJourneySession();
    if (saved) {
      // Only show resume prompt if we didn't already restore to workspace from sessionStorage
      if (
        shouldRestoreStoredRun &&
        hasAnsweredFields(saved) &&
        journeyPhase === 'welcome' &&
        !getStoredJourneyRunId()
      ) {
        setSavedSession(saved);
        setJourneyPhase('resume');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRestoreStoredRun]);

  // Persist phase to sessionStorage so refresh restores the correct view
  useEffect(() => {
    setStoredJourneyPhase(journeyPhase);
  }, [journeyPhase]);

  // Fetch company name from Supabase when restoring workspace without a local name
  useEffect(() => {
    if (journeyPhase === 'workspace' && !journeyCompanyName && activeRunId) {
      fetch(`/api/journey/session?runId=${activeRunId}`, { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const name = (data?.metadata as Record<string, unknown> | null)?.companyName;
          if (typeof name === 'string' && name.trim()) {
            setJourneyCompanyName(name);
            setStoredJourneyCompanyName(name);
          }
        })
        .catch(() => {});
    }
  }, [journeyPhase, journeyCompanyName, activeRunId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
        body: () => {
          const nextActiveRunId = activeRunIdRef.current;
          const nextResumeTransportState = resumeTransportStateRef.current;

          if (!nextActiveRunId && !nextResumeTransportState) {
            return undefined;
          }

          return {
            ...(nextActiveRunId ? { activeRunId: nextActiveRunId } : {}),
            ...(nextResumeTransportState
              ? { resumeState: nextResumeTransportState }
              : {}),
          };
        },
        fetch: createJourneyGuardedFetch('Journey'),
      }),
    []
  );

  const {
    messages,
    setMessages,
  } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) => shouldAutoSendJourneyMessages(messages),
    onError: (err) => {
      console.error('Journey chat error:', err);
      if (err?.message?.includes('Tool result is missing')) {
        setMessages((prev) => {
          const cleaned = [...prev];
          for (let i = cleaned.length - 1; i >= 0; i--) {
            if (cleaned[i].role === 'assistant') {
              cleaned.splice(i, 1);
              break;
            }
          }
          return cleaned;
        });
      }
    },
  });
  const approvalState = useMemo(() => getJourneyApprovalState(messages), [messages]);
  const approvedArtifactSections = approvalState.approvedSections;

  const resetConversationState = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  const commitActiveRunId = useCallback((nextRunId: string) => {
    activeRunIdRef.current = nextRunId;
    resumeTransportStateRef.current = undefined;
    setActiveRunId(nextRunId);
    setResumeTransportState(undefined);
    setStoredJourneyRunId(nextRunId);
  }, []);

  // Supabase Realtime — receive async research results
  const { user } = useUser();

  const beginFreshJourneyRun = useCallback((): string => {
    const nextRunId = createJourneyRunId();
    commitActiveRunId(nextRunId);
    resetConversationState();
    setJourneyCompanyName(null);
    setStoredJourneyCompanyName(null);
    if (user?.id) {
      resetResearchState(user.id, nextRunId);
    }
    return nextRunId;
  }, [commitActiveRunId, resetConversationState, resetResearchState, user?.id]);

  const shouldFetchResearchJobActivity =
    journeyPhase === 'workspace' || journeyPhase === 'prefilling';
  const researchJobActivity = useResearchJobActivity({
    userId: shouldFetchResearchJobActivity ? user?.id : null,
    activeRunId,
    resetSignal: realtimeResetSignal,
    ignoreUpdatedBefore: researchResetAt,
  });

  // Add terminal log helper
  const addLog = useCallback((level: TerminalLogEntry['level'], message: string) => {
    setTerminalLogs((prev) => [...prev.slice(-50), { level, message, timestamp: Date.now() }]);
  }, []);

  const markResearchQueued = useCallback(
    (section: string) => {
      const hasPreviousResult = Boolean(researchResults[section]);
      const isAlreadyQueued = activeResearch.has(section) && !hasPreviousResult;

      setDispatchTimeoutFallbackSections((prev) => {
        if (!prev.has(section)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(section);
        return next;
      });

      if (isAlreadyQueued) {
        return;
      }

      if (hasPreviousResult) {
        setResearchResults((prev) => {
          if (!prev[section]) {
            return prev;
          }

          const next = { ...prev };
          delete next[section];
          return next;
        });
      }

      setActiveResearch((prev) => {
        if (prev.has(section)) return prev;
        const next = new Set(prev);
        next.add(section);
        return next;
      });

      if (REVIEW_ARTIFACT_SECTIONS.has(section)) {
        if (
          hasPreviousResult ||
          approvedArtifactSections.has(section as JourneyReviewSection) ||
          artifactFeedbackSection === section ||
          recentlyApprovedArtifactSection === section
        ) {
          resetArtifactSectionTracking(section);
        }

        showArtifactSection(section, { automatic: true });
      }

      if (!loggedResearchStartsRef.current.has(section)) {
        loggedResearchStartsRef.current.add(section);
        const sectionLabel = SECTION_META[section] ?? section;
        addLog('run', `Researching ${sectionLabel}...`);
      }
    },
    [
      activeResearch,
      addLog,
      approvedArtifactSections,
      artifactFeedbackSection,
      setDispatchTimeoutFallbackSections,
      recentlyApprovedArtifactSection,
      researchResults,
      resetArtifactSectionTracking,
      showArtifactSection,
    ],
  );

  const enterWorkspaceFromDeepResearchFields = useCallback(
    async (runId: string, fields: Record<string, string>): Promise<void> => {
      if (hasTransitionedToWorkspaceRef.current) {
        return;
      }

      const acceptedJourneyFields: Record<string, string> = {
        ...(prefillWebsiteUrl.trim().length > 0
          ? { websiteUrl: normalizeLaunchUrl(prefillWebsiteUrl) ?? prefillWebsiteUrl.trim() }
          : {}),
      };

      for (const [key, rawValue] of Object.entries(fields)) {
        const value = rawValue.trim();
        if (value.length > 0) {
          acceptedJourneyFields[key] = value;
        }
      }

      if (Object.keys(acceptedJourneyFields).length === 0) {
        throw new Error(
          `Cannot open Journey workspace for run ${runId}: deep research returned no usable onboarding fields`,
        );
      }

      const displayName = acceptedJourneyFields.companyName || 'this company';
      const orderedFieldKeys = Object.keys(acceptedJourneyFields);
      const context = buildJourneyResearchContext(
        acceptedJourneyFields,
        orderedFieldKeys,
      );
      const guardedFetch = createJourneyGuardedFetch('Journey');

      await guardedFetch('/api/journey/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearResearch: false,
          fields: acceptedJourneyFields,
          activeRunId: runId,
        }),
      });

      setResumeTransportState(acceptedJourneyFields);
      resumeTransportStateRef.current = acceptedJourneyFields;
      setJourneyCompanyName(displayName);
      setStoredJourneyCompanyName(displayName);
      hasTransitionedToWorkspaceRef.current = true;
      setJourneyPhase('workspace');
      addLog(
        'ok',
        `Opened workspace from deep research context with ${Object.keys(fields).length} fields`,
      );

      const result = await dispatchResearchSection('industryMarket', runId, context);
      if (result.status === 'error') {
        const errorMessage =
          result.error ?? `Market & Category dispatch failed for run ${runId}`;
        setResearchResults((prev) => ({
          ...prev,
          industryMarket: {
            status: 'error',
            section: 'industryMarket',
            error: errorMessage,
            durationMs: 0,
          },
        }));
        addLog('err', errorMessage);
        return;
      }

      markResearchQueued('industryMarket');
      addLog(
        'run',
        `Market & Category synthesis queued from deep corpus (job: ${result.jobId ?? 'unknown'})`,
      );
    },
    [
      addLog,
      markResearchQueued,
      prefillWebsiteUrl,
      setResearchResults,
    ],
  );

  const markResearchDispatchError = useCallback(
    (section: string, errorMessage: string) => {
      const activity = researchJobActivity[section];
      const shouldIgnore = shouldIgnoreDispatchError({
        errorMessage,
        active: activeResearch.has(section),
        activity,
      });

      if (shouldIgnore) {
        markResearchQueued(section);
        setDispatchTimeoutFallbackSections((prev) => {
          if (prev.has(section)) {
            return prev;
          }

          const next = new Set(prev);
          next.add(section);
          return next;
        });
        if (!loggedResearchTimeoutFallbacksRef.current.has(section)) {
          loggedResearchTimeoutFallbacksRef.current.add(section);
          const sectionLabel = SECTION_META[section] ?? section;
          addLog(
            'warn',
            `${sectionLabel} chat request timed out. Waiting for the worker result from Supabase.`,
          );
        }
        return;
      }

      setDispatchTimeoutFallbackSections((prev) => {
        if (!prev.has(section)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(section);
        return next;
      });

      setActiveResearch((prev) => {
        if (!prev.has(section)) return prev;
        const next = new Set(prev);
        next.delete(section);
        return next;
      });

      setResearchResults((prev) => {
        const existing = prev[section];
        if (existing?.status === 'error' && existing.error === errorMessage) {
          return prev;
        }
        return {
          ...prev,
          [section]: {
            status: 'error',
            section,
            error: errorMessage,
            durationMs: 0,
          },
        };
      });

      if (REVIEW_ARTIFACT_SECTIONS.has(section)) {
        resetArtifactSectionTracking(section);
        showArtifactSection(section, { automatic: true });
      }

      if (!loggedResearchErrorsRef.current.has(section)) {
        loggedResearchErrorsRef.current.add(section);
        const sectionLabel = SECTION_META[section] ?? section;
        addLog('err', `${sectionLabel} research failed: ${errorMessage}`);
      }
    },
    [
      activeResearch,
      addLog,
      markResearchQueued,
      researchJobActivity,
      resetArtifactSectionTracking,
      setDispatchTimeoutFallbackSections,
      showArtifactSection,
    ],
  );

  // Track research tool dispatch from the agent stream → mark sections as active/loading
  useEffect(() => {
    const dispatchStates = extractResearchDispatchState(messages);

    for (const [section, dispatchState] of Object.entries(dispatchStates)) {
      if (dispatchState.status === 'queued') {
        markResearchQueued(section);
        continue;
      }

      markResearchDispatchError(
        section,
        dispatchState.error ?? 'Research dispatch failed',
      );
    }
  }, [markResearchDispatchError, markResearchQueued, messages]);

  useEffect(() => {
    const erroredSections = Object.entries(researchJobActivity).filter(
      ([, activity]) =>
        activity.status === 'error' &&
        typeof activity.error === 'string' &&
        activity.error.trim().length > 0,
    );
    if (erroredSections.length === 0) {
      return;
    }

    setActiveResearch((prev) => {
      const next = new Set(prev);
      let changed = false;

      for (const [section] of erroredSections) {
        changed = next.delete(section) || changed;
      }

      return changed ? next : prev;
    });

    setDispatchTimeoutFallbackSections((prev) => {
      const next = new Set(prev);
      let changed = false;

      for (const [section] of erroredSections) {
        changed = next.delete(section) || changed;
      }

      return changed ? next : prev;
    });

    setResearchResults((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const [section, activity] of erroredSections) {
        const currentError = next[section];
        if (currentError?.status === 'error' && currentError.error === activity.error) {
          continue;
        }

        next[section] = {
          status: 'error',
          section,
          error: activity.error,
          durationMs: 0,
        };
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [researchJobActivity]);

  useEffect(() => {
    journeyPhaseRef.current = journeyPhase;
  }, [journeyPhase]);

  useResearchRealtime({
    userId: null,
    activeRunId,
    resetSignal: realtimeResetSignal,
    ignoreUpdatedBefore: researchResetAt,
    onSectionComplete: (section: string, result: ResearchSectionResult) => {
      // Track research completion (always update state regardless of phase)
      setResearchResults((prev) => ({ ...prev, [section]: result }));
      setActiveResearch((prev) => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });
      setDispatchTimeoutFallbackSections((prev) => {
        if (!prev.has(section)) {
          return prev;
        }

        const next = new Set(prev);
        next.delete(section);
        return next;
      });

      // Add terminal log
      const sectionLabel = SECTION_META[section] ?? section;
      if (result.status === 'error') {
        addLog(
          'err',
          `${sectionLabel} research failed: ${result.error ?? 'Unknown error'}`,
        );
      } else if (result.status === 'partial') {
        addLog(
          'warn',
          `${sectionLabel} research failed validation: ${result.error ?? 'Artifact requires review'}`,
        );
      } else {
        addLog('ok', `${sectionLabel} research complete`);
      }

      // Save AI insights to business profile when research sections complete (fire-and-forget)
      const insightSections = ['industryMarket', 'icpValidation', 'competitors', 'offerAnalysis', 'keywordIntel', 'crossAnalysis'];
      if (result.status === 'complete' && result.data && insightSections.includes(section)) {
        fetch('/api/profiles/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeRunId,
            section,
            data: result.data,
          }),
        })
          .then((r) => r.json())
          .then((j) => console.log(`[insights] ${section}:`, j))
          .catch((e) => console.warn(`[insights] ${section} failed:`, e));
      }

      if (result.status !== 'complete') {
        return;
      }

      // Workspace hydration is handled by WorkspaceResearchBridge. Keep the
      // legacy hidden chat wake-up loop dormant for the Journey workspace.
      if (journeyPhaseRef.current === 'workspace') {
        if (
          REVIEW_ARTIFACT_SECTIONS.has(section) &&
          !approvedArtifactSections.has(section as JourneyReviewSection)
        ) {
          showArtifactSection(section, { automatic: true });
        }

        return;
      }

    },
  });

  // Only show timeout warnings for sections that are actually running.
  useEffect(() => {
    if (activeResearch.size === 0) {
      return;
    }

    const timer = setTimeout(() => {
      const pendingSections = [...activeResearch];
      console.warn('[journey] Research timed out, pending:', pendingSections);
      addLog('warn', `Research timed out for: ${pendingSections.join(', ')}`);
      setDispatchTimeoutFallbackSections((prev) => {
        const next = new Set(prev);
        for (const section of pendingSections) {
          next.add(section);
        }
        return next;
      });
    }, 5 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [activeResearch, addLog]);

  // Prevent document-level scroll
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  // Smart auto-scroll
  useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (isNewMessage || isNearBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Resume handlers
  const handleResumeContinue = useCallback(() => {
    if (!savedSession) {
      beginFreshJourneyRun();
      hasTransitionedToWorkspaceRef.current = true;
      setJourneyPhase('workspace');
      return;
    }

    const nextRunId =
      savedSession.activeJourneyRunId && savedSession.activeJourneyRunId.trim().length > 0
        ? savedSession.activeJourneyRunId
        : activeRunId ?? createJourneyRunId();
    commitActiveRunId(nextRunId);

    setResumeTransportState(getAnsweredFields(savedSession));
    setIsResuming(true);
    addLog('ok', 'Resuming previous session');
    hasTransitionedToWorkspaceRef.current = true;
    setJourneyPhase('workspace');
  }, [activeRunId, addLog, beginFreshJourneyRun, commitActiveRunId, savedSession]);

  const handleResumeStartFresh = useCallback(() => {
    clearJourneySession();
    clearStoredJourneySession();
    beginFreshJourneyRun();
    setDeepResearchOnboardingFields({});
    setLinkDeepResearchStatus('idle');
    setLinkDeepResearchError(null);
    setSavedSession(null);
    setIsResuming(false);
    setJourneyPhase('welcome');
    addLog('inf', 'Starting fresh journey');
  }, [addLog, beginFreshJourneyRun]);

  const handleAnalyzeCompanyLink = useCallback(() => {
    const websiteUrl = normalizeLaunchUrl(prefillWebsiteUrl);
    if (!websiteUrl) return;
    const nextRunId = createJourneyRunId();
    const sourceFields: Record<string, string> = {
      websiteUrl,
    };
    const sourceContext = buildJourneyResearchContext(
      sourceFields,
      Object.keys(sourceFields),
    );
    const guardedFetch = createJourneyGuardedFetch('Journey');

    setDeepResearchOnboardingFields({});
    setLinkDeepResearchStatus('starting');
    setLinkDeepResearchError(null);
    commitActiveRunId(nextRunId);
    addLog('run', `Starting company deep research and profile extraction for ${websiteUrl}`);
    setJourneyPhase('prefilling');

    void guardedFetch('/api/journey/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clearResearch: true,
        fields: sourceFields,
        activeRunId: nextRunId,
      }),
    })
      .then(() => dispatchResearchSection('deepResearchProgram', nextRunId, sourceContext))
      .then(async (result) => {
        if (result.status === 'error') {
          throw new Error(result.error ?? 'Company deep research dispatch failed');
        }

        setLinkDeepResearchStatus('queued');
        addLog('run', `Company deep research queued (job: ${result.jobId ?? 'unknown'})`);
        await waitForResearchSectionComplete(nextRunId, 'deepResearchProgram');
        const deepResearchFields = await fetchDeepResearchOnboardingFields(nextRunId);
        if (Object.keys(deepResearchFields).length === 0) {
          throw new Error(
            'Company deep research completed without onboardingFields; refusing to open the workspace from shallow context.',
          );
        }
        setDeepResearchOnboardingFields(deepResearchFields);
        setLinkDeepResearchStatus('complete');
        addLog(
          'ok',
          `Company deep research corpus ready with ${Object.keys(deepResearchFields).length} profile fields`,
        );
        await enterWorkspaceFromDeepResearchFields(nextRunId, deepResearchFields);
      })
      .catch((error: unknown) => {
        const message = getErrorMessage(error);
        setLinkDeepResearchStatus('error');
        setLinkDeepResearchError(message);
        addLog('err', `Company deep research failed: ${message}`);
      });
  }, [
    addLog,
    commitActiveRunId,
    enterWorkspaceFromDeepResearchFields,
    prefillWebsiteUrl,
  ]);

  const showResumeView = journeyPhase === 'resume';
  const resumeWorkspace = (
    <div className="flex flex-1 items-center justify-center px-12">
      <div className="w-full max-w-3xl">
        <ResumePrompt
          session={savedSession!}
          onContinue={handleResumeContinue}
          onStartFresh={handleResumeStartFresh}
        />
      </div>
    </div>
  );

  const prefillWorkspace = (
    <PrefillStreamView
      websiteUrl={prefillWebsiteUrl}
      deepResearchFields={deepResearchOnboardingFields}
      deepResearchStatus={linkDeepResearchStatus}
      deepResearchError={linkDeepResearchError}
      deepResearchActivity={researchJobActivity.deepResearchProgram}
      onRetry={() => {
        setPrefillWebsiteUrl('');
        setDeepResearchOnboardingFields({});
        setLinkDeepResearchStatus('idle');
        setLinkDeepResearchError(null);
        setJourneyPhase('welcome');
      }}
    />
  );

  const welcomeWorkspace = (
    <JourneyManusWelcome
      websiteUrl={prefillWebsiteUrl}
      onWebsiteUrlChange={setPrefillWebsiteUrl}
      onAnalyze={handleAnalyzeCompanyLink}
    />
  );

  const standardWorkspace = showResumeView
    ? resumeWorkspace
    : journeyPhase === 'prefilling'
      ? prefillWorkspace
      : welcomeWorkspace;

  // Workspace phase — replaces entire chat layout with artifact-first workspace
  if (journeyPhase === 'workspace') {
    const handleWorkspaceSectionApproved = (approvedSection: SectionKey) => {
      addLog('ok', `${SECTION_META[approvedSection] ?? approvedSection} approved — preparing the next section`);
    };

    return (
      <AppShell sidebar={<AppSidebar />} wide className="font-sans bg-[#0b0b0a]">
        <WorkspaceProvider
          sessionId={activeRunId ?? 'default'}
          startInWorkspace
          initialSection={(deepLinkSection as SectionKey | undefined) ?? (deepLinkMediaPlan ? 'mediaPlan' : undefined)}
        >
          <WorkspacePage
            userId={user?.id}
            activeRunId={activeRunId}
            onSectionApproved={handleWorkspaceSectionApproved}
            companyName={journeyCompanyName}
            onBack={() => {
              clearStoredJourneySession();
              setJourneyCompanyName(null);
              setJourneyPhase('welcome');
            }}
          />
        </WorkspaceProvider>
      </AppShell>
    );
  }

  if (journeyPhase === 'welcome') {
    return (
      <AppShell sidebar={<AppSidebar />} wide className="font-sans bg-[#0b0b0a]">
        {welcomeWorkspace}
      </AppShell>
    );
  }

  return (
    <AppShell sidebar={<AppSidebar />} wide className="font-sans bg-[#0b0b0a]">
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#0b0b0a]">
        <AnimatePresence mode="wait">
          <motion.div
            key={journeyPhase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {standardWorkspace}
          </motion.div>
        </AnimatePresence>
      </main>
    </AppShell>
  );
}

// Section label mapping for terminal logs
const SECTION_META: Record<string, string> = {
  industryMarket: 'Market Overview',
  competitors: 'Competitor Intel',
  icpValidation: 'ICP Validation',
  offerAnalysis: 'Offer Analysis',
  crossAnalysis: 'Strategic Synthesis',
  keywordIntel: 'Keyword Intel',
};
