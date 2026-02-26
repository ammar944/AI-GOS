"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface ThinkingBlockProps {
  content: string;
  durationMs?: number;
  defaultOpen?: boolean;
}

export function ThinkingBlock({
  content,
  durationMs,
  defaultOpen = false,
}: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const label =
    durationMs !== undefined
      ? `Thinking for ${(durationMs / 1000).toFixed(1)}s`
      : "Thinking";

  return (
    <div
      style={{
        borderLeft: "2px solid var(--border-default, rgba(255, 255, 255, 0.12))",
        paddingLeft: "12px",
        margin: "8px 0",
      }}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 cursor-pointer bg-transparent border-0 p-0 outline-none"
        aria-expanded={isOpen}
      >
        <ChevronRight
          className="w-3 h-3"
          style={{
            color: "var(--text-tertiary, #666666)",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
        <span
          style={{
            fontSize: "11.5px",
            color: "var(--text-tertiary, #666666)",
          }}
        >
          {label}
        </span>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <p
              style={{
                fontStyle: "italic",
                fontSize: "12.5px",
                color: "var(--text-tertiary, #666666)",
                whiteSpace: "pre-wrap",
                marginTop: "6px",
              }}
            >
              {content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
