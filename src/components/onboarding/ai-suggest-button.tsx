"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AISuggestButtonProps {
  onClick: () => void;
  isLoading: boolean;
  fieldsFound: number;
  disabled?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AISuggestButton({
  onClick,
  isLoading,
  fieldsFound,
  disabled = false,
  className,
}: AISuggestButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-all duration-200",
        disabled && "cursor-not-allowed",
        !disabled && !isLoading && "cursor-pointer",
        isLoading && "cursor-default",
        className,
      )}
      style={{
        background: disabled
          ? "rgba(255, 255, 255, 0.04)"
          : isLoading
            ? "rgba(54, 94, 255, 0.15)"
            : "rgba(54, 94, 255, 0.12)",
        color: disabled
          ? "rgb(100, 105, 115)"
          : "rgb(54, 94, 255)",
        border: `1px solid ${
          disabled
            ? "rgba(255, 255, 255, 0.06)"
            : isLoading
              ? "rgba(54, 94, 255, 0.3)"
              : "rgba(54, 94, 255, 0.2)"
        }`,
        ...(disabled
          ? {}
          : {
              boxShadow: "0 0 0 0 rgba(54, 94, 255, 0)",
            }),
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.background = "rgba(54, 94, 255, 0.25)";
          e.currentTarget.style.borderColor = "rgba(54, 94, 255, 0.4)";
          e.currentTarget.style.boxShadow = "0 0 12px rgba(54, 94, 255, 0.15)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.background = "rgba(54, 94, 255, 0.12)";
          e.currentTarget.style.borderColor = "rgba(54, 94, 255, 0.2)";
          e.currentTarget.style.boxShadow = "0 0 0 0 rgba(54, 94, 255, 0)";
        }
      }}
      aria-label={
        isLoading
          ? `AI suggesting, ${fieldsFound} fields found`
          : "AI Suggest"
      }
    >
      {isLoading ? (
        <motion.div
          animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </motion.div>
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      <span>
        {isLoading
          ? fieldsFound > 0
            ? `${fieldsFound} field${fieldsFound !== 1 ? "s" : ""}...`
            : "Suggesting..."
          : "AI Suggest"}
      </span>
    </button>
  );
}
