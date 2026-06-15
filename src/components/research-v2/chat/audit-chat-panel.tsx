'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, SendHorizontal } from 'lucide-react';
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  type DynamicToolUIPart,
  type ToolUIPart,
} from 'ai';
import { useChat } from '@ai-sdk/react';

import { Response } from '@/components/ai-elements/response';
import { Shimmer } from '@/components/ai-elements/shimmer';
import {
  READER_SECTION_LABELS,
  type ReaderSectionId,
} from '@/components/research-v3/reader-sections';
import { cn } from '@/lib/utils';

export interface AuditChatPanelProps {
  runId: string;
  focusedZone?: string;
  onResearchMutated?: () => void;
}

const TOOL_LABELS: Record<string, string> = {
  rerunSection: 'Rerunning section',
  draftStrategyBrief: 'Drafting offer & angle brief',
  reviseStrategyBrief: 'Revising offer & angle brief',
  editClaim: 'Editing claim',
  editNarrative: 'Editing narrative',
  explainSource: 'Explaining source',
  summarizeArtifact: 'Summarizing research',
};

function humanizeToolName(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? humanizeToolName(name);
}

function toolOutputMessage(output: unknown): string | null {
  if (
    output !== null &&
    typeof output === 'object' &&
    'message' in output &&
    typeof (output as { message: unknown }).message === 'string'
  ) {
    const message = (output as { message: string }).message.trim();
    return message.length > 0 ? message : null;
  }
  return null;
}

type StatusTone = 'pending' | 'done' | 'error';

function StatusRow({
  tone,
  spin = false,
  title,
  detail,
}: {
  tone: StatusTone;
  spin?: boolean;
  title: string;
  detail?: string;
}): React.ReactElement {
  const Icon = tone === 'error' ? AlertTriangle : tone === 'done' ? Check : Loader2;
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5">
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-px size-3.5 shrink-0',
          tone === 'pending' && 'text-primary',
          tone === 'done' && 'text-emerald-500',
          tone === 'error' && 'text-destructive',
          spin && 'animate-spin',
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-foreground/90">
          {title}
        </div>
        {detail ? (
          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{detail}</div>
        ) : null}
      </div>
    </div>
  );
}

function ToolStatusRow({ part }: { part: ToolUIPart | DynamicToolUIPart }): React.ReactElement {
  const label = toolLabel(getToolName(part));
  if (part.state === 'output-error') {
    return (
      <StatusRow
        tone="error"
        title={label}
        detail="This action didn't complete. Try again or rephrase the request."
      />
    );
  }
  if (part.state === 'output-available') {
    return <StatusRow tone="done" title={label} detail={toolOutputMessage(part.output) ?? undefined} />;
  }
  return <StatusRow tone="pending" spin title={label} detail="Working…" />;
}

export function AuditChatPanel({
  runId,
  focusedZone,
  onResearchMutated,
}: AuditChatPanelProps): React.ReactElement {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const hasThread = messages.length > 0 || busy || error !== undefined;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy, error]);

  const submitMessage = (): void => {
    const text = input.trim();
    if (text === '' || busy) return;
    setInput('');
    void sendMessage({ text });
  };

  const focusedLabel =
    focusedZone && focusedZone in READER_SECTION_LABELS
      ? READER_SECTION_LABELS[focusedZone as ReaderSectionId]
      : null;

  return (
    <div className="flex flex-col">
      {hasThread ? (
        <div ref={scrollRef} className="max-h-[40vh] overflow-y-auto">
          <div className="mx-auto w-full max-w-[820px] space-y-3 px-5 pb-3 pt-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'text-[13px] leading-relaxed',
                  message.role === 'user' && 'rounded-md bg-muted px-3 py-2 text-foreground',
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
                  if (isToolUIPart(part)) {
                    return <ToolStatusRow key={index} part={part} />;
                  }
                  return null;
                })}
              </div>
            ))}
            {busy ? <Shimmer>Thinking…</Shimmer> : null}
            {error ? (
              <StatusRow
                tone="error"
                title="Strategist unavailable"
                detail="The request didn't go through. Try again in a moment."
              />
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="px-5 py-3">
        <div className="mx-auto w-full max-w-[820px]">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Strategist
            </span>
            {focusedLabel ? (
              <span className="truncate text-[11px] text-muted-foreground/70">· {focusedLabel}</span>
            ) : null}
          </div>
          <div className="flex items-end gap-2 rounded-lg border border-border bg-background px-3 py-2 transition-colors focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage();
                }
              }}
              rows={1}
              placeholder="Ask the strategist - reframe, fix, or rerun..."
              className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 [field-sizing:content]"
              disabled={busy}
            />
            <button
              type="button"
              aria-label="Send message"
              title="Send message"
              disabled={busy || input.trim() === ''}
              onClick={submitMessage}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              <SendHorizontal className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
