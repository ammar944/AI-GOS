'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { durations } from '@/lib/motion';

export type FieldCardMode = 'text' | 'enum' | 'multi-select';

export interface FieldCardChoice {
  value: string;
  label: string;
  helper?: string;
}

export interface FieldCardProps {
  fieldKey: string;
  label: string;
  value: string;
  placeholder?: string;
  helper?: string;
  isRequired: boolean;
  isScraped: boolean;
  isMultiline: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  /** Rendering mode — text (default), enum (single-select), multi-select (chips) */
  mode?: FieldCardMode;
  /** Choices list for enum / multi-select modes */
  choices?: readonly FieldCardChoice[];
}

/** Multi-select values are stored as comma-separated strings ("meta,google,linkedin"). */
function parseMultiValue(value: string): Set<string> {
  if (!value.trim()) return new Set();
  return new Set(value.split(',').map((s) => s.trim()).filter(Boolean));
}

function serializeMultiValue(values: Set<string>): string {
  return Array.from(values).join(',');
}

export function FieldCard({
  fieldKey,
  label,
  value,
  placeholder = '',
  helper,
  isRequired,
  isScraped,
  isMultiline,
  onChange,
  onBlur,
  autoFocus,
  mode = 'text',
  choices,
}: FieldCardProps) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Auto-resize textarea to fit content (text mode only)
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (mode === 'text') autoResize();
  }, [value, autoResize, mode]);

  const selectedMulti = useMemo(
    () => (mode === 'multi-select' ? parseMultiValue(value) : new Set<string>()),
    [mode, value],
  );

  const filled =
    mode === 'multi-select' ? selectedMulti.size > 0 : value.trim().length > 0;

  const sharedInputClasses = cn(
    'w-full bg-transparent border-none outline-none text-[14px] leading-relaxed placeholder:text-[var(--text-quaternary)]',
    'caret-[var(--text-primary)]',
  );

  const toggleMulti = useCallback(
    (choiceValue: string) => {
      const next = new Set(selectedMulti);
      if (next.has(choiceValue)) next.delete(choiceValue);
      else next.add(choiceValue);
      onChange(serializeMultiValue(next));
    },
    [selectedMulti, onChange],
  );

  return (
    <div
      data-field-key={fieldKey}
      className={cn(
        'group relative rounded-xl transition-all duration-200',
        focused
          ? 'bg-[var(--bg-active)]'
          : 'bg-transparent hover:bg-[var(--bg-hover)]',
      )}
    >
      {/* Header — label + tags */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <label
          htmlFor={fieldKey}
          className="text-[10px] font-mono uppercase tracking-[0.14em] cursor-pointer transition-colors"
          style={{ color: focused ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          onClick={() => textareaRef.current?.focus()}
        >
          {label}
        </label>

        <div className="flex items-center gap-1.5 ml-auto">
          {isRequired ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
              style={{
                color: filled ? 'var(--accent-green)' : 'var(--accent-amber)',
                background: filled ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${filled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
              }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: filled ? 'var(--accent-green)' : 'var(--accent-amber)' }}
              />
              {filled ? 'Done' : 'Required'}
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
              style={{
                color: filled ? 'var(--text-tertiary)' : 'var(--text-quaternary)',
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {filled ? (
                <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ background: 'var(--text-quaternary)' }}
                />
              )}
              {filled ? 'Filled' : 'Optional'}
            </span>
          )}

          {isScraped && filled && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
              style={{
                color: 'var(--text-secondary)',
                background: 'var(--bg-hover)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              AI
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        {/* Enum / multi-select pills */}
        {(mode === 'enum' || mode === 'multi-select') && choices && choices.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {choices.map((choice) => {
                const isSelected =
                  mode === 'multi-select'
                    ? selectedMulti.has(choice.value)
                    : value === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => {
                      if (mode === 'multi-select') toggleMulti(choice.value);
                      else onChange(choice.value);
                    }}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[12px] transition-all duration-150 whitespace-nowrap',
                      isSelected
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
                    )}
                    style={{
                      background: isSelected
                        ? 'rgba(54, 94, 255, 0.16)'
                        : 'var(--bg-hover)',
                      border: `1px solid ${
                        isSelected
                          ? 'rgba(54, 94, 255, 0.4)'
                          : 'var(--border-subtle)'
                      }`,
                    }}
                  >
                    {choice.label}
                  </button>
                );
              })}
            </div>
            {/* Selected choice's helper (enum mode) */}
            {mode === 'enum' && value && choices.find((c) => c.value === value)?.helper && (
              <p
                className="mt-2 text-[11px] leading-relaxed"
                style={{ color: 'var(--text-quaternary)' }}
              >
                {choices.find((c) => c.value === value)?.helper}
              </p>
            )}
          </>
        ) : (
          // Text mode — auto-resizing textarea
          <textarea
            ref={textareaRef}
            id={fieldKey}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              autoResize();
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus={autoFocus}
            placeholder={placeholder}
            rows={isMultiline ? 3 : 1}
            className={cn(sharedInputClasses, 'resize-none overflow-hidden')}
            style={{ color: 'var(--text-primary)' }}
          />
        )}

        {/* Focus line — text mode only */}
        {mode === 'text' && (
          <motion.div
            className="h-px mt-1 rounded-full"
            style={{
              background: 'var(--text-primary)',
              transformOrigin: 'left',
            }}
            animate={{ scaleX: focused ? 1 : 0, opacity: focused ? 0.4 : 0 }}
            transition={{ duration: durations.normal }}
          />
        )}

        {/* Helper text (non-enum — enum mode shows its selected helper instead) */}
        {helper && mode !== 'enum' && (
          <p
            className="mt-2 text-[11px] leading-relaxed"
            style={{ color: 'var(--text-quaternary)' }}
          >
            {helper}
          </p>
        )}
        {/* For enum mode: only show helper when nothing is selected yet */}
        {helper && mode === 'enum' && !value && (
          <p
            className="mt-2 text-[11px] leading-relaxed"
            style={{ color: 'var(--text-quaternary)' }}
          >
            {helper}
          </p>
        )}
      </div>
    </div>
  );
}
