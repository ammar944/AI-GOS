"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EditableList } from "@/components/strategic-research/editable/editable-list";
import type { MediaPlanExecutiveSummary } from "@/lib/media-plan/types";
import {
  SubSection,
  InfoCard,
  EditableText,
  RESEARCH_SUBTLE_BLOCK_CLASS,
  fmt$,
  type EditingProps,
} from "./shared";

export function ExecutiveSummaryContent({
  data,
  isEditing,
  onFieldChange,
}: { data: MediaPlanExecutiveSummary } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Hero budget */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            Recommended Monthly Budget
          </p>
          {isEditing ? (
            <EditableText
              value={String(data.recommendedMonthlyBudget)}
              onSave={(v) => onFieldChange?.("recommendedMonthlyBudget", Number(v) || 0)}
              className="text-3xl font-bold"
            />
          ) : (
            <p
              className="text-3xl font-bold"
              style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono), monospace" }}
            >
              {fmt$(data.recommendedMonthlyBudget)}
            </p>
          )}
        </div>
        {isEditing ? (
          <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
            <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              Timeline to Results
            </p>
            <EditableText
              value={data.timelineToResults}
              onSave={(v) => onFieldChange?.("timelineToResults", v)}
            />
          </div>
        ) : (
          <InfoCard label="Timeline to Results" value={data.timelineToResults} />
        )}
      </div>

      {/* Objective */}
      {isEditing ? (
        <EditableText
          value={data.primaryObjective}
          onSave={(v) => onFieldChange?.("primaryObjective", v)}
          className="text-base font-medium"
        />
      ) : (
        <p
          className="text-base font-medium"
          style={{
            color: "var(--text-heading)",
            fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
          }}
        >
          {data.primaryObjective}
        </p>
      )}

      {/* Overview */}
      {isEditing ? (
        <EditableText
          value={data.overview}
          onSave={(v) => onFieldChange?.("overview", v)}
          multiline
          className="text-sm leading-relaxed"
        />
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {data.overview}
        </p>
      )}

      {/* Top Priorities */}
      <SubSection title="Top Priorities">
        {isEditing ? (
          <EditableList
            items={data.topPriorities}
            onSave={(items) => onFieldChange?.("topPriorities", items)}
            renderPrefix={(i) => (
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
              >
                {i + 1}
              </span>
            )}
          />
        ) : (
          <ol className="list-inside space-y-2">
            {data.topPriorities.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                  style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
                >
                  {i + 1}
                </span>
                {p}
              </li>
            ))}
          </ol>
        )}
      </SubSection>
    </div>
  );
}
