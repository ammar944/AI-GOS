"use client";

import { motion } from "framer-motion";
import { springs } from "@/lib/motion";
import { useState, useCallback } from "react";
import { CheckCheck, Undo2, Redo2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market",
  icpAnalysisValidation: "ICP Analysis",
  offerAnalysisViability: "Offer Analysis",
  competitorAnalysis: "Competitors",
  crossAnalysisSynthesis: "Synthesis",
  keywordIntelligence: "Keywords",
};

interface SectionPaginationNavProps {
  sections: StrategicBlueprintSection[];
  currentPage: number;
  reviewedSections: Set<StrategicBlueprintSection>;
  onGoToPage: (page: number) => void;
  // Action bar props
  allReviewed?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  hasPendingEdits?: boolean;
  preApproveAllState?: Set<StrategicBlueprintSection> | null;
  onApproveAll?: () => void;
  onUndoApproveAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onApprove?: () => void;
  onCopy?: () => void;
}

export function SectionPaginationNav({
  sections,
  currentPage,
  reviewedSections,
  onGoToPage,
  allReviewed = false,
  canUndo = false,
  canRedo = false,
  hasPendingEdits = false,
  preApproveAllState = null,
  onApproveAll,
  onUndoApproveAll,
  onUndo,
  onRedo,
  onApprove,
  onCopy,
}: SectionPaginationNavProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [onCopy]);

  const showActions = onApproveAll || onApprove;

  return (
    <div className="flex items-center justify-between px-6 py-2.5">
      {/* Left: dots + counter */}
      <div className="flex items-center gap-3">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1.5">
            {sections.map((section, i) => {
              const isActive = i === currentPage;
              const isReviewed = reviewedSections.has(section);

              return (
                <Tooltip key={section}>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => onGoToPage(i)}
                      className="relative flex items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
                      style={{
                        width: isActive ? 24 : 8,
                        height: 8,
                        background: isActive
                          ? "var(--accent-blue)"
                          : isReviewed
                            ? "var(--success)"
                            : "var(--border-default)",
                        boxShadow: isActive
                          ? "0 0 10px var(--accent-blue-glow)"
                          : "none",
                        opacity: isActive ? 1 : isReviewed ? 0.9 : 0.5,
                      }}
                      animate={{
                        width: isActive ? 24 : 8,
                      }}
                      whileHover={{ scale: 1.2, opacity: 1 }}
                      transition={springs.snappy}
                      aria-label={`Go to ${SECTION_LABELS[section]}`}
                      aria-current={isActive ? "step" : undefined}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {SECTION_LABELS[section]}
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
          {currentPage + 1} of {sections.length}
        </span>
      </div>

      {/* Right: action buttons */}
      {showActions && (
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          {(canUndo || canRedo) && (
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1 mr-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-lg transition-all duration-200",
                        !canUndo && "opacity-40 cursor-not-allowed"
                      )}
                      style={{
                        color: canUndo
                          ? "var(--text-secondary)"
                          : "var(--text-tertiary)",
                      }}
                      onClick={onUndo}
                      disabled={!canUndo}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-lg transition-all duration-200",
                        !canRedo && "opacity-40 cursor-not-allowed"
                      )}
                      style={{
                        color: canRedo
                          ? "var(--text-secondary)"
                          : "var(--text-tertiary)",
                      }}
                      onClick={onRedo}
                      disabled={!canRedo}
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Redo (Ctrl+Shift+Z)
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}

          {/* Copy as Markdown */}
          {onCopy && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 rounded-lg transition-all duration-200",
                      copied
                        ? "text-green-400"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    )}
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {copied ? "Copied" : "Copy"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Copy full blueprint as markdown
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Approve All / Undo Approve */}
          {!allReviewed && onApproveAll && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg transition-all duration-200 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              onClick={onApproveAll}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Approve All</span>
            </Button>
          )}
          {allReviewed &&
            preApproveAllState !== null &&
            onUndoApproveAll && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg transition-all duration-200 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                onClick={onUndoApproveAll}
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Undo Approve</span>
              </Button>
            )}

          {/* Continue/Approve — primary CTA */}
          {onApprove && (
            <Button
              size="sm"
              onClick={onApprove}
              disabled={!allReviewed}
              className={cn(
                "h-8 gap-1.5 rounded-lg transition-all duration-200",
                !allReviewed && "opacity-50 cursor-not-allowed"
              )}
              style={{
                background: allReviewed
                  ? "var(--gradient-primary)"
                  : "var(--bg-elevated)",
                color: allReviewed ? "white" : "var(--text-tertiary)",
                fontFamily:
                  'var(--font-display), "Cabinet Grotesk", sans-serif',
                fontWeight: 500,
                border: "none",
              }}
            >
              <span>{hasPendingEdits ? "Approve" : "Continue"}</span>
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
