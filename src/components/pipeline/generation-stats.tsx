"use client";

import { cn } from "@/lib/utils";

interface GenerationStatsProps {
  elapsedTime: number; // milliseconds
  estimatedCost: number; // dollars
  completedSections: number;
  totalSections: number;
  className?: string;
}

/**
 * Minimal stats display for generation progress.
 * Follows v2.0 design: restraint over decoration, monospace for data.
 */
export function GenerationStats({
  elapsedTime,
  estimatedCost,
  completedSections,
  totalSections,
  className,
}: GenerationStatsProps) {
  // Format time as M:SS
  const totalSeconds = Math.floor(elapsedTime / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // Format cost
  const costDisplay = `$${estimatedCost.toFixed(4)}`;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-6 text-sm",
        className
      )}
      style={{ color: "var(--text-tertiary)" }}
    >
      {/* Time */}
      <div className="flex items-center gap-2">
        <span>Time</span>
        <span
          className="font-mono tabular-nums"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {timeDisplay}
        </span>
      </div>

      <span style={{ color: "var(--border-default)" }}>·</span>

      {/* Sections */}
      <div className="flex items-center gap-2">
        <span>Sections</span>
        <span
          className="font-mono tabular-nums"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {completedSections}/{totalSections}
        </span>
      </div>

      <span style={{ color: "var(--border-default)" }}>·</span>

      {/* Cost */}
      <div className="flex items-center gap-2">
        <span>Cost</span>
        <span
          className="font-mono tabular-nums"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {costDisplay}
        </span>
      </div>
    </div>
  );
}
