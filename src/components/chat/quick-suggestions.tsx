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
    <div
      className="flex gap-2 overflow-x-auto px-5 py-3 scrollbar-hide"
      style={{
        // Hide scrollbar across browsers
        msOverflowStyle: "none",
        scrollbarWidth: "none",
      }}
    >
      {SUGGESTIONS.map((suggestion, index) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          whileHover={!disabled ? { scale: 1.02 } : undefined}
          whileTap={!disabled ? { scale: 0.98 } : undefined}
          onClick={() => !disabled && onSelect(suggestion)}
          disabled={disabled}
          className="flex-shrink-0 cursor-pointer transition-colors duration-200"
          style={{
            padding: "8px 14px",
            background: disabled
              ? "rgba(255, 255, 255, 0.02)"
              : "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "9999px",
            fontSize: "13px",
            color: disabled
              ? "rgba(160, 160, 160, 0.5)"
              : "var(--text-secondary, #a0a0a0)",
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.10)";
              e.currentTarget.style.color = "#ffffff";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.color = "var(--text-secondary, #a0a0a0)";
            }
          }}
        >
          {suggestion}
        </motion.button>
      ))}
    </div>
  );
}
