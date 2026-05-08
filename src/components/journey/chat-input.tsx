'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SlashCommandPalette, type SlashCommand } from '@/components/chat/slash-command-palette';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';

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
  const docInputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [isSlashPaletteOpen, setIsSlashPaletteOpen] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

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

  const handleCommandSelect = useCallback((command: SlashCommand) => {
    setInput(`/${command.name} `);
    setIsSlashPaletteOpen(false);
    setSelectedCommandIndex(0);
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

      // Standard Enter → submit (PromptInputTextarea handles this in production
      // via form.requestSubmit(), but we also handle it here for consistency)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed && !isLoading && !disabled) {
          onSubmit(trimmed);
          setInput('');
          setIsSlashPaletteOpen(false);
          setSelectedCommandIndex(0);
        }
      }
    },
    [isSlashPaletteOpen, filteredCommands, safeSelectedIndex, handleCommandSelect, input, isLoading, disabled, onSubmit]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setInput(value);
      setIsSlashPaletteOpen(value.startsWith('/'));
    },
    []
  );

  const canSend = input.trim().length > 0 && !isLoading && !disabled;

  return (
    <div
      data-testid="journey-chat-input"
      className={cn('w-full max-w-2xl pointer-events-auto', className)}
    >
      <div className="relative">
        {/* Slash command palette */}
        <SlashCommandPalette
          commands={filteredCommands}
          isOpen={isSlashPaletteOpen}
          selectedIndex={safeSelectedIndex}
          onSelect={handleCommandSelect}
        />

        <PromptInput
          onSubmit={({ text }) => {
            const trimmed = text.trim();
            if (!trimmed || isLoading || disabled) return;
            onSubmit(trimmed);
            setInput('');
            setIsSlashPaletteOpen(false);
            setSelectedCommandIndex(0);
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || (isLoading && !canSend)}
              className="min-h-10 max-h-[120px]"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {/* Document upload */}
              {onFileUpload && (
                <>
                  <input
                    ref={docInputRef}
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
                    onClick={() => docInputRef.current?.click()}
                    disabled={isUploading || isLoading}
                    title={isUploading ? 'Extracting...' : 'Upload niche & demographics document'}
                    className="cursor-pointer"
                  >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                  </Button>
                </>
              )}
            </PromptInputTools>
            <PromptInputSubmit disabled={!canSend} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
