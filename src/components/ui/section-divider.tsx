import * as React from "react"

import { cn } from "@/lib/utils"

interface SectionDividerProps {
  className?: string
  variant?: "default" | "gradient" | "glow"
}

function SectionDivider({
  className,
  variant = "default",
}: SectionDividerProps) {
  const variants = {
    default: "bg-border",
    gradient: "bg-gradient-to-r from-transparent via-primary/50 to-transparent",
    glow: "bg-primary/30 shadow-[0_0_10px_oklch(0.62_0.19_255_/_0.3)]",
  }

  return (
    <div
      className={cn(
        "h-px w-full",
        variants[variant],
        className
      )}
      role="separator"
    />
  )
}

interface SectionHeaderProps {
  className?: string
  title: string
  description?: string
  badge?: string
  align?: "left" | "center"
}

function SectionHeader({
  className,
  title,
  description,
  badge,
  align = "center",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "space-y-2",
        align === "center" && "text-center",
        className
      )}
    >
      {badge && (
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary",
            align === "center" && "mx-auto"
          )}
        >
          {badge}
        </div>
      )}
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  )
}

export { SectionDivider, SectionHeader }
