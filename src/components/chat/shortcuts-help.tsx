'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

import { isMac } from '@/hooks/use-chat-shortcuts';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Data: shortcut groups
// ---------------------------------------------------------------------------

interface ShortcutRow {
  label: string;
  /** Each element is one key or symbol displayed in its own <kbd> */
  keys: string[];
}

interface ShortcutGroup {
  heading: string;
  shortcuts: ShortcutRow[];
}

function buildShortcutGroups(mac: boolean): ShortcutGroup[] {
  const mod = mac ? '⌘' : 'Ctrl';

  return [
    {
      heading: 'Navigation',
      shortcuts: [
        { label: 'Quick commands', keys: [mod, 'K'] },
        { label: 'Focus input', keys: ['/'] },
        { label: 'Cancel / close', keys: ['Esc'] },
      ],
    },
    {
      heading: 'Editing',
      shortcuts: [
        { label: 'Undo last edit', keys: [mod, 'Z'] },
        { label: 'Redo', keys: [mod, '⇧', 'Z'] },
        { label: 'Approve edit', keys: ['Y'] },
        { label: 'Reject edit', keys: ['N'] },
      ],
    },
    {
      heading: 'Other',
      shortcuts: [
        { label: 'Keyboard shortcuts', keys: [mod, '/'] },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        padding: '2px 6px',
        borderRadius: '4px',
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
        lineHeight: 1.6,
        display: 'inline-block',
        userSelect: 'none',
      }}
    >
      {children}
    </kbd>
  );
}

function ShortcutGroupSection({ group }: { group: ShortcutGroup }) {
  return (
    <div>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-quaternary)', letterSpacing: '0.08em' }}
      >
        {group.heading}
      </p>

      <div className="flex flex-col gap-1.5">
        {group.shortcuts.map((shortcut) => (
          <div
            key={shortcut.label}
            className="flex items-center justify-between gap-4"
          >
            <span
              className="text-[13px]"
              style={{ color: 'var(--text-secondary)' }}
            >
              {shortcut.label}
            </span>

            <span className="flex items-center gap-1 shrink-0">
              {shortcut.keys.map((key, idx) => (
                <Kbd key={`${key}-${idx}`}>{key}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  const mac = isMac();
  const groups = buildShortcutGroups(mac);

  // Close on Escape is handled by the hook (useChatShortcuts) — but also add
  // a local handler here so the dialog works standalone if wired separately.
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Trap scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const content = (
    <AnimatePresence>
      {isOpen && (
        // Backdrop
        <motion.div
          key="shortcuts-help-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleBackdropClick}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          {/* Modal panel */}
          <motion.div
            key="shortcuts-help-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            style={{
              maxWidth: '420px',
              width: '90%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: '14px',
              padding: '24px',
              position: 'relative',
              boxShadow: 'var(--shadow-elevated)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'var(--accent-blue-subtle)',
                  border: '1px solid rgba(54, 94, 255, 0.2)',
                }}
              >
                <Keyboard
                  size={14}
                  style={{ color: 'var(--accent-blue)' }}
                />
              </div>

              <h2
                className="text-[16px] font-semibold leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                Keyboard Shortcuts
              </h2>

              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close keyboard shortcuts"
                className={cn(
                  'ml-auto w-7 h-7 rounded-md flex items-center justify-center',
                  'transition-colors duration-150'
                )}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'var(--bg-hover)';
                  (e.currentTarget as HTMLButtonElement).style.color =
                    'var(--text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color =
                    'var(--text-tertiary)';
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Divider */}
            <div
              className="mb-5"
              style={{
                height: '1px',
                background: 'var(--border-subtle)',
              }}
            />

            {/* Shortcut groups */}
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <ShortcutGroupSection key={group.heading} group={group} />
              ))}
            </div>

            {/* Footer hint */}
            <div
              className="mt-5 pt-4 text-[11px] text-center"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                color: 'var(--text-quaternary)',
              }}
            >
              Press{' '}
              <Kbd>{mac ? '⌘' : 'Ctrl'}</Kbd>
              {' '}
              <Kbd>/</Kbd>
              {' '}
              to toggle this panel
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render into document.body via a portal so the overlay covers the full
  // viewport regardless of the 340px chat panel's stacking context.
  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
