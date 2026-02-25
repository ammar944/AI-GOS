"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/utils";

// ── Slide + fade for competitor cards ──────────────────────────────────────────
// Reduced from ±60 to ±32 for a subtler, less jarring transition

export const competitorSlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 32 : -32,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -32 : 32,
    opacity: 0,
  }),
};

export const competitorSlideTransition = {
  x: { type: "spring" as const, stiffness: 500, damping: 40 },
  opacity: { duration: 0.15 },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompetitorTabStripProps {
  competitors: Array<{ name?: string; website?: string; analysisDepth?: string }>;
  currentPage: number;
  onGoToPage: (page: number) => void;
}

interface CompetitorFooterNavProps {
  competitors: Array<{ name?: string; website?: string }>;
  currentPage: number;
  onGoToPage: (page: number) => void;
}

// ── CompetitorTabStrip ────────────────────────────────────────────────────────
// Minimal text-only tabs with amber underline indicator.
// No filled backgrounds, no browser-tab borders, no Globe icon.

export function CompetitorTabStrip({
  competitors,
  currentPage,
  onGoToPage,
}: CompetitorTabStripProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  // Check scroll overflow state
  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  React.useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, competitors.length]);

  // Scroll active tab into view
  React.useEffect(() => {
    const tab = tabRefs.current[currentPage];
    if (tab && scrollRef.current) {
      const container = scrollRef.current;
      const tabLeft = tab.offsetLeft;
      const tabRight = tabLeft + tab.offsetWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;

      if (tabLeft < viewLeft + 32) {
        container.scrollTo({ left: Math.max(0, tabLeft - 32), behavior: "smooth" });
      } else if (tabRight > viewRight - 32) {
        container.scrollTo({ left: tabRight - container.clientWidth + 32, behavior: "smooth" });
      }
    }
  }, [currentPage]);

  // Keyboard navigation (ArrowLeft/Right, Home/End)
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft" && currentPage > 0) {
        e.preventDefault();
        onGoToPage(currentPage - 1);
      } else if (e.key === "ArrowRight" && currentPage < competitors.length - 1) {
        e.preventDefault();
        onGoToPage(currentPage + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        onGoToPage(0);
      } else if (e.key === "End") {
        e.preventDefault();
        onGoToPage(competitors.length - 1);
      }
    },
    [currentPage, competitors.length, onGoToPage]
  );

  if (competitors.length <= 1) return null;

  return (
    <div
      className="relative"
      role="tablist"
      aria-label="Competitors"
      onKeyDown={handleKeyDown}
    >
      {/* Left fade edge */}
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-10 h-full w-8",
          "bg-gradient-to-r from-[var(--bg-surface)] to-transparent",
          "transition-opacity duration-150",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Scrollable tab strip */}
      <div
        ref={scrollRef}
        className="flex items-end gap-0 overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {competitors.map((competitor, i) => {
          const isActive = i === currentPage;
          const isSummary = competitor.analysisDepth === "summary";
          const name = competitor.name || `Competitor ${i + 1}`;

          return (
            <button
              key={competitor.name ?? `competitor-${i}`}
              type="button"
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`competitor-panel-${i}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onGoToPage(i)}
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs",
                "transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-blue)]",
                isActive
                  ? "text-[var(--text-heading)]"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              )}
            >
              {/* Tab number */}
              <span
                className="text-[10px] font-medium tabular-nums"
                style={{
                  color: isActive ? "#f59e0b" : "var(--text-tertiary)",
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {i + 1}
              </span>

              {/* Competitor name */}
              <span className="truncate max-w-[120px] leading-tight">
                {name}
              </span>

              {/* Summary depth indicator — italic, not a badge */}
              {isSummary && (
                <span
                  className="text-[10px] italic shrink-0"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  (summary)
                </span>
              )}

              {/* Amber underline indicator for active tab */}
              {isActive && (
                <motion.div
                  layoutId="competitor-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px]"
                  style={{ backgroundColor: "#f59e0b" }}
                  transition={springs.snappy}
                />
              )}
            </button>
          );
        })}

        {/* Position counter — inline after tabs */}
        <div className="flex shrink-0 items-center self-center px-2 py-2">
          <span
            className="text-[10px] tabular-nums"
            style={{
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {currentPage + 1}/{competitors.length}
          </span>
        </div>
      </div>

      {/* Right fade edge */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 z-10 h-full w-8",
          "bg-gradient-to-l from-[var(--bg-surface)] to-transparent",
          "transition-opacity duration-150",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

// ── CompetitorFooterNav ───────────────────────────────────────────────────────
// Minimal single-row footer: ← PolyAI    3 of 8    Loman AI →
// No filled buttons, no gradients, no Globe icon, ~32px tall.

export function CompetitorFooterNav({
  competitors,
  currentPage,
  onGoToPage,
}: CompetitorFooterNavProps) {
  if (competitors.length <= 1) return null;

  const hasPrev = currentPage > 0;
  const hasNext = currentPage < competitors.length - 1;
  const prevName = hasPrev
    ? (competitors[currentPage - 1]?.name || `Competitor ${currentPage}`)
    : "";
  const nextName = hasNext
    ? (competitors[currentPage + 1]?.name || `Competitor ${currentPage + 2}`)
    : "";

  return (
    <div
      className="py-3 mt-4 flex items-center justify-between"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Previous */}
      <div className="flex-1 min-w-0">
        {hasPrev ? (
          <button
            type="button"
            onClick={() => onGoToPage(currentPage - 1)}
            className={cn(
              "flex items-center gap-1 text-xs",
              "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[120px]">{prevName}</span>
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Center counter */}
      <span
        className="shrink-0 text-[10px] tabular-nums px-2"
        style={{
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {currentPage + 1} of {competitors.length}
      </span>

      {/* Next */}
      <div className="flex-1 min-w-0 flex justify-end">
        {hasNext ? (
          <button
            type="button"
            onClick={() => onGoToPage(currentPage + 1)}
            className={cn(
              "flex items-center gap-1 text-xs",
              "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              "transition-colors duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            )}
          >
            <span className="truncate max-w-[120px]">{nextName}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
