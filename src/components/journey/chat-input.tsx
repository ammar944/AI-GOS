'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlashCommandPalette, type SlashCommand } from '@/components/chat/slash-command-palette';

const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'research', description: 'Research a topic with live data', icon: 'Search', color: 'var(--accent-blue)' },
  { name: 'edit', description: 'Edit a blueprint section', icon: 'Pencil', color: '#f59e0b' },
  { name: 'compare', description: 'Compare competitors or strategies', icon: 'GitCompare', color: '#a855f7' },
  { name: 'analyze', description: 'Deep-dive analysis of metrics', icon: 'BarChart3', color: '#06b6d4' },
  { name: 'visualize', description: 'Generate visual breakdowns', icon: 'Eye', color: '#22c55e' },
];

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
  const [isSlashPaletteOpen, setIsSlashPaletteOpen] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Slash command filtering
  const slashFilter = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
  const filteredCommands = useMemo(
    () => isSlashPaletteOpen
      ? SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(slashFilter))
      : [],
    [isSlashPaletteOpen, slashFilter]
  );

  // Derived safe index — clamped to filtered list bounds without useEffect
  const safeSelectedIndex = filteredCommands.length === 0
    ? 0
    : Math.min(selectedCommandIndex, filteredCommands.length - 1);

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
    setIsSlashPaletteOpen(false);
    setSelectedCommandIndex(0);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, disabled, onSubmit]);

  const handleCommandSelect = useCallback((command: SlashCommand) => {
    setInput(`/${command.name} `);
    setIsSlashPaletteOpen(false);
    setSelectedCommandIndex(0);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Slash command palette navigation
      if (isSlashPaletteOpen && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCommandIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : prev
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCommandIndex((prev) => (prev > 0 ? prev - 1 : 0));
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleCommandSelect(filteredCommands[safeSelectedIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsSlashPaletteOpen(false);
          setInput('');
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isSlashPaletteOpen, filteredCommands, safeSelectedIndex, handleCommandSelect]
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
          position: 'relative',
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
        {/* Slash command palette — above input */}
        <SlashCommandPalette
          commands={filteredCommands}
          isOpen={isSlashPaletteOpen}
          selectedIndex={safeSelectedIndex}
          onSelect={handleCommandSelect}
        />

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            const value = e.target.value;
            setInput(value);
            setIsSlashPaletteOpen(value.startsWith('/'));
          }}
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
