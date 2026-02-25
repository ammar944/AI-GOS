"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { BudgetAllocation } from "@/lib/media-plan/types";
import {
  SubSection,
  InfoCard,
  FunnelBadge,
  Chip,
  EditableText,
  RESEARCH_SUBTLE_BLOCK_CLASS,
  fmt$,
  fmtPct,
  type EditingProps,
} from "./shared";

export function BudgetAllocationContent({
  data,
  isEditing,
  onFieldChange,
}: { data: BudgetAllocation } & EditingProps) {
  return (
    <div className="space-y-6">
      {/* Header budgets */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
            Total Monthly Budget
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: "var(--accent-blue)", fontFamily: "var(--font-mono), monospace" }}
          >
            {fmt$(data.totalMonthlyBudget)}
          </p>
        </div>
        <InfoCard label="Daily Ceiling" value={fmt$(data.dailyCeiling)} mono />
      </div>

      {/* Platform Breakdown */}
      <SubSection title="Platform Breakdown">
        <div className="space-y-2">
          {data.platformBreakdown.map((pb, pbIdx) => {
            const pct = Math.min(pb.percentage, 100);
            return (
              <div key={pb.platform} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: "var(--text-heading)" }}>{pb.platform}</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <EditableText
                        value={String(pb.percentage)}
                        onSave={(v) => onFieldChange?.(`platformBreakdown.${pbIdx}.percentage`, Number(v) || 0)}
                        className="font-mono text-xs"
                      />
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>%</span>
                    </div>
                  ) : (
                    <span className="font-mono text-xs" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono), monospace" }}>
                      {fmt$(pb.monthlyBudget)} ({fmtPct(pb.percentage)})
                    </span>
                  )}
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{ background: "var(--bg-elevated)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: "var(--gradient-primary)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SubSection>

      {/* Funnel Split */}
      <SubSection title="Funnel Split">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {data.funnelSplit.map((fs, fsIdx) => {
            const borderColor =
              fs.stage === "cold"
                ? "rgba(54,94,255,0.4)"
                : fs.stage === "warm"
                  ? "rgba(245,158,11,0.4)"
                  : "rgba(239,68,68,0.4)";
            return (
              <div
                key={fs.stage}
                className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}
                style={{ borderColor }}
              >
                <div className="flex items-center justify-between">
                  <FunnelBadge stage={fs.stage} />
                  {isEditing ? (
                    <EditableText
                      value={String(fs.percentage)}
                      onSave={(v) => onFieldChange?.(`funnelSplit.${fsIdx}.percentage`, Number(v) || 0)}
                      className="text-xl font-bold font-mono"
                    />
                  ) : (
                    <span
                      className="text-xl font-bold font-mono"
                      style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono), monospace" }}
                    >
                      {fmtPct(fs.percentage)}
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {fs.rationale}
                </p>
              </div>
            );
          })}
        </div>
      </SubSection>

      {/* Monthly Roadmap */}
      <SubSection title="Monthly Roadmap">
        <div className="space-y-3">
          {data.monthlyRoadmap.map((mr) => (
            <div key={mr.month} className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium"
                  style={{ background: "rgba(54,94,255,0.15)", color: "var(--accent-blue)" }}
                >
                  M{mr.month}
                </span>
                <span className="text-sm font-mono font-medium" style={{ color: "var(--text-heading)", fontFamily: "var(--font-mono), monospace" }}>
                  {fmt$(mr.budget)}
                </span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{mr.focus}</span>
              </div>
              {mr.scalingTriggers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mr.scalingTriggers.map((st) => (
                    <Chip key={st}>{st}</Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SubSection>

      {/* Ramp-up Strategy */}
      {data.rampUpStrategy && (
        <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
          <p className="mb-1 text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>
            Ramp-Up Strategy
          </p>
          {isEditing ? (
            <EditableText
              value={data.rampUpStrategy}
              onSave={(v) => onFieldChange?.("rampUpStrategy", v)}
              multiline
              className="text-sm"
            />
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{data.rampUpStrategy}</p>
          )}
        </div>
      )}
    </div>
  );
}
