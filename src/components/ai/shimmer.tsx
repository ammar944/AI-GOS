"use client"

import { motion } from "motion/react"
import { type CSSProperties, memo, useMemo } from "react"
import { cn } from "@/lib/utils"

const shimmerMotionComponents = {
  div: motion.div,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
  p: motion.p,
  span: motion.span,
} as const

type ShimmerElement = keyof typeof shimmerMotionComponents

export interface TextShimmerProps {
  children: string
  as?: ShimmerElement
  className?: string
  duration?: number
  spread?: number
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent = shimmerMotionComponents[Component]

  const dynamicSpread = useMemo(() => (children?.length ?? 0) * spread, [children, spread])

  return (
    <MotionComponent
      animate={{ backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className,
      )}
      initial={{ backgroundPosition: "100% center" }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        } as CSSProperties
      }
      transition={{
        repeat: Number.POSITIVE_INFINITY,
        duration,
        ease: "linear",
      }}
    >
      {children}
    </MotionComponent>
  )
}

export const Shimmer = memo(ShimmerComponent)

/** Demo component for preview */
export default function ShimmerDemo() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <Shimmer>This text has a shimmer effect</Shimmer>
      <Shimmer as="h1" className="font-bold text-4xl">
        Large Heading
      </Shimmer>
      <Shimmer duration={3} spread={3}>
        Slower shimmer with wider spread
      </Shimmer>
    </div>
  )
}
