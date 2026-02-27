'use client';

import { useRef, useMemo, useEffect, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';

import { JourneyLayout } from '@/components/journey/journey-layout';
import { JourneyHeader } from '@/components/journey/journey-header';
import { ChatMessage } from '@/components/journey/chat-message';
import { JourneyChatInput } from '@/components/journey/chat-input';
import { TypingIndicator } from '@/components/journey/typing-indicator';
import { LEAD_AGENT_WELCOME_MESSAGE } from '@/lib/ai/prompts/lead-agent-system';

/**
 * Extract text content from a UIMessage's parts array.
 * Filters for text parts and joins them into a single string.
 */
function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function JourneyPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Transport — stable reference, no body needed for Sprint 1
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
      }),
    []
  );

  // Chat hook
  const { messages, sendMessage, status, error } = useChat({
    transport,
    onError: (err) => {
      console.error('Journey chat error:', err);
    },
  });

  // Derived state
  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const isLoading = isStreaming || isSubmitted;

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

  // Last assistant message gets streaming cursor
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.role === 'assistant';

  // Chat content passed to JourneyLayout
  const chatContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <JourneyHeader />

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
              role={message.role as 'user' | 'assistant'}
              content={getTextContent(message)}
              isStreaming={isThisMessageStreaming}
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
