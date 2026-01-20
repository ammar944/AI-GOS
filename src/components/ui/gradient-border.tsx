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
        // SaaSLaunch blue gradient border
        background: animate
          ? "linear-gradient(135deg, rgba(54, 94, 255, 0.3), rgba(0, 111, 255, 0.15), rgba(54, 94, 255, 0.1), rgba(0, 111, 255, 0.2))"
          : "linear-gradient(135deg, rgba(54, 94, 255, 0.2), rgba(255, 255, 255, 0.05), rgba(54, 94, 255, 0.1))",
        backgroundSize: animate ? "300% 300%" : "100% 100%",
        animation: animate ? "gradientShift 12s ease infinite" : "none",
      }}
    >
      <div
        className={cn(
          "h-full rounded-[15px]",
          innerClassName
        )}
        style={{ background: 'var(--bg-surface)' }}
      >
        {children}
      </div>
    </div>
  );
}
