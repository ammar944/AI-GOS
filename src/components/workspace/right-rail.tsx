'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Send, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { VoiceInputButton } from '@/components/chat/voice-input-button';

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

/** Extract concatenated text from UIMessage.parts */
function getMessageText(parts: Array<{ type: string; text?: string; [k: string]: unknown }>): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
}

/** Simple markdown-ish rendering — bold, italic, inline code, line breaks */
function renderMessageContent(text: string) {
  // Split into paragraphs
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n');
    return (
      <p key={pIdx} className={pIdx > 0 ? 'mt-2.5' : ''}>
        {lines.map((line, lIdx) => (
          <span key={lIdx}>
            {lIdx > 0 && <br />}
            {renderInline(line)}
          </span>
        ))}
      </p>
    );
  });
}

function renderInline(text: string) {
  // Handle **bold**, *italic*, `code`
  const parts: (string | React.ReactNode)[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);

    // Find earliest match
    const matches = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (first.type === 'bold') {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-[var(--text-primary)]">
          {first.match![1]}
        </strong>,
      );
    } else if (first.type === 'code') {
      parts.push(
        <code
          key={keyIdx++}
          className="px-1 py-0.5 rounded bg-white/5 text-[var(--accent-cyan)] text-[12px] font-mono"
        >
          {first.match![1]}
        </code>,
      );
    }

    remaining = remaining.slice(first.index + first.match![0].length);
  }

  return parts;
}

interface RightRailProps {
  className?: string;
}

