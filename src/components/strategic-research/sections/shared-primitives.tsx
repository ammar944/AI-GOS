"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_COLORS } from "../ui-tokens";
import { useFieldHighlight } from "@/components/strategic-blueprint/use-field-highlight";
import type {
  ValidationStatus,
  RiskRating,
  OfferRecommendation,
} from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Shared Props Interface for Editable Content
// =============================================================================

export interface EditableContentProps {
  isEditing?: boolean;
  onFieldChange?: (fieldPath: string, newValue: unknown) => void;
}

// =============================================================================
// FieldHighlightWrapper — wraps any content with chat-edit highlight support
// =============================================================================

/**
 * Wraps a field's content with data attributes and CSS classes so the
 * BlueprintEditContext can highlight it when the chat agent targets it.
 *
 * Use this around the outermost element of any named field in a section
 * content component. When `fieldPath` is undefined or no edit is targeting
 * this field, it renders a plain pass-through div with no visual overhead.
 */
export function FieldHighlightWrapper({
  fieldPath,
  children,
  className,
}: {
  fieldPath?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { highlightProps } = useFieldHighlight(fieldPath ?? '');

  // If no fieldPath, render plain wrapper (hook still called unconditionally)
  if (!fieldPath) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      {...highlightProps}
      className={cn(highlightProps.className, className)}
    >
      {children}
    </div>
  );
}

// =============================================================================
// Status Color Maps
// =============================================================================

export const VALIDATION_STATUS_COLORS: Record<ValidationStatus, string> = {
  validated: STATUS_BADGE_COLORS.success,
  workable: STATUS_BADGE_COLORS.warning,
  invalid: STATUS_BADGE_COLORS.danger,
};

export const RISK_COLORS: Record<RiskRating, string> = {
  low: STATUS_BADGE_COLORS.success,
  medium: STATUS_BADGE_COLORS.warning,
  high: STATUS_BADGE_COLORS.caution,
  critical: STATUS_BADGE_COLORS.danger,
};

export const OFFER_RECOMMENDATION_COLORS: Record<OfferRecommendation, string> = {
  proceed: STATUS_BADGE_COLORS.success,
  adjust_messaging: STATUS_BADGE_COLORS.warning,
  adjust_pricing: STATUS_BADGE_COLORS.warning,
  icp_refinement_needed: STATUS_BADGE_COLORS.caution,
  major_offer_rebuild: STATUS_BADGE_COLORS.danger,
};

// =============================================================================
// Core Primitive Components (Flat Design Language)
// =============================================================================

/**
 * Section label — uppercase tertiary text.
 */
export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 mb-8">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)] font-[family-name:var(--font-heading)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * List item with subtle dot accent.
 */
export function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 py-[6px]">
      <div className="w-1 h-1 rounded-full bg-[rgb(49,53,63)] mt-[9px] shrink-0" />
      <span className="text-[13.5px] text-[rgb(205,208,213)] leading-[1.6]">{children}</span>
    </li>
  );
}

/**
 * Boolean check indicator with simple dots.
 */
export function BoolCheck({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      {value ? (
        <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-[rgb(49,53,63)] shrink-0" />
      )}
      <span className={cn(
        "text-[13.5px]",
        value ? "text-[rgb(205,208,213)]" : "text-[rgb(100,105,115)]"
      )}>
        {label}
      </span>
    </div>
  );
}

/**
 * Placeholder for sections with no data.
 */
export function EmptyExplanation({ message }: { message: string }) {
  return (
    <p className="text-sm italic text-white/30">
      {message}
    </p>
  );
}

/**
 * Score row with thin bar — horizontal layout.
 */
