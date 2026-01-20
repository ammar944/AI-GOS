"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { CheckCircle2, CheckCheck, RotateCcw, ArrowRight, Undo2, Redo2, DollarSign } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "./section-card";
import type {
  StrategicBlueprintOutput,
  StrategicBlueprintSection,
  Citation,
} from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { createApprovedBlueprint } from "@/lib/strategic-blueprint/approval";

export interface StrategicResearchReviewProps {
  strategicBlueprint: StrategicBlueprintOutput;
  onApprove: (approvedBlueprint: StrategicBlueprintOutput) => void;
  onRegenerate: () => void;
  onEdit?: (sectionKey: string, fieldPath: string, newValue: unknown) => void;
}

// Helper to deep-merge edits at a field path into an object
function setFieldAtPath(obj: unknown, path: string, value: unknown): unknown {
  const parts = path.split(".");
  if (parts.length === 0) return value;

  // Clone the object
  const result: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];

    // Check if next key is a number (array index)
    if (/^\d+$/.test(nextKey)) {
      // Current is an array
      const arr = Array.isArray(current[key]) ? [...(current[key] as unknown[])] : [];
      current[key] = arr;
      current = arr as unknown as Record<string, unknown>;
    } else {
      // Current is an object
      current[key] = { ...(current[key] as Record<string, unknown>) };
      current = current[key] as Record<string, unknown>;
    }
  }

  const lastKey = parts[parts.length - 1];
  current[lastKey] = value;

  return result;
}

