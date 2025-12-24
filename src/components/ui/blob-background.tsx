"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface BlobProps {
  className?: string
  color?: "primary" | "sky" | "periwinkle" | "mixed"
  size?: "sm" | "md" | "lg" | "xl"
  position?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  animate?: boolean
  delay?: number
}

const sizeClasses = {
  sm: "w-32 h-32",
  md: "w-48 h-48",
  lg: "w-64 h-64",
  xl: "w-96 h-96",
}

const colorClasses = {
  primary: "bg-[oklch(0.62_0.19_255)]",
  sky: "bg-[oklch(0.80_0.12_240)]",
  periwinkle: "bg-[oklch(0.75_0.10_270)]",
  mixed: "bg-gradient-to-br from-[oklch(0.62_0.19_255)] via-[oklch(0.75_0.10_270)] to-[oklch(0.80_0.12_240)]",
}

function Blob({
  className,
  color = "primary",
  size = "md",
  position,
  animate = true,
  delay = 0,
}: BlobProps) {
  const positionStyles: React.CSSProperties = {
    top: position?.top,
    right: position?.right,
    bottom: position?.bottom,
    left: position?.left,
    animationDelay: delay ? `${delay}s` : undefined,
  }

  return (
    <div
      className={cn(
        "absolute rounded-[30%_70%_70%_30%_/_30%_30%_70%_70%] blur-[60px] opacity-40",
        sizeClasses[size],
        colorClasses[color],
        animate && "animate-float",
        className
      )}
      style={positionStyles}
      aria-hidden="true"
    />
  )
}

interface BlobBackgroundProps {
  className?: string
  children?: React.ReactNode
  /** Preset blob configuration */
  preset?: "hero" | "subtle" | "scattered" | "corner" | "none"
  /** Custom blobs configuration */
  blobs?: BlobProps[]
  /** Show grid pattern overlay */
  showGrid?: boolean
  /** Show dots pattern overlay */
  showDots?: boolean
}

const presets: Record<string, BlobProps[]> = {
  hero: [
    { color: "primary", size: "xl", position: { top: "-10%", right: "-5%" }, delay: 0 },
    { color: "sky", size: "lg", position: { top: "40%", left: "-10%" }, delay: -2 },
    { color: "periwinkle", size: "md", position: { bottom: "10%", right: "20%" }, delay: -4 },
  ],
  subtle: [
    { color: "primary", size: "lg", position: { top: "20%", right: "10%" }, delay: 0 },
    { color: "sky", size: "md", position: { bottom: "30%", left: "5%" }, delay: -3 },
  ],
  scattered: [
    { color: "primary", size: "md", position: { top: "10%", left: "10%" }, delay: 0 },
    { color: "sky", size: "sm", position: { top: "30%", right: "15%" }, delay: -1 },
    { color: "periwinkle", size: "lg", position: { bottom: "20%", left: "25%" }, delay: -2 },
    { color: "primary", size: "sm", position: { bottom: "10%", right: "10%" }, delay: -3 },
    { color: "mixed", size: "md", position: { top: "50%", right: "30%" }, delay: -4 },
  ],
  corner: [
    { color: "mixed", size: "xl", position: { top: "-20%", right: "-15%" }, delay: 0 },
  ],
  none: [],
}

function BlobBackground({
  className,
  children,
  preset = "hero",
  blobs,
  showGrid = false,
  showDots = false,
}: BlobBackgroundProps) {
  const blobConfig = blobs ?? presets[preset]

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Blob layer */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {blobConfig.map((blob, index) => (
          <Blob key={index} {...blob} />
        ))}
      </div>

      {/* Pattern overlays */}
      {showGrid && (
        <div
          className="absolute inset-0 pointer-events-none pattern-grid opacity-30"
          aria-hidden="true"
        />
      )}
      {showDots && (
        <div
          className="absolute inset-0 pointer-events-none pattern-dots opacity-20"
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

interface GlowOrbProps {
  className?: string
  size?: "sm" | "md" | "lg"
  color?: "primary" | "sky" | "periwinkle"
  pulse?: boolean
}

const orbSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
}

function GlowOrb({
  className,
  size = "md",
  color = "primary",
  pulse = true,
}: GlowOrbProps) {
  return (
    <div
      className={cn(
        "rounded-full",
        orbSizes[size],
        colorClasses[color],
        "shadow-[0_0_20px_oklch(0.62_0.19_255_/_0.6)]",
        pulse && "animate-pulse",
        className
      )}
      aria-hidden="true"
    />
  )
}

export { Blob, BlobBackground, GlowOrb }
