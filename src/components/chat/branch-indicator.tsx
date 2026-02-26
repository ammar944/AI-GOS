'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import type { ConversationBranch } from '@/lib/chat/branching';

// =============================================================================
// Design constants
// =============================================================================

/**
 * Branch dot / accent colors that cycle as branches are created.
 * Intentionally kept as a small, finite palette so the UI stays coherent.
 */
const BRANCH_COLORS = [
  'var(--accent-blue)',
  'var(--accent-purple)',
  'var(--accent-cyan)',
  'var(--accent-amber)',
] as const;

function getBranchColor(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}

// =============================================================================
// BranchIndicator
// =============================================================================

export interface BranchIndicatorProps {
  /** All branches in the conversation state */
  branches: ConversationBranch[];
  /** Currently active branch id — null means main thread */
  activeBranchId: string | null;
  /** The message id this indicator is mounted next to */
  messageId: string;
  /** Called when the user clicks a branch tab to switch */
  onSwitch: (branchId: string | null) => void;
  /** Called when the user clicks "+" to fork from this message */
  onCreate: (fromMessageId: string) => void;
}

/**
 * Compact tab strip that renders at a branch fork point.
 *
 * Only renders if at least one branch has `parentMessageId === messageId`.
 * Shows "Main" + branch labels. Active tab gets an accent underline.
 * A "+" button lets the user create an additional branch from this point.
 *
 * Designed for the 340 px chat panel — max height ~28 px.
 */
export function BranchIndicator({
  branches,
  activeBranchId,
  messageId,
  onSwitch,
  onCreate,
}: BranchIndicatorProps) {
  // Only the branches that fork from this exact message
  const localBranches = branches.filter((b) => b.parentMessageId === messageId);

  // Don't render if there are no branches at this fork point
  if (localBranches.length === 0) return null;

  // Is the main thread active for a message that has branches? The main thread
  // is "active" here if activeBranchId is null AND this message exists on main.
  const mainIsActive = activeBranchId === null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.snappy}
      className="flex items-center gap-1 px-4 pb-1"
      role="tablist"
      aria-label="Conversation branches"
    >
      {/* Thin left accent line */}
      <div
        className="w-px self-stretch flex-shrink-0 rounded-full"
        style={{ background: 'var(--border-subtle)', marginRight: 4 }}
        aria-hidden="true"
      />

      {/* Main thread tab */}
      <BranchTab
        label="Main"
        color="var(--text-tertiary)"
        isActive={mainIsActive}
        onClick={() => onSwitch(null)}
        scopeId={messageId}
      />

      {/* Branch tabs */}
      {localBranches.map((branch, idx) => (
        <BranchTab
          key={branch.id}
          label={branch.label}
          color={getBranchColor(idx)}
          isActive={activeBranchId === branch.id}
          onClick={() => onSwitch(branch.id)}
          scopeId={messageId}
        />
      ))}

      {/* Create new branch button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        transition={springs.snappy}
        onClick={() => onCreate(messageId)}
        className={cn(
          'flex-shrink-0 flex items-center justify-center',
          'w-5 h-5 rounded transition-colors'
        )}
        style={{
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)',
        }}
        title="Fork new branch from here"
        aria-label="Create new branch from this message"
      >
        <Plus className="w-2.5 h-2.5" />
      </motion.button>
    </motion.div>
  );
}

// =============================================================================
// BranchTab (internal)
// =============================================================================

interface BranchTabProps {
  label: string;
  color: string;
  isActive: boolean;
  onClick: () => void;
  /** Scope for layoutId to prevent cross-indicator animation */
  scopeId: string;
}

