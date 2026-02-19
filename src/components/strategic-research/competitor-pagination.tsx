"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { springs } from "@/lib/motion";
import { cn } from "@/lib/utils";

// ── Slide + fade for competitor cards (matches section-level pattern) ──
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

// ── Types ──

interface CompetitorPaginationNavProps {
  competitors: Array<{ name?: string; website?: string }>;
  currentPage: number;
  onGoToPage: (page: number) => void;
}

// ── Helpers ──

function extractDomain(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// ── Navigation Arrows (exported for card overlay use) ──

interface CompetitorCardArrowsProps {
  currentPage: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

export function CompetitorCardArrows({
  currentPage,
  total,
  onPrev,
  onNext,
}: CompetitorCardArrowsProps) {
  if (total <= 1) return null;

  return (
    <>
      {/* Left arrow */}
      <AnimatePresence>
        {currentPage > 0 && (
          <motion.button
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.15 }}
            onClick={onPrev}
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10",
              "flex h-8 w-8 items-center justify-center rounded-full",
              "border border-[var(--border-default)] bg-[var(--bg-elevated)]",
              "text-[var(--text-secondary)] shadow-md",
              "transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-heading)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            )}
            aria-label="Previous competitor"
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Right arrow */}
      <AnimatePresence>
        {currentPage < total - 1 && (
          <motion.button
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            onClick={onNext}
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10",
              "flex h-8 w-8 items-center justify-center rounded-full",
              "border border-[var(--border-default)] bg-[var(--bg-elevated)]",
              "text-[var(--text-secondary)] shadow-md",
              "transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-heading)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            )}
            aria-label="Next competitor"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main Tab Navigation ──

export function CompetitorPaginationNav({
  competitors,
  currentPage,
  onGoToPage,
}: CompetitorPaginationNavProps) {
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

  // Keyboard navigation
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
    <div className="relative" role="tablist" aria-label="Competitors" onKeyDown={handleKeyDown}>
      {/* Scroll fade: left */}
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-10 h-full w-8",
          "bg-gradient-to-r from-[var(--bg-surface)] to-transparent",
          "transition-opacity duration-150",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Tab strip */}
      <div
        ref={scrollRef}
        className="flex items-end gap-0.5 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {competitors.map((competitor, i) => {
          const isActive = i === currentPage;
          const domain = extractDomain(competitor.website);
          const name = competitor.name || `Competitor ${i + 1}`;

          return (
            <button
              key={i}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`competitor-panel-${i}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onGoToPage(i)}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2.5",
                "text-left transition-colors duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] focus-visible:ring-inset",
                isActive
                  ? "bg-[var(--bg-surface)]"
                  : "bg-transparent hover:bg-[var(--bg-elevated)]"
              )}
              style={{
                borderWidth: isActive ? "1px 1px 0 1px" : "1px 1px 0 1px",
                borderColor: isActive ? "var(--border-default)" : "transparent",
                borderStyle: "solid",
                marginBottom: isActive ? "-1px" : "0",
              }}
            >
              {/* Tab number */}
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold tabular-nums",
                  "transition-colors duration-150",
                )}
                style={{
                  backgroundColor: isActive ? "var(--accent-blue)" : "var(--bg-elevated)",
                  color: isActive ? "#fff" : "var(--text-tertiary)",
                }}
              >
                {i + 1}
              </span>

              {/* Name + domain */}
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "text-xs font-semibold truncate max-w-[140px] leading-tight",
                    "transition-colors duration-150"
                  )}
                  style={{
                    color: isActive ? "var(--text-heading)" : "var(--text-secondary)",
                  }}
                >
                  {name}
                </span>
                {domain && (
                  <span
                    className="flex items-center gap-1 text-[10px] truncate max-w-[140px] leading-tight"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    <Globe className="h-2.5 w-2.5 shrink-0" />
                    {domain}
                  </span>
                )}
              </div>

              {/* Active indicator bar */}
              {isActive && (
                <motion.div
                  layoutId="competitor-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ backgroundColor: "var(--accent-blue)" }}
                  transition={springs.snappy}
                />
              )}
            </button>
          );
        })}

        {/* Counter pill at end */}
        <div className="flex shrink-0 items-center self-center px-2.5 py-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
            style={{
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {currentPage + 1}/{competitors.length}
          </span>
        </div>
      </div>

      {/* Scroll fade: right */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 z-10 h-full w-8",
          "bg-gradient-to-l from-[var(--bg-surface)] to-transparent",
          "transition-opacity duration-150",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Bottom border that the active tab "breaks" through */}
      <div
        className="h-px w-full"
        style={{ backgroundColor: "var(--border-default)" }}
      />
    </div>
  );
}
