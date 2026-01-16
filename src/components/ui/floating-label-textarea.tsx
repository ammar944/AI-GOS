"use client";

import { useState, useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { durations } from "@/lib/motion";

interface FloatingLabelTextareaProps
  extends Omit<React.ComponentPropsWithoutRef<"textarea">, "placeholder"> {
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  rows?: number;
}

export function FloatingLabelTextarea({
  label,
  value,
  onChange,
  className,
  id: providedId,
  rows = 4,
  ...props
}: FloatingLabelTextareaProps) {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const textareaId = providedId || generatedId;

  const hasValue = Boolean(value && value.length > 0);
  const isActive = focused || hasValue;

  return (
    <div className={cn("relative pt-6", className)}>
      <motion.label
        htmlFor={textareaId}
        className="absolute left-0 top-0 text-[14px] font-medium pointer-events-none origin-left z-10"
        animate={{
          y: isActive ? 0 : 24,
          color: isActive ? "var(--accent-blue)" : "var(--text-tertiary)",
        }}
        transition={{ duration: durations.normal }}
      >
        {label}
      </motion.label>

      <textarea
        id={textareaId}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        rows={rows}
        className="relative w-full bg-transparent border-none outline-none py-3 text-[16px] resize-none z-0"
        style={{
          color: "var(--text-primary)",
          borderBottom: "1px solid var(--border-default)",
        }}
        {...props}
      />

      {/* Gradient focus line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, var(--accent-blue), var(--accent-purple))",
          transformOrigin: "left",
        }}
        animate={{
          scaleX: focused ? 1 : 0,
        }}
        transition={{ duration: durations.normal }}
      />
    </div>
  );
}
