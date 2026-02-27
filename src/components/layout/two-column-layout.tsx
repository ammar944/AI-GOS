"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  MessageSquare,
  PanelLeftClose,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";

interface TwoColumnLayoutProps {
  chatContent: React.ReactNode;
  blueprintContent: React.ReactNode;
  className?: string;
}

/**
 * Two-column layout with narrow chat panel (340px) and full-width blueprint.
 * Desktop: chat on the left (340px expanded, 48px minimized), animated via
 * Framer Motion spring. Chat content stays mounted so state is preserved.
 * Mobile: blueprint fills screen with a floating FAB + full-screen overlay.
 */
export function TwoColumnLayout({
  chatContent,
  blueprintContent,
  className,
}: TwoColumnLayoutProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleDesktop = useCallback(() => setIsMinimized((p) => !p), []);
  const toggleMobile = useCallback(() => setIsMobileOpen((p) => !p), []);

  return (
    <div className={cn("h-full w-full", className)}>
      {/* ─── Desktop ─── */}
      <div className="hidden lg:flex h-full">
        {/* Chat panel — always present, animated width via Framer Motion */}
        <motion.div
          className="h-full flex-shrink-0 relative overflow-hidden"
          animate={{ width: isMinimized ? 48 : 340 }}
          transition={springs.smooth}
          style={{
            borderRight: "1px solid var(--border-default)",
            background: "var(--bg-chat)",
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
              "flex flex-col h-full w-[340px]",
              "transition-opacity duration-200",
              isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"
            )}
          >
            {/* Header — brand + minimize (no mode selector) */}
            <div className="flex items-center justify-between shrink-0 px-3 pt-3 pb-2">
              {/* Left: branded icon + titles */}
              <div className="flex items-center gap-2 min-w-0">
                {/* Blue-gradient icon badge */}
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent-blue) 0%, #6366f1 100%)",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>

                {/* Titles */}
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-[13px] font-semibold leading-tight truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    AIGOS
                  </span>
                  <span
                    className="text-[11px] leading-tight truncate"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    AI Strategy Agent
                  </span>
                </div>
              </div>

              {/* Right: minimize button only */}
              <button
                onClick={toggleDesktop}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
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
        </motion.div>

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
            style={{ background: "var(--bg-chat)" }}
          >
            {/* Mobile header — branded, matches desktop */}
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-[var(--border-default)]">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent-blue) 0%, #6366f1 100%)",
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span
                    className="text-[13px] font-semibold leading-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    AIGOS
                  </span>
                  <span
                    className="text-[11px] leading-tight"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    AI Strategy Agent
                  </span>
                </div>
              </div>

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
                <X className="h-4 w-4" />
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
