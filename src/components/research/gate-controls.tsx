'use client';

import type {
  ChangeEvent,
  FormEvent,
  ReactElement,
} from 'react';
import { useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  PIPELINE_SECTION_CONFIG,
  type PipelineSectionId,
} from '@/lib/research/pipeline-types';

export interface GateControlsProps {
  runId: string;
  sectionId: PipelineSectionId;
  sectionData?: Record<string, unknown>;
  onApprove: () => void;
  className?: string;
}

function renderMessageText(message: {
  id: string;
  role: string;
  parts?: Array<{ type?: string; text?: string }>;
}): ReactElement | null {
  const textParts = (message.parts ?? []).filter(
    (part) => part.type === 'text' && typeof part.text === 'string' && part.text.length > 0,
  );

  if (textParts.length === 0) {
    return null;
  }

  return (
    <div
      key={message.id}
      className={cn(
        'max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6',
        message.role === 'user'
          ? 'ml-auto bg-zinc-50 text-zinc-950'
          : 'bg-zinc-900 text-zinc-200',
      )}
    >
      {textParts.map((part, index) => (
        <p key={`${message.id}-${String(index)}`}>{part.text}</p>
      ))}
    </div>
  );
}

export function GateControls({
  runId,
  sectionId,
  sectionData,
  onApprove,
  className,
}: GateControlsProps): ReactElement {
  const sectionConfig = PIPELINE_SECTION_CONFIG[sectionId];
  const [input, setInput] = useState('');
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/research/chat',
        body: {
          runId,
          sectionId,
        },
      }),
    [runId, sectionId],
  );

  const {
    messages,
    sendMessage,
    status,
  } = useChat({
    transport,
    id: `research-chat-${sectionId}`,
    experimental_throttle: 50,
  });

  const isSending = status === 'submitted' || status === 'streaming';

  const handleInputChange = (
    event: ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    setInput(event.target.value);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const nextInput = input.trim();
    if (nextInput.length === 0 || isSending) {
      return;
    }

    sendMessage({
      text: nextInput,
    });
    setInput('');
  };

  return (
    <div className={cn('flex min-h-screen flex-col', className)}>
      <div className="border-b border-zinc-800 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Refinement Chat
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
          {sectionConfig.displayName}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Ask for changes to this artifact only. The chat is scoped to the active section gate.
        </p>

        {sectionData ? (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Current section payload
            </p>
            <pre className="mt-3 overflow-hidden whitespace-pre-wrap break-words text-xs leading-6 text-zinc-300">
              {JSON.stringify(sectionData, null, 2).slice(0, 900)}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 p-4 text-sm text-zinc-500">
            No refinement messages yet. Ask for a specific change or approve the section as-is.
          </div>
        ) : null}

        {messages.map((message) =>
          renderMessageText(message as { id: string; role: string; parts?: Array<{ type?: string; text?: string }> }),
        )}

        {status !== 'ready' ? (
          <div className="text-sm text-zinc-500">Streaming response...</div>
        ) : null}
      </div>

      <div className="border-t border-zinc-800 p-6">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about this section or request a focused change..."
            className="min-h-[120px] border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
            disabled={isSending}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="submit"
              disabled={isSending || input.trim().length === 0}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
            <Button
              type="button"
              onClick={onApprove}
              className="bg-green-600 text-white hover:bg-green-500"
            >
              Looks good
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
