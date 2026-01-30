"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export type ScoreVariant =
  | "segmented-ring"
  | "glow-arc"
  | "gradient-bar"
  | "thermometer"
  | "liquid-fill";

export type ScoreSize = "sm" | "md" | "lg" | "xl";

interface BaseScoreProps {
  score: number;
  max?: number;
  label?: string;
  size?: ScoreSize;
  className?: string;
  animated?: boolean;
}

export interface ScoreDisplayProps extends BaseScoreProps {
  variant?: ScoreVariant;
}

// =============================================================================
// SIZE CONFIGURATIONS
// =============================================================================

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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getScoreColor(percentage: number) {
  if (percentage >= 70) return { from: "rgb(16, 185, 129)", to: "rgb(34, 197, 94)" }; // Green
  if (percentage >= 50) return { from: "rgb(245, 158, 11)", to: "rgb(251, 191, 36)" }; // Yellow
  return { from: "rgb(239, 68, 68)", to: "rgb(220, 38, 38)" }; // Red
}

function getBrandGradient() {
  return {
    from: "var(--accent-blue)",
    to: "var(--accent-blue-hover)",
  };
}

// =============================================================================
// VARIANT COMPONENTS
// =============================================================================

function SegmentedRing({
  score,
  max = 10,
  label,
  size = "lg",
  animated = true,
}: BaseScoreProps) {
  const segments = 12;
  const percentage = (score / max) * 100;
  const filled = Math.ceil((percentage / 100) * segments);
  const rotation = 360 / segments;
  const config = sizeConfig[size];
  const gradient = getBrandGradient();

  return (
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
  );
}

function GlowArc({
  score,
  max = 10,
  label,
  size = "lg",
  animated = true,
}: BaseScoreProps) {
  const percentage = (score / max) * 100;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (270 / 360) * circumference;
  const strokeDashoffset = arcLength - (percentage / 100) * arcLength;
  const config = sizeConfig[size];
  const gradient = getBrandGradient();

  // Calculate endpoint position for the glow dot
  const angle = -135 + (270 * percentage) / 100;
  const angleRad = (angle * Math.PI) / 180;
  const endX = 50 + radius * Math.cos(angleRad);
  const endY = 50 + radius * Math.sin(angleRad);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn("relative", config.container)}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ? `${label}: ${score} out of ${max}` : `Score: ${score} out of ${max}`}
      >
        <svg viewBox="0 0 100 100" className="overflow-visible -rotate-[135deg]">
          <defs>
            <linearGradient id="arc-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradient.from} />
              <stop offset="100%" stopColor={gradient.to} />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(54, 94, 255, 0.08)"
            strokeWidth={config.strokeWidth + 2}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Main arc */}
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="url(#arc-gradient)"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={animated ? { strokeDashoffset: arcLength } : false}
            animate={
              animated
                ? {
                    strokeDashoffset,
                  }
                : undefined
            }
            transition={
              animated
                ? {
                    duration: 1.5,
                    ease: [0.22, 1, 0.36, 1],
                  }
                : undefined
            }
          />

          {/* Endpoint dot */}
          {percentage > 0 && <circle cx={endX} cy={endY} r="2.5" fill={gradient.to} />}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={animated ? { opacity: 0, scale: 0.5 } : false}
            animate={animated ? { opacity: 1, scale: 1 } : undefined}
            transition={animated ? { delay: 0.3, type: "spring" } : undefined}
          >
            <div
              className={cn(config.fontSize, "font-bold leading-none")}
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-heading)",
              }}
            >
              {score.toFixed(1)}
            </div>
            <div className={cn(config.labelSize, "text-center text-[var(--text-tertiary)] mt-0.5")}>
              /{max}
            </div>
          </motion.div>
        </div>
      </div>

      {label && (
        <p className={cn(config.labelSize, "text-[var(--text-secondary)] font-medium text-center")}>
          {label}
        </p>
      )}
    </div>
  );
}

