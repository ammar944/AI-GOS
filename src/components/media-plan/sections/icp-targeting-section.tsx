"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ICPTargeting } from "@/lib/media-plan/types";
import {
  SubSection,
  FunnelBadge,
  StatusBadge,
  Chip,
  EditableText,
  RESEARCH_SUBTLE_BLOCK_CLASS,
  renderChipGroup,
  type EditingProps,
} from "./shared";

export function ICPTargetingContent({
  data,
  isEditing,
  onFieldChange,
}: { data: ICPTargeting } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Audience Segments */}
      <SubSection title="Audience Segments">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {data.segments.map((seg) => (
            <div key={seg.name} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                    {seg.name}
                  </span>
                  {/* Priority score badge (new) */}
                  {seg.priorityScore != null && (
                    <span
                      className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium font-mono"
                      style={{
                        fontFamily: "var(--font-mono), monospace",
                        background: seg.priorityScore >= 7
                          ? "rgba(34,197,94,0.14)"
                          : seg.priorityScore >= 4
                            ? "rgba(245,158,11,0.14)"
                            : "rgba(239,68,68,0.14)",
                        color: seg.priorityScore >= 7
                          ? "rgb(134,239,172)"
                          : seg.priorityScore >= 4
                            ? "rgb(253,186,116)"
                            : "rgb(252,165,165)",
                        borderColor: seg.priorityScore >= 7
                          ? "rgba(34,197,94,0.34)"
                          : seg.priorityScore >= 4
                            ? "rgba(245,158,11,0.34)"
                            : "rgba(239,68,68,0.34)",
                      }}
                    >
                      Priority: {seg.priorityScore}/10
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Targeting difficulty badge (new) */}
                  {seg.targetingDifficulty && (
                    <StatusBadge
                      label={seg.targetingDifficulty}
                      variant={
                        seg.targetingDifficulty === "easy" ? "success"
                          : seg.targetingDifficulty === "moderate" ? "warning"
                            : "danger"
                      }
                    />
                  )}
                  <FunnelBadge stage={seg.funnelPosition} />
                </div>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {seg.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {seg.targetingParameters.map((tp) => (
                  <Chip key={tp}>{tp}</Chip>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Est. Reach: {seg.estimatedReach}
              </p>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Platform Targeting */}
      <SubSection title="Platform Targeting">
        <div className="space-y-4">
          {data.platformTargeting.map((pt) => (
            <div key={pt.platform} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                {pt.platform}
              </span>
              {renderChipGroup("Interests", pt.interests)}
              {renderChipGroup("Job Titles", pt.jobTitles)}
              {renderChipGroup("Custom Audiences", pt.customAudiences)}
              {renderChipGroup("Lookalike Audiences", pt.lookalikeAudiences)}
              {renderChipGroup("Exclusions", pt.exclusions)}
            </div>
          ))}
        </div>
      </SubSection>

      {/* Profile */}
      <SubSection title="Profile">
        <div className="space-y-3">
          {data.demographics && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                Demographics
              </p>
              {isEditing ? (
                <EditableText
                  value={data.demographics}
                  onSave={(v) => onFieldChange?.("demographics", v)}
                  multiline
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.demographics}</p>
              )}
            </div>
          )}
          {data.psychographics && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                Psychographics
              </p>
              {isEditing ? (
                <EditableText
                  value={data.psychographics}
                  onSave={(v) => onFieldChange?.("psychographics", v)}
                  multiline
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.psychographics}</p>
              )}
            </div>
          )}
          {data.geographicTargeting && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                Geographic Targeting
              </p>
              {isEditing ? (
                <EditableText
                  value={data.geographicTargeting}
                  onSave={(v) => onFieldChange?.("geographicTargeting", v)}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.geographicTargeting}</p>
              )}
            </div>
          )}
        </div>
      </SubSection>

      {/* Overlap Warnings (new) */}
      {data.overlapWarnings && data.overlapWarnings.length > 0 && (
        <div
          className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}
          style={{ borderColor: "rgba(245,158,11,0.4)" }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "rgb(245,158,11)" }} />
            <p className="text-xs font-medium uppercase" style={{ color: "rgb(253,186,116)" }}>
              Audience Overlap Warnings
            </p>
          </div>
          <ul className="space-y-1 pl-6">
            {data.overlapWarnings.map((warning, wIdx) => (
              <li key={wIdx} className="list-disc text-sm" style={{ color: "var(--text-secondary)" }}>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reachability banner */}
      {data.reachabilityAssessment && (
        <div
          className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "flex items-start gap-3 p-4")}
          style={{ borderColor: "rgba(54,94,255,0.3)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-blue)" }} />
          {isEditing ? (
            <EditableText
              value={data.reachabilityAssessment}
              onSave={(v) => onFieldChange?.("reachabilityAssessment", v)}
              multiline
              className="text-sm flex-1"
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {data.reachabilityAssessment}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
