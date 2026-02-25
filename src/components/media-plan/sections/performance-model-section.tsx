"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PerformanceModel } from "@/lib/media-plan/types";
import {
  SubSection,
  InfoCard,
  MonitoringColumn,
  EditableText,
  RESEARCH_SUBTLE_BLOCK_CLASS,
  fmt$,
  fmtPct,
  type EditingProps,
} from "./shared";

export function PerformanceModelContent({
  data,
  isEditing,
  onFieldChange,
}: { data: PerformanceModel } & EditingProps) {
  const m = data.cacModel;

  return (
    <div className="space-y-6">
      {/* CAC Funnel Model */}
      <SubSection title="CAC Funnel Model">
        {isEditing ? (
          <>
            {/* Editable grid row 1 */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Target CPL</p>
                <EditableText
                  value={String(m.targetCPL)}
                  onSave={(v) => onFieldChange?.("cacModel.targetCPL", Number(v) || 0)}
                />
              </div>
              <InfoCard label="Expected Leads/mo" value={m.expectedMonthlyLeads} mono />
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Lead &rarr; SQL</p>
                <EditableText
                  value={String(m.leadToSqlRate)}
                  onSave={(v) => onFieldChange?.("cacModel.leadToSqlRate", Number(v) || 0)}
                />
              </div>
              <InfoCard label="Expected SQLs/mo" value={m.expectedMonthlySQLs} mono />
            </div>
            {/* Editable grid row 2 */}
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>SQL &rarr; Customer</p>
                <EditableText
                  value={String(m.sqlToCustomerRate)}
                  onSave={(v) => onFieldChange?.("cacModel.sqlToCustomerRate", Number(v) || 0)}
                />
              </div>
              <InfoCard label="Customers/mo" value={m.expectedMonthlyCustomers} mono />
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Target CAC</p>
                <EditableText
                  value={String(m.targetCAC)}
                  onSave={(v) => onFieldChange?.("cacModel.targetCAC", Number(v) || 0)}
                />
              </div>
              <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
                <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Est. LTV</p>
                <EditableText
                  value={String(m.estimatedLTV)}
                  onSave={(v) => onFieldChange?.("cacModel.estimatedLTV", Number(v) || 0)}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Funnel flow */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InfoCard label="Target CPL" value={fmt$(m.targetCPL)} mono />
              <InfoCard label="Expected Leads/mo" value={m.expectedMonthlyLeads} mono />
              <InfoCard label="Lead → SQL" value={fmtPct(m.leadToSqlRate)} mono />
              <InfoCard label="Expected SQLs/mo" value={m.expectedMonthlySQLs} mono />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <InfoCard label="SQL → Customer" value={fmtPct(m.sqlToCustomerRate)} mono />
              <InfoCard label="Customers/mo" value={m.expectedMonthlyCustomers} mono />
              <InfoCard label="Target CAC" value={fmt$(m.targetCAC)} mono />
              <InfoCard label="Est. LTV" value={fmt$(m.estimatedLTV)} mono />
            </div>
          </>
        )}

        {/* LTV:CAC highlight */}
        <div
          className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "mt-3 flex items-center justify-between p-4")}
          style={{ borderColor: "rgba(34,197,94,0.3)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--text-heading)" }}>
            LTV : CAC Ratio
          </span>
          <span
            className="text-xl font-bold font-mono"
            style={{ color: "rgb(34,197,94)", fontFamily: "var(--font-mono), monospace" }}
          >
            {m.ltvToCacRatio}
          </span>
        </div>
      </SubSection>

      {/* Monitoring Schedule */}
      <SubSection title="Monitoring Schedule">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MonitoringColumn title="Daily" items={data.monitoringSchedule.daily} />
          <MonitoringColumn title="Weekly" items={data.monitoringSchedule.weekly} />
          <MonitoringColumn title="Monthly" items={data.monitoringSchedule.monthly} />
        </div>
      </SubSection>
    </div>
  );
}
