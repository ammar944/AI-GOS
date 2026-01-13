"use client";

import { motion } from "framer-motion";

export function StreamingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.4, repeat: Infinity }}
      style={{
        display: "inline-block",
        width: 10,
        height: 20,
        background: "linear-gradient(180deg, #3b82f6, #8b5cf6)",
        borderRadius: 2,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        boxShadow: "0 0 20px rgba(59,130,246,0.5)",
      }}
    />
  );
}
