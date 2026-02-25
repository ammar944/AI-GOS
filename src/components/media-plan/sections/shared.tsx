import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESEARCH_SUBTLE_BLOCK_CLASS, STATUS_BADGE_COLORS } from "@/components/strategic-research/ui-tokens";
import { EditableText } from "@/components/strategic-research/editable/editable-text";
import type { KPITarget } from "@/lib/media-plan/types";

// Re-export for consumers
export { RESEARCH_SUBTLE_BLOCK_CLASS, STATUS_BADGE_COLORS };
export { EditableText };

// =============================================================================
// Editing prop types
// =============================================================================

export interface EditingProps {
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

// =============================================================================
// Shared components
// =============================================================================

export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 space-y-3">
      <h3
        className="border-l-4 pl-3 text-sm font-semibold uppercase tracking-wide"
        style={{
          color: "var(--text-tertiary)",
          borderColor: "var(--accent-blue)",
          fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
          letterSpacing: "0.05em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export function InfoCard({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4")}>
      <p className="mb-1 text-xs uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p
        className={cn("text-base font-medium", mono && "font-mono")}
        style={{
          color: "var(--text-heading)",
          ...(mono ? { fontFamily: "var(--font-mono), monospace" } : {}),
        }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

export function StatusBadge({ label, variant }: { label: string; variant: keyof typeof STATUS_BADGE_COLORS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_BADGE_COLORS[variant],
      )}
    >
      {label}
    </span>
  );
}

export const FUNNEL_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  cold: "info",
  warm: "warning",
  hot: "danger",
};

export function FunnelBadge({ stage }: { stage: string }) {
  const variant = FUNNEL_COLORS[stage] ?? "neutral";
  return <StatusBadge label={stage} variant={variant} />;
}

export const PRIORITY_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  primary: "info",
  secondary: "neutral",
  testing: "warning",
};

export function PriorityBadge({ priority }: { priority: string }) {
  const variant = PRIORITY_COLORS[priority] ?? "neutral";
  return <StatusBadge label={priority} variant={variant} />;
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-default)",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}

export function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent-blue)" }} />
      <span style={{ color: "var(--text-secondary)" }}>{children}</span>
    </li>
  );
}

export function fmt$(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function fmtPct(n: number): string {
  return `${n}%`;
}

export function renderChipGroup(label: string, items: string[]) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Chip key={item}>{item}</Chip>
        ))}
      </div>
    </div>
  );
}

export function NamingRow({ label, pattern }: { label: string; pattern: string }) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <span className="w-20 shrink-0 font-medium" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <code className="font-mono" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono), monospace" }}>{pattern}</code>
    </div>
  );
}

export function MonitoringColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn(RESEARCH_SUBTLE_BLOCK_CLASS, "p-4 space-y-2")}>
      <p className="text-xs font-semibold uppercase" style={{ color: "var(--accent-blue)" }}>
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <ListItem key={i}>{item}</ListItem>
        ))}
      </ul>
    </div>
  );
}

export function KPITable({
  kpis,
  indices,
  isEditing,
  onFieldChange,
}: {
  kpis: KPITarget[];
  indices: number[];
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Metric</th>
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Target</th>
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Timeframe</th>
            <th className="pb-2 pr-4 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Benchmark</th>
            <th className="pb-2 text-left text-xs font-medium uppercase" style={{ color: "var(--text-tertiary)" }}>Measurement</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((k, localIdx) => {
            const globalIdx = indices[localIdx];
            const hasEnrichedData = k.benchmarkRange || k.sourceConfidence != null || k.scenarioThresholds;
            return (
              <React.Fragment key={k.metric}>
                <tr className={cn("border-b border-[var(--border-subtle)]", hasEnrichedData && "border-b-0")}>
                  <td className="py-2 pr-4 font-medium" style={{ color: "var(--text-heading)" }}>{k.metric}</td>
                  <td className="py-2 pr-4 font-mono text-xs" style={{ fontFamily: "var(--font-mono), monospace", color: "var(--accent-blue)" }}>
                    {isEditing ? (
                      <EditableText
                        value={k.target}
                        onSave={(v) => onFieldChange?.(`${globalIdx}.target`, v)}
                      />
                    ) : (
                      k.target
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                    {isEditing ? (
                      <EditableText
                        value={k.timeframe}
                        onSave={(v) => onFieldChange?.(`${globalIdx}.timeframe`, v)}
                      />
                    ) : (
                      k.timeframe
                    )}
                  </td>
                  <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {isEditing ? (
                      <EditableText
                        value={k.benchmark}
                        onSave={(v) => onFieldChange?.(`${globalIdx}.benchmark`, v)}
                      />
                    ) : (
                      k.benchmarkRange ? (
                        <span className="font-mono" style={{ fontFamily: "var(--font-mono), monospace" }}>
                          Low: {k.benchmarkRange.low} | Mid: {k.benchmarkRange.mid} | High: {k.benchmarkRange.high}
                        </span>
                      ) : (
                        k.benchmark
                      )
                    )}
                    {/* Source confidence indicator */}
                    {k.sourceConfidence != null && (
                      <span
                        className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          background: k.sourceConfidence >= 4
                            ? "rgba(34,197,94,0.14)"
                            : k.sourceConfidence >= 2
                              ? "rgba(245,158,11,0.14)"
                              : "rgba(239,68,68,0.14)",
                          color: k.sourceConfidence >= 4
                            ? "rgb(134,239,172)"
                            : k.sourceConfidence >= 2
                              ? "rgb(253,186,116)"
                              : "rgb(252,165,165)",
                        }}
                      >
                        {k.sourceConfidence}/5
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-xs" style={{ color: "var(--text-secondary)" }}>{k.measurementMethod}</td>
                </tr>
                {/* Scenario thresholds sub-row (new) */}
                {k.scenarioThresholds && (
                  <tr className="border-b border-[var(--border-subtle)] last:border-0">
                    <td colSpan={5} className="pb-2 pl-4 text-xs">
                      <span className="font-mono" style={{ fontFamily: "var(--font-mono), monospace", color: "var(--text-tertiary)" }}>
                        Scenarios — Best: <span style={{ color: "rgb(134,239,172)" }}>{k.scenarioThresholds.best}</span>
                        {" | "}Base: <span style={{ color: "rgb(253,186,116)" }}>{k.scenarioThresholds.base}</span>
                        {" | "}Worst: <span style={{ color: "rgb(252,165,165)" }}>{k.scenarioThresholds.worst}</span>
                      </span>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const SEVERITY_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

export const CATEGORY_COLORS: Record<string, keyof typeof STATUS_BADGE_COLORS> = {
  budget: "warning",
  creative: "info",
  audience: "neutral",
  platform: "caution",
  compliance: "danger",
  market: "neutral",
};

