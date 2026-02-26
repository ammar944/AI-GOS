'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Square, Paperclip, ChevronDown } from 'lucide-react';

import { MagneticButton } from '@/components/ui/magnetic-button';
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
  { name: 'research', description: 'Research a topic with live data', icon: 'Search', color: 'var(--accent-blue)' },
  { name: 'edit', description: 'Edit a blueprint section', icon: 'Pencil', color: '#f59e0b' },
  { name: 'compare', description: 'Compare competitors or strategies', icon: 'GitCompare', color: '#a855f7' },
  { name: 'analyze', description: 'Deep-dive analysis of metrics', icon: 'BarChart3', color: '#06b6d4' },
  { name: 'visualize', description: 'Generate visual breakdowns', icon: 'Eye', color: '#22c55e' },
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

  // Auto-resize textarea: min 20px (1 row), max 100px (~5 rows)
  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
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
          el.style.height = '20px';
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
    ? 'rgba(249, 115, 22, 0.5)'
    : isFocused
      ? 'var(--border-focus, #4d6fff)'
      : 'var(--border-default)';

  const boxShadow =
    isFocused && !isVoiceRecording
      ? '0 0 24px rgba(77,111,255,0.12)'
      : 'none';

  const canSend = input.trim().length > 0 && !isInputDisabled;
  const showStop = isLoading && !!onStop;

  return (
    <div className={cn('relative', className)}>
      {/* Gradient fade above the input */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          height: '48px',
          background:
            'linear-gradient(180deg, transparent, var(--bg-chat) 30%)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Slash command palette — rendered above the form */}
      <div style={{ position: 'relative', zIndex: 60 }}>
        <SlashCommandPalette
          commands={filteredCommands}
          isOpen={isSlashPaletteOpen}
          selectedIndex={selectedCommandIndex}
          onSelect={handleCommandSelect}
        />
      </div>

      {/* Input container — Figma AI style: textarea + toolbar in one rounded box */}
      <form
        onSubmit={handleSubmit}
        style={{
          borderRadius: '12px',
          background: 'var(--bg-input)',
          border: `1px solid ${borderColor}`,
          boxShadow,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          overflow: 'hidden',
          position: 'relative',
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
          className="w-full px-3 pt-2.5 pb-1 text-[13px] outline-none resize-none overflow-y-auto leading-[1.5] bg-transparent"
          style={{
            color: 'var(--text-primary)',
            minHeight: '20px',
            maxHeight: '100px',
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
              Groq 70B
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
              <button
                type="button"
                onClick={onStop}
                className="w-7 h-7 rounded-[7px] flex items-center justify-center"
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-default)',
                  cursor: 'pointer',
                }}
                title="Stop generating"
              >
                <Square size={10} style={{ color: 'var(--text-secondary)' }} />
              </button>
            )}

            {/* Send button */}
            <MagneticButton
              type="submit"
              disabled={!canSend && !showStop}
              className="w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  canSend ? 'var(--accent-blue)' : 'transparent',
                color:
                  canSend ? '#ffffff' : 'var(--text-quaternary)',
                opacity: !canSend ? 0.4 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <Send size={14} />
            </MagneticButton>
          </div>
        </div>
      </form>
    </div>
  );
}
