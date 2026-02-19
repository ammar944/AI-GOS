"use client";

import React from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";

const SWIPE_THRESHOLD = 80; // px displacement
const VELOCITY_THRESHOLD = 500; // px/s
const HINT_STORAGE_KEY = "competitor-swipe-hint-seen";
const HINT_DURATION = 4500; // ms

interface SwipeableCompetitorCardProps {
  children: React.ReactNode;
  onSwipeLeft: () => void; // navigate to next
  onSwipeRight: () => void; // navigate to prev
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  isEditing?: boolean;
}

export function SwipeableCompetitorCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  canSwipeLeft,
  canSwipeRight,
  isEditing = false,
}: SwipeableCompetitorCardProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [showHint, setShowHint] = React.useState(false);
  const isHorizontalRef = React.useRef<boolean | null>(null);
  const x = useMotionValue(0);

  // Visual feedback transforms — gentle, not jarring
  const rotate = useTransform(x, [-200, 0, 200], [-0.8, 0, 0.8]);
  const scale = useTransform(x, [-200, 0, 200], [0.99, 1, 0.99]);

  // Directional edge glow opacity
  const leftGlow = useTransform(x, [0, 60, 150], [0, 0.4, 0.8]);
  const rightGlow = useTransform(x, [-150, -60, 0], [0.8, 0.4, 0]);

  // One-time swipe hint
  React.useEffect(() => {
    if (isEditing || (!canSwipeLeft && !canSwipeRight)) return;
    try {
      if (localStorage.getItem(HINT_STORAGE_KEY)) return;
      setShowHint(true);
      const timer = setTimeout(() => {
        setShowHint(false);
        localStorage.setItem(HINT_STORAGE_KEY, "1");
      }, HINT_DURATION);
      return () => clearTimeout(timer);
    } catch {
      // localStorage unavailable
    }
  }, [isEditing, canSwipeLeft, canSwipeRight]);

  const handlePanStart = React.useCallback(
    (_event: PointerEvent, info: PanInfo) => {
      if (isEditing) return;
      const absX = Math.abs(info.delta.x);
      const absY = Math.abs(info.delta.y);
      isHorizontalRef.current = absX > absY;
    },
    [isEditing]
  );

  const handlePan = React.useCallback(
    (_event: PointerEvent, info: PanInfo) => {
      if (isEditing || !isHorizontalRef.current) return;

      let dx = info.offset.x;
      if (dx > 0 && !canSwipeRight) dx = dx * 0.15; // stronger resist
      if (dx < 0 && !canSwipeLeft) dx = dx * 0.15;

      x.set(dx);
      if (!isDragging && Math.abs(dx) > 5) {
        setIsDragging(true);
      }
    },
    [isEditing, canSwipeLeft, canSwipeRight, x, isDragging]
  );

  const handlePanEnd = React.useCallback(
    (_event: PointerEvent, info: PanInfo) => {
      if (isEditing || !isHorizontalRef.current) {
        isHorizontalRef.current = null;
        return;
      }

      const displacement = info.offset.x;
      const velocity = info.velocity.x;

      const shouldNavigate =
        Math.abs(displacement) > SWIPE_THRESHOLD ||
        Math.abs(velocity) > VELOCITY_THRESHOLD;

      if (shouldNavigate) {
        if (displacement < 0 && canSwipeLeft) {
          onSwipeLeft();
        } else if (displacement > 0 && canSwipeRight) {
          onSwipeRight();
        }
      }

      // Smooth spring-back instead of instant snap
      animate(x, 0, {
        type: "spring",
        stiffness: springs.snappy.stiffness,
        damping: springs.snappy.damping,
      });
      setIsDragging(false);
      isHorizontalRef.current = null;
    },
    [isEditing, canSwipeLeft, canSwipeRight, onSwipeLeft, onSwipeRight, x]
  );

  return (
    <motion.div
      className={cn(
        "relative touch-pan-y",
        isDragging && "competitor-card-dragging"
      )}
      style={{ x, rotate, scale }}
      onPanStart={handlePanStart}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
    >
      {children}

      {/* Directional edge glows during swipe */}
      {isDragging && (
        <>
          {/* Right-edge glow (swiping right → prev) */}
          {canSwipeRight && (
            <motion.div
              className="absolute inset-y-0 left-0 w-16 rounded-l-lg pointer-events-none z-10"
              style={{
                opacity: leftGlow,
                background: "linear-gradient(to right, rgba(54, 94, 255, 0.15), transparent)",
              }}
            />
          )}
          {/* Left-edge glow (swiping left → next) */}
          {canSwipeLeft && (
            <motion.div
              className="absolute inset-y-0 right-0 w-16 rounded-r-lg pointer-events-none z-10"
              style={{
                opacity: rightGlow,
                background: "linear-gradient(to left, rgba(54, 94, 255, 0.15), transparent)",
              }}
            />
          )}
        </>
      )}

      {/* One-time swipe hint */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
              "absolute bottom-20 left-1/2 -translate-x-1/2 z-20",
              "flex items-center gap-2 rounded-full px-4 py-2",
              "text-xs font-medium text-white",
              "pointer-events-none select-none"
            )}
            style={{
              background: "linear-gradient(135deg, var(--accent-blue), var(--accent-blue-hover))",
              boxShadow: "0 4px 24px rgba(54, 94, 255, 0.35)",
            }}
          >
            <ChevronLeft className="h-3 w-3 opacity-60" />
            <span>Swipe to navigate</span>
            <ChevronRight className="h-3 w-3 opacity-60" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
