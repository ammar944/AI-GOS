'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EditHistoryEntry, EditHistoryState, PendingEdit } from '@/lib/chat/types';
import { SECTION_LABELS } from '@/lib/ai/chat-tools/utils';

/**
 * Hook for managing blueprint edit undo/redo history.
 * Persists state to sessionStorage keyed by blueprintId.
 */
export function useEditHistory(blueprintId?: string, maxDepth = 50) {
  const [editHistory, setEditHistory] = useState<EditHistoryState>({
    history: [],
    currentIndex: -1,
    maxDepth,
  });

  const historyStorageKey = blueprintId ? `blueprint-edit-history-${blueprintId}` : null;

  // Load from sessionStorage on mount
  useEffect(() => {
    if (!historyStorageKey) return;

    try {
      const stored = sessionStorage.getItem(historyStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as EditHistoryState;
        parsed.history = parsed.history.map(entry => ({
          ...entry,
          appliedAt: new Date(entry.appliedAt),
        }));
        setEditHistory(parsed);
      }
    } catch (error) {
      console.error('Failed to load edit history:', error);
    }
  }, [historyStorageKey]);

  // Persist to sessionStorage on change
  useEffect(() => {
    if (!historyStorageKey) return;

    try {
      sessionStorage.setItem(historyStorageKey, JSON.stringify(editHistory));
    } catch (error) {
      console.error('Failed to save edit history:', error);
    }
  }, [editHistory, historyStorageKey]);

  const generateEditLabel = useCallback((edits: PendingEdit[]): string => {
    if (edits.length === 1) {
      const edit = edits[0];
      const sectionLabel = SECTION_LABELS[edit.section] || edit.section;
      return `${sectionLabel}: ${edit.fieldPath}`;
    }
    const uniqueSections = [...new Set(edits.map(e => SECTION_LABELS[e.section] || e.section))];
    if (uniqueSections.length === 1) {
      return `${edits.length} edits in ${uniqueSections[0]}`;
    }
    return `${edits.length} edits across ${uniqueSections.length} sections`;
  }, []);

  const recordEdit = useCallback(
    (
      blueprintBefore: Record<string, unknown>,
      blueprintAfter: Record<string, unknown>,
      edits: PendingEdit[]
    ) => {
      const entry: EditHistoryEntry = {
        id: crypto.randomUUID(),
        appliedAt: new Date(),
        edits,
        blueprintBefore,
        blueprintAfter,
        label: generateEditLabel(edits),
      };

      setEditHistory(prev => {
        const newHistory = prev.history.slice(0, prev.currentIndex + 1);
        newHistory.push(entry);

        if (newHistory.length > prev.maxDepth) {
          newHistory.shift();
        }

        return {
          ...prev,
          history: newHistory,
          currentIndex: newHistory.length - 1,
        };
      });
    },
    [generateEditLabel]
  );

  const undo = useCallback((): Record<string, unknown> | null => {
    if (editHistory.currentIndex < 0) return null;

    const entry = editHistory.history[editHistory.currentIndex];

    setEditHistory(prev => ({
      ...prev,
      currentIndex: prev.currentIndex - 1,
    }));

    return entry.blueprintBefore;
  }, [editHistory]);

  const redo = useCallback((): Record<string, unknown> | null => {
    if (editHistory.currentIndex >= editHistory.history.length - 1) return null;

    const nextEntry = editHistory.history[editHistory.currentIndex + 1];

    setEditHistory(prev => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
    }));

    return nextEntry.blueprintAfter;
  }, [editHistory]);

  const canUndo = editHistory.currentIndex >= 0;
  const canRedo = editHistory.currentIndex < editHistory.history.length - 1;
  const undoDepth = editHistory.currentIndex + 1;

  const currentLabel =
    editHistory.currentIndex >= 0
      ? editHistory.history[editHistory.currentIndex].label
      : null;

  return {
    canUndo,
    canRedo,
    undoDepth,
    currentLabel,
    recordEdit,
    undo,
    redo,
  };
}
