"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.ComponentProps<typeof ProgressPrimitive.Root> {
  variant?: "default" | "gradient" | "glow"
}

function Progress({
  className,
  value,
  variant = "default",
  ...props
}: ProgressProps) {
  const indicatorClasses = {
    default: "bg-primary",
    gradient: "bg-gradient-to-r from-[oklch(0.80_0.12_240)] via-[oklch(0.70_0.15_250)] to-[oklch(0.62_0.19_255)]",
    glow: "bg-primary shadow-[0_0_10px_oklch(0.62_0.19_255_/_0.5)]",
  }

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full flex-1 transition-all duration-300",
          indicatorClasses[variant]
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
