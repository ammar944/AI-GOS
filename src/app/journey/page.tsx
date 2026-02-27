'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import { JourneyLayout } from '@/components/journey/journey-layout';
import { JourneyHeader } from '@/components/journey/journey-header';
import { ChatMessage } from '@/components/journey/chat-message';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { TypingIndicator } from '@/components/journey/typing-indicator';
import { LEAD_AGENT_WELCOME_MESSAGE } from '@/lib/ai/prompts/lead-agent-system';
import { getJourneySession, setJourneySession } from '@/lib/storage/local-storage';
import { calculateCompletion, createEmptyState } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';
import type { AskUserResult } from '@/components/journey/ask-user-card';

export default function JourneyPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Start at 0 to match SSR, then hydrate from localStorage in useEffect
  const [completionPercentage, setCompletionPercentage] = useState(0);

  useEffect(() => {
    const saved = getJourneySession();
    if (saved?.completionPercent) setCompletionPercentage(saved.completionPercent);
  }, []);

  // Transport — stable reference, no body needed for Sprint 1
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
      }),
    []
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

  // Auto-scroll on new messages or status change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

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
        setCompletionPercentage(completionPercent);
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

  // Last assistant message gets streaming cursor
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.role === 'assistant';

  // Chat content passed to JourneyLayout
  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <JourneyHeader completionPercentage={completionPercentage} />

      {/* Messages area — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {/* Welcome message — static, never sent to API */}
        <ChatMessage
          role="assistant"
          content={LEAD_AGENT_WELCOME_MESSAGE}
          isStreaming={false}
        />

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
          isLoading={isLoading}
          placeholder="Tell me about your business..."
        />
      </div>
    </div>
  );

  return (
    <div className="h-screen" style={{ background: 'var(--bg-base)' }}>
      <JourneyLayout phase="setup" chatContent={chatContent} />
    </div>
  );
}
