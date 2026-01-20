"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface SplitChatLayoutProps {
  chatContent: React.ReactNode;
  blueprintContent: React.ReactNode;
  className?: string;
}

export function SplitChatLayout({
  chatContent,
  blueprintContent,
  className,
}: SplitChatLayoutProps) {
  return (
    <div className={cn("h-full", className)}>
      {/* Desktop: side-by-side with resize */}
      <div className="hidden lg:block h-full">
        <Group orientation="horizontal" className="h-full">
          {/* Chat sidebar: 30% default, 20-40% range */}
          <Panel
            defaultSize={30}
            minSize={20}
            maxSize={40}
          >
            <div
              className="h-full flex flex-col"
              style={{ background: 'var(--bg-surface)' }}
            >
              {chatContent}
            </div>
          </Panel>

          {/* Resize handle with visual indicator */}
          <Separator className="w-px relative group cursor-col-resize">
            {/* Visual handle bar */}
            <div
              className="absolute inset-y-0 -left-1.5 -right-1.5 w-4 flex items-center justify-center"
            >
              <div
                className="w-1 h-12 rounded-full transition-colors duration-150 group-hover:scale-110"
                style={{
                  background: 'var(--border-default)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-blue)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--border-default)';
                }}
              />
            </div>
          </Separator>

          {/* Blueprint content: fills remaining space */}
          <Panel minSize={60}>
            <div className="h-full overflow-y-auto">
              {blueprintContent}
            </div>
          </Panel>
        </Group>
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
