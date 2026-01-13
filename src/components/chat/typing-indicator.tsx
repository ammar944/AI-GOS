"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-5 py-2">
      {/* Avatar - flat monochrome, no animation */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "var(--bg-surface, #101010)" }}
      >
        <Bot
          className="w-4 h-4"
          style={{ color: "var(--text-tertiary, #666666)" }}
        />
      </div>

      {/* Bubble with typing dots */}
      <div
        className="px-4 py-3"
        style={{
          background: "var(--bg-card, #0d0d0d)",
          border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
          borderRadius: "16px 16px 16px 4px",
        }}
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "var(--text-tertiary, #666666)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
