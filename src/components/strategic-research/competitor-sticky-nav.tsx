"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";

interface CompetitorStickyNavProps {
  competitors: Array<{ name?: string; website?: string }>;
  currentPage: number;
  onGoToPage: (page: number) => void;
  /** Ref to the tab strip element — hidden when it scrolls out of view */
  tabStripRef: React.RefObject<HTMLElement | null>;
  /** Ref to the whole competitor section — sticky nav hides when section exits viewport */
  sectionRef: React.RefObject<HTMLElement | null>;
}

export function CompetitorStickyNav({
  competitors,
  currentPage,
  onGoToPage,
  tabStripRef,
  sectionRef,
}: CompetitorStickyNavProps) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const tabEl = tabStripRef.current;
    const sectionEl = sectionRef.current;
    if (!tabEl || !sectionEl || competitors.length <= 1) return;

    let tabHidden = false;
    let sectionInView = true;

    const update = () => setVisible(tabHidden && sectionInView);

    const tabObserver = new IntersectionObserver(
      ([entry]) => {
        tabHidden = !entry.isIntersecting;
        update();
      },
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" }
    );

    const sectionObserver = new IntersectionObserver(
      ([entry]) => {
        sectionInView = entry.isIntersecting;
        update();
      },
      { threshold: 0 }
    );

    tabObserver.observe(tabEl);
    sectionObserver.observe(sectionEl);

    return () => {
      tabObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, [tabStripRef, sectionRef, competitors.length]);

  if (competitors.length <= 1) return null;

  const hasPrev = currentPage > 0;
  const hasNext = currentPage < competitors.length - 1;
  const prevName = hasPrev ? (competitors[currentPage - 1]?.name || `Competitor ${currentPage}`) : "";
  const nextName = hasNext ? (competitors[currentPage + 1]?.name || `Competitor ${currentPage + 2}`) : "";
  const currentName = competitors[currentPage]?.name || `Competitor ${currentPage + 1}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -44, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -44, opacity: 0 }}
          transition={springs.snappy}
          className={cn(
            "sticky top-16 z-40",
            "flex h-11 items-center justify-between gap-2 rounded-b-lg px-3",
            "border-x border-b",
          )}
          style={{
            background: "rgba(12, 14, 19, 0.88)",
            backdropFilter: "blur(20px) saturate(1.2)",
            WebkitBackdropFilter: "blur(20px) saturate(1.2)",
            borderColor: "var(--border-default)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
          }}
        >
          {/* Prev button */}
          <button
            onClick={() => hasPrev && onGoToPage(currentPage - 1)}
            disabled={!hasPrev}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all duration-150",
              hasPrev
                ? "text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-white/[0.06] active:scale-[0.97]"
                : "text-[var(--text-tertiary)] opacity-40 cursor-default"
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="max-w-[100px] truncate hidden sm:inline">{prevName}</span>
          </button>

          {/* Current name + counter — animated on change */}
          <div className="flex items-center gap-2 min-w-0">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentPage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="text-xs font-semibold text-[var(--text-heading)] truncate max-w-[160px]"
              >
                {currentName}
              </motion.span>
            </AnimatePresence>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              {currentPage + 1}/{competitors.length}
            </span>
          </div>

          {/* Next button */}
          <button
            onClick={() => hasNext && onGoToPage(currentPage + 1)}
            disabled={!hasNext}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all duration-150",
              hasNext
                ? "text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] hover:bg-[rgba(54,94,255,0.08)] active:scale-[0.97]"
                : "text-[var(--text-tertiary)] opacity-40 cursor-default"
            )}
          >
            <span className="max-w-[100px] truncate hidden sm:inline">{nextName}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
