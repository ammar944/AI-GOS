import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  [
    "rounded-xl",
    "border",
    "transition-all duration-200 ease-out",
    "bg-card text-card-foreground border-border",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",
        elevated: "shadow-lg shadow-black/20",
        ghost: "border-transparent bg-transparent",
        interactive: [
          "cursor-pointer",
          "hover:border-primary/30",
          "hover:bg-muted/50",
          "active:scale-[0.99]",
        ].join(" "),
        glass: "bg-card/40 backdrop-blur-xl border-border/50",
        highlight: "border-primary/30 bg-primary/5",
        subtle: "border-border/30 bg-muted/30",
      },
      hover: {
        none: "",
        scale: "hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.99]",
        lift: "hover:shadow-lg hover:-translate-y-1 active:translate-y-0",
        glow: "hover:shadow-[0_0_20px_oklch(0.62_0.19_255_/_0.15)] hover:border-primary/40",
        subtle: "hover:border-primary/20 hover:shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      hover: "none",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, hover, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card"
      className={cn(cardVariants({ variant, hover, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-header"
    className={cn("flex flex-col space-y-1.5 p-6 pb-0", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    data-slot="card-title"
    className={cn(
      "text-base font-semibold leading-tight tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="card-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    data-slot="card-content"
    className={cn("p-6", className)} 
    {...props} 
  />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="card-footer"
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }
