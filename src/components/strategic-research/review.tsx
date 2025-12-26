"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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

export interface StrategicResearchReviewProps {
  strategicBlueprint: StrategicBlueprintOutput;
  onComplete: () => void;
  onRegenerate: () => void;
}

export function StrategicResearchReview({
  strategicBlueprint,
  onComplete,
  onRegenerate,
}: StrategicResearchReviewProps) {
  // Track which sections are expanded (allow multiple)
  const [expandedSections, setExpandedSections] = useState<Set<StrategicBlueprintSection>>(
    new Set(["industryMarketOverview"]) // First section expanded by default
  );

  // Track which sections have been reviewed
  const [reviewedSections, setReviewedSections] = useState<Set<StrategicBlueprintSection>>(
    new Set()
  );

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
              sectionData={strategicBlueprint[sectionKey]}
              isExpanded={expandedSections.has(sectionKey)}
              isReviewed={reviewedSections.has(sectionKey)}
              onToggleExpand={() => handleToggleExpand(sectionKey)}
              onMarkReviewed={() => handleMarkReviewed(sectionKey)}
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
                onClick={onComplete}
                disabled={!allReviewed}
                className="gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
