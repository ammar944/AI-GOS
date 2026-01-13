"use client";

import { motion } from "framer-motion";

export function TypingIndicator() {
  return (
    <div className="flex gap-3 px-5 py-2">
      {/* Avatar placeholder to align with MessageBubble */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255, 255, 255, 0.1)" }}
      >
        <motion.div
          className="w-4 h-4 rounded-full"
          style={{
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Bubble with typing dots */}
      <div
        className="px-4 py-3"
        style={{
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px 16px 16px 4px",
        }}
      >
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -6, 0],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
              className="w-2 h-2 rounded-full"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
