'use client';

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { suggestionsForSection } from '@/lib/workspace/refine-suggestions';
import type { SectionKey } from '@/lib/workspace/types';

/**
 * InlineRefine — bundle-spec inline refinement input.
 *
 * Design ref: preview/component-inputs-refine.html (Option 2 — prefix chip + outlined)
 * and 03-design-system-spec.md § "Inline refine": click trigger → 3 suggested chips
 * + free text input → content streams back into card.
 *
 * Wiring: on submit we dispatch a `aigos:refine-card` CustomEvent. UnifiedChat
 * listens for it and fires the corresponding chat message (which the existing
 * editCard tool pipeline handles). This keeps the refine UI decoupled from the
 * chat's useChat hook.
 */

export const REFINE_EVENT = 'aigos:refine-card' as const;

export interface RefineCardEventDetail {
  cardId: string;
  section: SectionKey;
  cardLabel?: string;
  prompt: string;
}

interface InlineRefineProps {
  cardId: string;
  section: SectionKey;
  cardLabel?: string;
  /** Compact mode (card footer) vs. expanded (beneath focused card) */
  compact?: boolean;
}

export function InlineRefine({ cardId, section, cardLabel, compact = false }: InlineRefineProps) {
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = suggestionsForSection(section);

  const dispatch = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const detail: RefineCardEventDetail = {
      cardId,
      section,
      cardLabel,
      prompt: trimmed,
    };
    window.dispatchEvent(new CustomEvent(REFINE_EVENT, { detail }));
    setPrompt('');
    setExpanded(false);
  }, [cardId, section, cardLabel]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      dispatch(prompt);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setExpanded(false);
      setPrompt('');
    }
  }, [dispatch, prompt]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          // Focus next tick so animation doesn't steal focus
          setTimeout(() => inputRef.current?.focus(), 80);
        }}
        className={cn(
          'cursor-pointer inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1',
          'text-[10px] font-mono uppercase tracking-[0.12em]',
          'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
          'border border-transparent hover:border-[var(--border-subtle)]',
          'transition-colors duration-150',
        )}
      >
        <Sparkles className="h-3 w-3" />
        Refine
      </button>
    );
  }

  return (
    <AnimatePresence initial>
      <motion.div
        key="inline-refine"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0.6, 0.2, 1] }}
        className={cn(compact ? 'pt-2' : 'pt-3', 'overflow-hidden')}
      >
        {/* Suggestion chips */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => dispatch(s)}
                className={cn(
                  'cursor-pointer rounded-[4px] px-2 py-1 text-[11px] leading-none',
                  'border border-[var(--border-subtle)] bg-transparent',
                  'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                  'hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)]',
                  'transition-colors duration-150',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input — bundle Option 2: prefix chip + outlined + ⌘↵ kbd */}
        <label
          className={cn(
            'flex items-center gap-2 rounded-[4px] px-2.5 py-2',
            'border border-[var(--border-subtle)] bg-transparent',
            'focus-within:border-[var(--text-primary)] transition-colors duration-150',
          )}
        >
          <span
            className="shrink-0 select-none font-mono text-[14px] text-[var(--text-tertiary)] leading-none"
            aria-hidden
          >
            ›
          </span>
          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell the agent what to change…"
            className={cn(
              'flex-1 bg-transparent border-0 outline-none',
              'text-[13px] leading-none text-[var(--text-primary)]',
              'placeholder:text-[var(--text-tertiary)]',
            )}
          />
          <kbd
            className={cn(
              'shrink-0 font-mono text-[10px] tabular-nums',
              'rounded-[3px] border border-[var(--border-subtle)] px-1.5 py-0.5',
              'text-[var(--text-tertiary)]',
            )}
          >
            ↵
          </kbd>
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setPrompt('');
            }}
            className="cursor-pointer shrink-0 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close refine"
          >
            <X className="h-3 w-3" />
          </button>
        </label>
      </motion.div>
    </AnimatePresence>
  );
}
