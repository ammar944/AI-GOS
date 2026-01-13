"use client";

import { motion } from "framer-motion";

interface QuickSuggestionsProps {
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}

const SUGGESTIONS = [
  "Adjust budget targets",
  "Add a channel",
  "Explain competitors",
  "Summarize insights",
];

export function QuickSuggestions({ onSelect, disabled }: QuickSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {SUGGESTIONS.map((suggestion, index) => (
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
