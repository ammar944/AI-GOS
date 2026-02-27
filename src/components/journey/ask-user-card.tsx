'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AskUserResult =
  | { fieldName: string; selectedLabel: string; selectedIndex: number }
  | { fieldName: string; selectedLabels: string[]; selectedIndices: number[] }
  | { fieldName: string; otherText: string };

interface AskUserCardProps {
  toolCallId: string;
  question: string;
  fieldName: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  isSubmitted: boolean;
  selectedIndices: number[];
  onSubmit: (result: AskUserResult) => void;
}

type CardState = 'idle' | 'selecting' | 'other-input' | 'submitted';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasDescriptions(options: Array<{ label: string; description?: string }>): boolean {
  return options.some((o) => !!o.description);
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...springs.smooth, staggerChildren: 0.04 },
  },
};

const chipVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: springs.snappy },
};

// ---------------------------------------------------------------------------
// Chip sub-component
// ---------------------------------------------------------------------------

interface ChipProps {
  label: string;
  description?: string;
  isSelected: boolean;
  isOther?: boolean;
  isPill: boolean;
  isDisabled: boolean;
  isFadedOut: boolean;
  role: 'radio' | 'checkbox';
  tabIndex: number;
  chipRef: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function Chip({
  label,
  description,
  isSelected,
  isOther = false,
  isPill,
  isDisabled,
  isFadedOut,
  role,
  tabIndex,
  chipRef,
  onClick,
  onKeyDown,
}: ChipProps) {
  const borderRadius = isPill ? '999px' : '12px';

  return (
    <motion.button
      ref={chipRef}
      variants={chipVariants}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      role={role}
      aria-checked={isSelected}
      tabIndex={tabIndex}
      disabled={isDisabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        'relative text-left transition-all outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-1',
        isPill ? 'px-4 py-2' : 'px-4 py-3',
        isDisabled && 'cursor-default',
        !isDisabled && 'cursor-pointer',
      )}
      style={{
        borderRadius,
        background: isOther
          ? 'transparent'
          : isSelected
            ? 'rgba(54, 94, 255, 0.08)'
            : 'var(--bg-hover)',
        border: isOther
          ? '1.5px dashed var(--border-default)'
          : isSelected
            ? '1.5px solid var(--accent-blue)'
            : '1px solid var(--border-default)',
        color: isOther && !isSelected
          ? 'var(--text-tertiary)'
          : 'var(--text-primary)',
        opacity: isFadedOut ? 0.4 : isDisabled && !isSelected ? 0.5 : 1,
        pointerEvents: isDisabled ? 'none' : 'auto',
        boxShadow: isSelected
          ? '0 0 12px rgba(54, 94, 255, 0.15), 0 0 4px rgba(54, 94, 255, 0.1)'
          : 'none',
        '--tw-ring-color': 'var(--accent-blue)',
        '--tw-ring-offset-color': 'var(--bg-base)',
      } as React.CSSProperties}
    >
      <div className="flex items-center gap-2">
        {role === 'checkbox' && (
          <div
            className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-colors"
            style={{
              border: isSelected
                ? '1.5px solid var(--accent-blue)'
                : '1.5px solid var(--border-default)',
              background: isSelected ? 'var(--accent-blue)' : 'transparent',
            }}
          >
            {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <span
            className="text-sm font-medium block"
            style={{ lineHeight: '1.4' }}
          >
            {label}
          </span>
          {description && (
            <span
              className="text-xs block mt-0.5"
              style={{ color: 'var(--text-tertiary)', lineHeight: '1.4' }}
            >
              {description}
            </span>
          )}
        </div>

        {role === 'radio' && isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={springs.snappy}
            className="flex-shrink-0 w-2 h-2 rounded-full"
            style={{ background: 'var(--accent-blue)' }}
          />
        )}
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Other text input sub-component
// ---------------------------------------------------------------------------

interface OtherInputProps {
  onSubmit: (text: string) => void;
  isPill: boolean;
  isDisabled: boolean;
}

function OtherInput({ onSubmit, isPill, isDisabled }: OtherInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDisabled) {
      inputRef.current?.focus();
    }
  }, [isDisabled]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  }, [text, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      <div
        className="flex items-center gap-2"
        style={{
          borderRadius: isPill ? '999px' : '12px',
          background: 'var(--bg-input)',
          border: '1.5px solid var(--accent-blue)',
          padding: '6px 12px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          disabled={isDisabled}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Custom answer"
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !text.trim()}
          className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-opacity disabled:opacity-30"
          style={{
            background: 'var(--accent-blue)',
            color: '#ffffff',
          }}
        >
          Done
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AskUserCard({
  toolCallId,
  question,
  fieldName,
  options,
  multiSelect,
  isSubmitted,
  selectedIndices: selectedIndicesProp,
  onSubmit,
}: AskUserCardProps) {
  // Detect "Other" from submitted state with no chip indices selected
  const isOtherFromHistory = isSubmitted && selectedIndicesProp.length === 0;

  const [cardState, setCardState] = useState<CardState>(
    isSubmitted ? 'submitted' : 'idle',
  );
  const [internalSelected, setInternalSelected] = useState<Set<number>>(
    () => new Set(selectedIndicesProp),
  );
  const [singleHighlight, setSingleHighlight] = useState<number | null>(null);
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const isPill = !hasDescriptions(options);
  const groupRole = multiSelect ? 'group' : 'radiogroup';
  const chipRole = multiSelect ? 'checkbox' : 'radio';
  const totalChips = options.length + 1; // +1 for "Other"

  // Derive effective submission state and selection from props + internal state
  const submitted = cardState === 'submitted' || isSubmitted;
  const activeSelected = isSubmitted ? new Set(selectedIndicesProp) : internalSelected;

  // ---- Single-select handler ----
  const handleSingleSelect = useCallback(
    (index: number) => {
      if (cardState === 'submitted') return;

      setSingleHighlight(index);
      setInternalSelected(new Set([index]));

      // Auto-submit after 200ms animation delay
      setTimeout(() => {
        setCardState('submitted');
        onSubmit({
          fieldName,
          selectedLabel: options[index].label,
          selectedIndex: index,
        });
      }, 200);
    },
    [cardState, fieldName, options, onSubmit],
  );

  // ---- Multi-select toggle handler ----
  const handleMultiToggle = useCallback(
    (index: number) => {
      if (cardState === 'submitted') return;

      setInternalSelected((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
      setShowOtherInput(false);
      setCardState('selecting');
    },
    [cardState],
  );

  // ---- Multi-select "Done" handler ----
  const handleMultiDone = useCallback(() => {
    if (internalSelected.size === 0) return;

    const sortedIndices = Array.from(internalSelected).sort((a, b) => a - b);
    setCardState('submitted');
    onSubmit({
      fieldName,
      selectedLabels: sortedIndices.map((i) => options[i].label),
      selectedIndices: sortedIndices,
    });
  }, [fieldName, options, onSubmit, internalSelected]);

  // ---- "Other" chip handler ----
  const handleOtherClick = useCallback(() => {
    if (cardState === 'submitted') return;

    if (multiSelect) {
      setInternalSelected(new Set());
    }
    setShowOtherInput(true);
    setCardState('other-input');
  }, [cardState, multiSelect]);

  // ---- "Other" text submit handler ----
  const handleOtherSubmit = useCallback(
    (text: string) => {
      setCardState('submitted');
      onSubmit({ fieldName, otherText: text });
    },
    [fieldName, onSubmit],
  );

  // ---- Chip keyboard handler (roving tabindex) ----
  const handleChipKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (cardState === 'submitted') return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (index + 1) % totalChips;
        setFocusedIndex(next);
        chipRefs.current[next]?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (index - 1 + totalChips) % totalChips;
        setFocusedIndex(prev);
        chipRefs.current[prev]?.focus();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (index === options.length) {
          handleOtherClick();
        } else if (multiSelect) {
          handleMultiToggle(index);
        } else {
          handleSingleSelect(index);
        }
      }
    },
    [cardState, totalChips, options.length, multiSelect, handleOtherClick, handleMultiToggle, handleSingleSelect],
  );

  // Build selected labels for screen reader announcement
  const selectedLabels = Array.from(activeSelected)
    .sort((a, b) => a - b)
    .map((i) => options[i]?.label)
    .filter(Boolean);

  return (
    <motion.div
      data-tool-call-id={toolCallId}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="my-3 w-full"
      role={groupRole}
      aria-label={question}
    >
      {/* Chip grid */}
      <div
        className={cn(
          'flex flex-wrap gap-2',
          !isPill && 'flex-col gap-2',
        )}
      >
        {options.map((option, index) => {
          const isSelected = activeSelected.has(index);
          const isFadedOut =
            !multiSelect &&
            singleHighlight !== null &&
            singleHighlight !== index;

          return (
            <Chip
              key={`${fieldName}-${index}`}
              label={option.label}
              description={option.description}
              isSelected={isSelected}
              isPill={isPill}
              isDisabled={submitted}
              isFadedOut={isFadedOut}
              role={chipRole}
              tabIndex={!multiSelect ? (focusedIndex === index ? 0 : -1) : 0}
              chipRef={(el) => { chipRefs.current[index] = el; }}
              onClick={() =>
                multiSelect
                  ? handleMultiToggle(index)
                  : handleSingleSelect(index)
              }
              onKeyDown={(e) => handleChipKeyDown(e, index)}
            />
          );
        })}

        {/* "Other" chip */}
        {!showOtherInput && (
          <Chip
            label="Other"
            isSelected={isOtherFromHistory}
            isOther
            isPill={isPill}
            isDisabled={submitted}
            isFadedOut={
              !multiSelect &&
              singleHighlight !== null
            }
            role={chipRole}
            tabIndex={!multiSelect ? (focusedIndex === options.length ? 0 : -1) : 0}
            chipRef={(el) => { chipRefs.current[options.length] = el; }}
            onClick={handleOtherClick}
            onKeyDown={(e) => handleChipKeyDown(e, options.length)}
          />
        )}
      </div>

      {/* Other text input — expands inline */}
      <AnimatePresence>
        {showOtherInput && !submitted && (
          <div className="mt-2">
            <OtherInput
              onSubmit={handleOtherSubmit}
              isPill={isPill}
              isDisabled={submitted}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Multi-select "Done" button */}
      <AnimatePresence>
        {multiSelect && cardState === 'selecting' && activeSelected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="mt-3 flex justify-end"
          >
            <button
              onClick={handleMultiDone}
              className="px-5 py-1.5 rounded-full text-sm font-medium transition-all hover:brightness-110"
              style={{
                background: 'var(--accent-blue)',
                color: '#ffffff',
              }}
            >
              Done ({activeSelected.size})
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen reader live region */}
      <div aria-live="polite" className="sr-only">
        {submitted && selectedLabels.length > 0 && `Selected: ${selectedLabels.join(', ')}`}
        {submitted && isOtherFromHistory && 'Selected: Other'}
      </div>
    </motion.div>
  );
}
