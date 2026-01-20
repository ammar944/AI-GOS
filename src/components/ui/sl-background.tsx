"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ShaderMeshBackgroundProps {
  className?: string
  /** Height of the shader effect */
  height?: string
  /** Opacity of the effect (0-1) */
  opacity?: number
  /** Enable pulse animation */
  animate?: boolean
  /** Show on all pages or just hero */
  variant?: "hero" | "page" | "subtle"
}

/**
 * SaaSLaunch Shader Mesh Background
 * Animated radial gradient effect extracted from Framer design
 */
function ShaderMeshBackground({
  className,
  height = "800px",
  opacity = 0.8,
  animate = true,
  variant = "hero",
}: ShaderMeshBackgroundProps) {
  const variantStyles = {
    hero: {
      height,
      opacity,
    },
    page: {
      height: "600px",
      opacity: 0.5,
    },
    subtle: {
      height: "400px",
      opacity: 0.3,
    },
  }

  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 overflow-hidden pointer-events-none z-0",
        className
      )}
      style={{ height: styles.height, opacity: styles.opacity }}
      aria-hidden="true"
    >
      {/* Primary shader gradient */}
      <div
        className={cn(
          "absolute inset-0",
          animate && "animate-[shaderPulse_8s_ease-in-out_infinite]"
        )}
        style={{
          background: `
            radial-gradient(
              ellipse 80% 50% at 50% 0%,
              rgba(54, 94, 255, 0.4) 0%,
              rgba(20, 68, 215, 0.2) 40%,
              transparent 70%
            ),
            radial-gradient(
              ellipse 60% 40% at 70% 20%,
              rgba(112, 234, 255, 0.15) 0%,
              transparent 50%
            )
          `,
        }}
      />
    </div>
  )
}

interface BackgroundPatternProps {
  className?: string
  /** Pattern type */
  pattern?: "grid" | "dots"
  /** Opacity (0-1) */
  opacity?: number
}

/**
 * SaaSLaunch Background Pattern
 * Subtle grid or dots pattern at low opacity for texture
 */
function BackgroundPattern({
  className,
  pattern = "grid",
  opacity = 0.02,
}: BackgroundPatternProps) {
  const patternStyles = {
    grid: {
      backgroundImage: `
        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
      `,
      backgroundSize: "50px 50px",
    },
    dots: {
      backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)",
      backgroundSize: "20px 20px",
    },
  }

  return (
    <div
      className={cn("fixed inset-0 pointer-events-none z-0", className)}
      style={{
        opacity,
        ...patternStyles[pattern],
      }}
      aria-hidden="true"
    />
  )
}

interface GradientOverlayProps {
  className?: string
  /** Position of the overlay */
  position?: "top" | "center" | "bottom"
  /** Opacity (0-1) */
  opacity?: number
}

/**
 * SaaSLaunch Gradient Overlay
 * Radial blue gradient overlay used throughout sections
 */
function GradientOverlay({
  className,
  position = "center",
  opacity = 0.4,
}: GradientOverlayProps) {
  const positionStyles = {
    top: { top: 0, transform: "translateY(-30%)" },
    center: { top: "50%", transform: "translateY(-50%)" },
    bottom: { bottom: 0, transform: "translateY(30%)" },
  }

  return (
    <div
      className={cn("absolute left-0 right-0 pointer-events-none z-0", className)}
      style={{
        ...positionStyles[position],
        height: "740px",
        background: `radial-gradient(
          ellipse 50% 50% at 50% 50%,
          rgba(54, 94, 255, 0.15) 0%,
          transparent 70%
        )`,
        opacity,
      }}
      aria-hidden="true"
    />
  )
}

interface SaaSLaunchBackgroundProps {
  children: React.ReactNode
  className?: string
  /** Show shader mesh effect */
  showShader?: boolean
  /** Show grid pattern */
  showPattern?: boolean
  /** Shader variant */
  shaderVariant?: "hero" | "page" | "subtle"
  /** Pattern opacity */
  patternOpacity?: number
}

/**
 * SaaSLaunch Page Background
 * Complete background setup with shader, pattern, and proper layering
 */
function SaaSLaunchBackground({
  children,
  className,
  showShader = true,
  showPattern = true,
  shaderVariant = "hero",
  patternOpacity = 0.02,
}: SaaSLaunchBackgroundProps) {
  return (
    <div
      className={cn("min-h-screen relative", className)}
      style={{ background: "rgb(7, 9, 14)" }}
    >
      {/* Shader mesh effect */}
      {showShader && <ShaderMeshBackground variant={shaderVariant} />}

      {/* Background pattern */}
      {showPattern && <BackgroundPattern opacity={patternOpacity} />}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export {
  ShaderMeshBackground,
  BackgroundPattern,
  GradientOverlay,
  SaaSLaunchBackground,
}