function BranchTab({ label, color, isActive, onClick, scopeId }: BranchTabProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={springs.snappy}
      className={cn(
        'relative flex items-center gap-1 flex-shrink-0',
        'transition-colors rounded px-2 h-[22px]'
      )}
      style={{
        fontSize: 11,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? 'var(--text-secondary)' : 'var(--text-tertiary)',
        background: isActive ? 'var(--bg-hover)' : 'transparent',
        border: isActive
          ? '1px solid var(--border-subtle)'
          : '1px solid transparent',
        whiteSpace: 'nowrap',
      }}
      role="tab"
      aria-selected={isActive}
    >
      {/* Branch color dot */}
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: color }}
        aria-hidden="true"
      />

      {label}

      {/* Active indicator underline */}
      <AnimatePresence>
        {isActive && (
          <motion.span
            key="underline"
            layoutId={`branch-tab-underline-${scopeId}`}
            className="absolute bottom-0 left-1 right-1 h-px rounded-full"
            style={{ background: color }}
            initial={{ opacity: 0, scaleX: 0.5 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0.5 }}
            transition={springs.snappy}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// =============================================================================
// BranchHereButton
// =============================================================================

export interface BranchHereButtonProps {
  /** The assistant message id to fork from */
  messageId: string;
  /** Called when the user clicks the button */
  onBranch: (messageId: string) => void;
}

/**
 * Small ghost "Branch" button that floats in the top-right corner of an
 * assistant message on hover.
 *
 * The parent container MUST have `position: relative` and the `.branch-hover-target`
 * class for the CSS-based show-on-hover to work. The parent also adds the
 * `group` class so Tailwind group-hover utilities apply.
 *
 * Because Tailwind v4 has known issues with `group-hover:opacity-100` inside
 * component trees, we use inline style + className toggling driven by the
 * CSS class `.show-on-hover` defined in globals.css (outside any @layer).
 *
 * Usage:
 * ```tsx
 * <div className="relative group branch-hover-target">
 *   <MessageBubble ... />
 *   <BranchHereButton messageId={message.id} onBranch={handleBranch} />
 * </div>
 * ```
 */
export function BranchHereButton({ messageId, onBranch }: BranchHereButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.15 }}
      onClick={() => onBranch(messageId)}
      // show-on-card-hover is defined in globals.css outside @layer to avoid
      // Tailwind v4 specificity issues (see project memory)
      className="branch-here-btn show-on-card-hover absolute top-1.5 right-1.5 flex items-center gap-1 rounded-md px-1.5 py-1"
      style={{
        fontSize: 10,
        fontWeight: 500,
        background: 'var(--bg-active)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-tertiary)',
        cursor: 'pointer',
        zIndex: 10,
        letterSpacing: '0.01em',
      }}
      title={`Fork conversation from this message`}
      aria-label="Branch conversation from this message"
    >
      <GitBranch
        style={{ width: 11, height: 11, flexShrink: 0 }}
        aria-hidden="true"
      />
      <span>Branch</span>
    </motion.button>
  );
}

// =============================================================================
// BranchPill — compact inline badge showing active branch name in the header
// =============================================================================

export interface BranchPillProps {
  /** The currently active branch, or null if on main thread */
  activeBranch: ConversationBranch | null;
  /** Total number of branches */
  branchCount: number;
  /** Called to dismiss (go back to main thread) */
  onDismiss: () => void;
  className?: string;
}

/**
 * A small pill shown in the chat header (or inline) when viewing a branch.
 * Gives users persistent context about which branch they are on, with an
 * X to return to the main thread.
 */
export function BranchPill({
  activeBranch,
  branchCount,
  onDismiss,
  className,
}: BranchPillProps) {
  // Only show when on a named branch
  if (!activeBranch) return null;

  // Figure out the color index from the branchCount (rough heuristic)
  const colorIdx = branchCount > 0 ? (branchCount - 1) % BRANCH_COLORS.length : 0;
  const color = getBranchColor(colorIdx);

  return (
    <AnimatePresence>
      <motion.div
        key={activeBranch.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={springs.snappy}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 flex-shrink-0',
          className
        )}
        style={{
          fontSize: 11,
          fontWeight: 500,
          background: 'var(--bg-hover)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: color }}
          aria-hidden="true"
        />
        <span>{activeBranch.label}</span>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-full transition-colors hover:brightness-150"
          style={{ color: 'var(--text-tertiary)', lineHeight: 1 }}
          aria-label="Return to main thread"
          title="Return to main thread"
        >
          <X style={{ width: 10, height: 10 }} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
