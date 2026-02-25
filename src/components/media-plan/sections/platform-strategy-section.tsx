"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { EditableList } from "@/components/strategic-research/editable/editable-list";
import type { PlatformStrategy } from "@/lib/media-plan/types";
import {
  PriorityBadge,
  Chip,
  StatusBadge,
  EditableText,
  fmt$,
  fmtPct,
  type EditingProps,
} from "./shared";

export function PlatformStrategyContent({
  data,
  isEditing,
  onFieldChange,
}: { data: PlatformStrategy[] } & EditingProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {data.map((ps, idx) => (
        <div key={ps.platform} className="p-5 space-y-3">
          {/* Name + priority */}
          <div className="flex items-center justify-between">
            <span
              className="text-base font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              {ps.platform}
            </span>
            <PriorityBadge priority={ps.priority} />
          </div>

          {/* Spend */}
          <div className="flex items-baseline gap-2">
            {isEditing ? (
              <EditableText
                value={String(ps.monthlySpend)}
                onSave={(v) => onFieldChange?.(`${idx}.monthlySpend`, Number(v) || 0)}
                className="text-lg font-bold font-mono"
              />
            ) : (
              <span className="text-lg font-bold font-mono" style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono), monospace" }}>
                {fmt$(ps.monthlySpend)}/mo
              </span>
            )}
            {isEditing ? (
              <EditableText
                value={String(ps.budgetPercentage)}
                onSave={(v) => onFieldChange?.(`${idx}.budgetPercentage`, Number(v) || 0)}
                className="text-xs"
              />
            ) : (
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                ({fmtPct(ps.budgetPercentage)})
              </span>
            )}
          </div>

          {/* CPL */}
          {isEditing ? (
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              <span>CPL:</span>
              <EditableText
                value={String(ps.expectedCplRange.min)}
                onSave={(v) => onFieldChange?.(`${idx}.expectedCplRange.min`, Number(v) || 0)}
              />
              <span>&ndash;</span>
              <EditableText
                value={String(ps.expectedCplRange.max)}
                onSave={(v) => onFieldChange?.(`${idx}.expectedCplRange.max`, Number(v) || 0)}
              />
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              CPL: {fmt$(ps.expectedCplRange.min)} &ndash; {fmt$(ps.expectedCplRange.max)}
            </p>
          )}

          {/* Campaign types */}
          {isEditing ? (
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>Campaign Types</p>
              <EditableList
                items={ps.campaignTypes}
                onSave={(items) => onFieldChange?.(`${idx}.campaignTypes`, items)}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {ps.campaignTypes.map((ct) => (
                <Chip key={ct}>{ct}</Chip>
              ))}
            </div>
          )}

          {/* Ad formats + placements */}
          {ps.adFormats.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                Formats
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ps.adFormats.map((f) => (
                  <Chip key={f}>{f}</Chip>
                ))}
              </div>
            </div>
          )}

          {ps.placements.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                Placements
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ps.placements.map((pl) => (
                  <Chip key={pl}>{pl}</Chip>
                ))}
              </div>
            </div>
          )}

          {/* Competitive density + audience saturation (new) */}
          {(ps.competitiveDensity != null || ps.audienceSaturation) && (
            <div className="flex flex-wrap items-center gap-2">
              {ps.competitiveDensity != null && (
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    background: ps.competitiveDensity <= 3
                      ? "rgba(34,197,94,0.14)"
                      : ps.competitiveDensity <= 6
                        ? "rgba(245,158,11,0.14)"
                        : ps.competitiveDensity <= 8
                          ? "rgba(249,115,22,0.14)"
                          : "rgba(239,68,68,0.14)",
                    color: ps.competitiveDensity <= 3
                      ? "rgb(134,239,172)"
                      : ps.competitiveDensity <= 6
                        ? "rgb(253,186,116)"
                        : ps.competitiveDensity <= 8
                          ? "rgb(253,186,116)"
                          : "rgb(252,165,165)",
                    borderColor: ps.competitiveDensity <= 3
                      ? "rgba(34,197,94,0.34)"
                      : ps.competitiveDensity <= 6
                        ? "rgba(245,158,11,0.34)"
                        : ps.competitiveDensity <= 8
                          ? "rgba(249,115,22,0.34)"
                          : "rgba(239,68,68,0.34)",
                  }}
                >
                  Density: {ps.competitiveDensity}/10
                </span>
              )}
              {ps.audienceSaturation && (
                <StatusBadge
                  label={`Saturation: ${ps.audienceSaturation}`}
                  variant={
                    ps.audienceSaturation === "low" ? "success"
                      : ps.audienceSaturation === "medium" ? "warning"
                        : "danger"
                  }
                />
              )}
            </div>
          )}

          {/* Platform risk factors (new) */}
          {ps.platformRiskFactors && ps.platformRiskFactors.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
                Risk Factors
              </p>
              <ul className="space-y-0.5">
                {ps.platformRiskFactors.map((rf, rfIdx) => (
                  <li key={rfIdx} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" style={{ color: "rgba(245,158,11,0.7)" }} />
                    {rf}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Synergies */}
          {ps.synergiesWithOtherPlatforms && (
            <p className="text-xs italic" style={{ color: "var(--text-tertiary)" }}>
              {ps.synergiesWithOtherPlatforms}
            </p>
          )}

          {/* Rationale */}
          {isEditing ? (
            <EditableText
              value={ps.rationale}
              onSave={(v) => onFieldChange?.(`${idx}.rationale`, v)}
              multiline
              className="text-sm leading-relaxed"
            />
          ) : (
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {ps.rationale}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
