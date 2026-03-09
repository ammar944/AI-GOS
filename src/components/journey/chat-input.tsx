'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlashCommandPalette, type SlashCommand } from '@/components/chat/slash-command-palette';

const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'research', description: 'Research a topic with live data', icon: 'Search', color: 'var(--accent-blue)' },
  { name: 'edit', description: 'Edit a blueprint section', icon: 'Pencil', color: 'var(--accent-amber)' },
  { name: 'compare', description: 'Compare competitors or strategies', icon: 'GitCompare', color: 'var(--accent-purple)' },
  { name: 'analyze', description: 'Deep-dive analysis of metrics', icon: 'BarChart3', color: 'var(--accent-cyan)' },
  { name: 'visualize', description: 'Generate visual breakdowns', icon: 'Eye', color: 'var(--accent-green)' },
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
  placeholder = 'Ask AI-GOS to refine the strategy...',
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

  const safeSelectedIndex = filteredCommands.length === 0
    ? 0
    : Math.min(selectedCommandIndex, filteredCommands.length - 1);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => { autoResize(); }, [input, autoResize]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSubmit(trimmed);
    setInput('');
    setIsSlashPaletteOpen(false);
    setSelectedCommandIndex(0);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, isLoading, disabled, onSubmit]);

  const handleCommandSelect = useCallback((command: SlashCommand) => {
    setInput(`/${command.name} `);
    setIsSlashPaletteOpen(false);
    setSelectedCommandIndex(0);
    requestAnimationFrame(() => { textareaRef.current?.focus(); });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (isSlashPaletteOpen && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCommandIndex((prev) => prev < filteredCommands.length - 1 ? prev + 1 : prev);
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
    <div className={cn('w-full max-w-2xl pointer-events-auto', className)}>
        <div className="relative group">
          {/* Gradient glow border */}
          <div
            className={cn(
              'absolute -inset-0.5 bg-gradient-to-r from-brand-accent to-brand-success rounded-[12px] blur transition duration-500',
              isFocused ? 'opacity-40' : 'opacity-20',
            )}
          />
          {/* Input container */}
          <div className="relative flex items-center bg-[#0a0a0a] border border-white/10 rounded-[12px] px-4 py-3 shadow-2xl">
            {/* Slash command palette */}
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
              className="flex-1 bg-transparent outline-none resize-none scrollbar-hide text-sm text-white placeholder-white/20 leading-relaxed"
              style={{ minHeight: '20px', maxHeight: '120px' }}
            />

            {/* Send button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                'ml-2 p-2 rounded-lg transition-all',
                canSend
                  ? 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white'
                  : 'text-white/20 cursor-default',
              )}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
  );
}

