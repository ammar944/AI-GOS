"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const glowCardVariants = cva(
  "relative rounded-xl border transition-all duration-200 hover:scale-[1.02]",
  {
    variants: {
      variant: {
        default:
          "bg-card text-card-foreground border-border hover:border-primary/30",
        glass:
          "bg-[oklch(0.12_0.02_265_/_0.4)] backdrop-blur-2xl border-[oklch(0.62_0.19_255_/_0.2)] hover:border-[oklch(0.62_0.19_255_/_0.5)] hover:bg-[oklch(0.15_0.03_265_/_0.5)]",
        solid:
          "bg-[oklch(0.18_0.04_265)] border-[oklch(0.30_0.04_265)] hover:border-primary/40",
      },
      glow: {
        none: "",
        sm: "shadow-[0_0_20px_oklch(0.62_0.19_255_/_0.1)] hover:shadow-[0_0_30px_oklch(0.62_0.19_255_/_0.3)]",
        md: "shadow-[0_0_25px_oklch(0.62_0.19_255_/_0.15)] hover:shadow-[0_0_40px_oklch(0.62_0.19_255_/_0.4)]",
        lg: "shadow-[0_0_35px_oklch(0.62_0.19_255_/_0.2)] hover:shadow-[0_0_60px_oklch(0.62_0.19_255_/_0.5)]",
        pulse:
          "animate-pulse-glow",
      },
    },
    defaultVariants: {
      variant: "default",
      glow: "sm",
    },
  }
)

interface GlowCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glowCardVariants> {
  /** Add decorative gradient border on hover */
  gradientBorder?: boolean
}

function GlowCard({
  className,
  variant,
  glow,
  gradientBorder = false,
  children,
  ...props
}: GlowCardProps) {
  if (gradientBorder) {
    return (
      <div
        className={cn(
          "relative p-[1px] rounded-xl transition-all duration-300",
          "bg-gradient-to-r from-transparent via-transparent to-transparent",
          "hover:from-[oklch(0.62_0.19_255_/_0.5)] hover:via-[oklch(0.75_0.10_270_/_0.5)] hover:to-[oklch(0.80_0.12_240_/_0.5)]",
          glow !== "none" && "shadow-[0_0_20px_oklch(0.62_0.19_255_/_0.1)] hover:shadow-[0_0_30px_oklch(0.62_0.19_255_/_0.2)]"
        )}
      >
        <div
          className={cn(
            "rounded-xl bg-card p-6",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      data-slot="glow-card"
      className={cn(glowCardVariants({ variant, glow, className }))}
      {...props}
    >
      {children}
    </div>
  )
}

function GlowCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glow-card-header"
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
}

function GlowCardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="glow-card-title"
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function GlowCardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="glow-card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function GlowCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glow-card-content"
      className={cn("p-6 pt-0", className)}
      {...props}
    />
  )
}

function GlowCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="glow-card-footer"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

export {
  GlowCard,
  GlowCardHeader,
  GlowCardTitle,
  GlowCardDescription,
  GlowCardContent,
  GlowCardFooter,
  glowCardVariants,
}