export function RightRail({ className }: RightRailProps) {
  const { state, updateCard } = useWorkspace();
  const meta = SECTION_META[state.currentSection] ?? DEFAULT_SECTION_META;

  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const prevSectionRef = useRef(state.currentSection);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [deepResearch, setDeepResearch] = useState(false);
  // Track pending editCard proposals waiting for user approval
  const [pendingEdits, setPendingEdits] = useState<Map<string, {
    cardId: string;
    field: string;
    newValue: unknown;
    explanation: string;
    cardLabel: string;
  }>>(new Map());

  // Clear local messages + pending edits on section change
  useEffect(() => {
    if (prevSectionRef.current !== state.currentSection) {
      setLocalMessages([]);
      setPendingEdits(new Map());
      prevSectionRef.current = state.currentSection;
    }
  }, [state.currentSection]);

  // Build section cards payload for context injection
  const sectionCardsPayload = useMemo(() => {
    return Object.values(state.cards)
      .filter((c) => c.sectionKey === state.currentSection)
      .map((c) => ({
        id: c.id,
        cardType: c.cardType,
        label: c.label,
        content: c.content,
      }));
  }, [state.cards, state.currentSection]);

  // Section-scoped transport — passes card context + mode in body
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
        body: {
          currentSection: state.currentSection,
          sectionCards: sectionCardsPayload,
          deepResearch,
        },
      }),
    [state.currentSection, sectionCardsPayload, deepResearch],
  );

  const {
    messages,
    sendMessage,
    status,
  } = useChat({
    transport,
    id: state.currentSection,
    onToolCall: ({ toolCall }) => {
      // Intercept editCard tool calls — render approval UI instead of auto-executing
      const tc = toolCall as unknown as { toolName: string; toolCallId: string; [k: string]: unknown };
      if (tc.toolName === 'editCard') {
        // The tool call input arrives as the spread properties on the toolCall object
        const input = (tc.input ?? tc.args ?? tc) as Record<string, unknown>;
        const cardId = String(input.cardId ?? '');
        const field = String(input.field ?? '');
        const explanation = String(input.explanation ?? '');
        const newValue = input.newValue;
        const card = state.cards[cardId];
        setPendingEdits((prev) => {
          const next = new Map(prev);
          next.set(tc.toolCallId, {
            cardId,
            field,
            newValue,
            explanation,
            cardLabel: card?.label ?? 'Unknown card',
          });
          return next;
        });
        return undefined;
      }
      return undefined;
    },
  });

  // Merge AI messages + local messages for display
  const displayMessages = useMemo(() => {
    const aiMsgs = messages.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      text: getMessageText(m.parts as Array<{ type: string; text?: string }>),
    }));
    const localMsgs = localMessages.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
    }));
    return [...aiMsgs, ...localMsgs];
  }, [messages, localMessages]);

  const isStreaming = status === 'streaming';

  // Auto-scroll on new messages
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length, isStreaming]);

  // Track scroll position for "scroll to bottom" button
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollButton(distFromBottom > 100);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isStreaming) return;

      sendMessage({ text: trimmed });
      setInput('');
    },
    [input, isStreaming, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as FormEvent);
      }
    },
    [handleSubmit],
  );

  // Voice transcript handler — append to input at cursor
  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => {
      if (!prev.trim()) return text;
      return `${prev} ${text}`;
    });
    textareaRef.current?.focus();
  }, []);

  // Edit card approval/rejection handlers
  const handleApproveEdit = useCallback(
    (toolCallId: string) => {
      const edit = pendingEdits.get(toolCallId);
      if (!edit) return;

      // Apply the edit via workspace context
      const card = state.cards[edit.cardId];
      if (card) {
        const updatedContent = { ...card.content, [edit.field]: edit.newValue };
        updateCard(edit.cardId, updatedContent, 'ai');
      }

      // Remove from pending
      setPendingEdits((prev) => {
        const next = new Map(prev);
        next.delete(toolCallId);
        return next;
      });

      // Add local confirmation message
      setLocalMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `Updated **${edit.cardLabel}** — ${edit.explanation}`,
        },
      ]);
    },
    [pendingEdits, state.cards, updateCard],
  );

  const handleRejectEdit = useCallback(
    (toolCallId: string) => {
      const edit = pendingEdits.get(toolCallId);
      setPendingEdits((prev) => {
        const next = new Map(prev);
        next.delete(toolCallId);
        return next;
      });

      if (edit) {
        setLocalMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: `Edit to **${edit.cardLabel}** was rejected.`,
          },
        ]);
      }
    },
    [pendingEdits],
  );

  const hasMessages = displayMessages.length > 0 || pendingEdits.size > 0;

  return (
    <div
      className={cn(
        'flex flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-base)]',
        className ?? 'w-[40%]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full shadow-[0_0_6px_rgba(54,94,255,0.4)]',
            deepResearch ? 'bg-[var(--accent-cyan)]' : 'bg-[var(--accent-blue)]',
          )} />
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className={cn(
              'text-[10px] font-mono animate-pulse',
              deepResearch ? 'text-[var(--accent-cyan)]' : 'text-[var(--accent-blue)]',
            )}>
              {deepResearch ? 'deep thinking...' : 'thinking...'}
            </span>
          )}
          {/* Deep Research toggle */}
          <button
            type="button"
            onClick={() => setDeepResearch((v) => !v)}
            title={deepResearch ? 'Deep Research ON — extended reasoning' : 'Deep Research OFF — standard mode'}
            className={cn(
              'rounded-md px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-all',
              deepResearch
                ? 'bg-[var(--accent-cyan)]/15 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/25'
                : 'text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)] hover:bg-white/5',
            )}
          >
            {deepResearch ? 'Deep' : 'Deep'}
          </button>
        </div>
      </div>

      {/* Chat thread */}
      <div ref={threadRef} className="relative flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-4 space-y-4">
          {!hasMessages && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="text-[13px] text-[var(--text-tertiary)] text-center max-w-[200px]">
                Ask anything about this research section
              </p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-[var(--accent-blue)] text-white rounded-br-md'
                      : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] rounded-bl-md',
                  )}
                >
                  {msg.role === 'assistant' ? renderMessageContent(msg.text) : msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Pending edit proposals */}
          {Array.from(pendingEdits.entries()).map(([toolCallId, edit]) => (
            <motion.div
              key={toolCallId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/[0.04] p-3.5 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]" />
                  <span className="text-[11px] font-mono text-[var(--accent-blue)] uppercase tracking-wider">
                    Proposed Edit
                  </span>
                </div>
                <p className="text-[12px] font-medium text-[var(--text-primary)]">
                  {edit.cardLabel}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                  {edit.explanation}
                </p>
                <div className="text-[11px] font-mono text-[var(--text-quaternary)] bg-black/20 rounded-lg px-2.5 py-1.5 overflow-x-auto">
                  {edit.field}: {typeof edit.newValue === 'string'
                    ? edit.newValue.length > 120
                      ? edit.newValue.slice(0, 120) + '...'
                      : edit.newValue
                    : JSON.stringify(edit.newValue, null, 0).slice(0, 120)}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleApproveEdit(toolCallId)}
                    className="flex-1 rounded-lg bg-[var(--accent-blue)] text-white text-[12px] font-semibold py-1.5 transition-all hover:bg-[var(--accent-blue)]/90"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectEdit(toolCallId)}
                    className="flex-1 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] text-[12px] font-medium py-1.5 transition-all hover:bg-white/5"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Streaming indicator */}
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
                />
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                />
              </div>
            </motion.div>
          )}

          <div ref={threadEndRef} />
        </div>

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={scrollToBottom}
              className="sticky bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)] shadow-lg flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors z-10"
            >
              <ChevronDown className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--border-subtle)] p-3 space-y-2">
        {/* Chat input */}
        <form onSubmit={handleSubmit} className="relative">
          <div
            className={cn(
              'flex items-end gap-2 rounded-xl border bg-[var(--bg-surface)] px-3 py-2',
              'transition-all duration-200',
              isRecording
                ? 'border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.15)]'
                : 'border-[var(--border-default)] focus-within:border-[var(--accent-blue)]/40 focus-within:shadow-[0_0_8px_rgba(54,94,255,0.08)]',
            )}
          >
            {/* Voice button */}
            <VoiceInputButton
              onTranscript={handleVoiceTranscript}
              onRecordingChange={setIsRecording}
              disabled={isStreaming}
              compact
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              disabled={isStreaming}
              rows={1}
              className={cn(
                'flex-1 resize-none bg-transparent text-[13px] text-[var(--text-primary)]',
                'placeholder:text-[var(--text-quaternary)]',
                'focus:outline-none disabled:opacity-50',
                'leading-relaxed',
              )}
              style={{ maxHeight: 120 }}
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className={cn(
                'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                input.trim() && !isStreaming
                  ? 'bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90'
                  : 'text-[var(--text-quaternary)]',
              )}
            >
              {isStreaming ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
