"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type ViewMode = "normal" | "verbose" | "summary";

const ORDER: ViewMode[] = ["normal", "verbose", "summary"];

interface ViewModeCtx {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  cycle: () => void;
}

const Ctx = createContext<ViewModeCtx | null>(null);

export function ViewModeProvider({
  children,
  initial = "normal",
}: {
  children: ReactNode;
  initial?: ViewMode;
}) {
  const [mode, setMode] = useState<ViewMode>(initial);

  const cycle = useCallback(() => {
    setMode((m) => ORDER[(ORDER.indexOf(m) + 1) % ORDER.length]);
  }, []);

  return (
    <Ctx.Provider value={{ mode, setMode, cycle }}>{children}</Ctx.Provider>
  );
}

export function useViewMode(): ViewModeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useViewMode must be used inside ViewModeProvider");
  }
  return ctx;
}
