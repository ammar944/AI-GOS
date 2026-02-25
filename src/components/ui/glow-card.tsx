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
          "bg-[var(--brand-navy)]/40 backdrop-blur-2xl border-primary/20 hover:border-primary/50 hover:bg-[var(--brand-navy)]/50",
        solid:
          "bg-[var(--brand-navy-light)] border-border hover:border-primary/40",
      },
      glow: {
        none: "",
        sm: "shadow-[var(--shadow-glow)] hover:shadow-[0_0_30px_var(--brand-blue)]",
        md: "shadow-[0_0_25px_var(--brand-blue)] hover:shadow-[0_0_40px_var(--brand-blue)]",
        lg: "shadow-[0_0_35px_var(--brand-blue)] hover:shadow-[0_0_60px_var(--brand-blue)]",
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
          "hover:from-[var(--brand-blue)] hover:via-[var(--brand-periwinkle)] hover:to-[var(--brand-sky)]",
          glow !== "none" && "shadow-[var(--shadow-glow)] hover:shadow-[0_0_30px_var(--brand-blue)]"
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
