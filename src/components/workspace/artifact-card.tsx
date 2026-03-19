'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
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

/** Static (non-editing) context — cards always render in read-only mode.
 *  AI-driven edits go through updateCard() from workspace context. */
const STATIC_EDITING_CONTEXT = {
  isEditing: false,
  draftContent: {},
  updateDraft: () => {},
};

export function ArtifactCard({ card, children, index = 0 }: ArtifactCardProps) {
  const { restoreCardVersion } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-wider">
          {card.label}
        </span>

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

      <CardEditingContext value={STATIC_EDITING_CONTEXT}>
        {children}
      </CardEditingContext>
    </motion.div>
  );
}
