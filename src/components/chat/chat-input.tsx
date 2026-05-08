'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Square, Paperclip, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { VoiceInputButton } from './voice-input-button';
import { SlashCommandPalette } from './slash-command-palette';
import type { SlashCommand } from './slash-command-palette';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** External ref to the textarea — used by keyboard shortcuts hook */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'research', description: 'Research a topic with live data', icon: 'Search', color: 'var(--accent-amber)' },
  { name: 'edit', description: 'Edit a blueprint section', icon: 'Pencil', color: 'var(--accent-amber)' },
  { name: 'compare', description: 'Compare competitors or strategies', icon: 'GitCompare', color: 'var(--accent-purple)' },
  { name: 'analyze', description: 'Deep-dive analysis of metrics', icon: 'BarChart3', color: 'var(--text-secondary)' },
  { name: 'visualize', description: 'Generate visual breakdowns', icon: 'Eye', color: 'var(--accent-green)' },
];

export function ChatInput({
  onSubmit,
  isLoading,
  onStop,
  disabled = false,
  placeholder = 'Ask about your blueprint...',
  className,
  textareaRef,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isSlashPaletteOpen, setIsSlashPaletteOpen] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  // Use external ref when provided, otherwise use internal
  const inputRef = textareaRef || internalRef;

  // Derive filtered commands from the current input
  const slashFilter = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
  const filteredCommands = useMemo(
    () => isSlashPaletteOpen
      ? SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(slashFilter))
      : [],
    [isSlashPaletteOpen, slashFilter]
  );

  // Auto-resize textarea: min 36px (2 rows), max 160px (~7 rows)
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  // Keep selected index in bounds when filtered list changes
  useEffect(() => {
    setSelectedCommandIndex((prev) =>
      filteredCommands.length === 0 ? 0 : Math.min(prev, filteredCommands.length - 1)
    );
  }, [filteredCommands.length]);

  // Voice transcript — insert at cursor position, reading DOM value to avoid
  // recreating the callback on every keystroke
  const handleTranscript = useCallback((text: string) => {
    const el = inputRef.current;
    if (!el) {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      return;
    }
    const current = el.value;
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const spaceBefore =
      before && !before.endsWith(' ') && !before.endsWith('\n') ? ' ' : '';
    const newValue = before + spaceBefore + text + after;
    setInput(newValue);
    requestAnimationFrame(() => {
      const newCursorPos = start + spaceBefore.length + text.length;
      el.setSelectionRange(newCursorPos, newCursorPos);
      el.focus();
    });
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);

      if (value.startsWith('/')) {
        setIsSlashPaletteOpen(true);
      } else {
        setIsSlashPaletteOpen(false);
      }
    },
    []
  );

  const handleCommandSelect = useCallback((command: SlashCommand) => {
    setInput(`/${command.name} `);
    setIsSlashPaletteOpen(false);
    setSelectedCommandIndex(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || (isLoading && !onStop)) return;

      onSubmit(trimmed);
      setInput('');
      setIsSlashPaletteOpen(false);
      setSelectedCommandIndex(0);

      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.style.height = 'auto';
          el.style.height = '36px';
        }
      });
    },
    [input, isLoading, onStop, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Slash palette navigation
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
          handleCommandSelect(filteredCommands[selectedCommandIndex]);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setIsSlashPaletteOpen(false);
          return;
        }
      }

      // Standard keyboard behaviour
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (isVoiceRecording) {
          stopRecordingRef.current?.();
        } else {
          e.currentTarget.blur();
        }
      }
    },
    [
      isSlashPaletteOpen,
      filteredCommands,
      selectedCommandIndex,
      handleCommandSelect,
      handleSubmit,
      isVoiceRecording,
    ]
  );

  const isInputDisabled = (isLoading && !onStop) || disabled;

  // Border colour priority: recording > focused > default
  const borderColor = isVoiceRecording
    ? 'var(--accent-amber)'
    : isFocused
      ? 'var(--border-focus, var(--accent-blue))'
      : 'var(--border-default)';

  const canSend = input.trim().length > 0 && !isInputDisabled;
  const showStop = isLoading && !!onStop;

  return (
    <div className={cn('relative', className)}>
      {/* Slash command palette — rendered above the form */}
      <div className="relative z-[60]">
        <SlashCommandPalette
          commands={filteredCommands}
          isOpen={isSlashPaletteOpen}
          selectedIndex={selectedCommandIndex}
          onSelect={handleCommandSelect}
        />
      </div>

      {/* Input container — textarea + toolbar in one rounded box */}
      <form
        onSubmit={handleSubmit}
        className="relative overflow-hidden rounded-md transition-colors"
        style={{
          background: 'var(--bg-input)',
          border: `1px solid ${borderColor}`,
        }}
      >
        {/* Auto-expanding textarea */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            isVoiceRecording
              ? 'Listening...'
              : placeholder
          }
          disabled={isInputDisabled && !isVoiceRecording}
          rows={1}
          className="w-full px-3.5 pt-3 pb-1.5 text-sm outline-none resize-none overflow-y-auto leading-[1.55] bg-transparent scrollbar-hide text-foreground"
          style={{
            minHeight: '36px',
            maxHeight: '160px',
          }}
        />

        {/* Toolbar row — inside the container */}
        <div className="flex items-center justify-between px-2.5 pb-2 pt-0.5">
          {/* Left toolbar: Attach + Model selector + Voice */}
          <div className="flex items-center gap-1">
            {/* Attach file (coming soon — disabled placeholder) */}
            <button
              type="button"
              disabled
              title="Attach file (coming soon)"
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{
                background: 'transparent',
                color: 'var(--text-tertiary)',
                opacity: 0.5,
                cursor: 'not-allowed',
                border: 'none',
              }}
            >
              <Paperclip size={15} />
            </button>

            {/* Model selector badge */}
            <button
              type="button"
              disabled
              title="Model selection (coming soon)"
              className="flex items-center gap-1 px-2 py-1 rounded-md"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'default',
                fontFamily: 'var(--font-mono)',
                fontSize: '10.5px',
                color: 'var(--text-tertiary)',
              }}
            >
              Advanced
              <ChevronDown size={10} style={{ opacity: 0.6 }} />
            </button>

            {/* Voice input */}
            <VoiceInputButton
              onTranscript={handleTranscript}
              onRecordingChange={setIsVoiceRecording}
              stopRecordingRef={stopRecordingRef}
              disabled={isLoading}
              compact
            />
          </div>

          {/* Right toolbar: Stop + Send */}
          <div className="flex items-center gap-1.5">
            {/* Stop button (only when streaming) */}
            {showStop && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onStop}
                className="w-7 h-7 rounded-md p-0"
                title="Stop generating"
              >
                <Square size={10} className="text-muted-foreground" />
              </Button>
            )}

            {/* Send button */}
            <Button
              type="submit"
              size="icon"
              disabled={!canSend && !showStop}
              className="w-7 h-7 rounded-md p-0 flex-shrink-0"
              style={{
                background: canSend ? 'var(--accent-green)' : 'transparent',
                color: canSend ? 'var(--text-on-accent, white)' : 'var(--text-quaternary)',
                opacity: !canSend ? 0.4 : 1,
              }}
            >
              <Send size={14} />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
