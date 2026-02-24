"use client";

/**
 * BlueprintEditContext
 *
 * Shared context between AgentChat and PaginatedBlueprintView.
 * When the chat agent proposes or completes an edit, this context
 * propagates the target section + field path so the blueprint view
 * can auto-navigate to the right page and highlight the targeted field.
 *
 * Lifecycle of an edit target:
 *   null → { state: "pending", ... }   (approval-requested in chat)
 *       → { state: "approved", ... }   (user approved, onBlueprintUpdate fired)
 *       → null                          (cleared after flash timeout)
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type EditTargetState = "pending" | "approved" | "rejected";

export interface NavigationRequest {
  /** The blueprint section key to navigate to */
  section: string;
  /** Dot-notation field path to scroll to */
  fieldPath: string;
  /** Monotonically increasing ID so consumers can detect re-requests to the same location */
  requestId: number;
}

export interface EditTarget {
  /** The blueprint section key, e.g. "icpAnalysisValidation" */
  section: string;
  /** Dot-notation field path, e.g. "painSolutionFit.primaryPain" */
  fieldPath: string;
  /** Current lifecycle state */
  state: EditTargetState;
  /** Human-readable explanation from the model */
  explanation?: string;
  /** Stable ID so React can key on it without re-rendering for same edit */
  id: string;
}

interface BlueprintEditContextValue {
  /** The currently active edit target (if any) */
  activeEditTarget: EditTarget | null;
  /** Called when approval-requested fires (pending highlight) */
  notifyEditProposed: (params: {
    section: string;
    fieldPath: string;
    explanation?: string;
    id: string;
  }) => void;
  /** Called when the user approves an edit */
  notifyEditApproved: (id: string) => void;
  /** Called when the user rejects an edit */
  notifyEditRejected: (id: string) => void;
  /** Imperatively clear the target (e.g. page navigation clears stale highlights) */
  clearEditTarget: () => void;
  /** The pending button-triggered navigation request (if any) */
  navigationRequest: NavigationRequest | null;
  /** Fire a navigation request so the blueprint view can jump to a section/field */
  requestNavigation: (section: string, fieldPath: string) => void;
  /** Clear the navigation request once the view has handled it */
  clearNavigationRequest: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

export const BlueprintEditContext = createContext<BlueprintEditContextValue | null>(
  null
);

// ── Provider ───────────────────────────────────────────────────────────────────

const APPROVED_FLASH_MS = 2500;

export function BlueprintEditProvider({ children }: { children: ReactNode }) {
  const [activeEditTarget, setActiveEditTarget] =
    useState<EditTarget | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [navigationRequest, setNavigationRequest] =
    useState<NavigationRequest | null>(null);
  const navRequestIdRef = useRef(0);

  const requestNavigation = useCallback((section: string, fieldPath: string) => {
    navRequestIdRef.current += 1;
    setNavigationRequest({ section, fieldPath, requestId: navRequestIdRef.current });
  }, []);

  const clearNavigationRequest = useCallback(() => {
    setNavigationRequest(null);
  }, []);

  const clearEditTarget = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setActiveEditTarget(null);
  }, []);

  const notifyEditProposed = useCallback(
    ({
      section,
      fieldPath,
      explanation,
      id,
    }: {
      section: string;
      fieldPath: string;
      explanation?: string;
      id: string;
    }) => {
      // Cancel any pending auto-clear from a previous approved edit
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      setActiveEditTarget({ section, fieldPath, state: "pending", explanation, id });
    },
    []
  );

  const notifyEditApproved = useCallback(
    (id: string) => {
      setActiveEditTarget((prev) => {
        if (!prev || prev.id !== id) return prev;
        return { ...prev, state: "approved" };
      });
      // Auto-clear after the "approved" flash completes
      clearTimerRef.current = setTimeout(() => {
        setActiveEditTarget(null);
        clearTimerRef.current = null;
      }, APPROVED_FLASH_MS);
    },
    []
  );

  const notifyEditRejected = useCallback(
    (id: string) => {
      setActiveEditTarget((prev) => {
        if (!prev || prev.id !== id) return prev;
        return { ...prev, state: "rejected" };
      });
      // Clear rejected state quickly — it was denied, no need to linger
      clearTimerRef.current = setTimeout(() => {
        setActiveEditTarget(null);
        clearTimerRef.current = null;
      }, 800);
    },
    []
  );

  return (
    <BlueprintEditContext.Provider
      value={{
        activeEditTarget,
        notifyEditProposed,
        notifyEditApproved,
        notifyEditRejected,
        clearEditTarget,
        navigationRequest,
        requestNavigation,
        clearNavigationRequest,
      }}
    >
      {children}
    </BlueprintEditContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

/**
 * Strict hook — throws if used outside a provider.
 * Use when the component always requires the context to be present.
 */
export function useBlueprintEditContext(): BlueprintEditContextValue {
  const ctx = useContext(BlueprintEditContext);
  if (!ctx) {
    throw new Error(
      "useBlueprintEditContext must be used within BlueprintEditProvider"
    );
  }
  return ctx;
}

/**
 * Optional hook — returns null when no provider is in the tree.
 * Use in components like AgentChat and PaginatedBlueprintView that can
 * work without the context (e.g. in standalone pages without chat).
 */
export function useOptionalBlueprintEditContext(): BlueprintEditContextValue | null {
  return useContext(BlueprintEditContext);
}
