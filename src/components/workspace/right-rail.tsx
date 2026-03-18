'use client';

import { useState, useRef, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_META, DEFAULT_SECTION_META } from '@/lib/journey/section-meta';
import type { CardState } from '@/lib/workspace/types';

interface LocalMessage {
  id: string;
  role: 'assistant';
  text: string;
}

/**
 * Extract the numeric offer score from workspace cards.
 * Cards are keyed by cardId (not sectionKey), so we filter by sectionKey.
 */
function extractOfferScore(cards: Record<string, CardState>): {
  overall: number;
  dimensions: Array<{ label: string; value: number }>;
} | null {
  const scoreCard = Object.values(cards).find(
    (c) => c.sectionKey === 'offerAnalysis' && c.label === 'Offer Score',
  );
  if (!scoreCard) return null;

  const stats = scoreCard.content?.stats;
  if (!Array.isArray(stats) || stats.length === 0) return null;

  const dimensions: Array<{ label: string; value: number }> = [];
  let overall = 0;

  for (const stat of stats) {
    const s = stat as { label?: string; value?: string };
    if (!s.label || !s.value) continue;
    const num = parseFloat(String(s.value).split('/')[0]);
    if (Number.isNaN(num)) continue;

    if (s.label === 'Overall Score') {
      overall = num;
    } else {
      dimensions.push({ label: s.label, value: num });
    }
  }

  return overall > 0 ? { overall, dimensions } : null;
}

/**
 * Format score breakdown into a chat-friendly message.
 */
function formatScoreMessage(
  score: { overall: number; dimensions: Array<{ label: string; value: number }> },
  prevScore: number | null,
  round: number,
): string {
  const lines: string[] = [];

  if (prevScore !== null) {
    lines.push(`Score: ${prevScore}/10 → ${score.overall}/10`);
  } else {
    lines.push(`Your offer analysis scored ${score.overall}/10.`);
  }

  const sorted = [...score.dimensions].sort((a, b) => a.value - b.value);
  lines.push('');
  lines.push('Breakdown:');
  for (const dim of sorted) {
    const bar = dim.value >= 7 ? 'strong' : dim.value >= 5 ? 'moderate' : 'weak';
    lines.push(`  ${dim.label}: ${dim.value}/10 (${bar})`);
  }

  if (score.overall >= 8) {
    lines.push('');
    lines.push('Looking good — approve when you\'re ready.');
  } else if (round >= 2) {
    const weakest = sorted[0];
    lines.push('');
    lines.push(
      `The remaining gaps may need business-level changes (e.g., ${weakest.label}: ${weakest.value}/10). You can approve as-is or keep refining.`,
    );
  } else {
    lines.push('');
    lines.push('I can help improve the weak areas. Which should we tackle first?');
  }

  return lines.join('\n');
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

  // Offer refinement tracking
  const refinementRoundRef = useRef(0);
  const prevScoreRef = useRef<number | null>(null);
  const lastSeededPhaseRef = useRef<string | null>(null);

  // Clear local messages + reset refinement refs on section change
  useEffect(() => {
    if (prevSectionRef.current !== state.currentSection) {
      setLocalMessages([]);
      prevSectionRef.current = state.currentSection;
      refinementRoundRef.current = 0;
      prevScoreRef.current = null;
      lastSeededPhaseRef.current = null;
    }
  }, [state.currentSection]);

  // Auto-seed offer score breakdown when section enters review
  useEffect(() => {
    if (state.currentSection !== 'offerAnalysis') return;

    const phase = state.sectionStates.offerAnalysis;

    // Build a discriminator that changes on re-runs — use the score card's
    // latest version timestamp (changes each time worker writes new results).
    const scoreCard = Object.values(state.cards).find(
      (c) => c.sectionKey === 'offerAnalysis' && c.label === 'Offer Score',
    );
    const latestVersion = scoreCard?.versions?.[scoreCard.versions.length - 1]?.timestamp ?? 0;
    const phaseKey = `${phase}-${latestVersion}`;

    // Only fire once per distinct phase+result combination (not on re-renders)
    if (lastSeededPhaseRef.current === phaseKey) return;

    if (phase === 'review') {
      lastSeededPhaseRef.current = phaseKey;

      const score = extractOfferScore(state.cards);
      if (!score) return; // No score card — skip silently

      // Increment round counter on each re-run (prevScore exists = this is a re-run).
      // Round 0 = first result, round 1 = first re-run, round 2 = second re-run.
      // Exit condition (round >= 2) fires after the second re-run attempt.
      if (prevScoreRef.current !== null) {
        refinementRoundRef.current += 1;
      }

      const message = formatScoreMessage(
        score,
        prevScoreRef.current,
        refinementRoundRef.current,
      );

      prevScoreRef.current = score.overall;

      setLocalMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          text: message,
        },
      ]);
    }

    if (phase === 'error') {
      lastSeededPhaseRef.current = phaseKey;
      const errorMsg = state.sectionErrors.offerAnalysis ?? 'Unknown error';
      setLocalMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          text: `Re-run failed: ${errorMsg}. You can retry or approve the previous results.`,
        },
      ]);
    }
  }, [state.currentSection, state.sectionStates, state.cards, state.sectionErrors]);

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
                  'text-sm leading-relaxed',
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
