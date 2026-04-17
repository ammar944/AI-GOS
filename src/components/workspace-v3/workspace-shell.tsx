"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TopBar, type Crumb } from "./top-bar";
import { PeekRail, type PeekNavGroup } from "./peek-rail";
import { ChatChip } from "./chat-chip";
import "./workspace-shell.css";

export type ThemeMode = "dark" | "light";

export interface WorkspaceShellProps {
  crumbs: Crumb[];
  topBarCenter?: ReactNode;
  peekGroups: PeekNavGroup[];
  usage?: string;
  children: ReactNode;
  onCommandMenuOpen?: () => void;
  onChatToggle?: () => void;
  defaultTheme?: ThemeMode;
}

/**
 * AIGOS v3 workspace shell.
 * - 44px top bar (breadcrumb + center slot + chips)
 * - 8px peek rail left edge (hover-expands to 220px)
 * - 880px centered canvas
 * - Floating ⌘; chat chip bottom-right
 * - Cmd/Ctrl+K opens command menu
 * - Cmd/Ctrl+; toggles side chat
 * - data-theme persisted to localStorage
 */
export function WorkspaceShell({
  crumbs,
  topBarCenter,
  peekGroups,
  usage,
  children,
  onCommandMenuOpen,
  onChatToggle,
  defaultTheme = "dark",
}: WorkspaceShellProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      const saved = window.localStorage.getItem("aigos_v3_theme");
      return saved === "dark" || saved === "light"
        ? (saved as ThemeMode)
        : defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("aigos_v3_theme", theme);
    } catch {
      // storage quota / disabled — ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onCommandMenuOpen?.();
      } else if (mod && e.key === ";") {
        e.preventDefault();
        onChatToggle?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCommandMenuOpen, onChatToggle]);

  return (
    <div data-v3 data-v3-theme={theme} className="v3-root" suppressHydrationWarning>
      <TopBar
        crumbs={crumbs}
        center={topBarCenter}
        usage={usage}
        onCommandMenuOpen={onCommandMenuOpen}
      />
      <PeekRail groups={peekGroups} />
      <main className="v3-canvas">{children}</main>
      <ChatChip onClick={onChatToggle} />

      <button
        type="button"
        className="v3-theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "light mode" : "dark mode"}
      </button>
    </div>
  );
}
