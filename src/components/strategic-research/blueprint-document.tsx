"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";
import { generateBlueprintMarkdown } from "@/lib/strategic-blueprint/markdown-generator";
import { DocumentSection } from "./document-section";
import { SectionPaginationNav } from "./section-pagination-nav";
import { SectionProgressBar } from "./section-progress-bar";
import type {
  StrategicBlueprintOutput,
  StrategicBlueprintSection,
} from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { createApprovedBlueprint } from "@/lib/strategic-blueprint/approval";

// Helper to deep-merge edits at a field path into an object
function setFieldAtPath(obj: unknown, path: string, value: unknown): unknown {
  const parts = path.split(".");
  if (parts.length === 0) return value;

  const result: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];

    if (/^\d+$/.test(nextKey)) {
      const arr = Array.isArray(current[key]) ? [...(current[key] as unknown[])] : [];
      current[key] = arr;
      current = arr as unknown as Record<string, unknown>;
    } else {
      current[key] = { ...(current[key] as Record<string, unknown>) };
      current = current[key] as Record<string, unknown>;
    }
  }

  const lastKey = parts[parts.length - 1];
  current[lastKey] = value;

  return result;
}

// Slide + fade — subtle, fast, directional
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

export interface BlueprintDocumentProps {
  strategicBlueprint: StrategicBlueprintOutput;
  onApprove: (approvedBlueprint: StrategicBlueprintOutput) => void;
  onEdit?: (sectionKey: string, fieldPath: string, newValue: unknown) => void;
}

