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
  variant?: 'default' | 'studio' | 'paper' | 'premium';
  className?: string;
}

export function JourneyChatInput({
  onSubmit,
  isLoading,
  disabled = false,
  placeholder = 'Ask AIGOS to refine the strategy...',
  variant = 'default',
  className,
}: JourneyChatInputProps): React.JSX.Element {
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
    <div
      data-testid="journey-chat-input"
      data-variant={variant}
      className={cn(
        'w-full max-w-2xl pointer-events-auto',
        variant === 'studio' && 'journey-studio-chat-input max-w-[56rem]',
        variant === 'premium' && 'journey-premium-chat-input max-w-[58rem]',
        className,
      )}
    >
      <div className="relative group">
        {/* Gradient glow border */}
        <div
          className={cn(
            'absolute -inset-0.5 bg-gradient-to-r from-brand-accent to-brand-success rounded-[12px] blur transition duration-500',
            variant === 'studio'
              ? 'opacity-35'
              : variant === 'premium'
                ? isFocused
                  ? 'opacity-30'
                  : 'opacity-18'
              : variant === 'paper'
                ? isFocused
                  ? 'opacity-15'
                  : 'opacity-0'
                : isFocused
                  ? 'opacity-40'
                  : 'opacity-20',
          )}
        />
        {/* Input container */}
        <div
          className={cn(
            'relative border shadow-2xl',
            variant === 'studio'
              ? [
                  'overflow-hidden rounded-[20px] border-white/[0.12]',
                  'bg-[linear-gradient(180deg,rgba(17,16,13,0.96),rgba(9,9,8,0.94))]',
                  'shadow-[0_24px_60px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.04)]',
                ]
              : variant === 'premium'
                ? [
                    'overflow-hidden rounded-[24px] border-white/[0.1]',
                    'bg-[linear-gradient(180deg,rgba(14,14,12,0.96),rgba(7,7,6,0.98))]',
                    'shadow-[0_26px_72px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.04)]',
                  ]
              : variant === 'paper'
                ? [
                    'overflow-hidden rounded-[26px] border-black/8 bg-[#fdfbf6]',
                    'shadow-[0_22px_70px_rgba(17,16,13,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]',
                  ]
              : 'flex items-center rounded-[12px] border-white/10 bg-[#0a0a0a] px-4 py-3',
          )}
        >
          {variant === 'studio' || variant === 'paper' || variant === 'premium' ? (
            <div
              className={cn(
                'px-4 py-3',
                variant === 'paper'
                  ? 'border-b border-black/6'
                  : 'border-b border-white/[0.08]',
              )}
            >
              {variant === 'premium' ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-white/42">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-white/58">
                      Mode
                    </span>
                    <span className="rounded-full border border-brand-accent/20 bg-brand-accent/10 px-2.5 py-1 text-brand-accent">
                      Directive
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-white/58">
                      Scope
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-white/76">
                      Market Overview
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {['9 sources', '1 approval', 'Research live'].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-white/52"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {(variant === 'paper'
                    ? ['Intake', 'Refine', 'Approve', 'Research']
                    : ['Ask', 'Refine', 'Approve', 'Research']
                  ).map((chip) => (
                    <span
                      key={chip}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em]',
                        variant === 'paper'
                          ? 'border border-black/8 bg-white text-[#7b756d]'
                          : 'border border-white/[0.08] bg-white/[0.03] text-white/48',
                      )}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div
              className={cn(
                'relative flex items-center',
                (variant === 'studio' || variant === 'paper' || variant === 'premium')
                  ? 'px-4 py-4 sm:px-5'
                  : '',
              )}
            >
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
              className={cn(
                'flex-1 resize-none bg-transparent outline-none scrollbar-hide leading-relaxed',
                variant === 'studio'
                  ? 'text-[15px] text-white placeholder-white/24'
                  : variant === 'premium'
                    ? 'text-[15px] text-white placeholder-white/26'
                  : variant === 'paper'
                    ? 'text-[15px] text-[#1f1d18] placeholder-[#a7a095]'
                  : 'text-sm text-white placeholder-white/20',
              )}
              style={{ minHeight: '20px', maxHeight: '120px' }}
            />

            {/* Send button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                'ml-2 rounded-lg transition-all',
                variant === 'studio' || variant === 'premium' ? 'p-2.5' : 'p-2',
                canSend
                  ? variant === 'studio'
                    ? 'bg-brand-accent/12 text-brand-accent hover:bg-brand-accent/20'
                    : variant === 'premium'
                      ? 'bg-brand-accent/15 text-brand-accent hover:bg-brand-accent/24'
                    : variant === 'paper'
                      ? 'bg-[#1f1d18] text-white hover:opacity-92'
                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                  : variant === 'paper'
                    ? 'cursor-default bg-[#ece7dc] text-[#b4aea3]'
                    : variant === 'premium'
                      ? 'cursor-default bg-white/[0.04] text-white/24'
                    : 'cursor-default text-white/20',
              )}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
