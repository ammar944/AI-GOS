"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditableList } from "@/components/strategic-research/editable/editable-list";
import type { CampaignPhase } from "@/lib/media-plan/types";
import {
  SubSection,
  StatusBadge,
  ListItem,
  EditableText,
  RESEARCH_SUBTLE_BLOCK_CLASS,
  fmt$,
  type EditingProps,
} from "./shared";

export function CampaignPhasesContent({
  data,
  isEditing,
  onFieldChange,
}: { data: CampaignPhase[] } & EditingProps) {
  return (
    <div className="space-y-4">
      {data.map((phase, pIdx) => (
        <div key={phase.phase} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-5 space-y-3")}>
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
              style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
            >
              {phase.phase}
            </span>
            <span className="text-base font-semibold" style={{ color: "var(--text-heading)" }}>
              {phase.name}
            </span>
            <StatusBadge label={`${phase.durationWeeks} weeks`} variant="info" />
            <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono), monospace" }}>
              {fmt$(phase.estimatedBudget)}
            </span>
          </div>

          {/* Objective */}
          {isEditing ? (
            <EditableText
              value={phase.objective}
              onSave={(v) => onFieldChange?.(`${pIdx}.objective`, v)}
              multiline
              className="text-sm"
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{phase.objective}</p>
          )}

          {/* Activities */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
              Activities
            </p>
            {isEditing ? (
              <EditableList
                items={phase.activities}
                onSave={(items) => onFieldChange?.(`${pIdx}.activities`, items)}
              />
            ) : (
              <ul className="space-y-1">
                {phase.activities.map((a, i) => (
                  <ListItem key={i}>{a}</ListItem>
                ))}
              </ul>
            )}
          </div>

          {/* Success Criteria */}
          <div>
            <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
              Success Criteria
            </p>
            {isEditing ? (
              <EditableList
                items={phase.successCriteria}
                onSave={(items) => onFieldChange?.(`${pIdx}.successCriteria`, items)}
              />
            ) : (
              <ul className="space-y-1">
                {phase.successCriteria.map((sc, i) => (
                  <ListItem key={i}>{sc}</ListItem>
                ))}
              </ul>
            )}
          </div>

          {/* Go/No-Go Decision (new) */}
          {phase.goNoGoDecision && (
            <div
              className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "flex items-start gap-3 p-3")}
              style={{ borderColor: "rgba(245,158,11,0.4)" }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "rgb(245,158,11)" }} />
              <div>
                <p className="mb-0.5 text-xs font-medium uppercase" style={{ color: "rgb(253,186,116)" }}>
                  Go / No-Go Decision
                </p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{phase.goNoGoDecision}</p>
              </div>
            </div>
          )}

          {/* Scenario Adjustment (new) */}
          {phase.scenarioAdjustment && (
            <div
              className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "flex items-start gap-3 p-3")}
              style={{ borderColor: "rgba(54,94,255,0.3)" }}
            >
              <span className="mt-0.5 shrink-0 text-sm" style={{ color: "var(--accent-blue)" }}>i</span>
              <div>
                <p className="mb-0.5 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                  Scenario Adjustment
                </p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{phase.scenarioAdjustment}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
