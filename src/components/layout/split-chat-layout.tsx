"use client";

import { cn } from "@/lib/utils";

interface SplitChatLayoutProps {
  chatContent: React.ReactNode;
  blueprintContent: React.ReactNode;
  className?: string;
}

/**
 * Split layout with chat sidebar on left (30%) and content on right (70%).
 * Inspired by v0/Lovable's permanent sidebar pattern.
 * Uses CSS flexbox for reliable cross-browser layout.
 */
export function SplitChatLayout({
  chatContent,
  blueprintContent,
  className,
}: SplitChatLayoutProps) {
  return (
    <div className={cn("h-full", className)}>
      {/* Desktop: side-by-side layout */}
      <div className="hidden lg:flex h-full">
        {/* Chat sidebar: fixed 30% width */}
        <div
          className="w-[30%] min-w-[280px] max-w-[400px] h-full flex flex-col flex-shrink-0"
          style={{
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-default)',
          }}
        >
          {chatContent}
        </div>

        {/* Blueprint content: fills remaining space */}
        <div className="flex-1 h-full overflow-y-auto">
          {blueprintContent}
        </div>
      </div>

      {/* Mobile: vertical stack (blueprint above, chat below) */}
      <div className="lg:hidden h-full flex flex-col">
        {/* Blueprint takes most of the space */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {blueprintContent}
        </div>

        {/* Chat panel at bottom - fixed height on mobile */}
        <div
          className="h-[45vh] flex-shrink-0 flex flex-col"
          style={{
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
          }}
        >
          {chatContent}
        </div>
      </div>
    </div>
  );
}
