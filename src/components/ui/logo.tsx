import * as React from "react"
import { Cloud } from "lucide-react"

import { cn } from "@/lib/utils"
import { GradientText } from "./gradient-text"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
  showIcon?: boolean
  iconOnly?: boolean
}

const sizeClasses = {
  sm: {
    container: "gap-1.5",
    icon: "size-5",
    text: "text-lg",
  },
  md: {
    container: "gap-2",
    icon: "size-6",
    text: "text-xl",
  },
  lg: {
    container: "gap-2.5",
    icon: "size-8",
    text: "text-2xl",
  },
  xl: {
    container: "gap-3",
    icon: "size-10",
    text: "text-3xl",
  },
}

function Logo({
  className,
  size = "md",
  showIcon = true,
  iconOnly = false,
}: LogoProps) {
  const sizes = sizeClasses[size]

  if (iconOnly) {
    return (
      <div
        className={cn(
          "relative inline-flex items-center justify-center",
          className
        )}
      >
        <Cloud
          className={cn(
            sizes.icon,
            "text-primary drop-shadow-[0_0_10px_oklch(0.62_0.19_255_/_0.5)]"
          )}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "inline-flex items-center font-bold",
        sizes.container,
        sizes.text,
        className
      )}
    >
      {showIcon && (
        <Cloud
          className={cn(
            sizes.icon,
            "text-primary drop-shadow-[0_0_10px_oklch(0.62_0.19_255_/_0.5)]"
          )}
        />
      )}
      <span className="flex items-baseline">
        <span className="text-white">AI</span>
        <GradientText variant="default" className="font-bold">
          GOS
        </GradientText>
      </span>
    </div>
  )
}

function LogoMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const iconSizes = {
    sm: "size-8",
    md: "size-12",
    lg: "size-16",
  }

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.62_0.19_255)] to-[oklch(0.55_0.22_260)] p-2",
        "shadow-[0_0_30px_oklch(0.62_0.19_255_/_0.4)]",
        className
      )}
    >
      <Cloud className={cn(iconSizes[size], "text-white")} />
    </div>
  )
}

export { Logo, LogoMark }
