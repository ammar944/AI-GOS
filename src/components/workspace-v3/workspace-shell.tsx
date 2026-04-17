"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TopBar, type Crumb } from "./top-bar";
import { PeekRail, type PeekNavGroup } from "./peek-rail";
import { ChatChip } from "./chat-chip";
import { CommandMenu, type CommandAction } from "./command-menu";
import { ChatPanel, type ChatMessage } from "./chat-panel";
import {
  ViewModeProvider,
  useViewMode,
  type ViewMode,
} from "./view-mode";
import "./workspace-shell.css";

export type ThemeMode = "dark" | "light";

export interface WorkspaceShellProps {
  crumbs: Crumb[];
  topBarCenter?: ReactNode;
  peekGroups: PeekNavGroup[];
  usage?: string;
  children: ReactNode;
  commandActions?: CommandAction[];
  chatMessages?: ChatMessage[];
  onChatSubmit?: (text: string) => void;
  defaultTheme?: ThemeMode;
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  return (
    <ViewModeProvider>
      <WorkspaceShellInner {...props} />
    </ViewModeProvider>
  );
}

function WorkspaceShellInner({
  crumbs,
  topBarCenter,
  peekGroups,
  usage,
  children,
  commandActions = [],
  chatMessages,
  onChatSubmit,
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

  const [commandOpen, setCommandOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { mode, setMode, cycle: cycleView } = useViewMode();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      } else if (mod && e.key === ";") {
        e.preventDefault();
        setChatOpen((o) => !o);
      } else if (!mod && !isTyping && e.key.toLowerCase() === "v") {
        e.preventDefault();
        cycleView();
      } else if (e.key === "Escape") {
        if (commandOpen) setCommandOpen(false);
        else if (chatOpen) setChatOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandOpen, chatOpen, cycleView]);

  const builtInActions: CommandAction[] = [
    {
      id: "view-normal",
      group: "View",
      label: "Normal mode",
      shortcut: mode === "normal" ? "active" : undefined,
      onSelect: () => setMode("normal"),
    },
    {
      id: "view-verbose",
      group: "View",
      label: "Verbose mode — show agent board + source log",
      shortcut: mode === "verbose" ? "active" : undefined,
      onSelect: () => setMode("verbose"),
    },
    {
      id: "view-summary",
      group: "View",
      label: "Summary mode — collapse cards to takeaways",
      shortcut: mode === "summary" ? "active" : undefined,
      onSelect: () => setMode("summary"),
    },
    {
      id: "toggle-theme",
      group: "View",
      label: `Toggle theme (currently ${theme})`,
      onSelect: toggleTheme,
    },
    {
      id: "open-chat",
      group: "Actions",
      label: "Open chat",
      shortcut: "⌘;",
      onSelect: () => setChatOpen(true),
    },
  ];

  const actions = [...commandActions, ...builtInActions];

  return (
    <div
      data-v3
      data-v3-theme={theme}
      data-v3-view={mode}
      className="v3-root"
      suppressHydrationWarning
    >
      <TopBar
        crumbs={crumbs}
        center={topBarCenter}
        usage={usage}
        onCommandMenuOpen={() => setCommandOpen(true)}
      />
      <PeekRail groups={peekGroups} />
      <main className="v3-canvas">{children}</main>
      <ChatChip onClick={() => setChatOpen(true)} />

      <button
        type="button"
        className="v3-theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "light mode" : "dark mode"}
      </button>

      <CommandMenu
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        actions={actions}
      />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSubmit={onChatSubmit}
      />
    </div>
  );
}

export type { ViewMode };
