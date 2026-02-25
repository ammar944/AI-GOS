"use client";

import * as React from "react";
import type { CreativeStrategy } from "@/lib/media-plan/types";
import {
  SubSection,
  FunnelBadge,
  Chip,
  EditableText,
  fmt$,
  type EditingProps,
} from "./shared";

export function CreativeStrategyContent({
  data,
  isEditing,
  onFieldChange,
}: { data: CreativeStrategy } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Creative Angles */}
      <SubSection title="Creative Angles">
        <div className="space-y-4">
          {data.angles.map((a, aIdx) => (
            <div key={a.name} className="p-4 space-y-2">
              <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
                {a.name}
              </span>
              {isEditing ? (
                <EditableText
                  value={a.description}
                  onSave={(v) => onFieldChange?.(`angles.${aIdx}.description`, v)}
                  multiline
                  className="text-sm"
                />
              ) : (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{a.description}</p>
              )}
              {/* Hook in quote block */}
              {isEditing ? (
                <div className="border-l-2 pl-3" style={{ borderColor: "var(--accent-blue)" }}>
                  <EditableText
                    value={a.exampleHook}
                    onSave={(v) => onFieldChange?.(`angles.${aIdx}.exampleHook`, v)}
                    className="text-sm italic"
                  />
                </div>
              ) : (
                <blockquote
                  className="border-l-2 pl-3 text-sm italic"
                  style={{ borderColor: "var(--accent-blue)", color: "var(--text-heading)" }}
                >
                  &ldquo;{a.exampleHook}&rdquo;
                </blockquote>
              )}
              <div className="flex flex-wrap gap-1.5">
                {a.bestForFunnelStages.map((s) => (
                  <FunnelBadge key={s} stage={s} />
                ))}
                {a.platforms.map((p) => (
                  <Chip key={p}>{p}</Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Format Specs */}
      <SubSection title="Format Specifications">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Format</th>
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Dimensions</th>
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Platform</th>
                <th className="pb-2 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Copy Guideline</th>
              </tr>
            </thead>
            <tbody>
              {data.formatSpecs.map((fs) => (
                <tr key={`${fs.format}-${fs.platform}`} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-2 pr-4 font-medium" style={{ color: "var(--text-heading)" }}>{fs.format}</td>
                  <td className="py-2 pr-4 font-mono text-xs" style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text-secondary)" }}>{fs.dimensions}</td>
                  <td className="py-2 pr-4"><Chip>{fs.platform}</Chip></td>
                  <td className="py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{fs.copyGuideline}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SubSection>

      {/* Testing Plan */}
      <SubSection title="Testing Plan">
        <div className="space-y-3">
          {data.testingPlan.map((tp) => (
            <div key={tp.phase} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>{tp.phase}</span>
                <Chip>{tp.variantsToTest} variants</Chip>
                <Chip>{tp.durationDays}d</Chip>
                <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono), monospace" }}>
                  {fmt$(tp.testingBudget)}
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tp.methodology}</p>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Success: {tp.successCriteria}
              </p>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Refresh Cadence */}
      <SubSection title="Refresh Cadence">
        <div className="space-y-2">
          {data.refreshCadence.map((rc) => (
            <div key={rc.platform} className="flex items-start gap-4 p-4">
              <div className="shrink-0">
                <Chip>{rc.platform}</Chip>
              </div>
              <div className="space-y-1">
                <p className="text-sm" style={{ color: "var(--text-heading)" }}>
                  Every {rc.refreshIntervalDays} days
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rc.fatigueSignals.map((fs) => (
                    <span key={fs} className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                      {fs}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SubSection>

      {/* Brand Guidelines */}
      {data.brandGuidelines.length > 0 && (
        <SubSection title="Brand Guidelines">
          <div className="space-y-2">
            {data.brandGuidelines.map((bg, bgIdx) => (
              <div key={bgIdx} className="flex items-start gap-3 text-sm">
                <Chip>{bg.category}</Chip>
                {isEditing ? (
                  <EditableText
                    value={bg.guideline}
                    onSave={(v) => onFieldChange?.(`brandGuidelines.${bgIdx}.guideline`, v)}
                    className="flex-1"
                  />
                ) : (
                  <span style={{ color: "var(--text-secondary)" }}>{bg.guideline}</span>
                )}
              </div>
            ))}
          </div>
        </SubSection>
      )}
    </div>
  );
}
