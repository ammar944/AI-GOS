'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import { AppShell, AppSidebar, ShellProvider } from '@/components/shell';
import { ChatMessage } from '@/components/journey/chat-message';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { TypingIndicator } from '@/components/journey/typing-indicator';
import { ResumePrompt } from '@/components/journey/resume-prompt';
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
import { WelcomeState } from '@/components/journey/welcome-state';
import { ProfileCard } from '@/components/journey/profile-card';

export default function JourneyPage() {
  return (
    <ShellProvider>
      <JourneyPageContent />
    </ShellProvider>
  );
}

function JourneyPageContent() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Resume state
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedSession, setSavedSession] = useState<OnboardingState | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [transportBody, setTransportBody] = useState<Record<string, unknown> | undefined>(undefined);

  const [onboardingState, setOnboardingState] = useState<Partial<OnboardingState> | null>(null);

  useEffect(() => {
    const saved = getJourneySession();
    if (saved) {
      setOnboardingState(saved);
      if (hasAnsweredFields(saved)) {
        // Partial or complete session — show resume prompt
        setSavedSession(saved);
        setShowResumePrompt(true);
      }
    }
  }, []);

  // Transport — body includes resumeState when resuming a previous session.
  // transportBody changes at most once (when user clicks "Continue"), before
  // any messages are sent, so recreating the transport is safe.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
        body: transportBody,
      }),
    [transportBody]
  );

  // Chat hook
  const { messages, sendMessage, addToolOutput, addToolApprovalResponse, status, error, setMessages } = useChat({
    transport,
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
    onError: (err) => {
      console.error('Journey chat error:', err);
      // MissingToolResultsError — strip the last assistant message with orphaned tool calls
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

  // Derived state
  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';

  // Block input while any tool is waiting for user interaction (chips or approval)
  const hasPendingToolInteraction = messages.some(
    (msg) =>
      msg.role === 'assistant' &&
      msg.parts.some(
        (part) =>
          typeof part === 'object' &&
          'type' in part &&
          typeof (part as Record<string, unknown>).type === 'string' &&
          ((part as Record<string, unknown>).type as string).startsWith('tool-') &&
          'state' in part &&
          ((part as Record<string, unknown>).state === 'approval-requested' ||
            (part as Record<string, unknown>).state === 'input-available')
      )
  );

  const isLoading = isStreaming || isSubmitted || hasPendingToolInteraction;

  const hasMessages = messages.length > 0;
  const journeyPhase = hasMessages ? 1 : 0;

  // Prevent document-level scroll — this is a full-screen app shell.
  // Must lock BOTH html and body: when body has overflow:hidden, browsers
  // can transfer scroll to the html element, which scrollIntoView exploits —
  // scrolling the entire app shell 656px above the viewport (blank canvas bug).
  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  // Smart auto-scroll — only follow to bottom if user is already near it,
  // OR a genuinely new message was added (not just a part state mutation).
  // This prevents the chip-click trap where streaming token updates yank
  // the user back to bottom every time they try to scroll up.
  useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (isNewMessage || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Submit handler
  const handleSubmit = useCallback(
    (content: string) => {
      if (!content.trim() || isLoading) return;
      sendMessage({ text: content.trim() });
    },
    [isLoading, sendMessage]
  );

  // Handle askUser chip tap → persist to localStorage + send tool output
  const handleAskUserResponse = useCallback(
    (toolCallId: string, result: AskUserResult) => {
      // 1. Extract the value for localStorage persistence
      const value: unknown = 'selectedLabels' in result
        ? result.selectedLabels
        : 'selectedLabel' in result
          ? result.selectedLabel
          : 'otherText' in result
            ? result.otherText
            : null;

      // 2. Update localStorage immediately (belt — fast hydration)
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

        // Mark phase as complete on confirmation
        if (result.fieldName === 'confirmation') {
          const label = 'selectedLabel' in result ? String(result.selectedLabel).toLowerCase() : '';
          const confirmed = label.includes('looks good') || label.includes("let's go");
          if (confirmed) {
            updated.phase = 'complete';
            setJourneySession(updated);
          }
        }
      }

      // 3. Send tool output to SDK (triggers next round trip via sendAutomaticallyWhen)
      addToolOutput({
        tool: 'askUser',
        toolCallId,
        output: JSON.stringify(result),
      });
    },
    [addToolOutput]
  );

  // ── Resume handlers ──────────────────────────────────────────────────────
  const handleResumeContinue = useCallback(() => {
    if (savedSession) {
      setTransportBody({ resumeState: getAnsweredFields(savedSession) });
      setIsResuming(true);
    }
    setShowResumePrompt(false);
  }, [savedSession]);

  const handleResumeStartFresh = useCallback(() => {
    clearJourneySession();
    setTransportBody(undefined);
    setSavedSession(null);
    setIsResuming(false);
    setOnboardingState(null);
    setShowResumePrompt(false);
  }, []);

  // Welcome message — different when resuming a previous session
  const welcomeMessage = isResuming
    ? LEAD_AGENT_RESUME_WELCOME
    : LEAD_AGENT_WELCOME_MESSAGE;

  // Last assistant message gets streaming cursor
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.role === 'assistant';

  // Chat content
  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Messages area — scrollable */}
      <div ref={scrollAreaRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
        {/* Resume prompt OR welcome message */}
        {showResumePrompt && savedSession ? (
          <ResumePrompt
            session={savedSession}
            onContinue={handleResumeContinue}
            onStartFresh={handleResumeStartFresh}
          />
        ) : (
          <ChatMessage
            role="assistant"
            content={welcomeMessage}
            isStreaming={false}
          />
        )}

        {/* Inline profile card — renders once at least one field is answered */}
        <ProfileCard state={onboardingState} />

        {/* Conversation messages */}
        {messages.map((message, index) => {
          const isThisMessageStreaming =
            message.role === 'assistant' &&
            index === messages.length - 1 &&
            isLastMessageStreaming;

          return (
            <ChatMessage
              key={message.id}
              messageId={message.id}
              role={message.role as 'user' | 'assistant'}
              parts={message.parts}
              isStreaming={isThisMessageStreaming}
              onToolApproval={(approvalId, approved) =>
                addToolApprovalResponse({ id: approvalId, approved })
              }
              onToolOutput={handleAskUserResponse}
            />
          );
        })}

        {/* Typing indicator — only while waiting for first token */}
        {isSubmitted && <TypingIndicator className="ml-9" />}

        {/* Error display */}
        {error && (
          <div
            className="mx-0 my-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
            }}
          >
            {error.message || 'Something went wrong. Please try again.'}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — pinned to bottom */}
      <div className="flex-shrink-0 px-4 pb-4 pt-0">
        <JourneyChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading || showResumePrompt}
          placeholder={
            showResumePrompt
              ? 'Choose an option above to continue...'
              : isResuming
                ? "Let's pick up where we left off..."
                : 'Tell me about your business...'
          }
        />
      </div>
    </div>
  );

  return (
    <AppShell sidebar={<AppSidebar />}>
      {journeyPhase === 0 && !showResumePrompt ? (
        <WelcomeState onSubmit={handleSubmit} isLoading={isLoading} />
      ) : (
        chatContent
      )}
    </AppShell>
  );
}
