"use client";

import { motion } from "framer-motion";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Slide + fade for competitor cards (matches section-level pattern)
export const competitorSlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export const competitorSlideTransition = {
  x: { type: "spring" as const, stiffness: 500, damping: 40 },
  opacity: { duration: 0.15 },
};

interface CompetitorPaginationNavProps {
  competitors: Array<{ name?: string }>;
  currentPage: number;
  onGoToPage: (page: number) => void;
}

export function CompetitorPaginationNav({
  competitors,
  currentPage,
  onGoToPage,
}: CompetitorPaginationNavProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Left: dots + counter */}
      <div className="flex items-center gap-3">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1.5">
            {competitors.map((competitor, i) => {
              const isActive = i === currentPage;

              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => onGoToPage(i)}
                      className={cn(
                        "relative flex items-center justify-center rounded-full",
                        "transition-colors focus:outline-none",
                        "focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
                      )}
                      style={{
                        width: isActive ? 24 : 8,
                        height: 8,
                        background: isActive
                          ? "var(--accent-blue)"
                          : "var(--border-default)",
                        boxShadow: isActive
                          ? "0 0 10px rgba(54, 94, 255, 0.4)"
                          : "none",
                        opacity: isActive ? 1 : 0.5,
                      }}
                      animate={{
                        width: isActive ? 24 : 8,
                      }}
                      whileHover={{ scale: 1.2, opacity: 1 }}
                      transition={springs.snappy}
                      aria-label={`Go to ${competitor.name || `Competitor ${i + 1}`}`}
                      aria-current={isActive ? "step" : undefined}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {competitor.name || `Competitor ${i + 1}`}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        <span
          className="text-xs tabular-nums"
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {currentPage + 1} of {competitors.length}
        </span>
      </div>
    </div>
  );
}