function GradientBar({
  score,
  max = 10,
  label,
  size = "md",
  animated = true,
}: BaseScoreProps) {
  const percentage = (score / max) * 100;
  const gradient = getBrandGradient();

  const heightMap = {
    sm: "h-8",
    md: "h-10",
    lg: "h-12",
    xl: "h-16",
  };

  const fontSizeMap = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
    xl: "text-2xl",
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-[var(--text-secondary)]">{label}</span>
          <span
            className={cn(fontSizeMap[size], "font-bold")}
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-heading)",
            }}
          >
            {score.toFixed(1)}
          </span>
        </div>
      )}

      <div
        className={cn("relative rounded-full overflow-hidden", heightMap[size])}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ? `${label}: ${score} out of ${max}` : `Score: ${score} out of ${max}`}
      >
        {/* Progress fill */}
        <motion.div
          className="absolute left-0 top-0 bottom-0 rounded-full"
          initial={animated ? { width: 0 } : false}
          animate={animated ? { width: `${percentage}%` } : { width: `${percentage}%` }}
          transition={
            animated
              ? {
                  duration: 1.5,
                  ease: [0.22, 1, 0.36, 1],
                }
              : undefined
          }
          style={{
            background: `linear-gradient(90deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
          }}
        />
      </div>
    </div>
  );
}

function Thermometer({
  score,
  max = 10,
  label,
  size = "md",
  animated = true,
}: BaseScoreProps) {
  const segments = 10;
  const percentage = (score / max) * 100;
  const filled = Math.ceil((percentage / 100) * segments);
  const gradient = getBrandGradient();

  const sizeMap = {
    sm: { width: "w-12", height: "h-32", fontSize: "text-lg" },
    md: { width: "w-16", height: "h-40", fontSize: "text-xl" },
    lg: { width: "w-20", height: "h-48", fontSize: "text-2xl" },
    xl: { width: "w-24", height: "h-56", fontSize: "text-3xl" },
  };

  const config = sizeMap[size];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn("relative rounded-full overflow-hidden", config.width, config.height)}
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ? `${label}: ${score} out of ${max}` : `Score: ${score} out of ${max}`}
      >
        {/* Segments */}
        <div className="absolute bottom-0 left-0 right-0 flex flex-col-reverse gap-1 p-2">
          {Array.from({ length: segments }).map((_, i) => (
            <motion.div
              key={i}
              className="h-3 rounded-full"
              initial={
                animated
                  ? {
                      scaleY: 0,
                      opacity: 0,
                      background: "rgba(255, 255, 255, 0.1)",
                    }
                  : {
                      scaleY: i < filled ? 1 : 0,
                      opacity: i < filled ? 1 : 0,
                    }
              }
              animate={
                animated
                  ? {
                      scaleY: i < filled ? 1 : 0,
                      opacity: i < filled ? 1 : 0,
                      background:
                        i < filled
                          ? `linear-gradient(90deg, ${gradient.from} 0%, ${gradient.to} 100%)`
                          : "rgba(255, 255, 255, 0.1)",
                    }
                  : undefined
              }
              transition={
                animated
                  ? {
                      delay: i * 0.08,
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }
                  : undefined
              }
              style={{
                transformOrigin: "bottom",
                background:
                  !animated && i < filled
                    ? `linear-gradient(90deg, ${gradient.from} 0%, ${gradient.to} 100%)`
                    : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* Score label */}
      <motion.div
        className={cn(config.fontSize, "font-bold")}
        initial={animated ? { opacity: 0 } : false}
        animate={animated ? { opacity: 1 } : undefined}
        transition={animated ? { delay: 0.5 } : undefined}
        style={{
          fontFamily: "var(--font-heading)",
          color: "var(--text-heading)",
        }}
      >
        {score.toFixed(1)}
      </motion.div>

      {label && (
        <p className="text-xs text-[var(--text-secondary)] font-medium text-center">{label}</p>
      )}
    </div>
  );
}

function LiquidFill({
  score,
  max = 10,
  label,
  size = "lg",
  animated = true,
}: BaseScoreProps) {
  const percentage = (score / max) * 100;
  const waveOffset = percentage;
  const config = sizeConfig[size];
  const gradient = getBrandGradient();

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn("relative", config.container)}
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ? `${label}: ${score} out of ${max}` : `Score: ${score} out of ${max}`}
      >
        <svg viewBox="0 0 100 100" className="overflow-hidden rounded-full">
          <defs>
            <linearGradient id="liquid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={gradient.to} stopOpacity="0.9" />
              <stop offset="100%" stopColor={gradient.from} stopOpacity="0.9" />
            </linearGradient>
            <clipPath id="circle-clip">
              <circle cx="50" cy="50" r="45" />
            </clipPath>
          </defs>

          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="var(--bg-elevated)"
            stroke="var(--border-default)"
            strokeWidth="2"
          />

          {/* Liquid fill with wave */}
          <g clipPath="url(#circle-clip)">
            <motion.path
              d={`M 0 ${100 - waveOffset} Q 25 ${100 - waveOffset - 3} 50 ${100 - waveOffset} T 100 ${
                100 - waveOffset
              } L 100 100 L 0 100 Z`}
              fill="url(#liquid-gradient)"
              initial={animated ? { y: 100 } : false}
              animate={
                animated
                  ? {
                      y: 0,
                    }
                  : undefined
              }
              transition={
                animated
                  ? {
                      duration: 2,
                      ease: "easeOut",
                    }
                  : undefined
              }
            />
          </g>
        </svg>

        {/* Score overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={animated ? { scale: 0 } : false}
            animate={animated ? { scale: 1 } : undefined}
            transition={animated ? { delay: 0.5, type: "spring" } : undefined}
            className="text-center"
          >
            <span
              className={cn(config.fontSize, "font-bold")}
              style={{
                fontFamily: "var(--font-heading)",
                color: percentage > 50 ? "white" : "var(--text-heading)",
                mixBlendMode: percentage > 50 ? "difference" : "normal",
              }}
            >
              {score.toFixed(1)}
            </span>
            <div
              className={cn(config.labelSize, "mt-0.5")}
              style={{
                color: percentage > 50 ? "white" : "var(--text-tertiary)",
                mixBlendMode: percentage > 50 ? "difference" : "normal",
              }}
            >
              /{max}
            </div>
          </motion.div>
        </div>
      </div>

      {label && (
        <p className={cn(config.labelSize, "text-[var(--text-secondary)] font-medium text-center")}>
          {label}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ScoreDisplay({
  score,
  max = 10,
  label,
  variant = "segmented-ring",
  size = "lg",
  animated = true,
  className,
}: ScoreDisplayProps) {
  const baseProps = { score, max, label, size, animated };

  const variantComponents = {
    "segmented-ring": SegmentedRing,
    "glow-arc": GlowArc,
    "gradient-bar": GradientBar,
    thermometer: Thermometer,
    "liquid-fill": LiquidFill,
  };

  const Component = variantComponents[variant];

  return (
    <div className={cn("score-display", className)}>
      <Component {...baseProps} />
    </div>
  );
}

// Export individual components for direct use
export { SegmentedRing, GlowArc, GradientBar, Thermometer, LiquidFill };
