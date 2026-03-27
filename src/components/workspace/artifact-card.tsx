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

// Card types that support inline contentEditable editing
const EDITABLE_CARD_TYPES = new Set(['prose-card', 'bullet-list', 'check-list']);

export function ArtifactCard({ card, children, index = 0 }: ArtifactCardProps) {
  const { restoreCardVersion, updateCard } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftContent, setDraftContent] = useState<Record<string, unknown>>({});
  const [showSaved, setShowSaved] = useState(false);

  const canEdit = EDITABLE_CARD_TYPES.has(card.cardType);

  const handleSave = useCallback(() => {
    if (Object.keys(draftContent).length > 0) {
      updateCard(card.id, { ...card.content, ...draftContent }, 'user');
    }
    setIsEditing(false);
    setDraftContent({});
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  }, [card.id, card.content, draftContent, updateCard]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setDraftContent({});
  }, []);

  const updateDraft = useCallback((patch: Record<string, unknown>) => {
    setDraftContent((prev) => ({ ...prev, ...patch }));
  }, []);

  const editingContext = useMemo(() => ({
    isEditing,
    draftContent,
    updateDraft,
  }), [isEditing, draftContent, updateDraft]);

  const handleRestore = useCallback(
    (versionIndex: number) => {
      restoreCardVersion(card.id, versionIndex);
    },
    [card.id, restoreCardVersion],
  );

  const hasVersions = card.versions.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'group/card rounded-[var(--radius-lg)] border p-5',
        'transition-colors duration-200',
        'border-[var(--border-subtle)] bg-[var(--bg-card)]',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-wider">
            {card.label}
          </span>
          {showSaved && (
            <span className="text-[10px] font-mono text-[var(--accent-green,#22c55e)] animate-pulse">
              Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Inline edit controls */}
          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className={cn(
                'rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-all cursor-pointer',
                menuOpen ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100',
              )}
              aria-label="Edit card"
            >
              <Pencil className="size-3.5" />
            </button>
          )}
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-red,#ef4444)] hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Cancel edit"
              >
                <X className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-green,#22c55e)] hover:bg-white/5 transition-colors cursor-pointer"
                aria-label="Save edit"
              >
                <Check className="size-3.5" />
              </button>
            </>
          )}

          {/* Version history — visible on hover only */}
          {hasVersions && (
          <div
            className={cn(
              'transition-opacity duration-150',
              menuOpen ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100',
            )}
          >
            <DropdownMenu onOpenChange={setMenuOpen}>
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
