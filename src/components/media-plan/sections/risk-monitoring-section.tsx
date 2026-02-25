"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { EditableList } from "@/components/strategic-research/editable/editable-list";
import type { RiskMonitoring } from "@/lib/media-plan/types";
import {
  SubSection,
  StatusBadge,
  ListItem,
  EditableText,
  RESEARCH_SUBTLE_BLOCK_CLASS,
  SEVERITY_COLORS,
  CATEGORY_COLORS,
  type EditingProps,
} from "./shared";

export function RiskMonitoringContent({
  data,
  isEditing,
  onFieldChange,
}: { data: RiskMonitoring } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Risks */}
      <SubSection title="Identified Risks">
        <div className="space-y-3">
          {data.risks.map((r, rIdx) => (
            <div key={rIdx} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={r.category} variant={CATEGORY_COLORS[r.category] ?? "neutral"} />
                {/* P×I score badge (new) — shown when numerical scoring is available */}
                {r.score != null && (
                  <StatusBadge
                    label={`P\u00D7I: ${r.score}`}
                    variant={r.score <= 6 ? "success" : r.score <= 12 ? "warning" : r.score <= 19 ? "caution" : "danger"}
                  />
                )}
                {/* Classification badge (new) — shown when system-computed classification exists */}
                {r.classification && (
                  <StatusBadge
                    label={r.classification}
                    variant={
                      r.classification === "low" ? "success"
                        : r.classification === "medium" ? "warning"
                          : r.classification === "high" ? "caution"
                            : "danger"
                    }
                  />
                )}
                {/* Fallback: legacy severity/likelihood badges when numerical scores absent */}
                {r.score == null && (
                  <>
                    <StatusBadge label={`Severity: ${r.severity}`} variant={SEVERITY_COLORS[r.severity] ?? "neutral"} />
                    <StatusBadge label={`Likelihood: ${r.likelihood}`} variant={SEVERITY_COLORS[r.likelihood] ?? "neutral"} />
                  </>
                )}
                {/* Monitoring frequency badge (new) */}
                {r.monitoringFrequency && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {r.monitoringFrequency}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium" style={{ color: "var(--text-heading)" }}>{r.risk}</p>
              {/* Early warning indicator (new) */}
              {r.earlyWarningIndicator && (
                <p className="text-xs italic" style={{ color: "var(--text-tertiary)" }}>
                  Early Warning: {r.earlyWarningIndicator}
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                    Mitigation
                  </p>
                  {isEditing ? (
                    <EditableText
                      value={r.mitigation}
                      onSave={(v) => onFieldChange?.(`risks.${rIdx}.mitigation`, v)}
                      multiline
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.mitigation}</p>
                  )}
                </div>
                <div>
                  <p className="mb-0.5 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
                    Contingency
                  </p>
                  {isEditing ? (
                    <EditableText
                      value={r.contingency}
                      onSave={(v) => onFieldChange?.(`risks.${rIdx}.contingency`, v)}
                      multiline
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{r.contingency}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Key Assumptions */}
      {data.assumptions.length > 0 && (
        <SubSection title="Key Assumptions">
          {isEditing ? (
            <EditableList
              items={data.assumptions}
              onSave={(items) => onFieldChange?.("assumptions", items)}
            />
          ) : (
            <ul className="space-y-1">
              {data.assumptions.map((a, i) => (
                <ListItem key={i}>{a}</ListItem>
              ))}
            </ul>
          )}
        </SubSection>
      )}
    </div>
  );
}
