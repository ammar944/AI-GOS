import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
}

const sizeClasses = {
  sm: {
    width: 100,
    height: 32,
  },
  md: {
    width: 130,
    height: 40,
  },
  lg: {
    width: 160,
    height: 50,
  },
  xl: {
    width: 200,
    height: 62,
  },
}

function Logo({
  className,
  size = "md",
}: LogoProps) {
  const sizes = sizeClasses[size]

  return (
    <div
      className={cn(
        "relative inline-flex items-center",
        className
      )}
    >
      <Image
        src="/salf2.png"
        alt="SaaSLaunch"
        width={sizes.width}
        height={sizes.height}
        className="object-contain"
        priority
      />
    </div>
  )
}

function LogoMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const iconSizes = {
    sm: { width: 32, height: 32 },
    md: { width: 48, height: 48 },
    lg: { width: 64, height: 64 },
  }

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-xl overflow-hidden",
        "shadow-[0_0_30px_var(--brand-blue)]",
        className
      )}
    >
      <Image
        src="/salf2.png"
        alt="SaaSLaunch"
        width={iconSizes[size].width}
        height={iconSizes[size].height}
        className="object-contain"
      />
    </div>
  )
}

export { Logo, LogoMark }
