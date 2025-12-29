"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { CheckCircle2, RotateCcw, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "./section-card";
import type {
  StrategicBlueprintOutput,
  StrategicBlueprintSection,
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
      setPendingEdits((prev) => ({
        ...prev,
        [sectionKey]: {
          ...(prev[sectionKey] || {}),
          [fieldPath]: newValue,
        },
      }));

      // Notify parent if callback provided
      if (onEdit) {
        onEdit(sectionKey, fieldPath, newValue);
      }
    },
    [onEdit]
  );

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
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Review Your Strategic Research</h2>
              <p className="text-muted-foreground mt-1">
                Review each section before continuing. You&apos;ll be able to edit specific details in the next step.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Progress</div>
                <div className="text-lg font-semibold">
                  {reviewedSections.size} of 5 reviewed
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <Progress value={reviewProgress} className="h-2" />
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
              onToggleExpand={() => handleToggleExpand(sectionKey)}
              onMarkReviewed={() => handleMarkReviewed(sectionKey)}
              onToggleEdit={() => handleToggleEdit(sectionKey)}
              onFieldChange={(fieldPath, newValue) => handleFieldChange(sectionKey, fieldPath, newValue)}
            />
          </div>
        ))}
      </div>

      {/* Action Bar */}
      <Card className="sticky bottom-4 border-2 shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {allReviewed ? (
                <span className="flex items-center gap-2 text-green-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  All sections reviewed
                </span>
              ) : (
                `Review all ${5 - reviewedSections.size} remaining section${5 - reviewedSections.size === 1 ? "" : "s"} to continue`
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={onRegenerate}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Regenerate
              </Button>
              <Button
                onClick={handleApprove}
                disabled={!allReviewed}
                className="gap-2"
              >
                {hasPendingEdits ? "Approve & Continue" : "Continue"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
