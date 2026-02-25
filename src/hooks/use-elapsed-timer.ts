"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Tracks elapsed time (ms) while `isActive` is true.
 * Resets to 0 each time `isActive` toggles on.
 * Uses useSyncExternalStore to avoid lint issues with setState in effects.
 */
export function useElapsedTimer(isActive: boolean): number {
  const startRef = useRef<number>(0);
  const elapsedRef = useRef(0);
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const getSnapshot = useCallback(() => elapsedRef.current, []);

  useEffect(() => {
    if (isActive) {
      startRef.current = Date.now();
      elapsedRef.current = 0;
      const notify = () => listenersRef.current.forEach((l) => l());
      notify();
      const interval = setInterval(() => {
        elapsedRef.current = Date.now() - startRef.current;
        notify();
      }, 100);

      return () => {
        clearInterval(interval);
      };
    }
  }, [isActive]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
