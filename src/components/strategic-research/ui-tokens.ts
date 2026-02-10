export const RESEARCH_SHELL_CLASS =
  "rounded-xl border border-[var(--border-default)] bg-[rgba(12,14,19,0.62)] shadow-[var(--shadow-card)] backdrop-blur-sm";

export const RESEARCH_TRANSPARENT_PANEL_CLASS =
  "rounded-2xl border border-[var(--border-subtle)] bg-[rgba(7,9,14,0.48)] backdrop-blur-xl";

export const RESEARCH_SUBTLE_BLOCK_CLASS =
  "rounded-lg border border-[var(--border-default)] bg-[rgba(12,14,19,0.6)]";

export const STATUS_BADGE_COLORS = {
  success: "bg-[rgba(34,197,94,0.14)] text-[rgb(134,239,172)] border-[rgba(34,197,94,0.34)]",
  warning: "bg-[rgba(245,158,11,0.14)] text-[rgb(253,186,116)] border-[rgba(245,158,11,0.34)]",
  caution: "bg-[rgba(249,115,22,0.14)] text-[rgb(253,186,116)] border-[rgba(249,115,22,0.34)]",
  danger: "bg-[rgba(239,68,68,0.14)] text-[rgb(252,165,165)] border-[rgba(239,68,68,0.34)]",
  info: "bg-[rgba(54,94,255,0.14)] text-[rgb(147,197,253)] border-[rgba(54,94,255,0.34)]",
  neutral: "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]",
} as const;
