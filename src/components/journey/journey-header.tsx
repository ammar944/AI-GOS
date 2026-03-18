'use client';

import { cn } from '@/lib/utils';

interface JourneyHeaderProps {
  className?: string;
  completionPercentage?: number;
  onNewJourney?: () => void;
}

export function JourneyHeader({
  className,
  completionPercentage = 0,
  onNewJourney,
}: JourneyHeaderProps) {
  const clamped = Math.min(100, Math.max(0, completionPercentage));

  return (
    <header
      className={cn(
        'relative flex-none h-16 flex items-center justify-between px-8 border-b border-brand-border',
        className,
      )}
    >
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5">
        <div
          className="header-progress"
          style={{ width: `${clamped}%` }}
        />
      </div>

      {/* Left: Logo badge + title */}
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-accent to-brand-success flex items-center justify-center font-bold text-black text-xs">
          AI
        </div>
        <span className="text-sm font-medium tracking-tight">
          AIGOS <span className="text-[var(--text-tertiary)]">V2.0</span>
        </span>
      </div>

      {/* Right: Documentation + New Journey */}
      <div className="flex items-center gap-6">
        <button className="text-xs text-[var(--text-secondary)] hover:text-white transition-colors">
          Documentation
        </button>
        <button
          onClick={onNewJourney}
          className="bg-brand-accent hover:bg-blue-600 px-4 py-2 rounded-control text-xs font-medium transition-all text-white"
        >
          New Journey
        </button>
      </div>
    </header>
  );
}
