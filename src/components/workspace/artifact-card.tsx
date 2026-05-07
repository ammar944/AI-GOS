'use client';

import { useCallback, useMemo, useState } from 'react';
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
  variant?: 'card' | 'report-block';
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

export function ArtifactCard({ card, children, variant = 'card' }: ArtifactCardProps) {
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

  const statusDotClass =
    card.status === 'approved'
      ? 'bg-[var(--accent-green)]'
      : card.status === 'edited'
        ? 'bg-[var(--accent-amber)]'
        : 'bg-[var(--text-tertiary)]';

  return (
    <div
      className={cn(
        'group/card transition-colors duration-150',
        variant === 'report-block'
          ? 'border-b border-white/[0.055] bg-transparent py-5 last:border-b-0'
          : 'rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 hover:border-[var(--border-default)]',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span
            className={cn(
              'shrink-0 rounded-full',
              variant === 'report-block' ? 'mt-[7px] h-1.5 w-1.5' : 'mt-[9px] h-2 w-2',
              statusDotClass,
            )}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-0.5 min-w-0">
            <h3
              className={cn(
                'truncate leading-[1.2] tracking-[-0.01em] text-[var(--text-primary)]',
                variant === 'report-block'
                  ? 'text-[13px] font-medium not-italic text-white/78'
                  : 'text-[22px] italic font-normal tracking-tight',
              )}
              style={variant === 'report-block' ? undefined : { fontFamily: 'var(--font-instrument-sans)' }}
            >
              {card.label}
            </h3>
            {card.description && (
              <span className="text-[12px] text-[var(--text-tertiary)] leading-snug">
                {card.description}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showSaved && (
            <span className="text-[10px] font-mono text-[var(--accent-green)] animate-pulse uppercase tracking-[0.1em]">
              Saved
            </span>
          )}
          {!showSaved && card.status === 'approved' && (
            <span className="text-[10px] font-mono uppercase tracking-[0.12em] px-2 py-0.5 rounded text-[var(--accent-green)] bg-[var(--accent-green)]/10">
              Approved
            </span>
          )}
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
                      className="text-[10px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-[3px] border border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[var(--text-secondary)]"
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
    </div>
  );
}
