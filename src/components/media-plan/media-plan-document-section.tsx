"use client";

import { CheckCircle2, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaPlanSectionKey } from "@/lib/media-plan/section-constants";
import { MEDIA_PLAN_SECTION_ORDER, MEDIA_PLAN_SECTION_LABELS } from "@/lib/media-plan/section-constants";
import { MediaPlanSectionContent } from "./section-content";
import { RESEARCH_SHELL_CLASS } from "@/components/strategic-research/ui-tokens";
import type { MediaPlanOutput } from "@/lib/media-plan/types";

export interface MediaPlanDocumentSectionProps {
  sectionKey: MediaPlanSectionKey;
  mediaPlan: MediaPlanOutput;
  isReviewed: boolean;
  isEditing: boolean;
  hasEdits: boolean;
  onMarkReviewed: () => void;
  onToggleEdit: () => void;
  onFieldChange: (fieldPath: string, newValue: unknown) => void;
}

export function MediaPlanDocumentSection({
  sectionKey,
  mediaPlan,
  isReviewed,
  isEditing,
  hasEdits,
  onMarkReviewed,
  onToggleEdit,
  onFieldChange,
}: MediaPlanDocumentSectionProps) {
  const sectionNumber = MEDIA_PLAN_SECTION_ORDER.indexOf(sectionKey) + 1;
  const sectionLabel = MEDIA_PLAN_SECTION_LABELS[sectionKey];

  return (
    <section
      id={sectionKey}
      data-section
      className={cn(
        "rounded-xl",
        RESEARCH_SHELL_CLASS,
        "p-5"
      )}
    >
      {/* Section Header */}
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-4">
          {/* Section number - cyan for active, green for reviewed */}
          <span
            className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium")}
            style={
              isReviewed
                ? {
                    background: 'var(--success-subtle)',
                    color: 'var(--success)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                  }
                : {
                    background: 'var(--accent-blue)',
                    color: 'white',
                  }
            }
          >
            {isReviewed ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              sectionNumber
            )}
          </span>

          {/* Section title */}
          <div>
            <h2
              className="text-xl font-semibold leading-tight"
              style={{
                color: 'var(--text-heading)',
                fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              {sectionLabel}
            </h2>
            {/* Status indicators */}
            <div className="flex items-center gap-3 mt-1">
              {hasEdits && (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-sans), Inter, sans-serif',
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  Modified
                </span>
              )}
              {isReviewed && (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{
                    color: 'var(--success)',
                    fontFamily: 'var(--font-sans), Inter, sans-serif',
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Reviewed
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions - right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Edit button */}
          <Button
            variant={isEditing ? "default" : "ghost"}
            size="sm"
            onClick={onToggleEdit}
            className={cn(
              "gap-1.5 rounded-full border px-3 text-sm transition-colors duration-200",
              isEditing
                ? "border-transparent shadow-[0_0_15px_rgba(54,94,255,0.2)]"
                : "border-[var(--border-default)] text-[var(--text-tertiary)] hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
            )}
            style={isEditing ? {
              background: 'var(--gradient-primary)',
              color: 'white',
            } : undefined}
          >
            {isEditing ? (
              <>
                <Check className="h-4 w-4" />
                Done
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                Edit
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Section Content - always visible */}
      <div className="mt-3">
        <MediaPlanSectionContent
          sectionKey={sectionKey}
          mediaPlan={mediaPlan}
          isEditing={isEditing}
          onFieldChange={onFieldChange}
        />

        {/* Mark as Reviewed - positioned at bottom for natural reading flow */}
        {!isReviewed && (
          <div
            className="mt-5 pt-4 flex justify-end"
            style={{ borderTop: '1px solid var(--border-default)' }}
          >
            <Button
              variant="outline"
              onClick={onMarkReviewed}
              className="gap-2 px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderColor: 'var(--success)',
                color: 'var(--success)',
                background: 'var(--success-subtle)',
                fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Reviewed
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
