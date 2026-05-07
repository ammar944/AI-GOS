'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  type UIMessage,
} from 'ai';
import { useUser } from '@clerk/nextjs';
import { ShellProvider } from '@/components/shell';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { ResumePrompt } from '@/components/journey/resume-prompt';
import { useJourneyPrefill } from '@/hooks/use-journey-prefill';
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
import { cn } from '@/lib/utils';
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
  enqueuePendingSectionWakeUp,
  getAutoOpenSectionDecision,
  getWakeUpDispatchDecision,
  resetTrackedSection,
} from '@/lib/journey/journey-section-orchestration';
import {
  JOURNEY_FIELD_LABELS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_PRICING_GROUP_KEYS,
} from '@/lib/journey/field-catalog';
import { UnifiedFieldReview } from '@/components/journey/unified-field-review';
import { PrefillStreamView } from '@/components/journey/prefill-stream-view';
import { readJourneyPrefillFieldValue } from '@/lib/journey/prefill-fields';
import {
  dispatchResearchSection,
} from '@/lib/journey/dispatch-client';
import { buildJourneyResearchContext } from '@/lib/journey/context-string';
import type { SectionKey } from '@/lib/workspace/types';
import type { PendingMeeting } from '@/lib/meeting-intel/types';

const REVIEW_ARTIFACT_SECTIONS = new Set<string>([
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
]);

type JourneyPhaseView = 'welcome' | 'prefilling' | 'review' | 'resume' | 'workspace';
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
          `${section} failed for run ${runId} before onboarding review`,
      );
    }

    if (payload.complete) {
      return;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, LINK_DEEP_RESEARCH_POLL_INTERVAL_MS),
    );
  }

  throw new Error(
    `${section} did not finish for run ${runId} before the onboarding review timeout`,
  );
}

function logJourneyDebug(
  event: string,
  payload: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  console.debug('[journey][debug]', {
    event,
    ...payload,
  });
}

export default function JourneyPage() {
  return (
    <ShellProvider>
      <JourneyPageContent />
    </ShellProvider>
  );
}

function sectionToToolName(section: string): string {
  const map: Record<string, string> = {
    industryMarket: 'researchIndustry',
    competitors: 'researchCompetitors',
    icpValidation: 'researchICP',
    offerAnalysis: 'researchOffer',
    crossAnalysis: 'synthesizeResearch',
    keywordIntel: 'researchKeywords',
    mediaPlan: 'researchMediaPlan',
  };
  return map[section] ?? section;
}

