'use client';

import { useState, useRef, useCallback } from 'react';
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
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const handleFocus = useCallback(() => setFocused(true), []);
  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  const sharedInputClasses = cn(
    'w-full bg-transparent border-none outline-none text-[14px] leading-relaxed placeholder:text-[var(--text-quaternary)]',
    'caret-[var(--accent-blue)]',
  );

  return (
    <div
      className={cn(
        'group relative rounded-xl transition-all duration-200',
        focused
          ? 'bg-[rgb(20,22,28)]'
          : 'bg-transparent hover:bg-[rgb(16,18,24)]',
      )}
    >
      {/* Header — label + tags */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <label
          htmlFor={fieldKey}
          className="text-[11px] font-mono uppercase tracking-[0.14em] cursor-pointer"
          style={{ color: focused ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.45)' }}
          onClick={() => inputRef.current?.focus()}
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

      {/* Input area */}
      <div className="px-4 pb-3">
        {isMultiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            id={fieldKey}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus={autoFocus}
            placeholder={placeholder}
            rows={3}
            className={cn(sharedInputClasses, 'resize-none')}
            style={{ color: 'rgba(255, 255, 255, 0.9)' }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            id={fieldKey}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            autoFocus={autoFocus}
            placeholder={placeholder}
            className={cn(sharedInputClasses, 'py-1')}
            style={{ color: 'rgba(255, 255, 255, 0.9)' }}
          />
        )}

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
            style={{ color: 'rgba(255, 255, 255, 0.3)' }}
          >
            {helper}
          </p>
        )}
      </div>
    </div>
  );
}
