'use client';

import { useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Platform detection helper
// ---------------------------------------------------------------------------

/**
 * Returns true if the user is on macOS (uses ⌘ / metaKey), false for Windows/Linux (uses Ctrl).
 * Safe to call during SSR — defaults to false (Ctrl) on server.
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  // userAgent is more reliable than platform (which is deprecated)
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseChatShortcutsOptions {
  /** Reference to the chat input textarea */
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Whether the chat is currently streaming */
  isStreaming: boolean;
  /** Whether there is a pending approval (editBlueprint or generateSection) */
  hasPendingApproval: boolean;
  /** Callback to stop streaming */
  onStop?: () => void;
  /** Callback to undo the last edit */
  onUndo?: () => void;
  /** Callback to redo */
  onRedo?: () => void;
  /** Callback when Y is pressed during pending approval */
  onApprove?: () => void;
  /** Callback when N is pressed during pending approval */
  onReject?: () => void;
  /** Whether undo is currently available */
  canUndo?: boolean;
  /** Whether redo is currently available */
  canRedo?: boolean;
}

export interface UseChatShortcutsReturn {
  showHelp: boolean;
  setShowHelp: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Returns true when the browser's active element is a text-entry context
 * (input, textarea, contenteditable). Single-character shortcuts (Y, N, /)
 * must not fire when the user is typing.
 */
function isTypingInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatShortcuts({
  inputRef,
  isStreaming,
  hasPendingApproval,
  onStop,
  onUndo,
  onRedo,
  onApprove,
  onReject,
  canUndo = false,
  canRedo = false,
}: UseChatShortcutsOptions): UseChatShortcutsReturn {
  const [showHelp, setShowHelp] = useState(false);
  // Ref mirrors showHelp so the keydown handler reads current value without
  // needing showHelp in the useEffect dep array (avoids listener churn).
  const showHelpRef = useRef(showHelp);
  showHelpRef.current = showHelp;

  useEffect(() => {
    const mac = isMac();

    const handleKeyDown = (e: KeyboardEvent) => {
      const modKey = mac ? e.metaKey : e.ctrlKey;
      const key = e.key;

      // ------------------------------------------------------------------
      // Cmd/Ctrl + / — toggle shortcuts help dialog
      // ------------------------------------------------------------------
      if (modKey && key === '/') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // ------------------------------------------------------------------
      // Escape — stop streaming OR close help dialog
      // ------------------------------------------------------------------
      if (key === 'Escape') {
        if (showHelpRef.current) {
          e.preventDefault();
          setShowHelp(false);
          return;
        }
        if (isStreaming && onStop) {
          e.preventDefault();
          onStop();
          return;
        }
        // Intentionally falls through to browser default (e.g., blur textarea)
        return;
      }

      // ------------------------------------------------------------------
      // Cmd/Ctrl + K — focus input and open slash command palette
      // ------------------------------------------------------------------
      if (modKey && key === 'k') {
        e.preventDefault();
        const textarea = inputRef.current;
        if (!textarea) return;

        // Use requestAnimationFrame so focus happens after any other handlers
        requestAnimationFrame(() => {
          textarea.focus();
          // Prepend "/" only if the field is empty — avoids duplicating "/"
          // when the user presses Cmd+K repeatedly
          if (!textarea.value) {
            // Dispatch a native input event so React's synthetic onChange fires
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              'value'
            )?.set;
            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(textarea, '/');
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              // Fallback: set value directly (may not trigger React state)
              textarea.value = '/';
            }
            // Position cursor at end
            textarea.setSelectionRange(1, 1);
          }
        });
        return;
      }

      // ------------------------------------------------------------------
      // Cmd/Ctrl + Z — undo last edit
      // ------------------------------------------------------------------
      if (modKey && !e.shiftKey && key === 'z') {
        if (canUndo && onUndo) {
          e.preventDefault();
          onUndo();
        }
        return;
      }

      // ------------------------------------------------------------------
      // Cmd/Ctrl + Shift + Z — redo
      // ------------------------------------------------------------------
      if (modKey && e.shiftKey && key === 'z') {
        if (canRedo && onRedo) {
          e.preventDefault();
          onRedo();
        }
        return;
      }

      // ------------------------------------------------------------------
      // Single-character shortcuts — only fire when NOT typing in an input
      // ------------------------------------------------------------------
      if (isTypingInInput()) return;

      // Y — approve pending edit
      if (key === 'y' || key === 'Y') {
        if (hasPendingApproval && onApprove) {
          e.preventDefault();
          onApprove();
        }
        return;
      }

      // N — reject pending edit
      if (key === 'n' || key === 'N') {
        if (hasPendingApproval && onReject) {
          e.preventDefault();
          onReject();
        }
        return;
      }

      // / — focus the chat input (ChatInput will open the slash palette)
      if (key === '/') {
        const textarea = inputRef.current;
        if (textarea) {
          e.preventDefault();
          requestAnimationFrame(() => {
            textarea.focus();
            // Move cursor to the end so the slash appends naturally
            const len = textarea.value.length;
            textarea.setSelectionRange(len, len);
          });
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    inputRef,
    isStreaming,
    hasPendingApproval,
    onStop,
    onUndo,
    onRedo,
    onApprove,
    onReject,
    canUndo,
    canRedo,
  ]);

  return { showHelp, setShowHelp };
}
