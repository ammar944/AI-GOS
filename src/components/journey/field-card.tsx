'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { durations } from '@/lib/motion';

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
}: FieldCardProps) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  // Auto-resize textarea to fit content
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const sharedInputClasses = cn(
    'w-full bg-transparent border-none outline-none text-[14px] leading-relaxed placeholder:text-[var(--text-quaternary)]',
    'caret-[var(--accent-blue)]',
  );

  return (
    <div
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
          className="text-[11px] font-mono uppercase tracking-[0.14em] cursor-pointer"
          style={{ color: focused ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}
          onClick={() => textareaRef.current?.focus()}
        >
          {label}
        </label>

        <div className="flex items-center gap-1.5 ml-auto">
          {isRequired && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
              style={{
                color: value.trim() ? 'var(--accent-green)' : 'var(--accent-amber)',
                background: value.trim() ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${value.trim() ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
              }}
            >
              <span
                className="w-1 h-1 rounded-full"
                style={{ background: value.trim() ? 'var(--accent-green)' : 'var(--accent-amber)' }}
              />
              {value.trim() ? 'Done' : 'Required'}
            </span>
          )}

          {isScraped && value.trim() && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider"
              style={{
                color: 'var(--accent-blue)',
                background: 'rgba(54, 94, 255, 0.08)',
                border: '1px solid rgba(54, 94, 255, 0.15)',
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

      {/* Input area — all fields use auto-resizing textarea so content is always visible */}
      <div className="px-4 pb-3">
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

        {/* Focus line */}
        <motion.div
          className="h-px mt-1 rounded-full"
          style={{
            background: 'var(--accent-blue)',
            transformOrigin: 'left',
          }}
          animate={{ scaleX: focused ? 1 : 0, opacity: focused ? 0.5 : 0 }}
          transition={{ duration: durations.normal }}
        />

        {/* Helper text */}
        {helper && (
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
