"use client";

import { ChevronDown, ChevronUp, CheckCircle2, Pencil, Check } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StrategicBlueprintSection } from "@/lib/strategic-blueprint/output-types";
import { STRATEGIC_BLUEPRINT_SECTION_ORDER } from "@/lib/strategic-blueprint/output-types";
import { SectionContentRenderer } from "./section-content";

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
      className={cn(
        "transition-all duration-300",
        isReviewed && "border-green-500/50 bg-green-500/5",
        isEditing && "border-blue-500/50 ring-1 ring-blue-500/20"
      )}
    >
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Section number */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
              {sectionNumber}
            </div>
            {/* Section icon */}
            <div className="flex items-center gap-2 text-primary">
              {sectionIcon}
            </div>
            {/* Section label */}
            <h2 className="text-lg font-bold text-foreground">{sectionLabel}</h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Edited badge */}
            {hasEdits && (
              <Badge variant="outline" className="gap-1 border-blue-500/50 text-blue-500">
                <Pencil className="h-3 w-3" />
                Edited
              </Badge>
            )}
            {/* Reviewed badge */}
            {isReviewed && (
              <Badge variant="success" className="gap-1">
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
                  "gap-1.5",
                  isEditing && "bg-blue-500 hover:bg-blue-600"
                )}
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
        </CardContent>

        {/* Footer with Mark as Reviewed button */}
        {!isReviewed && !isEditing && (
          <CardFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={onMarkReviewed}
              className="ml-auto gap-2"
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
