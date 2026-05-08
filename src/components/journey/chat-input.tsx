'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send, FileUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SlashCommandPalette, type SlashCommand } from '@/components/chat/slash-command-palette';

const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'research', description: 'Research a topic with live data', icon: 'Search', color: 'var(--accent-amber)' },
  { name: 'edit', description: 'Edit a blueprint section', icon: 'Pencil', color: 'var(--accent-amber)' },
  { name: 'compare', description: 'Compare competitors or strategies', icon: 'GitCompare', color: 'var(--accent-purple)' },
  { name: 'analyze', description: 'Deep-dive analysis of metrics', icon: 'BarChart3', color: 'var(--text-secondary)' },
  { name: 'visualize', description: 'Generate visual breakdowns', icon: 'Eye', color: 'var(--accent-green)' },
];

const ACCEPTED_DOC_TYPES = '.pdf,.docx,.doc,.txt,.md';
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

interface JourneyChatInputProps {
  onSubmit: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Called when user selects a file for N&D upload */
  onFileUpload?: (file: File) => void;
  /** True while document extraction is in progress */
  isUploading?: boolean;
}

export function JourneyChatInput({
  onSubmit,
  isLoading,
  disabled = false,
  placeholder = 'Ask AIGOS to refine the strategy...',
  className,
  onFileUpload,
  isUploading = false,
}: JourneyChatInputProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;
    if (file.size > MAX_FILE_SIZE) {
      e.target.value = '';
      return;
    }
    onFileUpload(file);
    e.target.value = '';
  }, [onFileUpload]);

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
      className={cn('w-full max-w-2xl pointer-events-auto', className)}
    >
      <div
        className={cn(
          'relative flex items-center rounded-md border border-border bg-background px-4 py-3',
          isFocused && 'border-ring ring-[3px] ring-ring/50',
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
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none scrollbar-hide leading-relaxed"
          style={{ minHeight: '20px', maxHeight: '120px' }}
        />

        {/* Document upload */}
        {onFileUpload && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_DOC_TYPES}
              onChange={handleFileChange}
              className="hidden"
              aria-label="Upload niche document"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading}
              title={isUploading ? 'Extracting...' : 'Upload niche & demographics document'}
              className="mr-1"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            </Button>
          </>
        )}

        {/* Send button */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="ml-2"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
