"use client";

import { useState, useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { durations } from "@/lib/motion";

interface FloatingLabelInputProps
  extends React.ComponentPropsWithoutRef<"input"> {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export function FloatingLabelInput({
  label,
  value,
  onChange,
  className,
  id: providedId,
  placeholder,
  ...props
}: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const inputId = providedId || generatedId;

  const hasValue = Boolean(value && value.length > 0);
  const isActive = focused || hasValue;
  const hasLabel = Boolean(label);

  return (
    <div className={cn(hasLabel ? "relative pt-6" : "relative", className)}>
      {hasLabel && (
        <motion.label
          htmlFor={inputId}
          className="absolute left-0 top-0 text-[14px] font-medium pointer-events-none origin-left z-10"
          animate={{
            y: isActive ? 0 : 24,
            color: isActive ? "var(--accent-blue)" : "var(--text-tertiary)",
          }}
          transition={{ duration: durations.normal }}
        >
          {label}
        </motion.label>
      )}

      <input
        id={inputId}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="relative w-full bg-transparent border-none outline-none py-3 text-[16px] z-0"
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
