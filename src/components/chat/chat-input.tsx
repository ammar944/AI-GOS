'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Paperclip, ChevronDown } from 'lucide-react';

import { VoiceInputButton } from './voice-input-button';
import { SlashCommandPalette } from './slash-command-palette';
import type { SlashCommand } from './slash-command-palette';
import { cn } from '@/lib/utils';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';

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
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isSlashPaletteOpen, setIsSlashPaletteOpen] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  const stopRecordingRef = useRef<(() => void) | null>(null);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = textareaRef || internalRef;

  // Derive filtered commands from the current input
  const slashFilter = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
  const filteredCommands = useMemo(
    () => isSlashPaletteOpen
      ? SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(slashFilter))
      : [],
    [isSlashPaletteOpen, slashFilter]
  );

  // Keep selected index in bounds when filtered list changes
  useEffect(() => {
    setSelectedCommandIndex((prev) =>
      filteredCommands.length === 0 ? 0 : Math.min(prev, filteredCommands.length - 1)
    );
  }, [filteredCommands.length]);

  // Voice transcript — insert at cursor position
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
  }, [inputRef]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);
      setIsSlashPaletteOpen(value.startsWith('/'));
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
  }, [inputRef]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || (isLoading && !onStop)) return;
    onSubmit(trimmed);
    setInput('');
    setIsSlashPaletteOpen(false);
    setSelectedCommandIndex(0);
  }, [input, isLoading, onStop, onSubmit]);

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

      // Escape while recording stops voice
      if (e.key === 'Escape') {
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
      isVoiceRecording,
    ]
  );

  const isInputDisabled = (isLoading && !onStop) || disabled;
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

      <PromptInput
        onSubmit={({ text }) => {
          const trimmed = text.trim();
          if (!trimmed || (isLoading && !onStop)) return;
          onSubmit(trimmed);
          setInput('');
          setIsSlashPaletteOpen(false);
          setSelectedCommandIndex(0);
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isVoiceRecording
                ? 'Listening...'
                : placeholder
            }
            disabled={isInputDisabled && !isVoiceRecording}
            className="min-h-9 max-h-[160px]"
          />
        </PromptInputBody>
        <PromptInputFooter>
          {/* Left toolbar: Attach + Model selector + Voice */}
          <PromptInputTools>
            {/* Attach file (coming soon -- disabled placeholder) */}
            <button
              type="button"
              disabled
              title="Attach file (coming soon)"
              className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md border-none opacity-50"
              style={{
                background: 'transparent',
                color: 'var(--text-tertiary)',
              }}
            >
              <Paperclip size={15} />
            </button>

            {/* Model selector badge */}
            <button
              type="button"
              disabled
              title="Model selection (coming soon)"
              className="flex items-center gap-1 rounded-md border-none px-2 py-1"
              style={{
                background: 'transparent',
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
          </PromptInputTools>

          {/* Right toolbar: Stop + Send */}
          <PromptInputSubmit
            status={
              showStop ? 'streaming' : undefined
            }
            onStop={onStop}
            disabled={!canSend && !showStop}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