export function ScoreDisplay({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const percentage = (score / max) * 100;
  const color = percentage >= 70 ? "text-[rgb(54,94,255)]" : percentage >= 50 ? "text-[#f59e0b]" : "text-[#ef4444]";
  const barColor = percentage >= 70 ? "bg-[rgb(54,94,255)]" : percentage >= 50 ? "bg-[#f59e0b]" : "bg-[#ef4444]";

  return (
    <div className="flex items-center py-[10px] border-b border-[rgb(31,31,31)] first:border-t">
      <span className="flex-1 text-[13.5px] text-[rgb(205,208,213)]">{label}</span>
      <div className="w-[110px] h-[2px] bg-[rgb(31,31,31)] mx-5 rounded-[1px] overflow-hidden">
        <div
          className={cn("h-full rounded-[1px]", barColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn("text-[13px] font-medium tabular-nums w-9 text-right", color)}>
        {score}/{max}
      </span>
    </div>
  );
}

// =============================================================================
// New Primitives for Section Redesigns
// =============================================================================

/**
 * Key-value row — flat data display replacing DataCard.
 * Accepts an optional `fieldPath` to enable chat-edit highlighting.
 */
export function DataCard({
  label,
  children,
  className,
  fieldPath,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Dot-notation path to this field in the blueprint section data */
  fieldPath?: string;
}) {
  const { highlightProps } = useFieldHighlight(fieldPath ?? '');
  const highlightClass = fieldPath ? highlightProps.className : undefined;
  const highlightAttrs = fieldPath
    ? { 'data-field-path': highlightProps['data-field-path'], 'data-highlight-state': highlightProps['data-highlight-state'] }
    : {};

  return (
    <div
      {...highlightAttrs}
      className={cn(
        "flex justify-between items-baseline py-[11px] border-b border-[rgb(31,31,31)]",
        highlightClass,
        className
      )}
    >
      <span className="text-[13.5px] text-[rgb(205,208,213)]">
        {label}
      </span>
      <span className="text-[13.5px] font-medium text-[rgb(252,252,250)] tabular-nums text-right">
        {children}
      </span>
    </div>
  );
}

/**
 * Prose block — title + body text for insights and drivers.
 * Icon prop kept for backwards compatibility but not rendered.
 */
export function InsightCard({
  icon: _Icon,
  iconColor: _iconColor = "text-primary/70",
  title,
  children,
  accentBorder: _accentBorder = false,
  className,
  fieldPath,
}: {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  children: React.ReactNode;
  accentBorder?: boolean;
  className?: string;
  /** Dot-notation path to this field in the blueprint section data */
  fieldPath?: string;
}) {
  const { highlightProps } = useFieldHighlight(fieldPath ?? '');
  const highlightClass = fieldPath ? highlightProps.className : undefined;
  const highlightAttrs = fieldPath
    ? { 'data-field-path': highlightProps['data-field-path'], 'data-highlight-state': highlightProps['data-highlight-state'] }
    : {};

  return (
    <div
      {...highlightAttrs}
      className={cn(
        "mb-[18px]",
        highlightClass,
        className
      )}
    >
      <p className="text-[14px] font-medium text-[rgb(252,252,250)] leading-snug mb-[3px]">{title}</p>
      <div className="text-[13.5px] text-[rgb(205,208,213)] leading-[1.65]">{children}</div>
    </div>
  );
}

/**
 * Status line — colored status text with border separators.
 */
export function StatusBanner({
  status,
  statusLabel,
  colorClass,
  children,
  className,
}: {
  status: string;
  statusLabel?: string;
  colorClass: string;
  children: React.ReactNode;
  className?: string;
}) {
  const textColorMap: Record<string, string> = {
    success: "text-[#22c55e]",
    warning: "text-[#f59e0b]",
    danger: "text-[#ef4444]",
  };

  // Extract text color from colorClass — try to find a matching text-color,
  // otherwise derive from the colorClass string
  const statusColor = colorClass.includes("22c55e") || colorClass.includes("green")
    ? textColorMap.success
    : colorClass.includes("f59e0b") || colorClass.includes("amber")
      ? textColorMap.warning
      : colorClass.includes("ef4444") || colorClass.includes("red")
        ? textColorMap.danger
        : colorClass;

  return (
    <div className={cn(
      "border-t border-b border-[rgb(31,31,31)] py-3 mb-10",
      className
    )}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[rgb(100,105,115)]">
          {statusLabel || "Status"}
        </span>
        <span className={cn("text-[14px] font-medium capitalize", statusColor)}>
          {status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="text-[13.5px] text-[rgb(205,208,213)] leading-relaxed">{children}</div>
    </div>
  );
}

/**
 * Left-border callout block.
 */
export function HighlightBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "pl-4 border-l-2 border-[rgb(31,31,31)]",
      className
    )}>
      <div className="text-[13.5px] text-[rgb(205,208,213)] leading-[1.65]">{children}</div>
    </div>
  );
}

/**
 * Numbered step — plain number with body text.
 */
export function NumberedStep({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-[14px] py-[7px]">
      <span className="text-[12px] font-normal text-[rgb(100,105,115)] tabular-nums min-w-[20px] pt-[2px] shrink-0">
        {String(index).padStart(2, "0")}
      </span>
      <span className="text-[13.5px] text-[rgb(205,208,213)] leading-[1.6]">{children}</span>
    </li>
  );
}

/**
 * Warning item with amber dot accent.
 */
export function WarningItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 py-[6px]">
      <div className="w-[5px] h-[5px] rounded-full bg-[#f59e0b] mt-[13px] shrink-0" />
      <span className="text-[13.5px] text-[rgb(205,208,213)] leading-[1.6]">{children}</span>
    </li>
  );
}

/**
 * Priority label — colored text only, no pill.
 */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: "high" | "medium" | "low" | "primary" | "secondary" | "tertiary" | string;
  className?: string;
}) {
  const colors: Record<string, string> = {
    high: "text-[rgb(54,94,255)]",
    primary: "text-[rgb(54,94,255)]",
    medium: "text-[rgb(100,105,115)]",
    secondary: "text-[rgb(100,105,115)]",
    low: "text-[rgb(100,105,115)]",
    tertiary: "text-[rgb(100,105,115)]",
  };

  return (
    <span className={cn(
      "text-[12px] font-medium tabular-nums",
      colors[priority] || colors.low,
      className
    )}>
      {priority}
    </span>
  );
}

/**
 * Stacked row container — replaces grid layout for DataCard rows.
 */
export function CardGrid({
  cols: _cols = 3,
  children,
  className,
}: {
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col border-t border-[rgb(31,31,31)]", className)}>
      {children}
    </div>
  );
}

/**
 * Overall score display — large centered number, no container.
 */
export function OverallScoreDisplay({
  label,
  score,
  max = 10,
}: {
  label: string;
  score: number;
  max?: number;
}) {
  return (
    <div className="text-center mb-12">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[rgb(100,105,115)] mb-[6px]">
        {label}
      </p>
      <p className="text-[52px] font-light tracking-[-0.04em] text-[rgb(252,252,250)] tabular-nums leading-none">
        {score.toFixed(1)}<span className="text-[20px] font-light text-[rgb(49,53,63)]">/{max}</span>
      </p>
    </div>
  );
}
