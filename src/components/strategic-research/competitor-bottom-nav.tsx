"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CompetitorBottomNavProps {
  competitors: Array<{ name?: string; website?: string }>;
  currentPage: number;
  onGoToPage: (page: number) => void;
}

function extractDomain(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function CompetitorBottomNav({
  competitors,
  currentPage,
  onGoToPage,
}: CompetitorBottomNavProps) {
  if (competitors.length <= 1) return null;

  const hasPrev = currentPage > 0;
  const hasNext = currentPage < competitors.length - 1;

  const prevComp = hasPrev ? competitors[currentPage - 1] : null;
  const nextComp = hasNext ? competitors[currentPage + 1] : null;

  const prevName = prevComp?.name || `Competitor ${currentPage}`;
  const nextName = nextComp?.name || `Competitor ${currentPage + 2}`;
  const prevDomain = extractDomain(prevComp?.website);
  const nextDomain = extractDomain(nextComp?.website);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15, duration: 0.25 }}
      className="mt-5 flex items-center gap-3 pt-4"
      style={{
        borderTop: "1px solid var(--border-default)",
      }}
    >
      {/* Previous button */}
      <div className="flex-1 min-w-0">
        {hasPrev ? (
          <button
            onClick={() => onGoToPage(currentPage - 1)}
            className={cn(
              "group/btn flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5",
              "text-left transition-all duration-150",
              "hover:bg-white/[0.04]",
              "active:scale-[0.98]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            )}
            style={{
              backgroundColor: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
            }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-150 group-hover/btn:bg-white/[0.06]"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <ChevronLeft className="h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform duration-150 group-hover/btn:-translate-x-px" />
            </span>
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] leading-none">
                Previous
              </span>
              <span className="truncate text-xs font-medium text-[var(--text-secondary)] group-hover/btn:text-[var(--text-heading)] transition-colors leading-tight">
                {prevName}
              </span>
              {prevDomain && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)] truncate leading-none">
                  <Globe className="h-2.5 w-2.5 shrink-0 opacity-60" />
                  {prevDomain}
                </span>
              )}
            </div>
          </button>
        ) : (
          <div />
        )}
      </div>

      {/* Counter pill */}
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium tabular-nums"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          border: "1px solid var(--border-default)",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {currentPage + 1} / {competitors.length}
      </span>

      {/* Next button — primary CTA */}
      <div className="flex-1 min-w-0">
        {hasNext ? (
          <button
            onClick={() => onGoToPage(currentPage + 1)}
            className={cn(
              "group/btn flex w-full items-center justify-end gap-2.5 rounded-lg px-3 py-2.5",
              "text-right transition-all duration-150",
              "active:scale-[0.98]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
            )}
            style={{
              background: "linear-gradient(135deg, var(--accent-blue), var(--accent-blue-hover))",
              boxShadow: "0 2px 12px rgba(54, 94, 255, 0.2)",
            }}
          >
            <div className="min-w-0 flex flex-col items-end gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-white/50 leading-none">
                Next
              </span>
              <span className="truncate text-xs font-medium text-white leading-tight">
                {nextName}
              </span>
              {nextDomain && (
                <span className="flex items-center gap-1 text-[10px] text-white/50 truncate leading-none">
                  <Globe className="h-2.5 w-2.5 shrink-0" />
                  {nextDomain}
                </span>
              )}
            </div>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 transition-all duration-150 group-hover/btn:bg-white/20"
            >
              <ChevronRight className="h-3.5 w-3.5 text-white transition-transform duration-150 group-hover/btn:translate-x-px" />
            </span>
          </button>
        ) : (
          <div />
        )}
      </div>
    </motion.div>
  );
}
