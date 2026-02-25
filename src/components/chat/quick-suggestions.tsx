"use client";

import { motion } from "framer-motion";

interface QuickSuggestionsProps {
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
  blueprint?: Record<string, unknown>;
}

const FALLBACK_SUGGESTIONS = [
  "Explain competitors",
  "Summarize key insights",
  "Adjust budget targets",
];

/**
 * Generate dynamic suggestions based on blueprint data.
 * Each check is wrapped in try/catch to handle malformed data.
 */
function getDynamicSuggestions(blueprint: Record<string, unknown>): string[] {
  const suggestions: string[] = [];

  try {
    const offer = blueprint.offerAnalysisViability as Record<string, unknown> | undefined;
    const strength = offer?.offerStrength as Record<string, unknown> | undefined;
    const score = strength?.overallScore as number | undefined;
    if (score !== undefined && score < 6) {
      suggestions.push(`Improve offer score — currently ${score}/10`);
    }
  } catch { /* skip */ }

  try {
    const icp = blueprint.icpAnalysisValidation as Record<string, unknown> | undefined;
    const verdict = icp?.finalVerdict as Record<string, unknown> | undefined;
    const status = verdict?.status as string | undefined;
    if (status && status !== "ready_to_run") {
      suggestions.push("Review ICP validation status");
    }
  } catch { /* skip */ }

  try {
    const synthesis = blueprint.crossAnalysisSynthesis as Record<string, unknown> | undefined;
    const positioning = synthesis?.recommendedPositioning as string | undefined;
    if (!positioning || positioning.length < 50) {
      suggestions.push("Expand positioning statement");
    }
  } catch { /* skip */ }

  try {
    const competitors = blueprint.competitorAnalysis as Record<string, unknown> | undefined;
    const list = competitors?.competitors as unknown[] | undefined;
    if (!list || list.length === 0) {
      suggestions.push("Add competitor analysis");
    }
  } catch { /* skip */ }

  try {
    const synthesis = blueprint.crossAnalysisSynthesis as Record<string, unknown> | undefined;
    const hooks = synthesis?.adHooks as unknown[] | undefined;
    if (!hooks || hooks.length < 3) {
      suggestions.push("Generate more ad hooks");
    }
  } catch { /* skip */ }

  return suggestions;
}

export function QuickSuggestions({ onSelect, disabled, blueprint }: QuickSuggestionsProps) {
  // Build suggestions: dynamic first (up to 2), then fallbacks to reach max 4
  const dynamic = blueprint ? getDynamicSuggestions(blueprint).slice(0, 2) : [];
  const needed = 4 - dynamic.length;
  const fallbacks = FALLBACK_SUGGESTIONS.slice(0, needed);
  const suggestions = [...dynamic, ...fallbacks];

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          className="flex-shrink-0 cursor-pointer transition-all duration-200"
          style={{
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 500,
            color: disabled
              ? "var(--text-quaternary, #444444)"
              : "var(--text-tertiary, #666666)",
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = "var(--border-default, rgba(255, 255, 255, 0.12))";
              e.currentTarget.style.color = "var(--text-secondary, #a0a0a0)";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.borderColor = "var(--border-subtle, rgba(255, 255, 255, 0.08))";
              e.currentTarget.style.color = "var(--text-tertiary, #666666)";
            }
          }}
        >
          {suggestion}
        </motion.button>
      ))}
    </div>
  );
}
