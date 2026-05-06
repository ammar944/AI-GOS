'use client';

import {
  memo,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useId,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Globe, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ChatInput } from '@/components/chat/chat-input';
import { ThinkingBlock } from '@/components/chat/thinking-block';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import { JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { serializeWorkspaceMessages } from '@/lib/journey/workspace-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMode = 'normal' | 'thinking' | 'research';

export interface CardContext {
  id: string;
  title: string;
  firstParagraph: string;
  /** Top-level field keys in the card content — so the AI knows which fields to edit */
  fields?: string[];
}

export interface UnifiedChatProps {
  /** Active workspace section ('industryMarket', 'competitors', etc.) */
  section: string;
  /** Maps to journey_sessions */
  activeRunId: string;
  /** Lightweight card summaries for AI context injection */
  cardContext?: CardContext[];
  /** For greeting message */
  userName?: string;
  /** For greeting message */
  companyName?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Per-section starter prompts
// ---------------------------------------------------------------------------

const SECTION_STARTERS: Record<string, string[]> = {
  industryMarket: [
    'What are the biggest growth drivers in this market?',
    'How does seasonality affect this industry?',
    'What market segments should we prioritize?',
  ],
  icpValidation: [
    'Who is the most valuable customer segment?',
    'What pain points drive purchase decisions?',
    'How long is the typical buying cycle?',
  ],
  offerAnalysis: [
    'How does our pricing compare to competitors?',
    'What is our strongest value proposition?',
    'Which offer angles should we lead with?',
  ],
  competitors: [
    'What channels are competitors spending most on?',
    'Where are competitors weakest?',
    'What ad creative patterns work in this space?',
  ],
  keywordIntel: [
    'Which keywords have the best commercial intent?',
    'What negative keywords should we add?',
    'How competitive are our top keywords?',
  ],
  crossAnalysis: [
    'What are the biggest strategic insights?',
    'Which risks should we address first?',
    'What opportunities are competitors missing?',
  ],
  mediaPlan: [
    'What is the recommended channel mix?',
    'How should we allocate budget across phases?',
    'What are the KPIs for this plan?',
  ],
};

const DEFAULT_STARTERS = [
  'What does this research tell us?',
  'What should we focus on next?',
  'Summarize the key insights.',
];

const WORKSPACE_MESSAGE_PERSIST_DEBOUNCE_MS = 400;

// ---------------------------------------------------------------------------
// Mode config
// ---------------------------------------------------------------------------

interface ModeConfig {
  id: ChatMode;
  label: string;
  Icon: React.ElementType;
  /** CSS color for glow + active state */
  color: string;
  /** Tailwind shadow class pattern */
  glowStyle: string;
  streamingLabel: string;
}

const MODE_CONFIG: ModeConfig[] = [
  {
    id: 'normal',
    label: 'Normal',
    Icon: Brain,
    color: 'var(--text-secondary)',
    glowStyle: 'shadow-[0_0_0_1px_var(--border-focus)]',
    streamingLabel: 'Claude is thinking...',
  },
  {
    id: 'thinking',
    label: 'Thinking',
    Icon: Sparkles,
    color: '#a855f7',
    glowStyle: 'shadow-[0_0_0_1px_rgba(168,85,247,0.6)]',
    streamingLabel: 'Claude is reasoning...',
  },
  {
    id: 'research',
    label: 'Research',
    Icon: Globe,
    color: '#3b82f6',
    glowStyle: 'shadow-[0_0_0_1px_rgba(59,130,246,0.6)]',
    streamingLabel: 'Searching the web...',
  },
];

// ---------------------------------------------------------------------------
// Text extraction helpers
// ---------------------------------------------------------------------------

function getTextFromParts(parts: UIMessage['parts']): string {
  return (parts ?? [])
    .filter(
      (p): p is { type: 'text'; text: string } =>
        p.type === 'text' && typeof (p as { text?: unknown }).text === 'string',
    )
    .map((p) => p.text)
    .join('');
}

interface ReasoningPart {
  type: string;
  reasoning?: string;
  details?: Array<{ type: string; thinking?: string }>;
}

function getReasoningFromParts(parts: UIMessage['parts']): string | null {
  const rp = (parts ?? []).find((p) => p.type === 'reasoning') as ReasoningPart | undefined;
  if (!rp) return null;
  // Prefer details[0].thinking if present (native reasoning parts)
  if (rp.details && rp.details.length > 0 && rp.details[0].thinking) {
    return rp.details[0].thinking;
  }
  return rp.reasoning ?? null;
}

function getWorkspaceMessageSignature(messages: UIMessage[]): string {
  return JSON.stringify(messages);
}

async function readWorkspaceMessagesResponse(response: Response): Promise<UIMessage[]> {
  const payload = (await response.json()) as { workspaceMessages?: unknown };
  return serializeWorkspaceMessages(payload.workspaceMessages ?? []);
}

// ---------------------------------------------------------------------------
// Inline markdown renderer (bold, code, paragraphs)
// ---------------------------------------------------------------------------

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);

    const candidates = [
      boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
      codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
    ]
      .filter(Boolean)
      .sort((a, b) => a!.index - b!.index);

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = candidates[0]!;
    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (first.type === 'bold') {
      parts.push(
        <strong key={key++} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {first.match![1]}
        </strong>,
      );
    } else if (first.type === 'code') {
      parts.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded text-[var(--text-secondary)] text-[12px]"
          style={{ background: 'var(--bg-hover)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }}
        >
          {first.match![1]}
        </code>,
      );
    }

    remaining = remaining.slice(first.index + first.match![0].length);
  }

  return parts;
}

