"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FieldSuggestionProps {
  suggestedValue: string;
  reasoning: string;
  confidence: number;
  onAccept: () => void;
  onReject: () => void;
  isVisible: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConfidenceBadge(confidence: number) {
  if (confidence >= 80)
    return { label: "High", color: "rgb(34, 197, 94)", bg: "rgba(34, 197, 94, 0.15)" };
  if (confidence >= 50)
    return { label: "Medium", color: "rgb(250, 204, 21)", bg: "rgba(250, 204, 21, 0.15)" };
  return { label: "Low", color: "rgb(239, 68, 68)", bg: "rgba(239, 68, 68, 0.15)" };
}

const TRUNCATE_LENGTH = 120;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FieldSuggestion({
  suggestedValue,
  reasoning,
  confidence,
  onAccept,
  onReject,
  isVisible,
}: FieldSuggestionProps) {
  const [expanded, setExpanded] = useState(false);
  const badge = getConfidenceBadge(confidence);
  const isTruncated = suggestedValue.length > TRUNCATE_LENGTH;
  const displayValue =
    isTruncated && !expanded
      ? suggestedValue.slice(0, TRUNCATE_LENGTH) + "\u2026"
      : suggestedValue;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, height: "auto", marginTop: 8 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className="rounded-lg p-3"
            style={{
              background: "rgba(54, 94, 255, 0.06)",
              border: "1px solid rgba(54, 94, 255, 0.2)",
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles
                  className="h-3.5 w-3.5"
                  style={{ color: "rgb(54, 94, 255)" }}
                />
                <span
                  className="text-[12px] font-medium"
                  style={{ color: "rgb(54, 94, 255)" }}
                >
                  AI Suggestion
                </span>
              </div>
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: badge.bg, color: badge.color }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: badge.color }}
                />
                {badge.label}
              </span>
            </div>

            {/* Suggested value */}
            <p
              className="text-[14px] leading-relaxed"
              style={{ color: "rgb(252, 252, 250)" }}
            >
              &ldquo;{displayValue}&rdquo;
              {isTruncated && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="ml-1 text-[12px] transition-colors hover:underline"
                  style={{ color: "rgb(54, 94, 255)" }}
                >
                  {expanded ? "show less" : "show more"}
                </button>
              )}
            </p>

            {/* Reasoning */}
            {reasoning && (
              <p
                className="text-[12px] mt-2 leading-relaxed"
                style={{ color: "rgb(100, 105, 115)" }}
              >
                {reasoning}
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[12px] font-medium transition-all duration-150"
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "rgb(100, 105, 115)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.color = "rgb(155, 160, 170)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                  e.currentTarget.style.color = "rgb(100, 105, 115)";
                }}
                aria-label="Dismiss suggestion"
              >
                <X className="h-3.5 w-3.5" />
                <span>Dismiss</span>
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[12px] font-medium transition-all duration-150"
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  color: "rgb(34, 197, 94)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(34, 197, 94, 0.3)";
                  e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(34, 197, 94, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(34, 197, 94, 0.25)";
                }}
                aria-label="Accept suggestion"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Accept</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
