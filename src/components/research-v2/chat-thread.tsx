'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { cn } from '@/lib/utils';

export interface ChatThreadProps {
  runId: string;
  userId: string;
  className?: string;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function ChatThread({ runId, userId, className }: ChatThreadProps) {
  const [input, setInput] = useState('');
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/research-v2/chat',
        body: { runId },
        credentials: 'same-origin',
      }),
    [runId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: `research-v2-audit-chat-${runId}`,
    transport,
    experimental_throttle: 50,
  });

  const isSending = status === 'submitted' || status === 'streaming';
  const trimmedInput = input.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!trimmedInput || isSending) {
      return;
    }

    sendMessage({ text: trimmedInput });
    setInput('');
  }

  return (
    <section
      aria-label="Unified audit chat"
      data-user-id={userId}
      className={cn('flex min-h-[280px] flex-col border-t border-border', className)}
    >
      <div className="shrink-0 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-medium tracking-tight text-foreground">
              Audit chat
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              One thread can reference the full audit and every generated artifact.
            </p>
          </div>
          <div className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Run-level
          </div>
        </div>
      </div>

      <Conversation className="min-h-0 flex-1">
        {messages.length === 0 ? (
          <ConversationEmptyState
            className="min-h-[140px] p-4"
            title="Ask for artifact edits"
            description="Request a rerun, a precise correction, or a grounded read on the audit."
          />
        ) : (
          <ConversationContent className="mx-auto w-full max-w-2xl gap-4 px-4 py-2">
            {messages.map((message) => {
              const text = getMessageText(message);
              if (!text) {
                return null;
              }

              return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    {message.role === 'assistant' ? (
                      <MessageResponse>{text}</MessageResponse>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
                    )}
                  </MessageContent>
                </Message>
              );
            })}
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 px-4 pb-4 pt-3">
        <PromptInput
          className="mx-auto max-w-2xl"
          onSubmit={(_message, event) => handleSubmit(event)}
        >
          <PromptInputBody>
            <PromptInputTextarea
              aria-label="Message AIGOS"
              className="min-h-12"
              disabled={isSending}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask AIGOS to revise, rerun, or explain the audit..."
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <span className="text-[11px] text-muted-foreground">
              Shift + Enter for a new line
            </span>
            <PromptInputSubmit
              disabled={!trimmedInput || isSending}
              onStop={stop}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </section>
  );
}
