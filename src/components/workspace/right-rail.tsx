'use client';

import { useState, useRef, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';

interface LocalMessage {
  id: string;
  role: 'assistant';
  text: string;
}

/** Extract concatenated text from UIMessage.parts */
function getMessageText(parts: Array<{ type: string; text?: string; [k: string]: unknown }>): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

interface RightRailProps {
  className?: string;
}

export function RightRail({ className }: RightRailProps) {
  const { state, approveSection } = useWorkspace();
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;
  const isReviewable = state.sectionStates[state.currentSection] === 'review';

  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const prevSectionRef = useRef(state.currentSection);

  // Clear local messages on section change
  useEffect(() => {
    if (prevSectionRef.current !== state.currentSection) {
      setLocalMessages([]);
      prevSectionRef.current = state.currentSection;
    }
  }, [state.currentSection]);

  // Section-scoped transport — new DefaultChatTransport per section
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
      }),
    [],
  );

  const {
    messages,
    sendMessage,
    status,
  } = useChat({
    transport,
    id: state.currentSection, // scopes conversation per section
  });

  // Merge AI messages + local messages for display
  // AI messages keep their array order; local messages append at the end
  const displayMessages = useMemo(() => {
    const aiMsgs = messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      text: getMessageText(m.parts as Array<{ type: string; text?: string }>),
    }));
    const localMsgs = localMessages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      text: m.text,
    }));
    return [...aiMsgs, ...localMsgs];
  }, [messages, localMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;

      // "Looks good" keyword detection — intercept before sending to AI
      if (trimmed.toLowerCase() === 'looks good') {
        approveSection();
        setLocalMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            text: 'Section approved \u2713',
          },
        ]);
        setInput('');
        return;
      }

      // Send to AI via useChat
      sendMessage({ text: trimmed });
      setInput('');
    },
    [input, approveSection, sendMessage],
  );

  const isStreaming = status === 'streaming';

  return (
    <div className={cn("flex flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-chat)]", className ?? "w-[40%]")}>
      {/* Rail header */}
      <div className="border-b border-[var(--border-subtle)] px-4 py-3">
        <span className="text-xs font-mono text-[var(--text-tertiary)]">
          Chat &middot; {meta.label}
        </span>
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        {displayMessages.length === 0 ? (
          <p className="text-xs text-[var(--text-quaternary)]">
            Ask questions about this section...
          </p>
        ) : (
          <div className="space-y-3">
            {displayMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)]',
                )}
              >
                <span className="text-xs font-mono text-[var(--text-quaternary)] mr-2">
                  {msg.role === 'user' ? 'you' : 'ai'}
                </span>
                {msg.text}
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>
        )}
      </div>

      {/* Looks good + input */}
      <div className="border-t border-[var(--border-subtle)] p-4 space-y-3">
        {isReviewable && (
          <button
            type="button"
            onClick={approveSection}
            className={cn(
              'w-full rounded-[var(--radius-md)] bg-[var(--accent-blue)] px-4 py-2',
              'text-sm font-medium text-white',
              'transition-colors hover:bg-[var(--accent-blue)]/90',
            )}
          >
            Looks good &rarr;
          </button>
        )}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this section..."
            disabled={isStreaming}
            className={cn(
              'w-full rounded-[var(--radius-md)] border border-[var(--border-default)]',
              'bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]',
              'placeholder:text-[var(--text-quaternary)]',
              'focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]',
              'disabled:opacity-50',
            )}
          />
        </form>
      </div>
    </div>
  );
}