export function StrategicResearchReview({
  strategicBlueprint,
  onApprove,
  onRegenerate,
  onEdit,
}: StrategicResearchReviewProps) {
  // Track which sections are expanded (allow multiple)
  const [expandedSections, setExpandedSections] = useState<Set<StrategicBlueprintSection>>(
    new Set(["industryMarketOverview"]) // First section expanded by default
  );

  // Track which sections have been reviewed
  const [reviewedSections, setReviewedSections] = useState<Set<StrategicBlueprintSection>>(
    new Set()
  );

  // Track which section is currently being edited (only one at a time)
  const [editingSection, setEditingSection] = useState<StrategicBlueprintSection | null>(null);

  // Track pending edits per section: { sectionKey: { fieldPath: newValue, ... } }
  const [pendingEdits, setPendingEdits] = useState<Record<string, Record<string, unknown>>>({});

  // Undo/Redo history
  const [editHistory, setEditHistory] = useState<Record<string, Record<string, unknown>>[]>([]);
  const [futureEdits, setFutureEdits] = useState<Record<string, Record<string, unknown>>[]>([]);

  // Track previous state before "Approve All" for undo
  const [preApproveAllState, setPreApproveAllState] = useState<Set<StrategicBlueprintSection> | null>(null);

  // Track if we can undo/redo
  const canUndo = editHistory.length > 0;
  const canRedo = futureEdits.length > 0;

  // Refs for scrolling to next section
  const sectionRefs = useRef<Map<StrategicBlueprintSection, HTMLDivElement | null>>(new Map());

  const allReviewed = reviewedSections.size === 5;
  const reviewProgress = (reviewedSections.size / 5) * 100;

  const handleToggleExpand = useCallback((sectionKey: StrategicBlueprintSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }, []);

  const handleMarkReviewed = useCallback((sectionKey: StrategicBlueprintSection) => {
    setReviewedSections((prev) => {
      const next = new Set(prev);
      next.add(sectionKey);
      return next;
    });

    // Find and scroll to next unreviewed section
    const currentIndex = STRATEGIC_BLUEPRINT_SECTION_ORDER.indexOf(sectionKey);
    const nextUnreviewed = STRATEGIC_BLUEPRINT_SECTION_ORDER.find((section, index) => {
      return index > currentIndex && !reviewedSections.has(section) && section !== sectionKey;
    });

    if (nextUnreviewed) {
      // Expand the next section
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.add(nextUnreviewed);
        return next;
      });

      // Scroll to it after a brief delay to allow expansion
      setTimeout(() => {
        const element = sectionRefs.current.get(nextUnreviewed);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [reviewedSections]);

  // Approve all sections at once
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

  // Set ref for a section
  const setSectionRef = useCallback((sectionKey: StrategicBlueprintSection, element: HTMLDivElement | null) => {
    sectionRefs.current.set(sectionKey, element);
  }, []);

  // Toggle edit mode for a section
  const handleToggleEdit = useCallback((sectionKey: StrategicBlueprintSection) => {
    setEditingSection((prev) => (prev === sectionKey ? null : sectionKey));
  }, []);

  // Handle field change within a section
  const handleFieldChange = useCallback(
    (sectionKey: StrategicBlueprintSection, fieldPath: string, newValue: unknown) => {
      // Save current state to history before making the change
      setPendingEdits((prev) => {
        // Push current state to history
        setEditHistory((history) => [...history, prev]);
        // Clear future edits (new change invalidates redo stack)
        setFutureEdits([]);

        return {
          ...prev,
          [sectionKey]: {
            ...(prev[sectionKey] || {}),
            [fieldPath]: newValue,
          },
        };
      });

      // Notify parent if callback provided
      if (onEdit) {
        onEdit(sectionKey, fieldPath, newValue);
      }
    },
    [onEdit]
  );

  // Undo the last edit
  const handleUndo = useCallback(() => {
    if (!canUndo) return;

    setEditHistory((history) => {
      const newHistory = [...history];
      const previousState = newHistory.pop();

      if (previousState !== undefined) {
        // Push current state to future for redo
        setFutureEdits((future) => [...future, pendingEdits]);
        // Restore previous state
        setPendingEdits(previousState);
      }

      return newHistory;
    });
  }, [canUndo, pendingEdits]);

  // Redo the last undone edit
  const handleRedo = useCallback(() => {
    if (!canRedo) return;

    setFutureEdits((future) => {
      const newFuture = [...future];
      const nextState = newFuture.pop();

      if (nextState !== undefined) {
        // Push current state to history for undo
        setEditHistory((history) => [...history, pendingEdits]);
        // Restore next state
        setPendingEdits(nextState);
      }

      return newFuture;
    });
  }, [canRedo, pendingEdits]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Z (undo) or Ctrl+Shift+Z / Ctrl+Y (redo)
      if (event.ctrlKey || event.metaKey) {
        if (event.key === "z" && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
        } else if ((event.key === "z" && event.shiftKey) || event.key === "y") {
          event.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Check if a section has pending edits
  const sectionHasEdits = useCallback(
    (sectionKey: StrategicBlueprintSection): boolean => {
      const sectionEdits = pendingEdits[sectionKey];
      return sectionEdits ? Object.keys(sectionEdits).length > 0 : false;
    },
    [pendingEdits]
  );

  // Get merged section data (original + pending edits)
  const getMergedSectionData = useMemo(() => {
    return (sectionKey: StrategicBlueprintSection): unknown => {
      const originalData = strategicBlueprint[sectionKey] as unknown;
      const sectionEdits = pendingEdits[sectionKey];

      if (!sectionEdits || Object.keys(sectionEdits).length === 0) {
        return originalData;
      }

      // Apply each edit to the original data
      let mergedData: unknown = originalData;
      for (const [fieldPath, newValue] of Object.entries(sectionEdits)) {
        mergedData = setFieldAtPath(mergedData, fieldPath, newValue);
      }

      return mergedData;
    };
  }, [strategicBlueprint, pendingEdits]);

  // Check if there are any pending edits across all sections
  const hasPendingEdits = useMemo(() => {
    return Object.values(pendingEdits).some(
      (sectionEdits) => sectionEdits && Object.keys(sectionEdits).length > 0
    );
  }, [pendingEdits]);

  // Handle approval - merge edits and call onApprove
  const handleApprove = useCallback(() => {
    const approvedBlueprint = createApprovedBlueprint(strategicBlueprint, pendingEdits);
    onApprove(approvedBlueprint);
  }, [strategicBlueprint, pendingEdits, onApprove]);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--accent-blue)',
          borderWidth: '1px',
        }}
        className="shadow-[0_0_30px_rgba(54,94,255,0.15)]"
      >
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2
                className="text-2xl font-bold tracking-tight"
                style={{
                  fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                  letterSpacing: '-0.02em',
                  color: 'var(--text-heading)'
                }}
              >
                Review Your Strategic Research
              </h2>
              <p className="mt-1" style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-sans), Inter, sans-serif' }}>
                Review each section before continuing. You&apos;ll be able to edit specific details in the next step.
              </p>
            </div>

            <div className="flex items-center gap-6">
              {/* Generation cost - only show if > 0 */}
              {strategicBlueprint.metadata.totalCost > 0 && (
                <div className="text-right">
                  <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Generation Cost</div>
                  <div
                    className="text-lg font-semibold flex items-center justify-end gap-1"
                    style={{
                      fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                      color: 'var(--text-heading)'
                    }}
                  >
                    <DollarSign className="h-4 w-4" />
                    {strategicBlueprint.metadata.totalCost.toFixed(4)}
                  </div>
                </div>
              )}
              <div className="text-right">
                <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Progress</div>
                <div
                  className="text-lg font-semibold"
                  style={{
                    fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
                  }}
                >
                  <span style={{ color: 'var(--accent-blue)' }}>{reviewedSections.size}</span>
                  <span style={{ color: 'var(--text-heading)' }}> of 5 reviewed</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div
              className="relative h-2 w-full overflow-hidden rounded-full"
              style={{ background: 'var(--border-subtle)' }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${reviewProgress}%`,
                  background: 'var(--gradient-primary)',
                  boxShadow: '0 0 10px rgba(54, 94, 255, 0.4)',
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Cards */}
      <div className="space-y-4">
        {STRATEGIC_BLUEPRINT_SECTION_ORDER.map((sectionKey) => (
          <div
            key={sectionKey}
            ref={(el) => setSectionRef(sectionKey, el)}
          >
            <SectionCard
              sectionKey={sectionKey}
              sectionData={getMergedSectionData(sectionKey)}
              isExpanded={expandedSections.has(sectionKey)}
              isReviewed={reviewedSections.has(sectionKey)}
              isEditing={editingSection === sectionKey}
              hasEdits={sectionHasEdits(sectionKey)}
              citations={strategicBlueprint.metadata.sectionCitations?.[sectionKey] || []}
              onToggleExpand={() => handleToggleExpand(sectionKey)}
              onMarkReviewed={() => handleMarkReviewed(sectionKey)}
              onToggleEdit={() => handleToggleEdit(sectionKey)}
              onFieldChange={(fieldPath, newValue) => handleFieldChange(sectionKey, fieldPath, newValue)}
            />
          </div>
        ))}
      </div>

      {/* Floating Action Bar - centered on mobile, right-aligned on desktop */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 pb-[env(safe-area-inset-bottom)]">
        <Card
          className="shadow-xl backdrop-blur-sm"
          style={{
            background: 'rgba(12, 14, 19, 0.95)',
            borderColor: 'var(--border-default)',
          }}
        >
          <CardContent className="p-2 sm:p-3">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Compact progress indicator */}
              <div className="flex items-center gap-2">
                {allReviewed ? (
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Done</span>
                  </span>
                ) : (
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <span
                      className="font-medium"
                      style={{
                        color: 'var(--accent-blue)',
                        fontFamily: 'var(--font-mono), "JetBrains Mono", monospace'
                      }}
                    >
                      {reviewedSections.size}
                    </span>
                    <span className="mx-0.5">/</span>
                    <span>5</span>
                  </span>
                )}
              </div>

              {/* Divider */}
              <div className="h-6 w-px" style={{ background: 'var(--border-default)' }} />

              {/* Undo/Redo buttons - only show when there's history */}
              {(canUndo || canRedo) && (
                <TooltipProvider delayDuration={300}>
                  <div className="flex items-center gap-0.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-[var(--bg-hover)]"
                          onClick={handleUndo}
                          disabled={!canUndo}
                          style={{ color: canUndo ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
                        >
                          <Undo2 className="h-4 w-4" />
                          <span className="sr-only">Undo (Ctrl+Z)</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Undo (Ctrl+Z)</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-[var(--bg-hover)]"
                          onClick={handleRedo}
                          disabled={!canRedo}
                          style={{ color: canRedo ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
                        >
                          <Redo2 className="h-4 w-4" />
                          <span className="sr-only">Redo (Ctrl+Shift+Z)</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Redo (Ctrl+Shift+Z)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}

              {/* Divider before main actions (only when undo/redo visible) */}
              {(canUndo || canRedo) && <div className="h-6 w-px" style={{ background: 'var(--border-default)' }} />}

              {/* Action buttons - larger touch targets on mobile */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {!allReviewed && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-8 sm:w-auto sm:px-3 hover:bg-[var(--bg-hover)]"
                          onClick={handleApproveAll}
                          style={{
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif'
                          }}
                        >
                          <CheckCheck className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-2">Approve All</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Mark all sections as reviewed</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {allReviewed && preApproveAllState !== null && (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 sm:h-8 sm:w-auto sm:px-3 hover:bg-[var(--bg-hover)]"
                          onClick={handleUndoApproveAll}
                          style={{
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif'
                          }}
                        >
                          <Undo2 className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only sm:ml-2">Undo</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Undo Approve All</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:h-8 sm:w-auto sm:px-3 hover:bg-[var(--bg-hover)]"
                  onClick={onRegenerate}
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif'
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-2">Regenerate</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={!allReviewed}
                  className="h-9 sm:h-8 gap-1.5 rounded-full shadow-[0_0_20px_rgba(54,94,255,0.3)]"
                  style={{
                    background: allReviewed
                      ? 'var(--gradient-primary)'
                      : 'var(--bg-hover)',
                    borderColor: 'transparent',
                    color: allReviewed ? 'white' : 'var(--text-tertiary)',
                    fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                    fontWeight: 500,
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