function renderMessageContent(text: string): React.ReactNode {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, pIdx) => {
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
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Animated dots (typing / streaming indicator)
// ---------------------------------------------------------------------------

function AnimatedDots() {
  return (
    <span className="inline-flex items-center gap-[3px] ml-1">
      {[0, 0.2, 0.4].map((delay, i) => (
        <motion.span
          key={i}
          className="inline-block w-[3px] h-[3px] rounded-full bg-current opacity-50"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay }}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mode bar
// ---------------------------------------------------------------------------

interface ModeBarProps {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
}

function ModeBar({ mode, onChange }: ModeBarProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      if (!tabs) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (currentIndex + 1) % MODE_CONFIG.length;
        tabs[next].focus();
        onChange(MODE_CONFIG[next].id);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (currentIndex - 1 + MODE_CONFIG.length) % MODE_CONFIG.length;
        tabs[prev].focus();
        onChange(MODE_CONFIG[prev].id);
      }
    },
    [onChange],
  );

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Chat mode"
      className="flex items-center gap-1 p-0.5 rounded-xl border"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
    >
      {MODE_CONFIG.map(({ id, label, Icon, color, glowStyle }, index) => {
        const isActive = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium',
              'transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              'min-h-[32px]',
              isActive
                ? glowStyle
                : 'hover:bg-[var(--bg-hover)]',
            )}
            style={
              isActive
                ? {
                    background: `${color}18`,
                    color: color !== 'var(--text-secondary)' ? color : 'var(--text-primary)',
                    borderColor: color !== 'var(--text-secondary)' ? `${color}60` : undefined,
                  }
                : { color: 'var(--text-tertiary)' }
            }
          >
            <Icon
              className="w-3.5 h-3.5 shrink-0"
              style={isActive && color !== 'var(--text-secondary)' ? { color } : {}}
            />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  section: string;
  userName?: string;
  companyName?: string;
  onStarterClick: (text: string) => void;
}

function EmptyState({ section, userName, companyName, onStarterClick }: EmptyStateProps) {
  const starters = SECTION_STARTERS[section] ?? DEFAULT_STARTERS;
  const sectionLabel = (SECTION_META[section] ?? DEFAULT_SECTION_META).label;

  const greeting =
    userName && companyName
      ? `Hi ${userName}, let's review your ${companyName} research.`
      : userName
        ? `Hi ${userName}, let's dig into this research.`
        : `Let's review the ${sectionLabel} research.`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-10 px-4 gap-5"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center">
        <Sparkles className="w-5 h-5 text-[var(--text-primary)]" />
      </div>

      {/* Greeting */}
      <div className="text-center space-y-1">
        <p
          className="text-[14px] font-medium"
          style={{ fontFamily: 'var(--font-sans, "DM Sans", sans-serif)', color: 'var(--text-primary)' }}
        >
          {greeting}
        </p>
        <p
          className="text-[12px]"
          style={{ fontFamily: 'var(--font-sans, "DM Sans", sans-serif)', color: 'var(--text-tertiary)' }}
        >
          Ask me anything or pick a prompt below.
        </p>
      </div>

      {/* Starter prompts */}
      <div className="flex flex-col gap-2 w-full max-w-[300px]">
        {starters.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onStarterClick(prompt)}
            className={cn(
              'text-left px-3 py-2 rounded-lg text-[12px]',
              'border',
              'transition-all duration-150',
            )}
            style={{
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-default)',
              background: 'var(--bg-elevated)',
              fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover)';
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Message row
// ---------------------------------------------------------------------------

interface MessageRowProps {
  message: UIMessage;
  isStreaming: boolean;
  isLast: boolean;
  mode: ChatMode;
  userName?: string;
}

function MessageRowImpl({ message, isStreaming, isLast, mode, userName }: MessageRowProps) {
  const isUser = message.role === 'user';
  // Memoize text + reasoning extraction — these walk `message.parts` on every render.
  // During streaming the last message's parts array is mutated in place, so we intentionally
  // depend on parts-reference AND length: the memo invalidates when parts change identity
  // or grow, which is the only thing callers see during streaming.
  const text = useMemo(() => getTextFromParts(message.parts), [message.parts]);
  const reasoning = useMemo(
    () => (isUser ? null : getReasoningFromParts(message.parts)),
    [isUser, message.parts],
  );

  // For thinking mode: always show; normal/research: only show if present
  const showThinking = reasoning !== null && (mode === 'thinking' || reasoning.length > 0);
  const thinkingState = isStreaming && isLast ? 'streaming' : 'done';

  // Initial from userName or 'Y'
  const userInitial = userName ? userName[0].toUpperCase() : 'Y';

  // Timestamp — visible on hover via CSS group
  const [showTimestamp, setShowTimestamp] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-semibold mt-0.5',
          isUser
            ? ''
            : 'bg-[var(--bg-hover)] border border-[var(--border-subtle)]',
        )}
        style={isUser ? { background: 'var(--bg-hover)', color: 'var(--text-secondary)' } : {}}
      >
        {isUser ? (
          <span style={{ color: 'var(--text-secondary)' }}>{userInitial}</span>
        ) : (
          <Sparkles className="w-3 h-3 text-[var(--text-primary)]" />
        )}
      </div>

      {/* Bubble + thinking block */}
      <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start', 'min-w-0 max-w-[85%]')}>
        {/* Thinking block (assistant only) */}
        {showThinking && reasoning && (
          <div className="w-full">
            <ThinkingBlock
              content={reasoning}
              state={thinkingState}
              defaultOpen={mode === 'thinking'}
            />
          </div>
        )}

        {/* Message bubble */}
        {text.length > 0 && (
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
              isUser ? 'rounded-br-md' : 'bg-transparent rounded-bl-md',
            )}
            style={{
              fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
              ...(isUser
                ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' }
                : { color: 'var(--text-secondary)' }),
            }}
          >
            {isUser ? text : renderMessageContent(text)}
          </div>
        )}

        {/* Streaming: show text even while streaming */}
        {!isUser && isStreaming && isLast && text.length === 0 && (
          <div
            className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] leading-relaxed"
            style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans, "DM Sans", sans-serif)' }}
          >
            <AnimatedDots />
          </div>
        )}

        {/* Timestamp */}
        <AnimatePresence>
          {showTimestamp && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="text-[10px] px-1"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }}
            >
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Memoized wrapper — avoids re-rendering every message on each streaming chunk.
// During streaming, `useChat` mutates the last message's `parts` array in place; the
// comparator below detects that via (isStreaming && isLast) and forces a re-render on
// only that one row. All other rows skip.
const MessageRow = memo(MessageRowImpl, (prev, next) => {
  // Force re-render on the streaming last message — parts array is mutated in place,
  // so reference-equality on parts won't catch it.
  if (next.isStreaming && next.isLast) return false;

  return (
    prev.message.id === next.message.id &&
    prev.message.parts.length === next.message.parts.length &&
    prev.message.parts === next.message.parts &&
    prev.isStreaming === next.isStreaming &&
    prev.isLast === next.isLast &&
    prev.mode === next.mode &&
    prev.userName === next.userName
  );
});

