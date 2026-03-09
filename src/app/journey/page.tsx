'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import { useUser } from '@clerk/nextjs';
import { ShellProvider } from '@/components/shell';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { ChatMessage } from '@/components/journey/chat-message';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { TypingIndicator } from '@/components/journey/typing-indicator';
import { ResumePrompt } from '@/components/journey/resume-prompt';
import { useResearchRealtime } from '@/lib/journey/research-realtime';
import type { ResearchSectionResult } from '@/lib/journey/research-realtime';
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
import { ResearchInlineCard } from '@/components/journey/research-inline-card';
import { ProfileCard } from '@/components/journey/profile-card';

// Demo progress items matching the mockup's right panel
const DEMO_PROGRESS_ITEMS: ProgressItem[] = [
  { id: 'marketResearch', label: 'Market Research', status: 'complete', detail: 'Completed 12m ago' },
  { id: 'icpValidation', label: 'ICP Validation', status: 'active', detail: 'Processing data...' },
  { id: 'adAngleCreation', label: 'Ad Angle Creation', status: 'queued', detail: 'Queued' },
  { id: 'creativeGen', label: 'Creative Gen', status: 'queued', detail: 'Queued' },
];


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
  };
  return map[section] ?? section;
}

// Derive stepper phase from research state
function deriveStepperPhase(researchResults: Record<string, ResearchSectionResult | null>): {
  currentPhase: StepperPhase;
  completedPhases: StepperPhase[];
} {
  const hasMarket = !!researchResults.industryMarket;
  const hasCompetitors = !!researchResults.competitors;
  const hasICP = !!researchResults.icpValidation;
  const hasOffer = !!researchResults.offerAnalysis;
  const hasSynthesis = !!researchResults.crossAnalysis;

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
    { id: 'industryMarket', label: 'Market Research' },
    { id: 'icpValidation', label: 'ICP Validation' },
    { id: 'competitors', label: 'Competitor Intel' },
    { id: 'offerAnalysis', label: 'Offer Analysis' },
    { id: 'crossAnalysis', label: 'Strategic Synthesis' },
    { id: 'keywordIntel', label: 'Keyword Intel' },
  ];

  return sections.map((s) => {
    const result = researchResults[s.id];
    const isActive = activeResearch.has(s.id);

    let status: ProgressItem['status'] = 'queued';
    let detail = 'Queued';

    if (result) {
      status = 'complete';
      detail = 'Completed';
    } else if (isActive) {
      status = 'active';
      detail = 'Processing data...';
    }

    return { id: s.id, label: s.label, status, detail };
  });
}