function createRealtimeResearchMessage(
  section: string,
  result: ResearchSectionResult,
): UIMessage {
  const toolName = sectionToToolName(section);

  return {
    id: `realtime-${section}-${Date.now()}`,
    role: 'assistant',
    parts: [
      {
        type: `tool-${toolName}`,
        toolName,
        toolCallId: `realtime-${section}`,
        state: 'output-available',
        input: {},
        output: JSON.stringify(result),
      } as UIMessage['parts'][number],
    ],
  };
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
  const statusRef = useRef<string>('ready');
  const journeyPhaseRef = useRef<JourneyPhaseView>('welcome');
  // Sections with completed research that still need UI or agent follow-up.
  const pendingWakeUpsRef = useRef<Set<string>>(new Set());
  const wokenSectionsRef = useRef<Set<string>>(new Set());
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
  const [welcomeLinkedinUrl, setWelcomeLinkedinUrl] = useState('');
  const [prefillReviewOverrides, setPrefillReviewOverrides] = useState<Record<string, string>>({});
  const [linkDeepResearchStatus, setLinkDeepResearchStatus] =
    useState<LinkDeepResearchStatus>('idle');
  const [linkDeepResearchError, setLinkDeepResearchError] = useState<string | null>(null);
  const [journeyCompanyName, setJourneyCompanyName] = useState<string | null>(null);

  const {
    partialResult,
    submit: submitPrefill,
    isLoading: isPrefilling,
    fieldsFound,
    error: prefillError,
    stop: stopPrefill,
  } = useJourneyPrefill();
  // Flatten partialResult { key: { value } } into Record<string, string> for UnifiedFieldReview
  const extractedFieldsFlat = useMemo(() => {
    const flat: Record<string, string> = {};
    // Include the website URL the user entered — it's stored separately from extraction results
    if (prefillWebsiteUrl) flat.websiteUrl = prefillWebsiteUrl;
    if (welcomeLinkedinUrl) flat.linkedinUrl = welcomeLinkedinUrl;
    const record = partialResult as Record<string, unknown> | null | undefined;
    if (record) {
      for (const key of Object.keys(record)) {
        const value = readJourneyPrefillFieldValue(record, key);
        if (value) flat[key] = value;
      }
    }
    for (const [key, value] of Object.entries(prefillReviewOverrides)) {
      if (value.trim()) flat[key] = value;
    }
    return flat;
  }, [partialResult, prefillReviewOverrides, prefillWebsiteUrl, welcomeLinkedinUrl]);

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

  const [, setOnboardingState] = useState<Partial<OnboardingState> | null>(null);

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
  const [pendingMeetings, setPendingMeetings] = useState<PendingMeeting[]>([]);

  // Clear stale research data from Supabase and reset local state.
  // Called when starting a NEW session (accept prefill / skip / start fresh).
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
    pendingWakeUpsRef.current = new Set();
    wokenSectionsRef.current = new Set();
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

  const resetSectionWakeUpTracking = useCallback((section: string) => {
    pendingWakeUpsRef.current = resetTrackedSection(pendingWakeUpsRef.current, section);
    wokenSectionsRef.current = resetTrackedSection(wokenSectionsRef.current, section);
  }, []);

  const resetArtifactSectionTracking = useCallback((section: string) => {
    resetSectionWakeUpTracking(section);
    setArtifactFeedbackSection((prev) => (prev === section ? null : prev));
    setRecentlyApprovedArtifactSection((prev) => (prev === section ? null : prev));
    artifactAutoOpenedSectionsRef.current = resetTrackedSection(
      artifactAutoOpenedSectionsRef.current,
      section,
    );
  }, [resetSectionWakeUpTracking]);

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

  const queuePendingWakeUp = useCallback((section: string) => {
    pendingWakeUpsRef.current = enqueuePendingSectionWakeUp(
      pendingWakeUpsRef.current,
      section,
    );
  }, []);

  const shouldWakeAgentForSection = useCallback((section: string): boolean => {
    const decision = getWakeUpDispatchDecision(wokenSectionsRef.current, section);
    wokenSectionsRef.current = decision.nextWokenSections;
    return decision.shouldWake;
  }, []);

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
      setOnboardingState(saved);
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
    sendMessage,
    status,
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

  const researchJobActivity = useResearchJobActivity({
    userId: journeyPhase === 'workspace' ? user?.id : null,
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

      resetSectionWakeUpTracking(section);

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
      resetSectionWakeUpTracking,
      showArtifactSection,
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
    statusRef.current = status;
    journeyPhaseRef.current = journeyPhase;
  }, [journeyPhase, status]);

  // Guard ref to prevent double workspace transitions
  const hasTransitionedToWorkspaceRef = useRef(false);

  const appendRealtimeResearchMessage = useCallback(
    (section: string, result: ResearchSectionResult) => {
      const syntheticMessage = createRealtimeResearchMessage(section, result);

      setMessages((prev) => {
        const alreadyInjected = prev.some((msg) =>
          msg.parts.some((part) => {
            if (typeof part !== 'object' || !part || !('toolCallId' in part)) {
              return false;
            }
            return (part as { toolCallId?: string }).toolCallId === `realtime-${section}`;
          }),
        );

        return alreadyInjected ? prev : [...prev, syntheticMessage];
      });
    },
    [setMessages],
  );

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
      // old hidden chat wake-up loop dormant outside the legacy path.
      if (journeyPhaseRef.current !== 'workspace') {
        queuePendingWakeUp(section);
        return;
      }

      if (REVIEW_ARTIFACT_SECTIONS.has(section)) {
        if (approvedArtifactSections.has(section as JourneyReviewSection)) {
          return;
        }

        appendRealtimeResearchMessage(section, result);
        showArtifactSection(section, { automatic: true });
        return;
      }

      appendRealtimeResearchMessage(section, result);

      if (statusRef.current === 'streaming' || statusRef.current === 'submitted') {
        queuePendingWakeUp(section);
        return;
      }

      if (!shouldWakeAgentForSection(section)) {
        logJourneyDebug('hidden-wake-up-suppressed', {
          reason: 'realtime-complete',
          section,
        });
        return;
      }

      logJourneyDebug('hidden-wake-up-dispatched', {
        reason: 'realtime-complete',
        section,
      });
      sendMessage({
        text: `[Research complete: ${sectionLabel}] Results have been received. Continue the onboarding conversation — ask the next question based on what phase we're in.`,
        metadata: { hidden: true },
      });
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

  // The current product path uses WorkspaceResearchBridge for Supabase
  // hydration. Clear any old queued chat wake-ups when entering workspace so
  // background research cannot wake the removed onboarding chat loop.
  useEffect(() => {
    if (journeyPhase === 'workspace') {
      pendingWakeUpsRef.current = new Set();
    }
  }, [journeyPhase]);

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

  // Auto-transition removed — PrefillStreamView now shows a completion state
  // with a manual "Continue to Review" button so users can see what was extracted

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
    setLinkDeepResearchStatus('idle');
    setLinkDeepResearchError(null);
    setSavedSession(null);
    setIsResuming(false);
    setOnboardingState(null);
    setJourneyPhase('welcome');
    addLog('inf', 'Starting fresh journey');
  }, [addLog, beginFreshJourneyRun]);

  const handlePrefillReadyForReview = useCallback(
    (editedFields: Record<string, string>) => {
      setPrefillReviewOverrides({
        ...editedFields,
        websiteUrl: prefillWebsiteUrl,
        ...(welcomeLinkedinUrl.trim().length > 0
          ? { linkedinUrl: welcomeLinkedinUrl.trim() }
          : {}),
      });
      addLog('ok', 'Company research extracted onboarding context');
      setJourneyPhase('review');
    },
    [addLog, prefillWebsiteUrl, welcomeLinkedinUrl],
  );

  const handleAnalyzeCompanyLink = useCallback(() => {
    const websiteUrl = normalizeLaunchUrl(prefillWebsiteUrl);
    if (!websiteUrl) return;
    const linkedinUrl = normalizeLaunchUrl(welcomeLinkedinUrl);
    const nextRunId = createJourneyRunId();
    const sourceFields: Record<string, string> = {
      websiteUrl,
      ...(linkedinUrl ? { linkedinUrl } : {}),
    };
    const sourceContext = buildJourneyResearchContext(
      sourceFields,
      Object.keys(sourceFields),
    );
    const guardedFetch = createJourneyGuardedFetch('Journey');

    stopPrefill();
    setPrefillReviewOverrides({});
    setLinkDeepResearchStatus('starting');
    setLinkDeepResearchError(null);
    commitActiveRunId(nextRunId);
    addLog('run', `Starting company deep research and onboarding extraction for ${websiteUrl}`);
    setJourneyPhase('prefilling');

    submitPrefill({
      websiteUrl,
      linkedinUrl: linkedinUrl ?? undefined,
    });

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
        setLinkDeepResearchStatus('complete');
        addLog('ok', 'Company deep research corpus ready for onboarding review');
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
    prefillWebsiteUrl,
    stopPrefill,
    submitPrefill,
    welcomeLinkedinUrl,
  ]);

  // Handler for UnifiedFieldReview — takes a flat Record<string, string>
  const handleStartFromUnifiedReview = useCallback(
    (onboardingData: Record<string, string>) => {
      if (hasTransitionedToWorkspaceRef.current) {
        return;
      }

      // Gate: verify all required fields are filled before proceeding
      const missingRequired: string[] = [];
      for (const key of JOURNEY_REQUIRED_FIELD_KEYS) {
        if (!onboardingData[key]?.trim()) {
          missingRequired.push(JOURNEY_FIELD_LABELS[key] ?? key);
        }
      }
      const hasPricing = Array.from(JOURNEY_PRICING_GROUP_KEYS).some(
        (key) => onboardingData[key]?.trim(),
      );
      if (!hasPricing) {
        missingRequired.push('Pricing or Budget');
      }
      if (missingRequired.length > 0) {
        addLog('err', `Cannot proceed — missing required fields: ${missingRequired.join(', ')}`);
        return;
      }

      const existingRunId = activeRunIdRef.current;
      const nextRunId =
        existingRunId && existingRunId.trim().length > 0
          ? existingRunId
          : createJourneyRunId();
      const shouldClearResearch = !existingRunId;
      commitActiveRunId(nextRunId);
      const acceptedJourneyFields: Record<string, string> = {};

      for (const [key, rawValue] of Object.entries(onboardingData)) {
        const value = rawValue?.trim();
        if (value) acceptedJourneyFields[key] = value;
      }

      const displayName = acceptedJourneyFields.companyName || 'this company';
      const orderedFieldKeys = Object.keys(acceptedJourneyFields);

      addLog('ok', `Accepted ${Object.keys(acceptedJourneyFields).length} onboarding inputs`);
      hasTransitionedToWorkspaceRef.current = true;

      // Clear old results, set new fields + run ID, THEN dispatch
      const context = buildJourneyResearchContext(acceptedJourneyFields, orderedFieldKeys);
      const guardedFetch = createJourneyGuardedFetch('Journey');
      guardedFetch('/api/journey/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearResearch: shouldClearResearch,
          fields: Object.fromEntries(
            Object.entries(acceptedJourneyFields).filter(([, v]) => v.trim().length > 0),
          ),
          activeRunId: nextRunId,
        }),
      }).then(() => {
        // Save business profile from onboarding data (fire-and-forget)
        fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: nextRunId }),
        }).catch(() => { /* non-critical */ });

        // Submit any meetings added during onboarding (fire-and-forget)
        for (const meeting of pendingMeetings) {
          fetch('/api/meetings/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: meeting.title,
              meetingType: meeting.meetingType,
              transcript: meeting.transcript,
              runId: nextRunId,
            }),
          }).catch(() => { /* non-critical */ });
        }

        addLog('run', 'Starting Market & Category synthesis from completed onboarding context...');
        markResearchQueued('industryMarket');
        return dispatchResearchSection('industryMarket', nextRunId, context);
      }).then((result) => {
        if (result.status === 'error') {
          addLog('err', `Market & Category dispatch failed: ${result.error ?? 'Unknown error'}`);
          hasTransitionedToWorkspaceRef.current = false;
        } else {
          addLog('ok', `Market & Category synthesis queued (job: ${result.jobId ?? 'unknown'})`);
          setJourneyCompanyName(displayName);
          setStoredJourneyCompanyName(displayName);
          setJourneyPhase('workspace');
        }
      }).catch((err) => {
        hasTransitionedToWorkspaceRef.current = false;
        addLog('err', `Dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    },
    [addLog, commitActiveRunId, markResearchQueued, pendingMeetings],
  );

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
      partialResult={partialResult}
      fieldsFound={fieldsFound}
      isPrefilling={isPrefilling}
      error={prefillError}
      websiteUrl={prefillWebsiteUrl}
      deepResearchStatus={linkDeepResearchStatus}
      deepResearchError={linkDeepResearchError}
      onRetry={() => {
        stopPrefill();

        setPrefillWebsiteUrl('');
        setPrefillReviewOverrides({});
        setLinkDeepResearchStatus('idle');
        setLinkDeepResearchError(null);
        setJourneyPhase('welcome');
      }}
      onComplete={(editedFields) =>
        handlePrefillReadyForReview(editedFields)
      }
    />
  );

  const reviewWorkspace = (
    <UnifiedFieldReview
      extractedFields={extractedFieldsFlat}
      onStart={handleStartFromUnifiedReview}
      pendingMeetings={pendingMeetings}
      onPendingMeetingsChange={setPendingMeetings}
    />
  );

  const welcomeWorkspace = (
    <JourneyManusWelcome
      websiteUrl={prefillWebsiteUrl}
      linkedinUrl={welcomeLinkedinUrl}
      onWebsiteUrlChange={setPrefillWebsiteUrl}
      onLinkedinUrlChange={setWelcomeLinkedinUrl}
      onAnalyze={handleAnalyzeCompanyLink}
      onSkip={() => {
        setPrefillReviewOverrides({});
        setLinkDeepResearchStatus('idle');
        setLinkDeepResearchError(null);
        setJourneyPhase('review');
        addLog('inf', 'Opened manual onboarding review');
      }}
    />
  );

  const standardWorkspace = showResumeView
    ? resumeWorkspace
    : journeyPhase === 'prefilling'
      ? prefillWorkspace
      : journeyPhase === 'review'
        ? reviewWorkspace
        : welcomeWorkspace;

  // Workspace phase — replaces entire chat layout with artifact-first workspace
  if (journeyPhase === 'workspace') {
    const handleWorkspaceSectionApproved = (approvedSection: SectionKey) => {
      addLog('ok', `${SECTION_META[approvedSection] ?? approvedSection} approved — preparing the next section`);
    };

    return (
      <div
        className="flex h-screen flex-col font-sans"
        style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}
      >
        <div className="flex flex-1 min-h-0">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-h-0 min-w-0">
            <WorkspaceProvider sessionId={activeRunId ?? 'default'} startInWorkspace initialSection={(deepLinkSection as SectionKey | undefined) ?? (deepLinkMediaPlan ? 'mediaPlan' : undefined)}>
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
          </div>
        </div>
      </div>
    );
  }

  if (journeyPhase === 'welcome') {
    return welcomeWorkspace;
  }

  return (
    <div
      className="flex h-screen flex-col font-sans"
      style={{
        background: 'var(--bg-base)',
        color: '#E5E5E5',
      }}
    >
      <div className="flex flex-1 min-h-0">
        <AppSidebar />

        <main className={cn(
          'relative flex flex-1 flex-col min-h-0 min-w-0',
          "bg-[var(--bg-base)]",
        )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={journeyPhase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-1 flex-col min-h-0"
            >
              {standardWorkspace}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
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
