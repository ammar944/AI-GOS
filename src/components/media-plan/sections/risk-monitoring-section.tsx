"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { EditableList } from "@/components/strategic-research/editable/editable-list";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { RiskMonitoring } from "@/lib/media-plan/types";
import {
  StatusBadge,
  ListItem,
  EditableText,
  SEVERITY_COLORS,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type EditingProps,
} from "./shared";

function CollapsibleSubSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="mb-6 space-y-3">
        <CollapsibleTrigger className="group flex w-full items-center justify-between border-l-4 pl-3 text-sm font-semibold uppercase tracking-wide"
          style={{
            color: "var(--text-tertiary)",
            borderColor: "var(--accent-blue)",
            fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
            letterSpacing: "0.05em",
          }}
        >
          <span>{title}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 pt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function RiskMonitoringContent({
  data,
  isEditing,
  onFieldChange,
}: { data: RiskMonitoring } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Risks — default open so card isn't empty on load */}
      <CollapsibleSubSection title="Identified Risks" defaultOpen>
        <div className="space-y-3">
          {data.risks.map((r, rIdx) => (
            <div key={rIdx} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={CATEGORY_LABELS[r.category] ?? r.category} variant={CATEGORY_COLORS[r.category] ?? "neutral"} />
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
      </CollapsibleSubSection>

      {/* Key Assumptions — default collapsed */}
      {data.assumptions.length > 0 && (
        <CollapsibleSubSection title="Key Assumptions">
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
        </CollapsibleSubSection>
      )}
    </div>
  );
}
