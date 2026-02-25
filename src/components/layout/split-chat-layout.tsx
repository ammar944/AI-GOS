"use client";

import { useState, useCallback } from "react";
import { MessageSquare, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";

interface SplitChatLayoutProps {
  chatContent: React.ReactNode;
  blueprintContent: React.ReactNode;
  className?: string;
}

/**
 * Split layout with always-visible, minimizable chat panel.
 * Desktop: chat on the left (380 px expanded, 48 px minimized).
 * Chat content stays mounted so state is preserved across toggles.
 */
export function SplitChatLayout({
  chatContent,
  blueprintContent,
  className,
}: SplitChatLayoutProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleDesktop = useCallback(() => setIsMinimized((p) => !p), []);
  const toggleMobile = useCallback(() => setIsMobileOpen((p) => !p), []);

  return (
    <div className={cn("h-full w-full", className)}>
      {/* ─── Desktop ─── */}
      <div className="hidden lg:flex h-full">
        {/* Chat panel — always present, animated width */}
        <div
          className="h-full flex-shrink-0 relative overflow-hidden"
          style={{
            width: isMinimized ? 48 : 380,
            transition: "width 280ms cubic-bezier(0.4, 0, 0.2, 1)",
            borderRight: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          {/* Minimized strip — icon only */}
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center pt-3 z-10",
              "transition-opacity duration-200",
              isMinimized ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <button
              onClick={toggleDesktop}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                "transition-all duration-200 hover:scale-105",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
              )}
              style={{
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-default)",
              }}
              aria-label="Expand chat"
              title="Expand chat"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>

          {/* Expanded chat — always mounted, hidden when minimized */}
          <div
            className={cn(
              "flex flex-col h-full w-[380px]",
              "transition-opacity duration-200",
              isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 px-3 pt-3 pb-1">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: "var(--text-tertiary)" }}
              >
                Chat
              </span>
              <button
                onClick={toggleDesktop}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md",
                  "transition-all duration-200 hover:bg-[var(--bg-hover)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
                )}
                style={{ color: "var(--text-tertiary)" }}
                aria-label="Minimize chat"
                title="Minimize chat"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* Chat content */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {chatContent}
            </div>
          </div>
        </div>

        {/* Blueprint — fills remaining space */}
        <div className="flex-1 h-full min-h-0 overflow-hidden">
          {blueprintContent}
        </div>
      </div>

      {/* ─── Mobile ─── */}
      <div className="lg:hidden h-full flex flex-col relative">
        {/* Blueprint fills the screen */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {blueprintContent}
        </div>

        {/* Floating chat button */}
        {!isMobileOpen && (
          <button
            onClick={toggleMobile}
            className={cn(
              "absolute bottom-4 left-4 z-20",
              "flex h-12 w-12 items-center justify-center rounded-full",
              "shadow-lg transition-all duration-200 hover:scale-105",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            )}
            style={{ background: "var(--accent-blue)", color: "white" }}
            aria-label="Open chat"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        )}

        {/* Full-screen chat overlay */}
        {isMobileOpen && (
          <div
            className="absolute inset-0 z-20 flex flex-col"
            style={{ background: "var(--bg-surface)" }}
          >
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-[var(--border-default)]">
              <span
                className="text-sm font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                Chat
              </span>
              <button
                onClick={toggleMobile}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md",
                  "transition-all duration-200 hover:bg-[var(--bg-hover)]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
                )}
                style={{ color: "var(--text-secondary)" }}
                aria-label="Close chat"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {chatContent}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
