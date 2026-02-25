"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";
import { generateBlueprintMarkdown } from "@/lib/strategic-blueprint/markdown-generator";
import { OutputSectionCard } from "@/components/strategic-research/output-section-card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  StrategicBlueprintOutput,
  StrategicBlueprintSection,
} from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { useOptionalBlueprintEditContext } from "./blueprint-edit-context";

// ── Animation variants ───────────────────────────────────────────────────────

const slideVariants = {
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

const slideTransition = {
  x: { type: "spring" as const, stiffness: 500, damping: 40 },
  opacity: { duration: 0.15 },
};

// ── Section labels ───────────────────────────────────────────────────────────

const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market",
  icpAnalysisValidation: "ICP Analysis",
  offerAnalysisViability: "Offer Analysis",
  competitorAnalysis: "Competitors",
  crossAnalysisSynthesis: "Synthesis",
  keywordIntelligence: "Keywords",
};

// ── Component ────────────────────────────────────────────────────────────────

export interface PaginatedBlueprintViewProps {
  strategicBlueprint: StrategicBlueprintOutput;
}

export function PaginatedBlueprintView({
  strategicBlueprint,
}: PaginatedBlueprintViewProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);
  const [copied, setCopied] = useState(false);

  const { metadata } = strategicBlueprint;
  const sectionCitations = metadata.sectionCitations || {};

  // Filter sections with data
  const availableSections = useMemo(() => {
    return STRATEGIC_BLUEPRINT_SECTION_ORDER.filter((section) => {
      if (section === "keywordIntelligence") {
        return !!strategicBlueprint.keywordIntelligence;
      }
      return true;
    });
  }, [strategicBlueprint.keywordIntelligence]);

  const currentSectionKey = availableSections[currentPage];

  // ── Edit Context ────────────────────────────────────────────────────────

  // Context is null when rendered without a provider (e.g. standalone blueprint
  // pages, shared view pages). All edit-aware features gracefully no-op.
  const editCtx = useOptionalBlueprintEditContext();
  const activeEditTarget = editCtx?.activeEditTarget ?? null;

  // ── Navigate on explicit user request (from chat "View in Blueprint" button) ─

  useEffect(() => {
    if (!editCtx?.navigationRequest) return;

    const { section, fieldPath } = editCtx.navigationRequest;
    const targetSection = section as StrategicBlueprintSection;
    const targetIdx = availableSections.indexOf(targetSection);

    if (targetIdx === -1) {
      editCtx.clearNavigationRequest();
      return;
    }

    if (targetIdx !== currentPage) {
      setDirection(targetIdx > currentPage ? 1 : -1);
      setCurrentPage(targetIdx);

      // Wait for slide animation to settle, then scroll to field
      const timer = setTimeout(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-field-path="${CSS.escape(fieldPath)}"]`
        );
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        editCtx.clearNavigationRequest();
      }, 380);

      return () => clearTimeout(timer);
    }

    // Already on the correct page — just scroll to field
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-field-path="${CSS.escape(fieldPath)}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      editCtx.clearNavigationRequest();
    }, 100);

    return () => clearTimeout(timer);
  }, [editCtx?.navigationRequest?.requestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ─────────────────────────────────────────────────────────

  const goToPage = useCallback(
    (page: number) => {
      if (page < 0 || page >= availableSections.length || page === currentPage)
        return;
      setDirection(page > currentPage ? 1 : -1);
      setCurrentPage(page);
    },
    [currentPage, availableSections.length]
  );

  const goNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [goToPage, currentPage]);

  const goPrev = useCallback(() => {
    goToPage(currentPage - 1);
  }, [goToPage, currentPage]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "j" || event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "k" || event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  // ── Copy ────────────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const markdown = generateBlueprintMarkdown(strategicBlueprint);
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [strategicBlueprint]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === availableSections.length - 1;

  const progressPct =
    availableSections.length > 1
      ? (currentPage / (availableSections.length - 1)) * 100
      : 100;

  // Map sections to their edit indicator state for the tabs
  const sectionEditStates = useMemo<
    Record<string, "pending" | "approved" | null>
  >(() => {
    if (!activeEditTarget) return {};
    return {
      [activeEditTarget.section]:
        activeEditTarget.state === "pending"
          ? "pending"
          : activeEditTarget.state === "approved"
          ? "approved"
          : null,
    };
  }, [activeEditTarget]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top section nav ────────────────────────────────────────────────── */}
      <div className="shrink-0 relative bg-[rgba(12,14,19,0.5)] backdrop-blur-xl border-b border-border">
        {/*
          Scrollable wrapper: allows overflow on small viewports while centering
          tabs horizontally when there is enough room.
        */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-center gap-1 px-6 py-2.5 min-w-max mx-auto">
            {availableSections.map((section, i) => {
              const isActive = i === currentPage;
              const editState = sectionEditStates[section] ?? null;

              return (
                <button
                  key={section}
                  onClick={() => goToPage(i)}
                  className={cn(
                    "relative shrink-0 flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors duration-200",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    isActive
                      ? "text-white/90"
                      : "text-white/40 hover:text-white/60"
                  )}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Go to section ${i + 1}: ${SECTION_LABELS[section]}`}
                >
                  {/* Sliding pill background — Framer Motion layoutId */}
                  {isActive && (
                    <motion.div
                      layoutId="section-tab-bg"
                      className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/[0.08]"
                      transition={springs.snappy}
                    />
                  )}

                  {/* Number badge */}
                  <span
                    className={cn(
                      "relative z-10 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold tabular-nums leading-none transition-colors duration-200",
                      isActive
                        ? "bg-primary/[0.18] text-primary"
                        : "bg-white/[0.06] text-white/30"
                    )}
                  >
                    {i + 1}
                  </span>

                  {/* Label */}
                  <span
                    className={cn(
                      "relative z-10 whitespace-nowrap text-[12px] font-[family-name:var(--font-heading)] font-medium leading-none transition-colors duration-200",
                      isActive ? "text-white/90" : "text-white/40"
                    )}
                  >
                    {SECTION_LABELS[section]}
                  </span>

                  {/* Edit state indicator dot */}
                  {editState === "pending" && (
                    <span
                      className="relative z-10 blueprint-tab-pending-dot"
                      aria-label="Pending edit"
                    />
                  )}
                  {editState === "approved" && (
                    <span
                      className="relative z-10 blueprint-tab-approved-dot"
                      aria-label="Edit applied"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.04]">
          <motion.div
            className="h-full bg-primary/50"
            animate={{ width: `${progressPct}%` }}
            transition={springs.snappy}
          />
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 group">
        {/* Left arrow */}
        {!isFirstPage && (
          <button
            onClick={goPrev}
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 z-10",
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-[rgba(12,14,19,0.7)] backdrop-blur-md",
              "border border-white/[0.08] text-white/60",
              "opacity-0 group-hover:opacity-80 hover:!opacity-100",
              "transition-all duration-200",
              "hover:scale-110 hover:border-primary/30 hover:text-white/90",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            )}
            aria-label="Previous section"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {/* Animated section content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentPage}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="absolute inset-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:var(--border-default)_transparent]"
          >
            <div className="py-4 px-8 max-w-5xl mx-auto">
              <OutputSectionCard
                sectionKey={currentSectionKey}
                sectionData={strategicBlueprint[currentSectionKey]}
                citations={sectionCitations[currentSectionKey]}
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Right arrow */}
        {!isLastPage && (
          <button
            onClick={goNext}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 z-10",
              "flex h-9 w-9 items-center justify-center rounded-full",
              "bg-[rgba(12,14,19,0.7)] backdrop-blur-md",
              "border border-white/[0.08] text-white/60",
              "opacity-0 group-hover:opacity-80 hover:!opacity-100",
              "transition-all duration-200",
              "hover:scale-110 hover:border-primary/30 hover:text-white/90",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            )}
            aria-label="Next section"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Bottom pagination ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border">
        <div className="flex items-center justify-between px-6 py-2.5">
          {/* Left: dots + counter */}
          <div className="flex items-center gap-3">
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-1.5">
                {availableSections.map((section, i) => {
                  const isActive = i === currentPage;
                  const editState = sectionEditStates[section] ?? null;

                  return (
                    <Tooltip key={section}>
                      <TooltipTrigger asChild>
                        <motion.button
                          onClick={() => goToPage(i)}
                          className={cn(
                            "relative flex items-center justify-center rounded-full transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                            isActive
                              ? "bg-primary shadow-[0_0_10px_var(--accent-blue-glow)]"
                              : editState === "pending"
                              ? "bg-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.35)]"
                              : editState === "approved"
                              ? "bg-green-500/60 shadow-[0_0_8px_rgba(34,197,94,0.3)]"
                              : "bg-white/20 hover:bg-white/30"
                          )}
                          animate={{ width: isActive ? 26 : 10, height: 10 }}
                          whileHover={{ scale: 1.15 }}
                          transition={springs.snappy}
                          aria-label={`Go to ${SECTION_LABELS[section]}`}
                          aria-current={isActive ? "step" : undefined}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {SECTION_LABELS[section]}
                        {editState === "pending" && " — pending edit"}
                        {editState === "approved" && " — edit applied"}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>

            <span className="text-xs tabular-nums text-white/40 font-[family-name:var(--font-mono)]">
              {currentPage + 1} of {availableSections.length}
            </span>
          </div>

          {/* Right: copy button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-lg border transition-all duration-200",
                    "font-[family-name:var(--font-sans)]",
                    copied
                      ? "text-green-400 border-green-500/30"
                      : "text-white/50 border-white/[0.08] hover:border-primary/30 hover:text-white/70"
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
        </div>
      </div>
    </div>
  );
}
