"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { CheckCheck, RotateCcw, ArrowRight, Undo2, Redo2, DollarSign } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionNav } from "./section-nav";
import { DocumentSection } from "./document-section";
import { ReadingProgress } from "./reading-progress";
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

export interface BlueprintDocumentProps {
  strategicBlueprint: StrategicBlueprintOutput;
  onApprove: (approvedBlueprint: StrategicBlueprintOutput) => void;
  onRegenerate: () => void;
  onEdit?: (sectionKey: string, fieldPath: string, newValue: unknown) => void;
}

export function BlueprintDocument({
  strategicBlueprint,
  onApprove,
  onRegenerate,
  onEdit,
}: BlueprintDocumentProps) {
  // Active section for navigation highlighting
  const [activeSection, setActiveSection] = useState<StrategicBlueprintSection>("industryMarketOverview");
  const containerRef = useRef<HTMLDivElement>(null);

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

  const canUndo = editHistory.length > 0;
  const canRedo = futureEdits.length > 0;
  const allReviewed = reviewedSections.size === STRATEGIC_BLUEPRINT_SECTION_ORDER.length;

  // Intersection Observer to track active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as StrategicBlueprintSection);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    const sections = containerRef.current?.querySelectorAll("[data-section]");
    sections?.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const handleMarkReviewed = useCallback((sectionKey: StrategicBlueprintSection) => {
    setReviewedSections((prev) => {
      const next = new Set(prev);
      next.add(sectionKey);
      return next;
    });

    // Auto-scroll to next unreviewed section
    const currentIndex = STRATEGIC_BLUEPRINT_SECTION_ORDER.indexOf(sectionKey);
    const nextUnreviewed = STRATEGIC_BLUEPRINT_SECTION_ORDER.find((section, index) => {
      return index > currentIndex && !reviewedSections.has(section) && section !== sectionKey;
    });

    if (nextUnreviewed) {
      setTimeout(() => {
        document.getElementById(nextUnreviewed)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [reviewedSections]);

  const handleApproveAll = useCallback(() => {
    // Save current state before approving all (for undo)
    setPreApproveAllState(new Set(reviewedSections));
    setReviewedSections(new Set(STRATEGIC_BLUEPRINT_SECTION_ORDER));
  }, [reviewedSections]);

  // Undo the "Approve All" action
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

  // Keyboard shortcuts for undo/redo and navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Undo/Redo
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "z" && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
        } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
          event.preventDefault();
          handleRedo();
        }
      }

      // Navigation: j/k to move between sections
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const currentIndex = STRATEGIC_BLUEPRINT_SECTION_ORDER.indexOf(activeSection);
        const lastIndex = STRATEGIC_BLUEPRINT_SECTION_ORDER.length - 1;
        if (event.key === "j" && currentIndex < lastIndex) {
          event.preventDefault();
          const nextSection = STRATEGIC_BLUEPRINT_SECTION_ORDER[currentIndex + 1];
          document.getElementById(nextSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (event.key === "k" && currentIndex > 0) {
          event.preventDefault();
          const prevSection = STRATEGIC_BLUEPRINT_SECTION_ORDER[currentIndex - 1];
          document.getElementById(prevSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeSection, handleUndo, handleRedo]);

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

  return (
    <>
      {/* Reading progress bar */}
      <ReadingProgress />

      <div className="flex gap-8" style={{ background: 'var(--bg-base)' }}>
        {/* Main document content */}
        <div ref={containerRef} className="flex-1 max-w-4xl min-w-0">
          {/* Header */}
          <div className="mb-8 pb-6 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <h1
              className="text-3xl font-bold mb-2"
              style={{
                color: 'var(--text-heading)',
                fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              Strategic Research Blueprint
            </h1>
            <p
              className="text-base"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans), Inter, sans-serif',
                lineHeight: '1.6',
              }}
            >
              Review each section below. Use <kbd className="px-1.5 py-0.5 text-xs rounded border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>j</kbd> / <kbd className="px-1.5 py-0.5 text-xs rounded border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>k</kbd> to navigate between sections.
            </p>
            {strategicBlueprint.metadata.totalCost > 0 && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 text-sm"
                style={{
                  color: 'var(--text-tertiary)',
                  fontFamily: 'var(--font-sans), Inter, sans-serif',
                }}
              >
                <DollarSign className="h-4 w-4" />
                Generation cost: ${strategicBlueprint.metadata.totalCost.toFixed(4)}
              </div>
            )}
          </div>

          {/* All sections - continuous scroll, no collapse */}
          {STRATEGIC_BLUEPRINT_SECTION_ORDER.map((sectionKey) => (
            <DocumentSection
              key={sectionKey}
              sectionKey={sectionKey}
              sectionData={getMergedSectionData(sectionKey)}
              isReviewed={reviewedSections.has(sectionKey)}
              isEditing={editingSection === sectionKey}
              hasEdits={sectionHasEdits(sectionKey)}
              citations={strategicBlueprint.metadata.sectionCitations?.[sectionKey] || []}
              onMarkReviewed={() => handleMarkReviewed(sectionKey)}
              onToggleEdit={() => handleToggleEdit(sectionKey)}
              onFieldChange={(fieldPath, newValue) => handleFieldChange(sectionKey, fieldPath, newValue)}
            />
          ))}
        </div>

        {/* Sticky navigation sidebar */}
        <div className="w-56 shrink-0">
          <SectionNav
            activeSection={activeSection}
            reviewedSections={reviewedSections}
          />
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div
          className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm border"
          style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--border-default)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            {allReviewed ? (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-sans), Inter, sans-serif' }}>Done</span>
              </span>
            ) : (
              <span className="text-sm" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans), Inter, sans-serif' }}>
                <span className="font-medium" style={{ color: 'var(--accent-blue)' }}>{reviewedSections.size}</span>
                <span className="mx-0.5">/</span>
                <span>5</span>
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="h-5 w-px" style={{ background: 'var(--border-default)' }} />

          {/* Undo/Redo */}
          {(canUndo || canRedo) && (
            <>
              <TooltipProvider delayDuration={300}>
                <div className="flex items-center gap-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8 rounded-lg transition-all duration-200",
                          !canUndo && "opacity-40 cursor-not-allowed"
                        )}
                        style={{
                          color: canUndo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        }}
                        onClick={handleUndo}
                        disabled={!canUndo}
                      >
                        <Undo2 className="h-4 w-4" />
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
                          "h-8 w-8 rounded-lg transition-all duration-200",
                          !canRedo && "opacity-40 cursor-not-allowed"
                        )}
                        style={{
                          color: canRedo ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                        }}
                        onClick={handleRedo}
                        disabled={!canRedo}
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Redo (Ctrl+Shift+Z)</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
              <div className="h-5 w-px" style={{ background: 'var(--border-default)' }} />
            </>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {!allReviewed && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-full border transition-all duration-200 hover:border-[var(--accent-blue)]"
                      style={{
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border-default)',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                      onClick={handleApproveAll}
                    >
                      <CheckCheck className="h-4 w-4" />
                      <span className="hidden sm:inline">Approve All</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Mark all sections as reviewed</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {allReviewed && preApproveAllState !== null && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 rounded-full border transition-all duration-200 hover:border-[var(--accent-blue)]"
                      style={{
                        color: 'var(--text-secondary)',
                        borderColor: 'var(--border-default)',
                        fontFamily: 'var(--font-sans), Inter, sans-serif',
                      }}
                      onClick={handleUndoApproveAll}
                    >
                      <Undo2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Undo</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Undo Approve All</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-full border transition-all duration-200 hover:border-[var(--accent-blue)]"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-default)',
                fontFamily: 'var(--font-sans), Inter, sans-serif',
              }}
              onClick={onRegenerate}
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Regenerate</span>
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={!allReviewed}
              className={cn(
                "h-8 gap-1.5 px-5 rounded-full transition-all duration-200",
                !allReviewed && "opacity-50 cursor-not-allowed"
              )}
              style={{
                background: allReviewed ? 'var(--gradient-primary)' : 'var(--bg-elevated)',
                color: allReviewed ? 'white' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                fontWeight: 500,
                border: 'none',
                padding: '12px 20px',
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
          </div>
        </div>
      </div>
    </>
  );
}
