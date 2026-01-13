"use client";

import { cn } from "@/lib/utils";

interface GradientBorderProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  animate?: boolean;
}

export function GradientBorder({
  children,
  className,
  innerClassName,
  animate = false,
}: GradientBorderProps) {
  return (
    <div
      className={cn("relative rounded-2xl p-px", className)}
      style={{
        // Monochrome gradient - no blue/purple, uses white opacity variations
        background: animate
          ? "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05), rgba(255,255,255,0.02), rgba(255,255,255,0.10))"
          : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        backgroundSize: animate ? "300% 300%" : "100% 100%",
        animation: animate ? "gradientShift 12s ease infinite" : "none",
      }}
    >
      <div
        className={cn(
          "h-full rounded-[15px] bg-[#0a0a0a]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
