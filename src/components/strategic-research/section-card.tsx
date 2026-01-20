"use client";

import { ChevronDown, ChevronUp, CheckCircle2, Pencil, Check } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StrategicBlueprintSection, Citation } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { SectionContentRenderer } from "./section-content";
import { CitationBadge, SourcesList } from "./citations";

// Section icons mapping - reused from strategic-blueprint-display.tsx
import {
  TrendingUp,
  Users,
  Package,
  Swords,
  Lightbulb,
} from "lucide-react";

const SECTION_ICONS: Record<StrategicBlueprintSection, React.ReactNode> = {
  industryMarketOverview: <TrendingUp className="h-5 w-5" />,
  icpAnalysisValidation: <Users className="h-5 w-5" />,
  offerAnalysisViability: <Package className="h-5 w-5" />,
  competitorAnalysis: <Swords className="h-5 w-5" />,
  crossAnalysisSynthesis: <Lightbulb className="h-5 w-5" />,
};

const SECTION_LABELS: Record<StrategicBlueprintSection, string> = {
  industryMarketOverview: "Industry & Market Overview",
  icpAnalysisValidation: "ICP Analysis & Validation",
  offerAnalysisViability: "Offer Analysis & Viability",
  competitorAnalysis: "Competitor Analysis",
  crossAnalysisSynthesis: "Cross-Analysis Synthesis",
};

export interface SectionCardProps {
  sectionKey: StrategicBlueprintSection;
  sectionData: unknown;
  isExpanded: boolean;
  isReviewed: boolean;
  isEditing: boolean;
  hasEdits: boolean;
  /** Citations for this section (sections 1-4 have citations from research agents) */
  citations?: Citation[];
  onToggleExpand: () => void;
  onMarkReviewed: () => void;
  onToggleEdit: () => void;
  onFieldChange: (fieldPath: string, newValue: unknown) => void;
}

export function SectionCard({
  sectionKey,
  sectionData,
  isExpanded,
  isReviewed,
  isEditing,
  hasEdits,
  citations,
  onToggleExpand,
  onMarkReviewed,
  onToggleEdit,
  onFieldChange,
}: SectionCardProps) {
  const sectionNumber = STRATEGIC_BLUEPRINT_SECTION_ORDER.indexOf(sectionKey) + 1;
  const sectionIcon = SECTION_ICONS[sectionKey];
  const sectionLabel = SECTION_LABELS[sectionKey];

  return (
    <Card
      style={{
        background: 'var(--bg-surface)',
        borderColor: isReviewed
          ? 'var(--success)'
          : isEditing
          ? 'var(--accent-blue)'
          : 'var(--border-default)',
      }}
      className={cn(
        "transition-all duration-300",
        isReviewed && "shadow-[0_0_20px_rgba(34,197,94,0.1)]",
        isEditing && "shadow-[0_0_20px_rgba(54,94,255,0.1)] ring-1 ring-[var(--accent-blue)]/20"
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Section number */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full font-semibold text-lg"
              style={{
                background: isReviewed
                  ? 'var(--success-subtle)'
                  : 'var(--gradient-primary)',
                color: isReviewed ? 'var(--success)' : 'white',
              }}
            >
              {sectionNumber}
            </div>
            {/* Section icon */}
            <div
              className="flex items-center gap-2"
              style={{ color: isReviewed ? 'var(--success)' : 'var(--accent-blue)' }}
            >
              {sectionIcon}
            </div>
            {/* Section label */}
            <h2
              className="text-lg font-bold tracking-tight"
              style={{
                fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
                letterSpacing: '-0.02em',
                color: 'var(--text-heading)'
              }}
            >
              {sectionLabel}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Citation count badge */}
            {citations && citations.length > 0 && (
              <CitationBadge count={citations.length} />
            )}
            {/* Edited badge */}
            {hasEdits && (
              <Badge
                variant="outline"
                className="gap-1"
                style={{
                  borderColor: 'var(--accent-blue)',
                  color: 'var(--accent-blue)',
                  background: 'rgba(54, 94, 255, 0.1)',
                  fontFamily: 'var(--font-sans), Inter, sans-serif',
                }}
              >
                <Pencil className="h-3 w-3" />
                Edited
              </Badge>
            )}
            {/* Reviewed badge */}
            {isReviewed && (
              <Badge
                variant="success"
                className="gap-1"
                style={{
                  borderColor: 'var(--success)',
                  color: 'var(--success)',
                  background: 'var(--success-subtle)',
                  fontFamily: 'var(--font-sans), Inter, sans-serif',
                }}
              >
                <CheckCircle2 className="h-3 w-3" />
                Reviewed
              </Badge>
            )}
            {/* Edit/Done button - only show when expanded */}
            {isExpanded && (
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={onToggleEdit}
                className={cn(
                  "gap-1.5 transition-all duration-200",
                  isEditing && "shadow-[0_0_20px_rgba(54,94,255,0.3)]",
                  !isEditing && "hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
                )}
                style={isEditing ? {
                  background: 'var(--gradient-primary)',
                  borderColor: 'transparent',
                  color: 'white',
                  fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                } : {
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-display), "Cabinet Grotesk", sans-serif',
                }}
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
            )}
            {/* Expand/collapse button */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleExpand}
              aria-label={isExpanded ? "Collapse section" : "Expand section"}
              style={{ color: 'var(--text-tertiary)' }}
              className="hover:bg-[var(--bg-hover)]"
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Collapsible content area */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <CardContent className="pt-6">
          <SectionContentRenderer
            sectionKey={sectionKey}
            data={sectionData}
            isEditing={isEditing}
            onFieldChange={onFieldChange}
          />
          {/* Sources list - only show when expanded and citations exist */}
          {citations && citations.length > 0 && (
            <SourcesList citations={citations} sectionLabel={sectionLabel} />
          )}
        </CardContent>

        {/* Footer with Mark as Reviewed button */}
        {!isReviewed && !isEditing && (
          <CardFooter className="pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
            <Button
              variant="outline"
              onClick={onMarkReviewed}
              className="ml-auto gap-2"
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
          </CardFooter>
        )}
      </div>
    </Card>
  );
}
