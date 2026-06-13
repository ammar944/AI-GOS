'use client';

import { useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { DefaultChatTransport } from 'ai';
import { useChat } from '@ai-sdk/react';

import { Response } from '@/components/ai-elements/response';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { cn } from '@/lib/utils';

export interface AuditChatPanelProps {
  runId: string;
  focusedZone?: string;
  onResearchMutated?: () => void;
}

export function AuditChatPanel({
  runId,
  focusedZone,
  onResearchMutated,
}: AuditChatPanelProps): React.ReactElement {
  const [input, setInput] = useState('');
  const { error, messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/research-v2/chat',
      body: () => ({ runId, ...(focusedZone ? { focusedZone } : {}) }),
    }),
    onFinish: () => {
      onResearchMutated?.();
    },
  });
  const busy = status === 'submitted' || status === 'streaming';
  const submitMessage = (): void => {
    const text = input.trim();
    if (text === '' || busy) return;
    setInput('');
    void sendMessage({ text });
  };

  return (
    <div className="flex h-[420px] flex-col rounded-lg border border-border bg-background">
      <div className="border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        Strategist
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'text-[13px] leading-relaxed',
              message.role === 'user' &&
                'rounded-md bg-muted px-3 py-2 text-foreground',
            )}
          >
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return message.role === 'assistant' ? (
                  <Response key={index}>{part.text}</Response>
                ) : (
                  <span key={index}>{part.text}</span>
                );
              }
              if (part.type.startsWith('tool-')) {
                return (
                  <p
                    key={index}
                    className="font-mono text-[11px] text-muted-foreground"
                  >
                    {part.type.replace('tool-', '')}...
                  </p>
                );
              }
              return null;
            })}
          </div>
        ))}
        {busy ? <Shimmer>Working...</Shimmer> : null}
        {error ? (
          <p className="text-[12px] leading-relaxed text-destructive">
            {error.message}
          </p>
        ) : null}
      </div>
      <div
        className="border-t border-border p-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submitMessage();
              }
            }}
            rows={2}
            placeholder="Ask the strategist - reframe, fix, or rerun..."
            className="min-h-16 flex-1 resize-none rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            disabled={busy}
          />
          <button
            type="button"
            aria-label="Send message"
            title="Send message"
            disabled={busy || input.trim() === ''}
            onClick={submitMessage}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <SendHorizontal className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
