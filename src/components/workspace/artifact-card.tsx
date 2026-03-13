'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { CardEditingContext } from '@/lib/workspace/card-editing-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CardState } from '@/lib/workspace/types';

interface ArtifactCardProps {
  card: CardState;
  children: React.ReactNode;
  index?: number;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ArtifactCard({ card, children, index = 0 }: ArtifactCardProps) {
  const { updateCard, approveCard, restoreCardVersion } = useWorkspace();
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState<Record<string, unknown>>(card.content);

  const handleEdit = useCallback(() => {
    setDraftContent({ ...card.content });
    setIsEditing(true);
  }, [card.content]);

  const handleSave = useCallback(() => {
    updateCard(card.id, draftContent, 'user');
    setIsEditing(false);
  }, [card.id, draftContent, updateCard]);

  const handleCancel = useCallback(() => {
    setDraftContent(card.content);
    setIsEditing(false);
  }, [card.content]);

  const handleApprove = useCallback(() => {
    approveCard(card.id);
  }, [card.id, approveCard]);

  const handleRestore = useCallback(
    (versionIndex: number) => {
      restoreCardVersion(card.id, versionIndex);
    },
    [card.id, restoreCardVersion],
  );

  const updateDraft = useCallback((patch: Record<string, unknown>) => {
    setDraftContent((prev) => ({ ...prev, ...patch }));
  }, []);

  const editingContext = useMemo(
    () => ({ isEditing, draftContent, updateDraft }),
    [isEditing, draftContent, updateDraft],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'rounded-[var(--radius-lg)] border p-5',
        'transition-colors duration-200',
        isEditing
          ? 'border-[var(--border-focus)] bg-[var(--bg-card)]'
          : card.status === 'approved'
            ? 'border-[var(--accent-green)]/30 bg-[var(--accent-green)]/[0.02]'
            : 'border-[var(--border-subtle)] bg-[var(--bg-card)]',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-wider">
          {card.label}
        </span>

        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <button
                type="button"
                onClick={handleEdit}
                className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
                aria-label="Edit card"
              >
                <Pencil className="size-3.5" />
              </button>

              {card.versions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
                      aria-label="Version history"
                    >
                      <Clock className="size-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 bg-[var(--bg-card)] border-[var(--border-subtle)]"
                  >
                    <DropdownMenuLabel className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase">
                      Version History
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {card.versions.map((version, i) => (
                      <DropdownMenuItem
                        key={version.timestamp}
                        onClick={() => handleRestore(i)}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[var(--text-secondary)]">
                          {formatRelativeTime(version.timestamp)}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-mono px-1.5 py-0.5 rounded',
                            version.editedBy === 'user'
                              ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                              : 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]',
                          )}
                        >
                          {version.editedBy === 'user' ? 'You' : 'AI'}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {card.status !== 'approved' && (
                <button
                  type="button"
                  onClick={handleApprove}
                  className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-green)] hover:bg-[var(--accent-green)]/5 transition-colors"
                  aria-label="Approve card"
                >
                  <Check className="size-3.5" />
                </button>
              )}
            </>
          )}

          {isEditing && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded px-2 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors"
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded px-2 py-0.5 text-[10px] font-mono bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20 transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      <CardEditingContext value={editingContext}>
        {children}
      </CardEditingContext>
    </motion.div>
  );
}
