'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  type UIMessage,
} from 'ai';
import { useUser } from '@clerk/nextjs';
import { ShellProvider } from '@/components/shell';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { ChatMessage } from '@/components/journey/chat-message';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { TypingIndicator } from '@/components/journey/typing-indicator';
import { ResumePrompt } from '@/components/journey/resume-prompt';
import { useJourneyPrefill } from '@/hooks/use-journey-prefill';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
import { getJourneyApprovalState, type JourneyReviewSection } from '@/lib/ai/journey-review-gates';
import { shouldAutoSendJourneyMessages } from '@/lib/journey/chat-auto-send';
import { filterJourneyMessageParts } from '@/lib/journey/filter-chat-parts';
import { extractResearchDispatchState } from '@/lib/journey/research-dispatch-state';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import {
  shouldIgnoreDispatchError,
} from '@/lib/journey/research-recovery';
import {
  LEAD_AGENT_WELCOME_MESSAGE,
  LEAD_AGENT_RESUME_WELCOME,
} from '@/lib/ai/prompts/lead-agent-system';
import {
  getJourneySession,
  setJourneySession,
  clearJourneySession,
} from '@/lib/storage/local-storage';
import {
  calculateCompletion,
  createEmptyState,
  hasAnsweredFields,
  getAnsweredFields,
} from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
import type { AskUserResult } from '@/components/journey/ask-user-card';
import { JourneyStepper, type StepperPhase } from '@/components/journey/journey-stepper';
import { TerminalStream, type TerminalLogEntry } from '@/components/journey/terminal-stream';
import { JourneyProgressPanel, type ProgressItem } from '@/components/journey/journey-progress-panel';
import { JourneyStudioPreviewDock } from '@/components/journey/studio-preview-dock';
import { JourneyStudioPreviewShell } from '@/components/journey/studio-preview-shell';
import { ResearchInlineCard } from '@/components/journey/research-inline-card';
import { ArtifactTriggerCard } from '@/components/journey/artifact-trigger-card';
import { ArtifactPanel } from '@/components/journey/artifact-panel';
import { WorkspaceProvider } from '@/components/workspace/workspace-provider';
import { WorkspacePage } from '@/components/workspace/workspace-page';
import { JourneyWorkerStatusBanner } from '@/components/journey/journey-worker-status-banner';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  createJourneyGuardedFetch,
  formatJourneyErrorMessage,
} from '@/lib/journey/http';
import {
  createJourneyRunId,
  getStoredJourneyRunId,
  setStoredJourneyRunId,
} from '@/lib/journey/journey-run';
import {
  drainPendingSectionWakeUps,
  enqueuePendingSectionWakeUp,
  getAutoOpenSectionDecision,
  getWakeUpDispatchDecision,
  resetTrackedSection,
} from '@/lib/journey/journey-section-orchestration';
import {
  JOURNEY_FIELD_LABELS,
  JOURNEY_MANUAL_BLOCKER_FIELDS,
  JOURNEY_PREFILL_REVIEW_FIELDS,
  JOURNEY_REQUIRED_FIELD_KEYS,
  JOURNEY_PRICING_GROUP_KEYS,
} from '@/lib/journey/field-catalog';
import { getManualPrefillPreset } from '@/lib/journey/manual-prefill-presets';
import { isJourneyStudioPreview } from '@/lib/journey/journey-preview';
import { UnifiedFieldReview } from '@/components/journey/unified-field-review';
import { PrefillStreamView } from '@/components/journey/prefill-stream-view';
import { buildJourneyWorkerStatusItems } from '@/lib/journey/research-worker-status';
import { readJourneyPrefillFieldValue } from '@/lib/journey/prefill-fields';
import { dispatchResearchSection } from '@/lib/journey/dispatch-client';
import { getNextSection } from '@/lib/workspace/pipeline';
import type { SectionKey } from '@/lib/workspace/types';

// Demo progress items matching the mockup's right panel
const DEMO_PROGRESS_ITEMS: ProgressItem[] = [
  { id: 'industryMarket', label: 'Market Overview', status: 'complete', detail: 'Completed 12m ago' },
  { id: 'competitors', label: 'Competitor Intel', status: 'active', detail: 'Processing data...' },
  { id: 'icpValidation', label: 'ICP Validation', status: 'queued', detail: 'Queued' },
  { id: 'offerAnalysis', label: 'Offer Analysis', status: 'queued', detail: 'Queued' },
];

const REVIEW_ARTIFACT_SECTIONS = new Set<string>([
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
]);

type JourneyPhaseView = 'welcome' | 'prefilling' | 'review' | 'resume' | 'chat' | 'workspace';

interface PrefillAcceptPayload {
  editedFields?: Record<string, string>;
  manualFields?: Record<string, string>;
}

function getJourneyStudioTitle(
  journeyPhase: JourneyPhaseView,
  artifactOpen: boolean,
): string {
  if (journeyPhase === 'welcome') {
    return 'Stage the strategic brief';
  }
  if (journeyPhase === 'prefilling') {
    return 'Pulling market context from your footprint';
  }
  if (journeyPhase === 'review') {
    return 'Review the extracted operating context';
  }
  if (journeyPhase === 'resume') {
    return 'Resume the operating session';
  }
  if (artifactOpen) {
    return 'Review the live research proof';
  }
  return 'Operate the strategy session';
}

function getJourneyStudioDescription(
  journeyPhase: JourneyPhaseView,
  activeResearchCount: number,
  artifactOpen: boolean,
): string {
  if (journeyPhase === 'welcome') {
    return 'Seed the company context, then let Journey sequence the research, approvals, and strategy build-out.';
  }
  if (journeyPhase === 'prefilling') {
    return 'Journey is extracting company and positioning signals from the URLs you provided before the session begins.';
  }
  if (journeyPhase === 'review') {
    return 'Accept the fields that look right, skip the ones that need manual handling, then hand control back to the lead agent.';
  }
  if (journeyPhase === 'resume') {
    return 'A saved session exists locally. Continue from the current answers or start over with a clean run.';
  }
  if (artifactOpen) {
    return 'The right dock is pinned to artifact review so you can approve or redirect the section without losing the conversation thread.';
  }
  if (activeResearchCount > 0) {
    return 'Conversation, live research, and proof stay in one operating surface while workers continue in the background.';
  }
  return 'Use the strategist lane to refine answers, approve sections, and keep the research program moving.';
}

function getJourneyStudioStatusLabel(
  journeyPhase: JourneyPhaseView,
  activeResearchCount: number,
  artifactOpen: boolean,
  savedSession: OnboardingState | null,
): string {
  if (artifactOpen) {
    return 'Artifact review live';
  }
  if (activeResearchCount > 0) {
    return 'Live research active';
  }
  if (journeyPhase === 'prefilling') {
    return 'Context extraction';
  }
  if (journeyPhase === 'review') {
    return 'Review checkpoint';
  }
  if (journeyPhase === 'resume' && savedSession) {
    return 'Session ready';
  }
  return 'Studio ready';
}

