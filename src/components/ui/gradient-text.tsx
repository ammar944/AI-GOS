import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const gradientTextVariants = cva(
  "bg-clip-text text-transparent",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[oklch(0.80_0.12_240)] to-[oklch(0.75_0.10_270)]",
        primary:
          "bg-gradient-to-r from-[oklch(0.62_0.19_255)] to-[oklch(0.55_0.22_260)]",
        cloud:
          "bg-gradient-to-r from-[oklch(0.80_0.12_240)] to-[oklch(0.62_0.19_255)]",
        hero:
          "bg-gradient-to-r from-[oklch(0.80_0.12_240)] via-[oklch(0.70_0.15_250)] to-[oklch(0.62_0.19_255)]",
        accent:
          "bg-gradient-to-r from-[oklch(0.75_0.10_270)] to-[oklch(0.62_0.19_255)]",
        white:
          "bg-gradient-to-r from-white to-[oklch(0.90_0.02_255)]",
      },
      animate: {
        none: "",
        shimmer:
          "bg-[length:200%_100%] animate-[gradient-shift_3s_ease-in-out_infinite]",
        pulse:
          "animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
      animate: "none",
    },
  }
)

interface GradientTextProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof gradientTextVariants> {
  as?: "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "div"
}

function GradientText({
  className,
  variant,
  animate,
  as: Component = "span",
  ...props
}: GradientTextProps) {
  return (
    <Component
      className={cn(gradientTextVariants({ variant, animate, className }))}
      {...props}
    />
  )
}

export { GradientText, gradientTextVariants }
