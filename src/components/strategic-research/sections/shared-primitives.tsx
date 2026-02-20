"use client";

import { Check, CheckCircle2, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_COLORS } from "../ui-tokens";
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
// Core Primitive Components (Dashboard Design Language)
// =============================================================================

/**
 * Section header with accent bar — clean typography matching dashboard.
 * Uses the same font hierarchy: Instrument Sans headings, Inter body.
 */
export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 mb-6">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-4 rounded-full bg-blue-500/60" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40 font-[family-name:var(--font-heading)]">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

/**
 * Clean list item with subtle blue check accent.
 */
export function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 py-0.5">
      <div className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-blue-500/[0.08]">
        <Check className="size-2.5 text-blue-400/80" />
      </div>
      <span className="text-sm text-white/70 leading-relaxed">{children}</span>
    </li>
  );
}

/**
 * Boolean check/cross indicator — refined with subtle backgrounds.
 */
export function BoolCheck({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      {value ? (
        <div className="flex size-5 items-center justify-center rounded-full bg-emerald-500/[0.1]">
          <CheckCircle2 className="size-3.5 text-emerald-400/80" />
        </div>
      ) : (
        <div className="flex size-5 items-center justify-center rounded-full bg-red-500/[0.1]">
          <XCircle className="size-3.5 text-red-400/60" />
        </div>
      )}
      <span className={cn(
        "text-sm",
        value ? "text-white/80" : "text-white/40"
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
 * Score bar with gradient fill — matches dashboard's metric aesthetic.
 */
export function ScoreDisplay({ label, score, max = 10 }: { label: string; score: number; max?: number }) {
  const percentage = (score / max) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] text-white/50">{label}</span>
        <span className={cn(
          "text-[13px] font-medium tabular-nums font-[family-name:var(--font-mono)]",
          percentage >= 70 ? "text-blue-400/90" : percentage >= 50 ? "text-amber-400/80" : "text-red-400/80"
        )}>
          {score}/{max}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.04]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            percentage >= 70
              ? "bg-gradient-to-r from-blue-500/80 to-blue-400/60"
              : percentage >= 50
                ? "bg-gradient-to-r from-amber-500/70 to-amber-400/50"
                : "bg-gradient-to-r from-red-500/70 to-red-400/50"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// New Primitives for Section Redesigns
// =============================================================================

/**
 * Glass-morphism data card — for stat grids like Category Snapshot.
 * Matches dashboard card: bg-white/[0.02], border-white/[0.06].
 */
export function DataCard({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(
      "rounded-lg bg-white/[0.02] border border-white/[0.06] px-3.5 py-2.5",
      className
    )}>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/30 mb-1">
        {label}
      </p>
      <div className="text-[13px] font-medium text-white/85">
        {children}
      </div>
    </div>
  );
}

/**
 * Insight/driver card — icon + title + description.
 * Used for psychological drivers, objections, key insights, etc.
 */
export function InsightCard({
  icon: Icon,
  iconColor = "text-blue-400/70",
  title,
  children,
  accentBorder = false,
  className,
}: {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  children: React.ReactNode;
  accentBorder?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(
      "rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5",
      accentBorder && "border-l-2 border-l-blue-500/40",
      className
    )}>
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-white/[0.04]">
            <Icon className={cn("size-3", iconColor)} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white/85 leading-snug">{title}</p>
          <div className="mt-1 text-sm text-white/55 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Status banner for verdict/recommendation displays.
 * Uses the status color maps with a frosted-glass look.
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
  return (
    <div className={cn(
      "rounded-xl border p-4",
      colorClass,
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">
          {statusLabel || "Status"}
        </div>
        <span className="text-[13px] font-semibold capitalize">{status.replace(/_/g, " ")}</span>
      </div>
      <div className="text-sm leading-relaxed opacity-90">{children}</div>
    </div>
  );
}

/**
 * Blue-tinted highlight block — for recommendations, positioning, callouts.
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
      "rounded-lg bg-blue-500/[0.04] border border-blue-500/[0.12] p-4",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Numbered step in an ordered list.
 */
export function NumberedStep({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-0.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500/[0.1] text-[11px] font-semibold text-blue-400/80 tabular-nums">
        {index}
      </span>
      <span className="text-sm text-white/70 leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}

/**
 * Warning/blocker list item with amber/orange accent.
 */
export function WarningItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 py-0.5">
      <div className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/[0.1]">
        <div className="size-1.5 rounded-full bg-amber-400/70" />
      </div>
      <span className="text-sm text-white/70 leading-relaxed">{children}</span>
    </li>
  );
}

/**
 * Priority badge with consistent styling.
 */
export function PriorityBadge({
  priority,
  className,
}: {
  priority: "high" | "medium" | "low" | "primary" | "secondary" | "tertiary" | string;
  className?: string;
}) {
  const colors: Record<string, string> = {
    high: "bg-blue-500/[0.1] text-blue-400/80 border-blue-500/[0.15]",
    primary: "bg-blue-500/[0.1] text-blue-400/80 border-blue-500/[0.15]",
    medium: "bg-amber-500/[0.1] text-amber-400/70 border-amber-500/[0.15]",
    secondary: "bg-white/[0.04] text-white/50 border-white/[0.08]",
    low: "bg-white/[0.04] text-white/40 border-white/[0.08]",
    tertiary: "bg-white/[0.03] text-white/35 border-white/[0.06]",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border",
      colors[priority] || colors.low,
      className
    )}>
      {priority}
    </span>
  );
}

/**
 * Responsive card grid with consistent gaps.
 */
export function CardGrid({
  cols = 3,
  children,
  className,
}: {
  cols?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  const colClasses = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-2.5", colClasses[cols], className)}>
      {children}
    </div>
  );
}

/**
 * Overall score display — large centered number with glow effect.
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
  const percentage = (score / max) * 100;

  return (
    <div className="rounded-lg bg-blue-500/[0.04] border border-blue-500/[0.12] py-4 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/35 mb-1">
        {label}
      </p>
      <p className={cn(
        "text-3xl font-bold tabular-nums font-[family-name:var(--font-mono)]",
        percentage >= 70 ? "text-blue-400" : percentage >= 50 ? "text-amber-400" : "text-red-400"
      )}
        style={{
          textShadow: percentage >= 70
            ? "0 0 24px rgba(96, 165, 250, 0.25)"
            : "none"
        }}
      >
        {score.toFixed(1)}<span className="text-lg text-white/25">/{max}</span>
      </p>
    </div>
  );
}
