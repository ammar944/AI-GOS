'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JourneyChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function JourneyChatInput({
  onSubmit,
  isLoading,
  disabled = false,
  placeholder = 'Tell me about your business...',
  className,
}: JourneyChatInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea: min 1 row, max 120px
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSubmit(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const canSend = input.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className={cn('relative', className)}>
      {/* Gradient fade above input */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-48px',
          left: 0,
          right: 0,
          height: '48px',
          background: 'linear-gradient(to bottom, transparent, var(--bg-base))',
          pointerEvents: 'none',
        }}
      />

      {/* Glassmorphism container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          padding: '12px',
          borderRadius: '16px',
          background: 'rgba(10, 13, 20, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${isFocused ? 'var(--border-focus)' : 'var(--border-subtle)'}`,
          boxShadow: isFocused
            ? '0 0 0 3px var(--accent-blue-glow), 0 0 20px rgba(54, 94, 255, 0.1)'
            : 'none',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled || (isLoading && !canSend)}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none scrollbar-hide text-sm leading-relaxed"
          style={{
            color: 'var(--text-primary)',
            minHeight: '20px',
            maxHeight: '120px',
          }}
        />

        {/* Send button: 32px circle, accent-blue + glow when active, muted when empty */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: canSend ? 'var(--accent-blue)' : 'transparent',
            color: canSend ? '#ffffff' : 'var(--text-tertiary)',
            boxShadow: canSend ? '0 0 12px rgba(54, 94, 255, 0.4)' : 'none',
            border: 'none',
            cursor: canSend ? 'pointer' : 'default',
            transition: 'background 0.2s ease, box-shadow 0.2s ease, color 0.2s ease',
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
