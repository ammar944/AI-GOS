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
    <div className={cn("relative", className)}>
      <motion.label
        htmlFor={textareaId}
        className="absolute left-0 top-4 text-[14px] font-medium pointer-events-none origin-left"
        animate={{
          y: isActive ? -24 : 0,
          scale: isActive ? 0.85 : 1,
          color: isActive ? "var(--accent-blue)" : "var(--text-tertiary)",
        }}
        transition={{ duration: durations.normal }}
        style={{
          transformOrigin: "left",
        }}
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
        className="w-full bg-transparent border-none outline-none py-4 text-[16px] resize-none"
        style={{
          color: "var(--text-primary)",
          borderBottom: "1px solid var(--border-default)",
        }}
        aria-label={label}
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
