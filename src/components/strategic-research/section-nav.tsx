"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCheck, RotateCcw, Undo2, Redo2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";

const SECTION_NAV_ITEMS: { id: StrategicBlueprintSection; label: string }[] = [
  { id: "industryMarketOverview", label: "Industry & Market" },
  { id: "icpAnalysisValidation", label: "ICP Analysis" },
  { id: "offerAnalysisViability", label: "Offer Analysis" },
  { id: "competitorAnalysis", label: "Competitors" },
  { id: "crossAnalysisSynthesis", label: "Synthesis" },
];

interface SectionNavProps {
  activeSection: StrategicBlueprintSection;
  reviewedSections: Set<StrategicBlueprintSection>;
  onNavigate?: (sectionId: StrategicBlueprintSection) => void;
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
  onRegenerate?: () => void;
  onApprove?: () => void;
}

export function SectionNav({
  activeSection,
  reviewedSections,
  onNavigate,
  allReviewed = false,
  canUndo = false,
  canRedo = false,
  hasPendingEdits = false,
  preApproveAllState = null,
  onApproveAll,
  onUndoApproveAll,
  onUndo,
  onRedo,
  onRegenerate,
  onApprove,
}: SectionNavProps) {
  const handleClick = (sectionId: StrategicBlueprintSection) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    onNavigate?.(sectionId);
  };

  const showActionBar = onApproveAll || onRegenerate || onApprove;

  return (
    <nav className="sticky top-6 hidden lg:block">
      <div
        className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] shadow-[var(--shadow-card)]"
      >
      <div className="space-y-1">
        {SECTION_NAV_ITEMS.map((section, i) => {
          const isActive = activeSection === section.id;
          const isReviewed = reviewedSections.has(section.id);

          return (
            <button
              key={section.id}
              onClick={() => handleClick(section.id)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-all duration-200",
                "rounded-lg text-left",
                "hover:bg-[var(--bg-hover)]",
                isActive
                  ? "bg-[var(--bg-active)] text-[var(--text-primary)]"
                  : "text-[var(--text-tertiary)]"
              )}
            >
              {/* Section number indicator */}
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors"
                )}
                style={
                  isActive
                    ? {
                        background: 'var(--text-primary)',
                        color: 'rgb(0, 0, 0)',
                      }
                    : isReviewed
                    ? {
                        background: 'var(--success-subtle)',
                        color: 'var(--success)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                      }
                    : {
                        background: 'var(--border-default)',
                        color: 'var(--text-tertiary)',
                      }
                }
              >
                {isReviewed && !isActive ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className="truncate">{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Progress summary */}
      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
        <div
          className="text-xs mb-2"
          style={{
            color: 'var(--text-quaternary)',
            fontFamily: 'var(--font-sans), Inter, sans-serif',
          }}
        >
          Review Progress
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(reviewedSections.size / 5) * 100}%`,
                background: 'var(--gradient-primary)',
                boxShadow: '0 0 8px rgba(54, 94, 255, 0.3)',
              }}
            />
          </div>
          <span
            className="text-xs tabular-nums font-medium"
            style={{
              color: 'var(--accent-blue)',
              fontFamily: 'var(--font-mono), monospace',
            }}
          >
            {reviewedSections.size}/5
          </span>
        </div>
      </div>

      {/* Action Bar */}
      {showActionBar && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          {/* Undo/Redo row */}
          {(canUndo || canRedo) && (
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1 mb-3">
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
                        color: canUndo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
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
                        color: canRedo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                      }}
                      onClick={onRedo}
                      disabled={!canRedo}
                    >
                      <Redo2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Redo (Ctrl+Shift+Z)</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}

          {/* Action buttons - stacked vertically */}
          <div className="flex flex-col gap-2">
            {!allReviewed && onApproveAll && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 gap-2 justify-center rounded-lg border transition-all duration-200 hover:border-[var(--accent-blue)]"
                      style={{
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border-default)',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                      onClick={onApproveAll}
                    >
                      <CheckCheck className="h-4 w-4" />
                      <span>Approve All</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Mark all sections as reviewed</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {allReviewed && preApproveAllState !== null && onUndoApproveAll && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 gap-2 justify-center rounded-lg border transition-all duration-200 hover:border-[var(--accent-blue)]"
                      style={{
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border-default)',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                      onClick={onUndoApproveAll}
                    >
                      <Undo2 className="h-4 w-4" />
                      <span>Undo Approve</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Undo Approve All</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 gap-2 justify-center rounded-lg border transition-all duration-200 hover:border-[var(--accent-blue)]"
                style={{
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-default)',
                  fontFamily: 'var(--font-sans), Inter, sans-serif',
                }}
                onClick={onRegenerate}
              >
                <RotateCcw className="h-4 w-4" />
                <span>Regenerate</span>
              </Button>
            )}
            {onApprove && (
              <Button
                size="sm"
                onClick={onApprove}
                disabled={!allReviewed}
                className={cn(
                  "w-full h-9 gap-2 justify-center rounded-lg transition-all duration-200",
                  !allReviewed && "opacity-50 cursor-not-allowed"
                )}
                style={{
                  background: allReviewed ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                  color: allReviewed ? 'white' : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                  fontWeight: 500,
                  border: 'none',
                }}
              >
                <span>{hasPendingEdits ? "Approve" : "Continue"}</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      )}
      </div>
    </nav>
  );
}
