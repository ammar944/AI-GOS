"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ScoreSize = "sm" | "md" | "lg" | "xl";

export interface ScoreDisplayProps {
  score: number;
  max?: number;
  label?: string;
  size?: ScoreSize;
  className?: string;
  animated?: boolean;
}

const sizeConfig = {
  sm: {
    container: "w-20 h-20",
    fontSize: "text-xl",
    labelSize: "text-xs",
    strokeWidth: 6,
  },
  md: {
    container: "w-24 h-24",
    fontSize: "text-2xl",
    labelSize: "text-xs",
    strokeWidth: 7,
  },
  lg: {
    container: "w-32 h-32",
    fontSize: "text-3xl",
    labelSize: "text-sm",
    strokeWidth: 8,
  },
  xl: {
    container: "w-40 h-40",
    fontSize: "text-4xl",
    labelSize: "text-sm",
    strokeWidth: 10,
  },
};

function getBrandGradient() {
  return {
    from: "var(--accent-blue)",
    to: "var(--accent-blue-hover)",
  };
}

export function ScoreDisplay({
  score,
  max = 10,
  label,
  size = "lg",
  animated = true,
  className,
}: ScoreDisplayProps) {
  const segments = 12;
  const percentage = (score / max) * 100;
  const filled = Math.ceil((percentage / 100) * segments);
  const rotation = 360 / segments;
  const config = sizeConfig[size];
  const gradient = getBrandGradient();

  return (
    <div className={cn("score-display", className)}>
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn("relative", config.container)}
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ? `${label}: ${score} out of ${max}` : `Score: ${score} out of ${max}`}
        >
          <svg viewBox="0 0 100 100" className="overflow-visible">
            <defs>
              <linearGradient id="segment-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={gradient.from} />
                <stop offset="100%" stopColor={gradient.to} />
              </linearGradient>
            </defs>

            {Array.from({ length: segments }).map((_, i) => {
              const isFilled = i < filled;
              const angle = rotation * i;

              return (
                <g key={i} style={{ transformOrigin: "50% 50%", transform: `rotate(${angle}deg)` }}>
                  <motion.line
                    x1="50"
                    y1="8"
                    x2="50"
                    y2="18"
                    stroke={isFilled ? "url(#segment-gradient)" : "rgba(255,255,255,0.1)"}
                    strokeWidth={isFilled ? "4" : "2"}
                    strokeLinecap="round"
                    initial={animated ? { opacity: 0, scale: 0.5 } : false}
                    animate={animated ? { opacity: 1, scale: 1 } : undefined}
                    transition={
                      animated
                        ? {
                            delay: i * 0.04,
                            duration: 0.3,
                            ease: [0.22, 1, 0.36, 1],
                          }
                        : undefined
                    }
                  />
                </g>
              );
            })}
          </svg>

          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={animated ? { opacity: 0, y: 10 } : false}
            animate={animated ? { opacity: 1, y: 0 } : undefined}
            transition={animated ? { delay: 0.3 } : undefined}
          >
            <span
              className={cn(config.fontSize, "font-bold leading-none")}
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-heading)",
              }}
            >
              {score.toFixed(1)}
            </span>
            <span className={cn(config.labelSize, "text-[var(--text-tertiary)] mt-0.5")}>
              /{max}
            </span>
          </motion.div>
        </div>

        {label && (
          <p className={cn(config.labelSize, "text-[var(--text-secondary)] font-medium text-center")}>
            {label}
          </p>
        )}
      </div>
    </div>
  );
}