function getJourneyStudioStatusDetail(
  activeResearchCount: number,
  artifactOpen: boolean,
  artifactSection: string,
  progressItems: ProgressItem[],
  savedSession: OnboardingState | null,
): string {
  if (artifactOpen) {
    return `${SECTION_META[artifactSection] ?? artifactSection} in focus`;
  }
  if (activeResearchCount > 0) {
    return `${activeResearchCount} live research ${activeResearchCount === 1 ? 'task' : 'tasks'} running`;
  }
  if (typeof savedSession?.completionPercent === 'number') {
    return `${savedSession.completionPercent}% of required context saved`;
  }

  const completedResearchCount = progressItems.filter((item) => item.status === 'complete').length;
  return `${completedResearchCount} research ${completedResearchCount === 1 ? 'module' : 'modules'} completed`;
}

function getMessageTextPartText(part: unknown): string | null {
  if (
    typeof part !== 'object' ||
    part === null ||
    !('type' in part) ||
    !('text' in part)
  ) {
    return null;
  }

  if (part.type !== 'text' || typeof part.text !== 'string') {
    return null;
  }

  return part.text;
}

function isHiddenJourneyMessage(message: UIMessage): boolean {
  const metadata = message.metadata;
  return Boolean(
    metadata &&
      typeof metadata === 'object' &&
      'hidden' in metadata &&
      metadata.hidden === true,
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

function isCompleteResearchResult(
  result: ResearchSectionResult | null | undefined,
): boolean {
  return result?.status === 'complete';
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

// Derive stepper phase from research state
function deriveStepperPhase(researchResults: Record<string, ResearchSectionResult | null>): {
  currentPhase: StepperPhase;
  completedPhases: StepperPhase[];
} {
  const hasMarket = isCompleteResearchResult(researchResults.industryMarket);
  const hasCompetitors = isCompleteResearchResult(researchResults.competitors);
  const hasICP = isCompleteResearchResult(researchResults.icpValidation);
  const hasOffer = isCompleteResearchResult(researchResults.offerAnalysis);
  const hasSynthesis = isCompleteResearchResult(researchResults.crossAnalysis);

  const completedPhases: StepperPhase[] = [];
  let currentPhase: StepperPhase = 'discovery';

  if (hasMarket) {
    completedPhases.push('discovery');
    currentPhase = 'validation';
  }
  if (hasCompetitors && hasICP) {
    completedPhases.push('validation');
    currentPhase = 'strategy';
  }
  if (hasOffer && hasSynthesis) {
    completedPhases.push('strategy');
    currentPhase = 'launch';
  }

  return { currentPhase, completedPhases };
}

// Derive progress panel items from research state
function deriveProgressItems(
  researchResults: Record<string, ResearchSectionResult | null>,
  activeResearch: Set<string>
): ProgressItem[] {
  const sections = [
    { id: 'industryMarket', label: 'Market Overview' },
    { id: 'competitors', label: 'Competitor Intel' },
    { id: 'icpValidation', label: 'ICP Validation' },
    { id: 'offerAnalysis', label: 'Offer Analysis' },
    { id: 'crossAnalysis', label: 'Strategic Synthesis' },
    { id: 'keywordIntel', label: 'Keyword Intel' },
  ];

  return sections.map((s) => {
    const result = researchResults[s.id];
    const isActive = activeResearch.has(s.id);

    let status: ProgressItem['status'] = 'queued';
    let detail = 'Queued';

    if (result?.status === 'complete') {
      status = 'complete';
      detail = 'Completed';
    } else if (result?.status === 'error' || result?.status === 'partial') {
      status = 'queued';
      detail = 'Needs review';
    } else if (isActive) {
      status = 'active';
      detail = 'Processing data...';
    }

    return { id: s.id, label: s.label, status, detail };
  });
}

function JourneyPageContent() {
  const searchParams = useSearchParams();
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
  const [journeyPhase, setJourneyPhase] = useState<JourneyPhaseView>('welcome');
  const [savedSession, setSavedSession] = useState<OnboardingState | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [prefillWebsiteUrl, setPrefillWebsiteUrl] = useState('');

  const {
    partialResult,
    submit: submitPrefill,
    isLoading: isPrefilling,
    fieldsFound,
    error: prefillError,
    stop: stopPrefill,
  } = useJourneyPrefill();
  const prefillReviewPreset = useMemo(
    () =>
      getManualPrefillPreset({
        websiteUrl: prefillWebsiteUrl,
        companyName: readJourneyPrefillFieldValue(
          partialResult as Record<string, unknown> | null | undefined,
          'companyName',
        ),
      }),
    [partialResult, prefillWebsiteUrl],
  );

  // Flatten partialResult { key: { value } } into Record<string, string> for UnifiedFieldReview
  const extractedFieldsFlat = useMemo(() => {
    const flat: Record<string, string> = {};
    // Include the website URL the user entered — it's stored separately from extraction results
    if (prefillWebsiteUrl) flat.websiteUrl = prefillWebsiteUrl;
    const record = partialResult as Record<string, unknown> | null | undefined;
    if (!record) return flat;
    for (const key of Object.keys(record)) {
      const value = readJourneyPrefillFieldValue(record, key);
      if (value) flat[key] = value;
    }
    return flat;
  }, [partialResult, prefillWebsiteUrl]);

  const [activeRunId, setActiveRunId] = useState<string | null>(() => getStoredJourneyRunId());
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
  const [dispatchTimeoutFallbackSections, setDispatchTimeoutFallbackSections] = useState<Set<string>>(new Set());
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);

  // Artifact panel state
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [artifactSection, setArtifactSection] = useState<string>('industryMarket');
  const [artifactFeedbackSection, setArtifactFeedbackSection] = useState<string | null>(null);
  const [recentlyApprovedArtifactSection, setRecentlyApprovedArtifactSection] = useState<string | null>(null);
  const artifactAutoOpenedSectionsRef = useRef<Set<string>>(new Set());

  // Session reset signal — increment to clear stale research data from Realtime hook
  const [realtimeResetSignal, setRealtimeResetSignal] = useState(0);
  const [researchResetAt, setResearchResetAt] = useState<string | null>(null);

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
    const saved = getJourneySession();
    if (saved) {
      setOnboardingState(saved);
      if (hasAnsweredFields(saved)) {
        setSavedSession(saved);
        setJourneyPhase('resume');
      }
    }
  }, []);

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
    addToolOutput,
    addToolApprovalResponse,
    status,
    error,
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
    flushSync(() => {
      setActiveRunId(nextRunId);
      setResumeTransportState(undefined);
    });
    setStoredJourneyRunId(nextRunId);
  }, []);

  // Supabase Realtime — receive async research results
  const { user } = useUser();

  const beginFreshJourneyRun = useCallback((): string => {
    const nextRunId = createJourneyRunId();
    commitActiveRunId(nextRunId);
    resetConversationState();
    if (user?.id) {
      resetResearchState(user.id, nextRunId);
    }
    return nextRunId;
  }, [commitActiveRunId, resetConversationState, resetResearchState, user?.id]);

  const researchJobActivity = useResearchJobActivity({
    userId: journeyPhase === 'chat' ? user?.id : null,
    activeRunId,
    resetSignal: realtimeResetSignal,
    ignoreUpdatedBefore: researchResetAt,
  });

  // Add terminal log helper
  const addLog = useCallback((level: TerminalLogEntry['level'], message: string) => {
    setTerminalLogs((prev) => [...prev.slice(-50), { level, message, timestamp: Date.now() }]);
  }, []);

  const persistAcceptedJourneyFields = useCallback(
    (
      fields: Record<string, string>,
      nextRunId?: string,
    ) => {
      const acceptedFields = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value.trim().length > 0),
      );

      if (Object.keys(acceptedFields).length === 0) {
        return;
      }

      const guardedFetch = createJourneyGuardedFetch('Journey');
      void guardedFetch('/api/journey/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: acceptedFields,
          activeRunId: nextRunId ?? activeRunId,
        }),
      }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[journey] failed to persist accepted prefill fields:', message);
        addLog('warn', 'Accepted onboarding fields were not persisted to session metadata');
      });
    },
    [activeRunId, addLog],
  );

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
    userId: journeyPhase === 'chat' ? user?.id : null,
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

      if (result.status !== 'complete') {
        return;
      }

      // During prefilling/review, the user hasn't accepted context yet — queue follow-up work.
      if (journeyPhaseRef.current !== 'chat') {
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

  // Derived state
  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';

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

  // Flush queued research wake-ups when chat is ready to continue.
  useEffect(() => {
    if (journeyPhase !== 'chat') return;
    if (status === 'streaming' || status === 'submitted') return;

    const { queuedSections, nextPendingSections } = drainPendingSectionWakeUps(
      pendingWakeUpsRef.current,
    );
    if (queuedSections.length === 0) return;
    pendingWakeUpsRef.current = nextPendingSections;

    let shouldWakeAgent = false;

    for (const section of queuedSections) {
      const result = researchResults[section];
      if (!result || result.status !== 'complete') continue;

      if (REVIEW_ARTIFACT_SECTIONS.has(section)) {
        if (approvedArtifactSections.has(section as JourneyReviewSection)) {
          continue;
        }

        appendRealtimeResearchMessage(section, result);
        showArtifactSection(section, { automatic: true });
        continue;
      }

      appendRealtimeResearchMessage(section, result);

      const shouldWakeForSection = shouldWakeAgentForSection(section);
      if (!shouldWakeForSection) {
        logJourneyDebug('hidden-wake-up-suppressed', {
          reason: 'pending-flush',
          section,
        });
      }
      shouldWakeAgent = shouldWakeForSection || shouldWakeAgent;
    }

    if (shouldWakeAgent) {
      logJourneyDebug('hidden-wake-up-dispatched', {
        reason: 'pending-flush',
      });
      sendMessage({
        text: '[Research complete] New research results have been received. Continue the onboarding conversation — ask the next question based on what phase we\'re in.',
        metadata: { hidden: true },
      });
    }
  }, [
    journeyPhase,
    status,
    researchResults,
    approvedArtifactSections,
    appendRealtimeResearchMessage,
    sendMessage,
    shouldWakeAgentForSection,
    showArtifactSection,
  ]);

  // Stepper state
  const { currentPhase, completedPhases } = deriveStepperPhase(researchResults);

  // Progress panel items
  const progressItems = deriveProgressItems(researchResults, activeResearch);
  const workerStatusItems = useMemo(
    () =>
      buildJourneyWorkerStatusItems({
        activeResearch,
        researchJobActivity,
        researchResults,
        timedOutSections: dispatchTimeoutFallbackSections,
      }),
    [
      activeResearch,
      dispatchTimeoutFallbackSections,
      researchJobActivity,
      researchResults,
    ],
  );

  // Find pending tool interactions
  const pendingAskUser = useMemo(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (
          typeof part === 'object' &&
          'type' in part &&
          (part as Record<string, unknown>).type === 'tool-askUser' &&
          'state' in part &&
          (part as Record<string, unknown>).state === 'input-available'
        ) {
          const partAny = part as Record<string, unknown>;
          const input = partAny.input as { fieldName?: string } | undefined;
          return {
            toolCallId: (partAny.toolCallId as string) ?? '',
            fieldName: input?.fieldName ?? 'unknown',
          };
        }
      }
    }
    return null;
  }, [messages]);

  const hasPendingApproval = messages.some(
    (msg) =>
      msg.role === 'assistant' &&
      msg.parts.some(
        (part) =>
          typeof part === 'object' &&
          'type' in part &&
          typeof (part as Record<string, unknown>).type === 'string' &&
          ((part as Record<string, unknown>).type as string).startsWith('tool-') &&
          (part as Record<string, unknown>).type !== 'tool-askUser' &&
          'state' in part &&
          ((part as Record<string, unknown>).state === 'approval-requested' ||
            (part as Record<string, unknown>).state === 'input-available')
      )
  );

  const isLoading = isStreaming || isSubmitted || hasPendingApproval;
  const renderedChatError = useMemo(
    () => formatJourneyErrorMessage(error),
    [error],
  );
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

  // Handle askUser chip tap
  const handleAskUserResponse = useCallback(
    (toolCallId: string, result: AskUserResult) => {
      const value: unknown = 'selectedLabels' in result
        ? result.selectedLabels
        : 'selectedLabel' in result
          ? result.selectedLabel
          : 'otherText' in result
            ? result.otherText
            : null;

      if (value !== null) {
        const current = getJourneySession() ?? createEmptyState();
        const updated: OnboardingState = {
          ...current,
          activeJourneyRunId: activeRunId ?? current.activeJourneyRunId ?? null,
          [result.fieldName]: value,
          lastUpdated: new Date().toISOString(),
        };
        const { requiredFieldsCompleted, completionPercent } = calculateCompletion(updated);
        updated.requiredFieldsCompleted = requiredFieldsCompleted;
        updated.completionPercent = completionPercent;
        setJourneySession(updated);
        setStoredJourneyRunId(updated.activeJourneyRunId ?? null);
        setOnboardingState(updated);

        if (result.fieldName === 'confirmation') {
          const label = 'selectedLabel' in result ? String(result.selectedLabel).toLowerCase() : '';
          const confirmed = label.includes('looks good') || label.includes("let's go");
          if (confirmed) {
            updated.phase = 'complete';
            setJourneySession(updated);
          }
        }
      }

      addToolOutput({
        tool: 'askUser',
        toolCallId,
        output: JSON.stringify(result),
      });
    },
    [activeRunId, addToolOutput]
  );

  // Submit handler
  const handleSubmit = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;

      if (pendingAskUser) {
        handleAskUserResponse(pendingAskUser.toolCallId, {
          fieldName: pendingAskUser.fieldName,
          otherText: trimmed,
        });
        return;
      }

      if (artifactFeedbackSection) {
        const sectionLabel = SECTION_META[artifactFeedbackSection] ?? artifactFeedbackSection;
        setArtifactFeedbackSection(null);
        setRecentlyApprovedArtifactSection(null);
        addLog(
          'run',
          `Requested changes for ${sectionLabel}: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '...' : ''}"`,
        );
        sendMessage({
          text: `[SECTION_FEEDBACK:${artifactFeedbackSection}] ${trimmed}`,
          metadata: { hidden: false, displayText: trimmed },
        });
        return;
      }

      // Add terminal log for user messages
      setRecentlyApprovedArtifactSection(null);
      addLog('run', `Processing: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? '...' : ''}"`);
      sendMessage({ text: trimmed });
    },
    [
      artifactFeedbackSection,
      isLoading,
      sendMessage,
      pendingAskUser,
      handleAskUserResponse,
      addLog,
    ]
  );

  // Resume handlers
  const handleResumeContinue = useCallback(() => {
    if (!savedSession) {
      setJourneyPhase('chat');
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
    setJourneyPhase('chat');
  }, [activeRunId, addLog, commitActiveRunId, savedSession]);

  const handleResumeStartFresh = useCallback(() => {
    clearJourneySession();
    beginFreshJourneyRun();
    setSavedSession(null);
    setIsResuming(false);
    setOnboardingState(null);
    setJourneyPhase('welcome');
    addLog('inf', 'Starting fresh journey');
  }, [addLog, beginFreshJourneyRun]);

  // Prefill accept — build context, persist to session, dispatch first research section
  const handleAcceptPrefill = useCallback(
    ({ editedFields, manualFields }: PrefillAcceptPayload = {}) => {
      // Always create a fresh run ID for a new session
      const nextRunId = createJourneyRunId();
      commitActiveRunId(nextRunId);

      const partialResultRecord = partialResult as Record<string, unknown> | null | undefined;
      const acceptedJourneyFields: Record<string, string> = {};

      for (const { key } of JOURNEY_PREFILL_REVIEW_FIELDS) {
        const hasEditedValue = Boolean(
          editedFields && Object.prototype.hasOwnProperty.call(editedFields, key),
        );

        if (hasEditedValue) {
          const editedValue = editedFields?.[key]?.trim() ?? '';
          if (editedValue) {
            acceptedJourneyFields[key] = editedValue;
          }
          continue;
        }

        const value = readJourneyPrefillFieldValue(partialResultRecord, key);
        if (value) {
          acceptedJourneyFields[key] = value;
        }
      }

      for (const [key, rawValue] of Object.entries(manualFields ?? {})) {
        const value = rawValue.trim();
        if (!value) continue;
        acceptedJourneyFields[key] = value;
      }

      const displayName = acceptedJourneyFields.companyName || 'this company';
      const orderedFieldKeys = Array.from(
        new Set([
          ...JOURNEY_PREFILL_REVIEW_FIELDS.map(({ key }) => key),
          ...JOURNEY_MANUAL_BLOCKER_FIELDS.map(({ key }) => key),
        ]),
      );

      const lines: string[] = ["Here's what I found about the company:"];
      for (const key of orderedFieldKeys) {
        const value = acceptedJourneyFields[key]?.trim();
        if (!value) continue;
        lines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
      }
      lines.push('', 'Please use this context and begin the research journey.');

      addLog('ok', `Accepted ${Object.keys(acceptedJourneyFields).length} onboarding inputs`);

      // Go straight to workspace — render immediately while session persists
      hasTransitionedToWorkspaceRef.current = true;
      setJourneyPhase('workspace');

      // Persist session fields THEN dispatch — must await so the worker's
      // isActiveJourneyRun() guard sees the run ID when it tries to write results
      const context = lines.join('\n');
      const guardedFetch = createJourneyGuardedFetch('Journey');
      // Clear old research results, set new fields + run ID, THEN dispatch
      guardedFetch('/api/journey/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearResearch: true,
          fields: Object.fromEntries(
            Object.entries(acceptedJourneyFields).filter(([, v]) => v.trim().length > 0),
          ),
          activeRunId: nextRunId,
        }),
      }).then(() => {
        addLog('run', `Dispatching ${SECTION_META['industryMarket'] ?? 'Market Overview'}...`);
        return dispatchResearchSection('industryMarket', nextRunId, context);
      }).then((result) => {
        if (result.status === 'error') {
          addLog('err', `Market Overview dispatch failed: ${result.error ?? 'Unknown error'}`);
        } else {
          addLog('ok', `Market Overview dispatched (job: ${result.jobId ?? 'unknown'})`);
        }
      }).catch((err) => {
        addLog('err', `Dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    },
    [
      addLog,
      commitActiveRunId,
      partialResult,
    ],
  );

  // Handler for UnifiedFieldReview — takes a flat Record<string, string>
  const handleStartFromUnifiedReview = useCallback(
    (onboardingData: Record<string, string>) => {
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

      const nextRunId = createJourneyRunId();
      commitActiveRunId(nextRunId);
      const acceptedJourneyFields: Record<string, string> = {};

      for (const [key, rawValue] of Object.entries(onboardingData)) {
        const value = rawValue?.trim();
        if (value) acceptedJourneyFields[key] = value;
      }

      const displayName = acceptedJourneyFields.companyName || 'this company';
      const orderedFieldKeys = Object.keys(acceptedJourneyFields);

      const lines: string[] = ["Here's what I found about the company:"];
      for (const key of orderedFieldKeys) {
        const value = acceptedJourneyFields[key];
        if (!value) continue;
        lines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
      }
      lines.push('', 'Please use this context and begin the research journey.');

      addLog('ok', `Accepted ${Object.keys(acceptedJourneyFields).length} onboarding inputs`);

      // Go straight to workspace — render immediately while session persists
      hasTransitionedToWorkspaceRef.current = true;
      setJourneyPhase('workspace');

      // Clear old results, set new fields + run ID, THEN dispatch
      const context = lines.join('\n');
      const guardedFetch = createJourneyGuardedFetch('Journey');
      guardedFetch('/api/journey/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearResearch: true,
          fields: Object.fromEntries(
            Object.entries(acceptedJourneyFields).filter(([, v]) => v.trim().length > 0),
          ),
          activeRunId: nextRunId,
        }),
      }).then(() => {
        addLog('run', `Dispatching ${SECTION_META['industryMarket'] ?? 'Market Overview'}...`);
        return dispatchResearchSection('industryMarket', nextRunId, context);
      }).then((result) => {
        if (result.status === 'error') {
          addLog('err', `Market Overview dispatch failed: ${result.error ?? 'Unknown error'}`);
        } else {
          addLog('ok', `Market Overview dispatched (job: ${result.jobId ?? 'unknown'})`);
        }
      }).catch((err) => {
        addLog('err', `Dispatch failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    },
    [addLog, commitActiveRunId],
  );

  const handleArtifactApprove = useCallback(() => {
    setArtifactFeedbackSection(null);
    setRecentlyApprovedArtifactSection(artifactSection);
    setArtifactOpen(false);
    const result = researchResults[artifactSection];
    if (result) {
      appendRealtimeResearchMessage(artifactSection, result);
    }
    sendMessage({
      text: `[SECTION_APPROVED:${artifactSection}] Looks good`,
    });
  }, [appendRealtimeResearchMessage, artifactSection, researchResults, sendMessage]);

  const handleArtifactRequestChanges = useCallback(() => {
    setArtifactFeedbackSection(artifactSection);
    setRecentlyApprovedArtifactSection(null);
    showArtifactSection(artifactSection);
  }, [artifactSection, showArtifactSection]);

  const welcomeMessage = isResuming
    ? LEAD_AGENT_RESUME_WELCOME
    : LEAD_AGENT_WELCOME_MESSAGE;

  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.role === 'assistant';

  // Extract research card data from messages for the 2-column grid
  const researchCards = useMemo(() => {
    const cards = new Map<string, {
      section: string;
      status: 'loading' | 'complete' | 'error';
      data?: Record<string, unknown>;
      activity?: ReturnType<typeof useResearchJobActivity>[string];
      error?: string;
    }>();

    // From active research
    for (const section of activeResearch) {
      const activity = researchJobActivity[section];
      cards.set(section, {
        section,
        status: activity?.status === 'error' ? 'error' : 'loading',
        activity,
        error: activity?.status === 'error' ? activity.error : undefined,
      });
    }

    // From completed research
    for (const [section, result] of Object.entries(researchResults)) {
      if (result) {
        cards.set(section, {
          section,
          status: result.status === 'complete' ? 'complete' : 'error',
          data: (result.data ?? undefined) as Record<string, unknown> | undefined,
          activity: researchJobActivity[section],
          error: result.error,
        });
      }
    }

    return [...cards.values()];
  }, [activeResearch, researchJobActivity, researchResults]);

  // Artifact panel status — derived from existing research state
  const artifactStatus: 'loading' | 'complete' | 'error' = useMemo(() => {
    if (researchResults[artifactSection]) {
      const result = researchResults[artifactSection];
      return result?.status === 'complete' ? 'complete' : 'error';
    }
    if (researchJobActivity[artifactSection]?.status === 'error') {
      return 'error';
    }
    if (activeResearch.has(artifactSection)) return 'loading';
    return 'loading';
  }, [researchResults, researchJobActivity, activeResearch, artifactSection]);

  const artifactData = (researchResults[artifactSection]?.data ?? undefined) as Record<string, unknown> | undefined;
  const artifactActivity = researchJobActivity[artifactSection];
  const artifactApproved = approvedArtifactSections.has(artifactSection as JourneyReviewSection);
  const approvedSectionLabel =
    recentlyApprovedArtifactSection
      ? SECTION_META[recentlyApprovedArtifactSection] ?? recentlyApprovedArtifactSection
      : null;
  const approvedSectionNextStep =
    recentlyApprovedArtifactSection === 'industryMarket'
      ? 'Next, Journey moves into Competitor Intel.'
      : recentlyApprovedArtifactSection === 'competitors'
        ? 'Next, Journey validates the ICP against paid reachability and buying intent.'
        : recentlyApprovedArtifactSection === 'icpValidation'
          ? 'Next, Journey pressure-tests the offer and pricing.'
          : recentlyApprovedArtifactSection === 'offerAnalysis'
            ? 'Next, Journey synthesizes the approved sections into the strategy layer.'
            : null;
  const feedbackSectionLabel =
    artifactFeedbackSection
      ? SECTION_META[artifactFeedbackSection] ?? artifactFeedbackSection
      : null;

  // Whether to show artifact trigger in chat (research dispatched or complete for this section)
  const showArtifactTrigger =
    REVIEW_ARTIFACT_SECTIONS.has(artifactSection) &&
    (activeResearch.has(artifactSection) ||
      researchResults[artifactSection]?.status === 'complete');

  const showChatView = journeyPhase === 'chat';
  const showResumeView = journeyPhase === 'resume';
  const showStudioPreview = isJourneyStudioPreview(searchParams);
  const studioDockItems = showChatView ? progressItems : DEMO_PROGRESS_ITEMS;
  const conversationWidthClass = showStudioPreview
    ? 'mx-auto max-w-[56rem]'
    : artifactOpen
      ? ''
      : 'mx-auto max-w-3xl';
  const wideContentWidthClass = showStudioPreview
    ? 'mx-auto max-w-[68rem]'
    : artifactOpen
      ? ''
      : 'mx-auto max-w-5xl';
  const researchGridClassName = showStudioPreview
    ? 'grid-cols-1 max-w-[68rem] 2xl:grid-cols-2'
    : artifactOpen
      ? 'grid-cols-1 max-w-full'
      : 'grid-cols-2 max-w-5xl';
  const studioTitle = getJourneyStudioTitle(journeyPhase, artifactOpen);
  const studioDescription = getJourneyStudioDescription(
    journeyPhase,
    activeResearch.size,
    artifactOpen,
  );
  const studioStatusLabel = getJourneyStudioStatusLabel(
    journeyPhase,
    activeResearch.size,
    artifactOpen,
    savedSession,
  );
  const studioStatusDetail = getJourneyStudioStatusDetail(
    activeResearch.size,
    artifactOpen,
    artifactSection,
    studioDockItems,
    savedSession,
  );

  const renderStudioStateFrame = (content: React.ReactNode): React.ReactNode => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(60,131,246,0.08),transparent_34%),linear-gradient(180deg,rgba(17,16,13,0.92),rgba(9,9,8,0.96))]">
      <JourneyStepper
        currentPhase={currentPhase}
        completedPhases={completedPhases}
        className="justify-start gap-8 border-b border-white/[0.06] px-6 py-5 sm:px-8"
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {content}
      </div>
    </div>
  );

  const artifactPanel = (
    <ArtifactPanel
      activity={artifactActivity}
      section={artifactSection}
      status={artifactStatus}
      data={artifactData}
      approved={artifactApproved}
      onApprove={handleArtifactApprove}
      feedbackMode={artifactFeedbackSection === artifactSection}
      onRequestChanges={handleArtifactRequestChanges}
      onClose={() => setArtifactOpen(false)}
    />
  );

  const progressPanel = (
    <JourneyProgressPanel
      items={studioDockItems}
      computeStatus="stable"
      computePercent={85}
      variant={showStudioPreview ? 'studio' : 'default'}
      className={showStudioPreview ? 'h-full' : undefined}
    />
  );

  const chatWorkspace = (
    <>
      <JourneyStepper
        currentPhase={currentPhase}
        completedPhases={completedPhases}
        className={
          showStudioPreview
            ? 'justify-start gap-8 border-b border-white/[0.06] px-6 py-5 sm:px-8'
            : undefined
        }
      />

      <div className="flex flex-1 min-h-0">
        <div
          className={cn(
            'relative flex flex-col min-h-0 transition-all duration-300',
            showStudioPreview
              ? 'min-h-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(60,131,246,0.08),transparent_34%),linear-gradient(180deg,rgba(17,16,13,0.92),rgba(9,9,8,0.96))]'
              : artifactOpen
                ? 'w-[40%]'
                : 'w-full',
          )}
        >
          <section
            ref={scrollAreaRef}
            className={cn(
              'flex-1 overflow-y-auto custom-scrollbar',
              showStudioPreview
                ? 'space-y-6 px-6 pb-44 pt-6 sm:px-8'
                : 'space-y-8 px-6 pb-32',
            )}
          >
            {messages.length === 0 && (
              <div className={conversationWidthClass}>
                <ChatMessage
                  role="assistant"
                  content={welcomeMessage}
                  isStreaming={false}
                />
              </div>
            )}

            {researchCards.filter((card) => !REVIEW_ARTIFACT_SECTIONS.has(card.section)).length > 0 && (
              <div className={cn('grid gap-4', researchGridClassName)}>
                {researchCards
                  .filter((card) => !REVIEW_ARTIFACT_SECTIONS.has(card.section))
                  .map((card) => (
                    <ResearchInlineCard
                      key={card.section}
                      activity={card.activity}
                      section={card.section}
                      status={card.status}
                      data={card.data}
                      error={card.error}
                    />
                  ))}
              </div>
            )}

            {workerStatusItems.length > 0 && (
              <div className={wideContentWidthClass}>
                <JourneyWorkerStatusBanner items={workerStatusItems} />
              </div>
            )}

            {terminalLogs.length > 0 && (
              <div className={wideContentWidthClass}>
                <TerminalStream logs={terminalLogs} />
              </div>
            )}

            {messages
              .filter((m) => {
                if (
                  m.role === 'user' &&
                  m.parts?.some((part) =>
                    getMessageTextPartText(part)?.startsWith('[SECTION_APPROVED') === true,
                  )
                ) {
                  return false;
                }
                if (isHiddenJourneyMessage(m)) return false;
                if (m.id.startsWith('realtime-')) return false;
                return true;
              })
              .map((message, index) => {
                const isThisMessageStreaming =
                  message.role === 'assistant' &&
                  message.id === messages[messages.length - 1]?.id &&
                  isLastMessageStreaming;

                const metadata = message.metadata as Record<string, unknown> | undefined;
                const displayText = metadata?.displayText as string | undefined;
                const effectiveParts = displayText
                  ? [{ type: 'text' as const, text: displayText }]
                  : filterJourneyMessageParts(message.parts);

                return (
                  <div key={`${message.id}-${index}`} className={conversationWidthClass}>
                    <ChatMessage
                      messageId={message.id}
                      role={message.role as 'user' | 'assistant'}
                      parts={effectiveParts}
                      isStreaming={isThisMessageStreaming}
                      onToolApproval={(approvalId, approved) =>
                        addToolApprovalResponse({ id: approvalId, approved })
                      }
                      onToolOutput={handleAskUserResponse}
                    />
                  </div>
                );
              })}

            {showArtifactTrigger && (
              <div className={conversationWidthClass}>
                <ArtifactTriggerCard
                  approved={artifactApproved}
                  section={artifactSection}
                  status={artifactStatus}
                  onClick={() => showArtifactSection(artifactSection)}
                />
              </div>
            )}

            {recentlyApprovedArtifactSection && approvedSectionLabel && !artifactFeedbackSection && (
              <div className={conversationWidthClass}>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300/80">
                    {approvedSectionLabel} Approved
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/78">
                    {approvedSectionNextStep}
                  </p>
                </div>
              </div>
            )}

            {artifactFeedbackSection && feedbackSectionLabel && (
              <div className={conversationWidthClass}>
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-4">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/80">
                    Refine {feedbackSectionLabel}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/78">
                    Tell me what should change in this artifact. I&apos;ll keep the Journey
                    anchored here until the section is clarified and approved.
                  </p>
                </div>
              </div>
            )}

            {isSubmitted && (
              <div className={conversationWidthClass}>
                <TypingIndicator className="ml-9" />
              </div>
            )}

            {error && (
              <div className={conversationWidthClass}>
                <div
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                  }}
                >
                  {renderedChatError}
                </div>
              </div>
            )}

            {dispatchTimeoutFallbackSections.size > 0 && activeResearch.size > 0 && (
              <div className={conversationWidthClass}>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  Research is taking longer than expected. You can continue the conversation — results will appear if they complete.
                </div>
              </div>
            )}
          </section>

          <div
            className={cn(
              'pointer-events-none flex justify-center',
              showStudioPreview
                ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c0b09] via-[#0c0b09]/96 to-transparent px-5 pb-6 pt-20'
                : 'absolute bottom-8 left-0 right-0 px-6',
            )}
          >
            <JourneyChatInput
              onSubmit={handleSubmit}
              isLoading={isLoading && !pendingAskUser}
              placeholder={
                artifactFeedbackSection && feedbackSectionLabel
                  ? `Tell me what to change in ${feedbackSectionLabel}...`
                  : pendingAskUser
                    ? 'Pick an option or type your own answer...'
                    : isResuming
                      ? "Let's pick up where we left off..."
                      : 'Ask AIGOS to refine the strategy...'
              }
              variant={showStudioPreview ? 'studio' : 'default'}
            />
          </div>
        </div>

        {!showStudioPreview && (
          <AnimatePresence>
            {artifactOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: '60%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                {artifactPanel}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </>
  );

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
      onRetry={() => {
        stopPrefill();

        setPrefillWebsiteUrl('');
        setJourneyPhase('welcome');
      }}
      onComplete={() => setJourneyPhase('review')}
    />
  );

  const reviewWorkspace = (
    <UnifiedFieldReview
      extractedFields={extractedFieldsFlat}
      presetFields={prefillReviewPreset?.values}
      onStart={handleStartFromUnifiedReview}
    />
  );

  const welcomeWorkspace = (
    <WelcomeForm
      onAnalyze={(websiteUrl, linkedinUrl) => {
        setPrefillWebsiteUrl(websiteUrl);

        submitPrefill({ websiteUrl, linkedinUrl });
        setJourneyPhase('prefilling');
        addLog('run', `Analyzing ${websiteUrl}`);
      }}
    />
  );

  const standardWorkspace = showChatView
    ? chatWorkspace
    : showResumeView
      ? resumeWorkspace
      : journeyPhase === 'prefilling'
        ? prefillWorkspace
        : journeyPhase === 'review'
          ? reviewWorkspace
          : welcomeWorkspace;

  const previewWorkspace = showChatView
    ? chatWorkspace
    : renderStudioStateFrame(standardWorkspace);

  // Workspace phase — replaces entire chat layout with artifact-first workspace
  if (journeyPhase === 'workspace') {
    const handleWorkspaceSectionApproved = (approvedSection: SectionKey) => {
      const nextSection = getNextSection(approvedSection);
      if (!nextSection || !activeRunId) return;

      // Build context from persisted onboarding state
      const session = getJourneySession();
      const contextLines: string[] = [];
      if (session) {
        for (const [key, value] of Object.entries(session)) {
          if (typeof value === 'string' && value.trim()) {
            contextLines.push(`${JOURNEY_FIELD_LABELS[key] ?? key}: ${value}`);
          }
        }
      }
      const context = contextLines.length > 0
        ? contextLines.join('\n')
        : 'Research context from onboarding session';

      addLog('run', `Dispatching ${SECTION_META[nextSection] ?? nextSection}...`);
      void dispatchResearchSection(nextSection, activeRunId, context);
    };

    return (
      <div
        className="flex h-screen flex-col font-sans"
        style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}
      >
        <div className="flex flex-1 min-h-0">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-h-0 min-w-0">
            <WorkspaceProvider sessionId={activeRunId ?? 'default'} startInWorkspace>
              <WorkspacePage
                userId={user?.id}
                activeRunId={activeRunId}
                onSectionApproved={handleWorkspaceSectionApproved}
              />
            </WorkspaceProvider>
          </div>
        </div>
      </div>
    );
  }

  const previewDock = artifactOpen ? (
    <JourneyStudioPreviewDock
      eyebrow="Artifact Review"
      title={SECTION_META[artifactSection] ?? artifactSection}
    >
      {artifactPanel}
    </JourneyStudioPreviewDock>
  ) : (
    <JourneyStudioPreviewDock
      eyebrow="Proof Dock"
      title={showChatView ? 'Progress and evidence' : 'Journey readiness'}
      className="hidden xl:flex"
    >
      {progressPanel}
    </JourneyStudioPreviewDock>
  );
  return (
    <div
      className="flex h-screen flex-col font-sans"
      style={{
        background: showStudioPreview ? '#040403' : 'var(--bg-base)',
        color: '#E5E5E5',
      }}
    >
      <div className="flex flex-1 min-h-0">
        <AppSidebar />

        <main className={cn(
          'relative flex flex-1 flex-col min-h-0 min-w-0',
          showStudioPreview
            ? 'bg-[radial-gradient(circle_at_top_left,rgba(60,131,246,0.04),transparent_32%),linear-gradient(180deg,rgba(8,8,7,0.98),rgba(4,4,3,1))]'
            : 'bg-gradient-to-b from-transparent to-white/[0.01]',
        )}>
          {showStudioPreview ? (
            <JourneyStudioPreviewShell
              eyebrow="AIGOS Journey"
              title={studioTitle}
              description={studioDescription}
              statusLabel={studioStatusLabel}
              statusDetail={studioStatusDetail}
              dock={previewDock}
            >
              {previewWorkspace}
            </JourneyStudioPreviewShell>
          ) : (
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
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prefill Review View — shows extracted fields for acceptance/editing
// ---------------------------------------------------------------------------
function PrefillReviewView({
  partialResult,
  fieldsFound,
  websiteUrl,
  onAccept,
}: {
  partialResult: ReturnType<typeof useJourneyPrefill>['partialResult'];
  fieldsFound: number;
  websiteUrl: string;
  onAccept: (payload?: PrefillAcceptPayload) => void;
}) {
  const [editedFields, setEditedFields] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [manualFields, setManualFields] = useState<Record<string, string>>({});

  const foundFields = useMemo(() => {
    const fields: Array<{ key: string; label: string; value: string; confidence: number }> = [];
    for (const { key, label } of JOURNEY_PREFILL_REVIEW_FIELDS) {
      const value = readJourneyPrefillFieldValue(
        partialResult as Record<string, unknown>,
        key,
      );
      if (!value) continue;

      const field = partialResult?.[key as keyof typeof partialResult];
      fields.push({
        key,
        label,
        value,
        confidence:
          field && typeof field === 'object' && 'confidence' in field
            ? (field as { confidence?: number }).confidence ?? 0
            : 0,
      });
    }
    return fields;
  }, [partialResult]);

  const preset = useMemo(
    () =>
      getManualPrefillPreset({
        websiteUrl,
        companyName:
          editedFields.companyName?.trim() ||
          readJourneyPrefillFieldValue(
            partialResult as Record<string, unknown>,
            'companyName',
          ),
      }),
    [editedFields.companyName, partialResult, websiteUrl],
  );

  const resolvedManualFieldValues = useMemo(() => {
    const values: Record<string, string> = {};

    for (const field of JOURNEY_MANUAL_BLOCKER_FIELDS) {
      const manualValue = manualFields[field.key];
      if (typeof manualValue === 'string') {
        values[field.key] = manualValue;
        continue;
      }

      const editedValue = editedFields[field.key];
      if (typeof editedValue === 'string') {
        values[field.key] = editedValue;
        continue;
      }

      const extractedValue = readJourneyPrefillFieldValue(
        partialResult as Record<string, unknown>,
        field.key,
      );
      if (extractedValue) {
        values[field.key] = extractedValue;
        continue;
      }

      values[field.key] = preset?.values[field.key] ?? '';
    }

    return values;
  }, [editedFields, manualFields, partialResult, preset]);

  const pricingContextReady = Boolean(
    resolvedManualFieldValues.pricingTiers?.trim() ||
      resolvedManualFieldValues.monthlyAdBudget?.trim(),
  );

  const missingManualBlockers = useMemo(() => {
    const missing: string[] = [];
    let pricingMissingAdded = false;

    for (const field of JOURNEY_MANUAL_BLOCKER_FIELDS) {
      if (field.requiredGroup === 'pricingContext') {
        if (!pricingContextReady && !pricingMissingAdded) {
          missing.push('Pricing or Budget');
          pricingMissingAdded = true;
        }
        continue;
      }

      if (field.required && !resolvedManualFieldValues[field.key]?.trim()) {
        missing.push(field.label);
      }
    }

    return missing;
  }, [pricingContextReady, resolvedManualFieldValues]);

  const canStartResearch = missingManualBlockers.length === 0;

  return (
    <section
      data-testid="prefill-review"
      className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-8 pb-16"
    >
      <div className="max-w-2xl mx-auto flex flex-col pt-10 sm:pt-14 gap-8">
        {/* Header */}
        <div className="space-y-3">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-white">
            Found {fieldsFound} details from your site
          </h2>
          <p className="text-sm text-white/40 leading-relaxed">
            Review the extracted info below. Click any value to edit before starting.
          </p>
        </div>

        {/* Extracted fields */}
        <div className="space-y-2">
          {foundFields.map(({ key, label, value }) => {
            const hasEditedValue = Object.prototype.hasOwnProperty.call(editedFields, key);
            const displayValue = hasEditedValue ? editedFields[key] : value;
            const isEditing = editingKey === key;

            return (
              <div
                key={key}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3 group cursor-pointer transition-colors hover:border-white/[0.1]"
                onClick={() => {
                  if (!isEditing) {
                    if (!hasEditedValue) setEditedFields((prev) => ({ ...prev, [key]: value }));
                    setEditingKey(key);
                  }
                }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-emerald-500/15">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.16em]">{label}</span>
                  {isEditing ? (
                    <input
                      autoFocus
                      className="w-full mt-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-[var(--accent-blue)]/40"
                      value={displayValue}
                      onChange={(e) => setEditedFields((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => setEditingKey(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setEditingKey(null); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p className="text-sm text-white/75 mt-0.5 break-words leading-relaxed">
                      {displayValue}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Human Context — required fields */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <h3 className="font-heading text-lg font-semibold text-white">
                Fill what the web can&apos;t know
              </h3>
              <p className="text-sm text-white/35">
                Complete these before research begins.
              </p>
            </div>
            {preset ? (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
                Auto-prefill: {preset.label}
              </span>
            ) : null}
          </div>

          {/* Status banner */}
          <div
            className={cn(
              'rounded-xl border px-4 py-3',
              canStartResearch
                ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                : 'border-amber-500/20 bg-amber-500/[0.06]',
            )}
          >
            <p className={cn('text-sm font-medium', canStartResearch ? 'text-emerald-300' : 'text-amber-300')}>
              {canStartResearch
                ? 'Ready to start research.'
                : `${missingManualBlockers.length} required field${missingManualBlockers.length > 1 ? 's' : ''} missing`}
            </p>
            {!canStartResearch && (
              <p className="mt-1 text-xs text-white/35">
                {missingManualBlockers.join(' · ')}
              </p>
            )}
          </div>

          {/* Manual fields */}
          <div className="grid gap-3">
            {JOURNEY_MANUAL_BLOCKER_FIELDS.map((field) => {
              const value = resolvedManualFieldValues[field.key] ?? '';
              const isMissing = field.requiredGroup === 'pricingContext'
                ? !pricingContextReady
                : Boolean(field.required && !value.trim());
              const presetValue = preset?.values[field.key];
              const extractedValue = readJourneyPrefillFieldValue(
                partialResult as Record<string, unknown>,
                field.key,
              );
              const usedPreset = Boolean(
                presetValue &&
                  !extractedValue &&
                  !Object.prototype.hasOwnProperty.call(manualFields, field.key),
              );

              return (
                <div
                  key={field.key}
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    isMissing
                      ? 'border-amber-500/20 bg-amber-500/[0.03]'
                      : 'border-white/[0.06] bg-white/[0.02]',
                  )}
                  data-testid={`manual-blocker-${field.key}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/35">
                      {field.label}
                      {(field.required || field.requiredGroup) && (
                        <span className="ml-1.5 text-amber-400/80">*</span>
                      )}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {usedPreset && (
                        <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                          Auto-filled
                        </span>
                      )}
                      {isMissing && (
                        <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 font-medium">
                          Required
                        </span>
                      )}
                    </div>
                  </div>

                  {field.rows > 1 ? (
                    <textarea
                      rows={field.rows}
                      value={value}
                      onChange={(event) =>
                        setManualFields((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                      className={cn(
                        'mt-3 w-full resize-none rounded-lg border bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-white/15 outline-none transition-colors',
                        isMissing ? 'border-amber-500/20 focus:border-amber-500/40' : 'border-white/[0.06] focus:border-[var(--accent-blue)]/40',
                      )}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(event) =>
                        setManualFields((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                      className={cn(
                        'mt-3 w-full rounded-lg border bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-white/15 outline-none transition-colors',
                        isMissing ? 'border-amber-500/20 focus:border-amber-500/40' : 'border-white/[0.06] focus:border-[var(--accent-blue)]/40',
                      )}
                      placeholder={field.placeholder}
                    />
                  )}

                  {field.helper && (
                    <p className="mt-2 text-[11px] leading-relaxed text-white/25">{field.helper}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Single CTA — sticky at bottom */}
        <div className="sticky bottom-4 z-10">
          <button
            disabled={!canStartResearch}
            onClick={() =>
              onAccept({
                editedFields: Object.keys(editedFields).length > 0 ? editedFields : undefined,
                manualFields: resolvedManualFieldValues,
              })
            }
            className={cn(
              'w-full h-12 rounded-full font-semibold text-[15px] transition-all duration-200 cursor-pointer',
              canStartResearch
                ? 'bg-white text-black hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(255,255,255,0.08)]'
                : 'bg-white/10 text-white/30 cursor-not-allowed',
            )}
          >
            {canStartResearch ? 'Start Market Overview' : `Fill ${missingManualBlockers.length} required field${missingManualBlockers.length > 1 ? 's' : ''} to continue`}
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Welcome form — URL inputs matching the journey-v2 mockup
// ---------------------------------------------------------------------------
function WelcomeForm({
  onAnalyze,
}: {
  onAnalyze: (websiteUrl: string, linkedinUrl: string) => void;
}) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [urlFocused, setUrlFocused] = useState(false);
  const [linkedinFocused, setLinkedinFocused] = useState(false);

  // Shared motion config — mirrors fadeUp + springs.gentle
  const fadeUpVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };
  const gentleTransition = { type: 'spring' as const, stiffness: 300, damping: 35 };

  const processSteps = [
    { label: 'Seed context' },
    { label: 'Verify findings' },
    { label: 'Research streams' },
  ];

  return (
    <section className="flex-1 flex items-center justify-center overflow-y-auto custom-scrollbar">
      <div className="max-w-lg mx-auto flex flex-col items-center px-6 space-y-10">

        {/* Heading */}
        <motion.div
          className="text-center space-y-4"
          variants={fadeUpVariants}
          initial="initial"
          animate="animate"
          transition={{ ...gentleTransition, delay: 0 }}
        >
          <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-[-0.04em] text-white">
            Seed your strategy.
          </h1>
          <p className="text-[16px] text-white/40 max-w-sm mx-auto leading-[1.7]">
            Drop your website URL. AIGOS pulls context, runs research, and builds your media blueprint.
          </p>
        </motion.div>

        {/* URL input card */}
        <motion.div
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6 space-y-5"
          variants={fadeUpVariants}
          initial="initial"
          animate="animate"
          transition={{ ...gentleTransition, delay: 0.1 }}
          style={{
            borderColor: urlFocused || linkedinFocused
              ? 'rgba(54, 94, 255, 0.3)'
              : undefined,
            boxShadow: urlFocused || linkedinFocused
              ? '0 0 30px rgba(54, 94, 255, 0.08)'
              : undefined,
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          }}
        >
          {/* Website URL */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.16em] text-white/30 mb-2.5">
              Company Website
            </label>
            <div className="relative">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onFocus={() => setUrlFocused(true)}
                onBlur={() => setUrlFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && websiteUrl.trim()) {
                    onAnalyze(websiteUrl.trim(), linkedinUrl.trim());
                  }
                }}
                placeholder="https://yourcompany.com"
                autoFocus
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-base text-white/90 placeholder:text-white/20 placeholder:font-mono outline-none transition-all duration-200 focus:border-[var(--accent-blue)]/40"
              />
              <motion.div
                className="absolute bottom-0 left-3 right-3 h-px rounded-full"
                style={{
                  background: 'linear-gradient(90deg, var(--accent-blue) 0%, rgb(0, 111, 255) 50%, rgb(120, 80, 255) 100%)',
                  originX: 0.5,
                }}
                animate={{ scaleX: urlFocused ? 1 : 0, opacity: urlFocused ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.04]" />

          {/* LinkedIn */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-[0.16em] text-white/30 mb-2.5">
              LinkedIn Company Page
              <span className="ml-1.5 normal-case tracking-normal text-white/15">
                (optional)
              </span>
            </label>
            <div className="relative">
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                onFocus={() => setLinkedinFocused(true)}
                onBlur={() => setLinkedinFocused(false)}
                placeholder="https://linkedin.com/company/your-company"
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-2.5 text-sm text-white/90 placeholder:text-white/15 placeholder:font-mono outline-none transition-all duration-200 focus:border-[var(--accent-blue)]/40"
              />
              <motion.div
                className="absolute bottom-0 left-3 right-3 h-px rounded-full"
                style={{
                  background: 'linear-gradient(90deg, var(--accent-blue) 0%, rgb(0, 111, 255) 50%, rgb(120, 80, 255) 100%)',
                  originX: 0.5,
                }}
                animate={{ scaleX: linkedinFocused ? 1 : 0, opacity: linkedinFocused ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            </div>
          </div>
        </motion.div>

        {/* CTA + trust */}
        <motion.div
          className="flex flex-col items-center gap-4 w-full"
          variants={fadeUpVariants}
          initial="initial"
          animate="animate"
          transition={{ ...gentleTransition, delay: 0.2 }}
        >
          <motion.button
            onClick={() => {
              if (websiteUrl.trim()) onAnalyze(websiteUrl.trim(), linkedinUrl.trim());
            }}
            disabled={!websiteUrl.trim()}
            className={cn(
              'cursor-pointer h-12 rounded-full bg-white text-black font-semibold text-[15px] px-8 transition-all duration-200',
              'hover:bg-white/90 hover:shadow-[0_8px_30px_rgba(255,255,255,0.08)]',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:shadow-none',
            )}
            whileHover={websiteUrl.trim() ? { scale: 1.01 } : {}}
            whileTap={websiteUrl.trim() ? { scale: 0.98 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            Begin Analysis
          </motion.button>
          <p className="text-[11px] text-white/15 tracking-wide">
            Takes ~3 minutes. No credit card required.
          </p>
        </motion.div>

      </div>
    </section>
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