export function BlueprintDocument({
  strategicBlueprint,
  onApprove,
  onEdit,
}: BlueprintDocumentProps) {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0);

  // Track which sections have been reviewed
  const [reviewedSections, setReviewedSections] = useState<Set<StrategicBlueprintSection>>(new Set());

  // Track which section is currently being edited (only one at a time)
  const [editingSection, setEditingSection] = useState<StrategicBlueprintSection | null>(null);

  // Track pending edits per section
  const [pendingEdits, setPendingEdits] = useState<Record<string, Record<string, unknown>>>({});

  // Undo/Redo history
  const [editHistory, setEditHistory] = useState<Record<string, Record<string, unknown>>[]>([]);
  const [futureEdits, setFutureEdits] = useState<Record<string, Record<string, unknown>>[]>([]);

  // Track previous state before "Approve All" for undo
  const [preApproveAllState, setPreApproveAllState] = useState<Set<StrategicBlueprintSection> | null>(null);

  // Filter out sections with no data (e.g. keywordIntelligence when absent)
  const availableSections = useMemo(() => {
    return STRATEGIC_BLUEPRINT_SECTION_ORDER.filter((section) => {
      if (section === "keywordIntelligence") {
        return !!strategicBlueprint.keywordIntelligence;
      }
      return true;
    });
  }, [strategicBlueprint.keywordIntelligence]);

  const canUndo = editHistory.length > 0;
  const canRedo = futureEdits.length > 0;
  const allReviewed = availableSections.every((s) => reviewedSections.has(s));

  const currentSectionKey = availableSections[currentPage];

  // Navigation helpers
  const goToPage = useCallback(
    (page: number) => {
      if (page < 0 || page >= availableSections.length || page === currentPage) return;
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

  // Auto-close editing when changing pages
  useEffect(() => {
    setEditingSection(null);
  }, [currentPage]);

  const handleMarkReviewed = useCallback(
    (sectionKey: StrategicBlueprintSection) => {
      setReviewedSections((prev) => {
        const next = new Set(prev);
        next.add(sectionKey);
        return next;
      });

      // Auto-advance to next page after brief delay
      const currentIndex = availableSections.indexOf(sectionKey);
      if (currentIndex < availableSections.length - 1) {
        setTimeout(() => {
          goToPage(currentIndex + 1);
        }, 300);
      }
    },
    [availableSections, goToPage]
  );

  const handleApproveAll = useCallback(() => {
    setPreApproveAllState(new Set(reviewedSections));
    setReviewedSections(new Set(availableSections));
  }, [reviewedSections, availableSections]);

  const handleUndoApproveAll = useCallback(() => {
    if (preApproveAllState !== null) {
      setReviewedSections(preApproveAllState);
      setPreApproveAllState(null);
    }
  }, [preApproveAllState]);

  const handleToggleEdit = useCallback((sectionKey: StrategicBlueprintSection) => {
    setEditingSection((prev) => (prev === sectionKey ? null : sectionKey));
  }, []);

  const handleFieldChange = useCallback(
    (sectionKey: StrategicBlueprintSection, fieldPath: string, newValue: unknown) => {
      setPendingEdits((prev) => {
        setEditHistory((history) => [...history, prev]);
        setFutureEdits([]);

        return {
          ...prev,
          [sectionKey]: {
            ...(prev[sectionKey] || {}),
            [fieldPath]: newValue,
          },
        };
      });

      if (onEdit) {
        onEdit(sectionKey, fieldPath, newValue);
      }
    },
    [onEdit]
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) return;

    setEditHistory((history) => {
      const newHistory = [...history];
      const previousState = newHistory.pop();

      if (previousState !== undefined) {
        setFutureEdits((future) => [...future, pendingEdits]);
        setPendingEdits(previousState);
      }

      return newHistory;
    });
  }, [canUndo, pendingEdits]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;

    setFutureEdits((future) => {
      const newFuture = [...future];
      const nextState = newFuture.pop();

      if (nextState !== undefined) {
        setEditHistory((history) => [...history, pendingEdits]);
        setPendingEdits(nextState);
      }

      return newFuture;
    });
  }, [canRedo, pendingEdits]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Undo/Redo
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "z" && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
        } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
          event.preventDefault();
          handleRedo();
        }
        return;
      }

      // Navigation: j/k/ArrowRight/ArrowLeft
      if (!event.altKey) {
        if (event.key === "j" || event.key === "ArrowRight") {
          event.preventDefault();
          goNext();
        } else if (event.key === "k" || event.key === "ArrowLeft") {
          event.preventDefault();
          goPrev();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, goNext, goPrev]);

  const sectionHasEdits = useCallback(
    (sectionKey: StrategicBlueprintSection): boolean => {
      const sectionEdits = pendingEdits[sectionKey];
      return sectionEdits ? Object.keys(sectionEdits).length > 0 : false;
    },
    [pendingEdits]
  );

  const getMergedSectionData = useMemo(() => {
    return (sectionKey: StrategicBlueprintSection): unknown => {
      const originalData = strategicBlueprint[sectionKey] as unknown;
      const sectionEdits = pendingEdits[sectionKey];

      if (!sectionEdits || Object.keys(sectionEdits).length === 0) {
        return originalData;
      }

      let mergedData: unknown = originalData;
      for (const [fieldPath, newValue] of Object.entries(sectionEdits)) {
        mergedData = setFieldAtPath(mergedData, fieldPath, newValue);
      }

      return mergedData;
    };
  }, [strategicBlueprint, pendingEdits]);

  const hasPendingEdits = useMemo(() => {
    return Object.values(pendingEdits).some(
      (sectionEdits) => sectionEdits && Object.keys(sectionEdits).length > 0
    );
  }, [pendingEdits]);

  const handleApprove = useCallback(() => {
    const approvedBlueprint = createApprovedBlueprint(strategicBlueprint, pendingEdits);
    onApprove(approvedBlueprint);
  }, [strategicBlueprint, pendingEdits, onApprove]);

  const handleCopy = useCallback(() => {
    const markdown = generateBlueprintMarkdown(strategicBlueprint);
    navigator.clipboard.writeText(markdown);
  }, [strategicBlueprint]);

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === availableSections.length - 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top progress bar — lightweight inline */}
      <div className="shrink-0 px-6 pt-3 pb-2">
        <SectionProgressBar
          sections={availableSections}
          currentPage={currentPage}
          reviewedCount={reviewedSections.size}
        />
      </div>

      {/* Content area — full width */}
      <div className="relative flex-1 min-h-0 group">
          {/* Left arrow */}
          {!isFirstPage && (
            <button
              onClick={goPrev}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 z-10",
                "flex h-9 w-9 items-center justify-center rounded-full",
                "bg-[var(--bg-surface)] text-[var(--text-tertiary)]",
                "opacity-0 group-hover:opacity-80 hover:!opacity-100",
                "transition-all duration-200",
                "hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
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
              className="absolute inset-0 overflow-y-auto overflow-x-hidden"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "var(--border-default) transparent",
              }}
            >
              <div className="py-4 px-8">
                <DocumentSection
                  sectionKey={currentSectionKey}
                  sectionData={getMergedSectionData(currentSectionKey)}
                  isReviewed={reviewedSections.has(currentSectionKey)}
                  isEditing={editingSection === currentSectionKey}
                  hasEdits={sectionHasEdits(currentSectionKey)}
                  citations={strategicBlueprint.metadata.sectionCitations?.[currentSectionKey] || []}
                  onMarkReviewed={() => handleMarkReviewed(currentSectionKey)}
                  onToggleEdit={() => handleToggleEdit(currentSectionKey)}
                  onFieldChange={(fieldPath, newValue) =>
                    handleFieldChange(currentSectionKey, fieldPath, newValue)
                  }
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
                "bg-[var(--bg-surface)] text-[var(--text-tertiary)]",
                "opacity-0 group-hover:opacity-80 hover:!opacity-100",
                "transition-all duration-200",
                "hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
              )}
              aria-label="Next section"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
      </div>

      {/* Bottom pagination + actions */}
      <div
        className="shrink-0 border-t border-[var(--border-subtle)]"
      >
        <SectionPaginationNav
          sections={availableSections}
          currentPage={currentPage}
          reviewedSections={reviewedSections}
          onGoToPage={goToPage}
          allReviewed={allReviewed}
          canUndo={canUndo}
          canRedo={canRedo}
          hasPendingEdits={hasPendingEdits}
          preApproveAllState={preApproveAllState}
          onApproveAll={handleApproveAll}
          onUndoApproveAll={handleUndoApproveAll}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onApprove={handleApprove}
          onCopy={handleCopy}
        />
      </div>
    </div>
  );
}