// ---------------------------------------------------------------------------
// Streaming status bar (below messages, above input)
// ---------------------------------------------------------------------------

interface StreamingStatusProps {
  mode: ChatMode;
  isStreaming: boolean;
  streamingDuration: number;
}

function StreamingStatus({ mode, isStreaming, streamingDuration }: StreamingStatusProps) {
  if (!isStreaming) return null;

  // Only show "Claude is thinking..." after 3s in normal mode.
  // In thinking mode, always show. In research mode, always show.
  // Don't show anything for normal mode under 3s (just let the dots in the message handle it).
  if (mode === 'normal' && streamingDuration < 3000) return null;

  const label =
    mode === 'thinking'
      ? 'Reasoning deeply'
      : mode === 'research'
        ? 'Searching the web'
        : 'Processing';

  const color =
    mode === 'thinking'
      ? '#a855f7'
      : mode === 'research'
        ? '#3b82f6'
        : 'var(--text-quaternary, #555)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-2 px-4 py-1.5"
    >
      <span
        className="text-[11px]"
        style={{ color, fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }}
      >
        {label}
        <AnimatedDots />
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UnifiedChat({
  section,
  activeRunId,
  userName,
  companyName,
  className,
}: UnifiedChatProps) {
  const [mode, setMode] = useState<ChatMode>('normal');
  const threadRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const streamingStartRef = useRef<number>(0);
  const [streamingDuration, setStreamingDuration] = useState(0);
  const modeBarId = useId();

  // Workspace context for applying edits to cards
  const { state: workspaceState, updateCard } = useWorkspace();

  // Pending editCard proposals waiting for user approval
  const [pendingEdits, setPendingEdits] = useState<Map<string, {
    cardId: string;
    field: string;
    newValue: unknown;
    explanation: string;
    cardLabel: string;
  }>>(new Map());

  // Pending updateField proposals (onboarding profile fields) waiting for approval
  const [pendingFieldEdits, setPendingFieldEdits] = useState<Map<string, {
    key: string;
    value: string;
    reason: string;
  }>>(new Map());

  // Local confirmation messages (edit applied/rejected)
  const [localMessages, setLocalMessages] = useState<Array<{
    id: string;
    role: 'assistant';
    text: string;
  }>>([]);

  const sectionCardsPayload = useMemo(
    () =>
      Object.values(workspaceState.cards)
        .filter((card) => card.sectionKey === section)
        .map((card) => ({
          id: card.id,
          cardType: card.cardType,
          label: card.label,
          content: card.content,
        })),
    [section, workspaceState.cards],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/journey/stream',
        body: {
          activeRunId,
          currentSection: section,
          sectionCards: sectionCardsPayload,
          deepResearch: mode === 'thinking' || mode === 'research',
          workspaceChatMode: mode,
        },
      }),
    [activeRunId, mode, section, sectionCardsPayload],
  );

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
  } = useChat({
    transport,
    id: `unified-${section}-${activeRunId}`,
  });

  const isStreaming = status === 'streaming';
  const isSubmitted = status === 'submitted';
  const threadKey = `${activeRunId}:${section}`;
  const hydratedThreadKeyRef = useRef<string | null>(null);
  const lastPersistedSignatureRef = useRef<string | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeRunId) {
      setMessages([]);
      hydratedThreadKeyRef.current = null;
      lastPersistedSignatureRef.current = getWorkspaceMessageSignature([]);
      return;
    }

    const controller = new AbortController();
    const requestThreadKey = threadKey;
    const params = new URLSearchParams({ runId: activeRunId, section });

    hydratedThreadKeyRef.current = null;
    lastPersistedSignatureRef.current = null;
    setMessages([]);

    fetch(`/api/journey/session?${params.toString()}`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`status ${response.status}: ${text}`);
        }
        return readWorkspaceMessagesResponse(response);
      })
      .then((persistedMessages) => {
        if (controller.signal.aborted) {
          return;
        }
        setMessages(persistedMessages);
        lastPersistedSignatureRef.current =
          getWorkspaceMessageSignature(persistedMessages);
        hydratedThreadKeyRef.current = requestThreadKey;
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[journey] workspace chat hydration failed', {
          activeRunId,
          section,
          message,
        });
        hydratedThreadKeyRef.current = requestThreadKey;
        lastPersistedSignatureRef.current = getWorkspaceMessageSignature([]);
      });

    return () => {
      controller.abort();
    };
  }, [activeRunId, section, setMessages, threadKey]);

  useEffect(() => {
    if (!activeRunId || hydratedThreadKeyRef.current !== threadKey || status !== 'ready') {
      return;
    }

    const signature = getWorkspaceMessageSignature(messages);
    if (messages.length === 0 || signature === lastPersistedSignatureRef.current) {
      return;
    }

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      fetch('/api/journey/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeRunId,
          workspaceMessages: {
            section,
            messages,
          },
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text();
            throw new Error(`status ${response.status}: ${text}`);
          }
          lastPersistedSignatureRef.current = signature;
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('[journey] workspace chat persistence failed', {
            activeRunId,
            section,
            message,
          });
        });
    }, WORKSPACE_MESSAGE_PERSIST_DEBOUNCE_MS);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [activeRunId, messages, section, status, threadKey]);

  // Scan message parts for editCard tool results and populate pendingEdits.
  // In AI SDK v6, tool parts have type `tool-{toolName}` (e.g., `tool-editCard`).
  // The part has: type, toolCallId, state ('input-streaming'|'input-available'|'output-available'), input, output.
  const processedToolCallsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (typeof part !== 'object' || part === null || !('type' in part)) continue;
        const typed = part as Record<string, unknown>;
        const partType = String(typed.type ?? '');

        // Match tool-editCard parts (AI SDK v6 uses `tool-{name}` as part type)
        if (partType !== 'tool-editCard') continue;

        const toolCallId = typed.toolCallId as string | undefined;
        const partState = typed.state as string | undefined;
        if (!toolCallId) continue;

        // Only process when the tool result is available
        if (partState !== 'output-available') continue;

        // The output/result contains our { status: 'proposed', cardId, field, ... }
        const output = (typed.output ?? typed.result) as Record<string, unknown> | undefined;
        if (!output || output.status !== 'proposed') continue;

        // Skip if already processed
        if (processedToolCallsRef.current.has(toolCallId)) continue;
        if (pendingEdits.has(toolCallId)) continue;

        processedToolCallsRef.current.add(toolCallId);
        const cardId = String(output.cardId ?? '');
        const field = String(output.field ?? '');
        const explanation = String(output.explanation ?? '');
        const newValue = output.newValue;
        const card = workspaceState.cards[cardId];
        setPendingEdits((prev) => {
          const next = new Map(prev);
          next.set(toolCallId, {
            cardId,
            field,
            newValue,
            explanation,
            cardLabel: card?.label ?? 'Research card',
          });
          return next;
        });
      }
    }
  }, [messages, workspaceState.cards, pendingEdits]);

  // Scan message parts for updateField tool results and populate pendingFieldEdits.
  // Mirror of the editCard scanner above — different part type + payload shape.
  const processedFieldCallsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (typeof part !== 'object' || part === null || !('type' in part)) continue;
        const typed = part as Record<string, unknown>;
        const partType = String(typed.type ?? '');
        if (partType !== 'tool-updateField') continue;

        const toolCallId = typed.toolCallId as string | undefined;
        const partState = typed.state as string | undefined;
        if (!toolCallId) continue;
        if (partState !== 'output-available') continue;

        const output = (typed.output ?? typed.result) as Record<string, unknown> | undefined;
        if (!output || output.status !== 'proposed') continue;

        if (processedFieldCallsRef.current.has(toolCallId)) continue;
        if (pendingFieldEdits.has(toolCallId)) continue;

        processedFieldCallsRef.current.add(toolCallId);
        setPendingFieldEdits((prev) => {
          const next = new Map(prev);
          next.set(toolCallId, {
            key: String(output.key ?? ''),
            value: String(output.value ?? ''),
            reason: String(output.reason ?? ''),
          });
          return next;
        });
      }
    }
  }, [messages, pendingFieldEdits]);

  const isLoading = isStreaming || isSubmitted;

  // Track streaming start time for "thinking for N seconds" display
  useEffect(() => {
    if (isStreaming) {
      if (streamingStartRef.current === 0) {
        streamingStartRef.current = Date.now();
      }
      const interval = setInterval(() => {
        setStreamingDuration(Date.now() - streamingStartRef.current);
      }, 250);
      return () => clearInterval(interval);
    } else {
      streamingStartRef.current = 0;
      setStreamingDuration(0);
    }
  }, [isStreaming]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    // Only auto-scroll if user is near the bottom
    const el = threadRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isStreaming, localMessages.length]);

  // Scroll position tracking for FAB
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollFab(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Handle mode switch — abort in-flight stream before switching
  const handleModeChange = useCallback(
    (newMode: ChatMode) => {
      if (isLoading) stop();
      setMode(newMode);
    },
    [isLoading, stop],
  );

  // Submit from ChatInput
  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      sendMessage({ text: text.trim() });
    },
    [isLoading, sendMessage],
  );

  // Starter prompt clicked
  const handleStarterClick = useCallback(
    (text: string) => {
      sendMessage({ text });
    },
    [sendMessage],
  );

  // Edit approval — apply the proposed change to the workspace card
  const handleApproveEdit = useCallback(
    (toolCallId: string) => {
      const edit = pendingEdits.get(toolCallId);
      if (!edit) return;

      const card = workspaceState.cards[edit.cardId];
      if (card) {
        // Support dot-notation: "stats.Category" → field "stats", subKey "Category"
        const dotIdx = edit.field.indexOf('.');
        const topField = dotIdx >= 0 ? edit.field.slice(0, dotIdx) : edit.field;
        const subKey = dotIdx >= 0 ? edit.field.slice(dotIdx + 1) : null;

        const existingValue = card.content[topField];
        let newValue = edit.newValue;

        if (Array.isArray(existingValue)) {
          const items = existingValue as Array<Record<string, unknown>>;
          const stringVal = typeof newValue === 'string' ? newValue : String(newValue ?? '');

          if (subKey) {
            // Dot-notation: update the specific item by label match
            const target = subKey.toLowerCase();
            const updated = items.map((item) => {
              const label = String(item.label ?? item.title ?? '').toLowerCase();
              if (label === target) return { ...item, value: stringVal };
              return item;
            });
            newValue = updated;
          } else if (!Array.isArray(newValue) && typeof newValue === 'string') {
            // AI sent a bare string for an array field — try to match by explanation context
            // Fall back: look for a stat whose current value is being discussed
            const target = edit.explanation.toLowerCase();
            let matched = false;
            const updated = items.map((item) => {
              if (matched) return item;
              const label = String(item.label ?? item.title ?? '').toLowerCase();
              if (target.includes(label)) {
                matched = true;
                return { ...item, value: stringVal };
              }
              return item;
            });
            newValue = matched ? updated : existingValue;
          } else if (Array.isArray(newValue)) {
            // AI sent a replacement array — normalize keys to lowercase
            newValue = (newValue as Array<Record<string, unknown>>).map((item) => {
              const normalized: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(item)) {
                normalized[k.toLowerCase()] = v;
              }
              return normalized;
            });
          } else {
            // Non-string, non-array for an array field — don't corrupt
            newValue = existingValue;
          }
        }

        const updatedContent = { ...card.content, [topField]: newValue };
        updateCard(edit.cardId, updatedContent, 'ai');

        // Persist card edit to Supabase (fire-and-forget)
        if (activeRunId) {
          fetch('/api/journey/card-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              runId: activeRunId,
              sectionKey: card.sectionKey,
              cardId: edit.cardId,
              updatedContent,
            }),
          }).catch(() => { /* best-effort persistence */ });
        }
      }

      setPendingEdits((prev) => {
        const next = new Map(prev);
        next.delete(toolCallId);
        return next;
      });

      setLocalMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: `${edit.cardLabel} updated` },
      ]);
    },
    [pendingEdits, workspaceState.cards, updateCard, activeRunId],
  );

  // Edit rejection — discard the proposed change
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
          { id: crypto.randomUUID(), role: 'assistant', text: `${edit.cardLabel} edit rejected` },
        ]);
      }
    },
    [pendingEdits],
  );

  // Profile field update approval — PATCH the onboarding session with the new value.
  const handleApproveFieldEdit = useCallback(
    (toolCallId: string) => {
      const edit = pendingFieldEdits.get(toolCallId);
      if (!edit) return;

      const label = JOURNEY_FIELD_LABELS[edit.key] ?? edit.key;

      fetch('/api/journey/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: { [edit.key]: edit.value },
          activeRunId,
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('patch failed');
          setLocalMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', text: `${label} updated` },
          ]);
        })
        .catch(() => {
          setLocalMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: 'assistant', text: `Failed to update ${label}` },
          ]);
        });

      setPendingFieldEdits((prev) => {
        const next = new Map(prev);
        next.delete(toolCallId);
        return next;
      });
    },
    [pendingFieldEdits, activeRunId],
  );

  const handleRejectFieldEdit = useCallback(
    (toolCallId: string) => {
      const edit = pendingFieldEdits.get(toolCallId);
      setPendingFieldEdits((prev) => {
        const next = new Map(prev);
        next.delete(toolCallId);
        return next;
      });
      if (edit) {
        const label = JOURNEY_FIELD_LABELS[edit.key] ?? edit.key;
        setLocalMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', text: `${label} change rejected` },
        ]);
      }
    },
    [pendingFieldEdits],
  );

  const hasMessages =
    messages.length > 0 ||
    pendingEdits.size > 0 ||
    pendingFieldEdits.size > 0 ||
    localMessages.length > 0;
  const sectionLabel = (SECTION_META[section] ?? DEFAULT_SECTION_META).label;

  return (
    <div
      className={cn(
        'flex flex-col',
        'h-full min-h-0',
        className,
      )}
      style={{
        fontFamily: 'var(--font-sans, "DM Sans", sans-serif)',
        background: 'var(--bg-chat)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header — mode bar                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border-default)' }}
        id={modeBarId}
      >
        <ModeBar mode={mode} onChange={handleModeChange} />

        {/* Streaming indicator (right side of header) */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.span
              key="streaming"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[10.5px] animate-pulse"
              style={{
                color:
                  mode === 'thinking'
                    ? '#a855f7'
                    : mode === 'research'
                      ? '#3b82f6'
                      : 'var(--text-quaternary, #555)',
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              }}
            >
              {mode === 'research' ? 'searching' : 'thinking'}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Message thread                                                      */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-subtle,#27272a) transparent' }}
      >
        <div className="px-4 py-4 space-y-4">
          {/* Empty state */}
          {!hasMessages && (
            <EmptyState
              section={section}
              userName={userName}
              companyName={companyName}
              onStarterClick={handleStarterClick}
            />
          )}

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <MessageRow
                key={msg.id}
                message={msg}
                isStreaming={isStreaming}
                isLast={idx === messages.length - 1}
                mode={mode}
                userName={userName}
              />
            ))}
          </AnimatePresence>

          {/* Local confirmation messages — compact inline notifications */}
          {localMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[11px] text-emerald-400/80 leading-snug truncate">
                {msg.text.replace(/\*\*/g, '')}
              </span>
            </motion.div>
          ))}

          {/* Typing indicator — only when submitted (before first token) */}
          <AnimatePresence>
            {isSubmitted && !isStreaming && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex gap-2.5"
              >
                <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-[var(--bg-hover)] border border-[var(--border-subtle)] mt-0.5">
                  <Sparkles className="w-3 h-3 text-[var(--text-primary)]" />
                </div>
                <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-transparent">
                  <span className="flex items-center gap-[3px]">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <motion.span
                        key={i}
                        className="inline-block w-[5px] h-[5px] rounded-full"
                        style={{ background: 'var(--text-quaternary)' }}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay }}
                      />
                    ))}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={threadEndRef} />
        </div>

        {/* Scroll-to-bottom FAB */}
        <AnimatePresence>
          {showScrollFab && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              onClick={scrollToBottom}
              aria-label="Scroll to bottom"
              className={cn(
                'sticky bottom-3 left-1/2 -translate-x-1/2',
                'w-8 h-8 rounded-full',
                'shadow-lg',
                'flex items-center justify-center',
                'transition-colors z-10',
              )}
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-tertiary)' }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Streaming status line                                               */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {isLoading && (
          <StreamingStatus
            mode={mode}
            isStreaming={isStreaming}
            streamingDuration={streamingDuration}
          />
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Pending edit proposals — pinned above input for visibility          */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {pendingEdits.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-amber-500/30 bg-amber-500/[0.03] px-3 py-2.5 shrink-0 space-y-2 overflow-hidden"
          >
            {Array.from(pendingEdits.entries()).map(([toolCallId, edit]) => (
              <div key={toolCallId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
                    Edit Proposed
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {edit.cardLabel}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {edit.explanation}
                </p>
                <div className="text-[11px] font-mono rounded-lg px-2.5 py-1.5 max-h-[80px] overflow-y-auto whitespace-pre-wrap" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-hover)' }}>
                  <span style={{ color: 'var(--text-quaternary)' }}>{edit.field}:</span>{' '}
                  {typeof edit.newValue === 'string'
                    ? edit.newValue.length > 300
                      ? edit.newValue.slice(0, 300) + '...'
                      : edit.newValue
                    : JSON.stringify(edit.newValue, null, 2).slice(0, 300)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApproveEdit(toolCallId)}
                    className="flex-1 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold py-2 transition-all hover:bg-emerald-500 active:scale-[0.98]"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRejectEdit(toolCallId)}
                    className="flex-1 rounded-lg border text-[12px] font-medium py-2 transition-all active:scale-[0.98]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Pending profile field updates — onboarding data changes            */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {pendingFieldEdits.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-emerald-500/30 bg-emerald-500/[0.03] px-3 py-2.5 shrink-0 space-y-2 overflow-hidden"
          >
            {Array.from(pendingFieldEdits.entries()).map(([toolCallId, edit]) => {
              const label = JOURNEY_FIELD_LABELS[edit.key] ?? edit.key;
              return (
                <div key={toolCallId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                      Profile Update Proposed
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                      {label}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {edit.reason}
                  </p>
                  <div
                    className="text-[11px] font-mono rounded-lg px-2.5 py-1.5 max-h-[80px] overflow-y-auto whitespace-pre-wrap"
                    style={{ color: 'var(--text-tertiary)', background: 'var(--bg-hover)' }}
                  >
                    <span style={{ color: 'var(--text-quaternary)' }}>{edit.key}:</span>{' '}
                    {edit.value.length > 300 ? edit.value.slice(0, 300) + '...' : edit.value}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveFieldEdit(toolCallId)}
                      className="flex-1 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold py-2 transition-colors hover:bg-emerald-500"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectFieldEdit(toolCallId)}
                      className="flex-1 rounded-lg border text-[12px] font-medium py-2 transition-colors"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Input area                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-t px-3 pb-3 pt-2 shrink-0 space-y-2" style={{ borderColor: 'var(--border-default)' }}>
        <ChatInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
          placeholder={
            mode === 'research'
              ? 'Ask to search the web...'
              : mode === 'thinking'
                ? 'Ask for deep reasoning...'
                : 'Ask anything about this research...'
          }
        />

        {/* Section badge */}
        <div className="flex items-center px-1">
          <span
            className="text-[10px] px-2 py-0.5 rounded-md border"
            style={{ color: 'var(--text-quaternary)', background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }}
          >
            {sectionLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