function JourneyPageContent() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Resume state
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedSession, setSavedSession] = useState<OnboardingState | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [transportBody, setTransportBody] = useState<Record<string, unknown> | undefined>(undefined);

  const [onboardingState, setOnboardingState] = useState<Partial<OnboardingState> | null>(null);

  // Research state tracking
  const [researchResults, setResearchResults] = useState<Record<string, ResearchSectionResult | null>>({});
  const [activeResearch, setActiveResearch] = useState<Set<string>>(new Set());
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);

  useEffect(() => {
    const saved = getJourneySession();
    if (saved) {
      setOnboardingState(saved);
      if (hasAnsweredFields(saved)) {
        setSavedSession(saved);
        setShowResumePrompt(true);
      }
    }
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
        body: transportBody,
      }),
    [transportBody]
  );

  const { messages, sendMessage, addToolOutput, addToolApprovalResponse, status, error, setMessages } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
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

  // Supabase Realtime — receive async research results
  const { user } = useUser();
  const [researchTimedOut, setResearchTimedOut] = useState(false);

  // Add terminal log helper
  const addLog = useCallback((level: TerminalLogEntry['level'], message: string) => {
    setTerminalLogs((prev) => [...prev.slice(-50), { level, message, timestamp: Date.now() }]);
  }, []);

  useResearchRealtime({
    userId: user?.id,
    onSectionComplete: (section: string, result: ResearchSectionResult) => {
      // Track research completion
      setResearchResults((prev) => ({ ...prev, [section]: result }));
      setActiveResearch((prev) => {
        const next = new Set(prev);
        next.delete(section);
        return next;
      });

      // Add terminal log
      const sectionLabel = SECTION_META[section] ?? section;
      addLog('ok', `${sectionLabel} research complete`);

      const toolName = sectionToToolName(section);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syntheticMessage: any = {
        id: `realtime-${section}-${Date.now()}`,
        role: 'assistant' as const,
        content: '',
        parts: [
          {
            type: `tool-${toolName}`,
            toolName,
            toolCallId: `realtime-${section}`,
            state: 'output-available' as const,
            input: {},
            output: JSON.stringify(result),
          },
        ],
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, syntheticMessage]);
    },
    onAllSectionsComplete: () => {
      addLog('ok', 'All research sections complete');
      sendMessage({
        text: "Okay — looks like the research is all in. What's your read on everything you found?",
      });
    },
    onTimeout: (pendingSections) => {
      console.warn('[journey] Research timed out, pending:', pendingSections);
      addLog('warn', `Research timed out for: ${pendingSections.join(', ')}`);
      setResearchTimedOut(true);
    },
  });

  // Derived state
  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';

  // Stepper state
  const { currentPhase, completedPhases } = deriveStepperPhase(researchResults);

  // Progress panel items
  const progressItems = deriveProgressItems(researchResults, activeResearch);

  // Completion percentage
  const completionPercentage = useMemo(() => {
    const totalSections = 6;
    const completedCount = Object.values(researchResults).filter(Boolean).length;
    return Math.round((completedCount / totalSections) * 100);
  }, [researchResults]);

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
  const hasMessages = messages.length > 0;

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
          [result.fieldName]: value,
          lastUpdated: new Date().toISOString(),
        };
        const { requiredFieldsCompleted, completionPercent } = calculateCompletion(updated);
        updated.requiredFieldsCompleted = requiredFieldsCompleted;
        updated.completionPercent = completionPercent;
        setJourneySession(updated);
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
    [addToolOutput]
  );

  // Submit handler
  const handleSubmit = useCallback(
    (content: string) => {
      if (!content.trim() || isLoading) return;

      if (pendingAskUser) {
        handleAskUserResponse(pendingAskUser.toolCallId, {
          fieldName: pendingAskUser.fieldName,
          otherText: content.trim(),
        });
        return;
      }

      // Add terminal log for user messages
      addLog('run', `Processing: "${content.trim().slice(0, 60)}${content.trim().length > 60 ? '...' : ''}"`);
      sendMessage({ text: content.trim() });
    },
    [isLoading, sendMessage, pendingAskUser, handleAskUserResponse, addLog]
  );

  // Resume handlers
  const handleResumeContinue = useCallback(() => {
    if (savedSession) {
      setTransportBody({ resumeState: getAnsweredFields(savedSession) });
      setIsResuming(true);
      addLog('ok', 'Resuming previous session');
    }
    setShowResumePrompt(false);
  }, [savedSession, addLog]);

  const handleResumeStartFresh = useCallback(() => {
    clearJourneySession();
    setTransportBody(undefined);
    setSavedSession(null);
    setIsResuming(false);
    setOnboardingState(null);
    setShowResumePrompt(false);
    addLog('inf', 'Starting fresh journey');
  }, [addLog]);

  const welcomeMessage = isResuming
    ? LEAD_AGENT_RESUME_WELCOME
    : LEAD_AGENT_WELCOME_MESSAGE;

  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.role === 'assistant';

  // Extract research card data from messages for the 2-column grid
  const researchCards = useMemo(() => {
    const cards: Array<{
      section: string;
      status: 'loading' | 'complete' | 'error';
      data?: Record<string, unknown>;
    }> = [];

    // From active research
    for (const section of activeResearch) {
      cards.push({ section, status: 'loading' });
    }

    // From completed research
    for (const [section, result] of Object.entries(researchResults)) {
      if (result) {
        cards.push({
          section,
          status: 'complete',
          data: result as unknown as Record<string, unknown>,
        });
      }
    }

    return cards;
  }, [activeResearch, researchResults]);

  const showActiveContent = hasMessages || showResumePrompt;

  return (
    <div
      className="h-screen flex flex-col font-sans"
      style={{ background: '#050505', color: '#E5E5E5', overflow: 'hidden' }}
    >
      {/* Body — sidebar + main + right panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <AppSidebar />

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-b from-transparent to-white/[0.01]">
          {showActiveContent ? (
            <>
              {/* Stepper */}
              <JourneyStepper
                currentPhase={currentPhase}
                completedPhases={completedPhases}
              />

              {/* Scrollable content */}
              <section
                ref={scrollAreaRef}
                className="flex-1 overflow-y-auto custom-scrollbar px-12 pb-32 space-y-12"
              >
                {/* Resume prompt OR welcome message */}
                {showResumePrompt && savedSession ? (
                  <div className="max-w-3xl mx-auto">
                    <ResumePrompt
                      session={savedSession}
                      onContinue={handleResumeContinue}
                      onStartFresh={handleResumeStartFresh}
                    />
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto">
                    <ChatMessage
                      role="assistant"
                      content={welcomeMessage}
                      isStreaming={false}
                    />
                  </div>
                )}

                {/* Research module cards — 2-column grid */}
                {researchCards.length > 0 && (
                  <div className="grid grid-cols-2 gap-6 max-w-5xl mx-auto">
                    {researchCards.map((card) => (
                      <ResearchInlineCard
                        key={card.section}
                        section={card.section}
                        status={card.status}
                        data={card.data}
                      />
                    ))}
                  </div>
                )}

                {/* Terminal log stream */}
                {terminalLogs.length > 0 && (
                  <div className="max-w-5xl mx-auto">
                    <TerminalStream logs={terminalLogs} />
                  </div>
                )}

                {/* Conversation messages */}
                {messages.map((message, index) => {
                  const isThisMessageStreaming =
                    message.role === 'assistant' &&
                    index === messages.length - 1 &&
                    isLastMessageStreaming;

                  return (
                    <div key={message.id} className="max-w-3xl mx-auto">
                      <ChatMessage
                        messageId={message.id}
                        role={message.role as 'user' | 'assistant'}
                        parts={message.parts}
                        isStreaming={isThisMessageStreaming}
                        onToolApproval={(approvalId, approved) =>
                          addToolApprovalResponse({ id: approvalId, approved })
                        }
                        onToolOutput={handleAskUserResponse}
                      />
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isSubmitted && (
                  <div className="max-w-3xl mx-auto">
                    <TypingIndicator className="ml-9" />
                  </div>
                )}

                {/* Profile snapshot card */}
                {onboardingState && (
                  <div className="max-w-5xl mx-auto">
                    <ProfileCard state={onboardingState} />
                  </div>
                )}

                {/* Error display */}
                {error && (
                  <div className="max-w-3xl mx-auto">
                    <div
                      className="px-3 py-2 rounded-lg text-xs"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                      }}
                    >
                      {error.message || 'Something went wrong. Please try again.'}
                    </div>
                  </div>
                )}

                {/* Research timeout warning — only during active chat, not welcome/resume */}
                {researchTimedOut && hasMessages && (
                  <div className="max-w-3xl mx-auto">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                      Research is taking longer than expected. You can continue the conversation — results will appear if they complete.
                    </div>
                  </div>
                )}
              </section>

              {/* Floating Input Bar */}
              <div className="absolute bottom-8 left-0 right-0 flex justify-center px-12 pointer-events-none">
                <JourneyChatInput
                  onSubmit={handleSubmit}
                  isLoading={(isLoading && !pendingAskUser) || showResumePrompt}
                  placeholder={
                    showResumePrompt
                      ? 'Choose an option above to continue...'
                      : pendingAskUser
                        ? 'Pick an option or type your own answer...'
                        : isResuming
                          ? "Let's pick up where we left off..."
                          : 'Ask AI-GOS to refine the strategy...'
                  }
                />
              </div>
            </>
          ) : (
            <WelcomeForm
              onAnalyze={(websiteUrl, linkedinUrl) => {
                const msg = linkedinUrl
                  ? `Website: ${websiteUrl}\nLinkedIn: ${linkedinUrl}`
                  : `Website: ${websiteUrl}`;
                addLog('run', `Analyzing ${websiteUrl}`);
                sendMessage({ text: msg });
              }}
              onSkip={() => {
                addLog('inf', 'Starting without website analysis');
                sendMessage({ text: 'Start without website analysis' });
              }}
            />
          )}
        </main>

        {/* Right Panel — Journey Progress */}
        <aside className="w-72 flex-none border-l border-brand-border p-8 hidden xl:flex flex-col">
          <JourneyProgressPanel
            items={showActiveContent ? progressItems : DEMO_PROGRESS_ITEMS}
            computeStatus="stable"
            computePercent={85}
          />
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome form — URL inputs matching the journey-v2 mockup
// ---------------------------------------------------------------------------
function WelcomeForm({
  onAnalyze,
  onSkip,
}: {
  onAnalyze: (websiteUrl: string, linkedinUrl: string) => void;
  onSkip: () => void;
}) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');

  return (
    <section className="flex-1 overflow-y-auto custom-scrollbar px-12 pb-12">
      <div className="max-w-3xl mx-auto flex flex-col items-center pt-12 space-y-10">
        {/* Badge */}
        <span className="inline-block text-xs font-medium tracking-wide text-white/60 border border-white/10 rounded-full px-4 py-1.5">
          AI-GOS
        </span>

        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-light text-white/95 leading-tight">
            Build your paid media{' '}
            <span className="text-brand-accent">strategy.</span>
          </h1>
          <p className="text-white/40 text-sm max-w-lg mx-auto">
            Drop your website URL and EGOS handles the rest — market research, competitive intel, ICP validation, and a full media plan.
          </p>
          <p className="text-white/25 text-xs">~10 min to complete strategy</p>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[
            {
              num: 1,
              color: 'bg-brand-accent',
              title: 'Seed context',
              desc: 'Give EGOS your homepage to pull business context automatically.',
            },
            {
              num: 2,
              color: 'bg-brand-success',
              title: 'Verify findings',
              desc: 'Review and approve what AI discovered before research begins.',
            },
            {
              num: 3,
              color: 'bg-brand-success',
              title: 'Watch research stream',
              desc: 'Six research sections generate live with evidence and citations.',
            },
          ].map((step) => (
            <div
              key={step.num}
              className="glass-surface rounded-2xl p-5 space-y-3"
            >
              <div className={`w-7 h-7 rounded-lg ${step.color} flex items-center justify-center text-xs font-bold text-black`}>
                {step.num}
              </div>
              <h3 className="text-sm font-medium text-white/90">{step.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* URL inputs */}
        <div className="w-full glass-surface rounded-2xl p-6 space-y-5">
          {/* Website URL */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-white/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              Company website
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/30 transition-colors"
            />
          </div>

          {/* LinkedIn URL */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-white/60">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn company page
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/company/your-company"
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/30 transition-colors"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={() => {
              if (websiteUrl.trim()) onAnalyze(websiteUrl.trim(), linkedinUrl.trim());
            }}
            disabled={!websiteUrl.trim()}
            className="flex-1 flex items-center justify-center gap-2 bg-brand-accent hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 rounded-xl text-sm font-medium text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Analyze website first
          </button>
          <button
            onClick={onSkip}
            className="flex-1 px-6 py-3 rounded-xl text-sm font-medium text-white/60 border border-white/10 hover:bg-white/5 hover:text-white/80 transition-all"
          >
            Start without website analysis
          </button>
        </div>
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
