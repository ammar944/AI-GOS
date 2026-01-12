"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fadeUp, durations } from "@/lib/motion";
import { useCounter } from "@/hooks/use-counter";

interface StatCardProps {
  value: number;
  label: string;
  icon?: React.ReactNode;
  delay?: number;
  className?: string;
}

export function StatCard({
  value,
  label,
  icon,
  delay = 0,
  className,
}: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  const animatedValue = useCounter(value, 2000);

  return (
    <motion.div
      className={cn("relative overflow-hidden p-6", className)}
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={{ delay: delay / 1000, duration: durations.normal }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hover glow effect */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          inset: -20,
          background:
            "radial-gradient(circle at center, rgba(59, 130, 246, 0.15), transparent 70%)",
        }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: durations.fast }}
      />

      {/* Icon */}
      {icon && (
        <div className="mb-4" style={{ opacity: 0.6 }}>
          {icon}
        </div>
      )}

      {/* Animated number */}
      <div
        className="font-mono text-[42px] font-bold"
        style={{
          letterSpacing: "-0.03em",
          fontFamily: "var(--font-mono)",
          background: "var(--gradient-text)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {animatedValue.toLocaleString()}
      </div>

      {/* Label */}
      <div
        className="text-[13px] font-medium mt-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </div>

      {/* Bottom line accent */}
      <motion.div
        className="absolute bottom-0 left-6 h-px"
        style={{
          background:
            "linear-gradient(90deg, rgba(59, 130, 246, 0.5), transparent)",
        }}
        animate={{ width: hovered ? "calc(100% - 48px)" : "40%" }}
        transition={{ duration: durations.normal }}
      />
    </motion.div>
  );
}
