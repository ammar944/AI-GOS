"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AdCopyOutput, AngleCopySet, PlatformCopyVariant } from "@/lib/media-plan/ad-copy-types";
import { AdCopyCard } from "./ad-copy-card";

// =============================================================================
// Props
// =============================================================================

interface AdCopyViewProps {
  adCopy: AdCopyOutput;
}

// =============================================================================
// Platform display names + tab order
// =============================================================================

const PLATFORM_META: Record<string, { label: string; order: number }> = {
  meta: { label: "Meta", order: 0 },
  google: { label: "Google", order: 1 },
  linkedin: { label: "LinkedIn", order: 2 },
  tiktok: { label: "TikTok", order: 3 },
  youtube: { label: "YouTube", order: 4 },
};

// =============================================================================
// Helpers
// =============================================================================

/** Derive unique sorted platforms from the copy sets. */
function extractPlatforms(copySets: AngleCopySet[]): string[] {
  const seen = new Set<string>();
  for (const cs of copySets) {
    for (const v of cs.variants) {
      seen.add(v.platform);
    }
  }
  return Array.from(seen).sort(
    (a, b) => (PLATFORM_META[a]?.order ?? 99) - (PLATFORM_META[b]?.order ?? 99),
  );
}

/** Get variants for a given platform across all angle copy sets. */
function variantsForPlatform(
  copySets: AngleCopySet[],
  platform: string,
): { angleName: string; funnelStage: "cold" | "warm" | "hot"; variant: PlatformCopyVariant }[] {
  const results: { angleName: string; funnelStage: "cold" | "warm" | "hot"; variant: PlatformCopyVariant }[] = [];
  for (const cs of copySets) {
    for (const v of cs.variants) {
      if (v.platform === platform) {
        results.push({ angleName: cs.angleName, funnelStage: cs.funnelStage, variant: v });
      }
    }
  }
  return results;
}

// =============================================================================
// Animation variants
// =============================================================================

const tabContentVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const tabContentTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

// =============================================================================
// AdCopyView — main export
// =============================================================================

export function AdCopyView({ adCopy }: AdCopyViewProps) {
  const platforms = useMemo(() => extractPlatforms(adCopy.copySets), [adCopy.copySets]);
  const [activeTab, setActiveTab] = useState<string>(platforms[0] ?? "meta");

  const cards = useMemo(
    () => variantsForPlatform(adCopy.copySets, activeTab),
    [adCopy.copySets, activeTab],
  );

  if (platforms.length === 0) {
    return (
      <div className="flex items-center justify-center py-16" style={{ color: "var(--text-tertiary)" }}>
        <p className="text-sm">No ad copy available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------------ */}
      {/* Tab bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-xl border p-1.5"
        style={{
          background: "rgba(7,9,14,0.48)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {platforms.map((p) => {
          const isActive = p === activeTab;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setActiveTab(p)}
              className={cn(
                "relative rounded-lg px-4 py-1.5 text-xs font-semibold tracking-wide transition-colors",
                isActive
                  ? "text-white"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
              style={{
                fontFamily: 'var(--font-heading), "Instrument Sans", sans-serif',
              }}
            >
              {/* Active pill background */}
              {isActive && (
                <motion.span
                  layoutId="ad-copy-tab-pill"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: "linear-gradient(135deg, rgba(54,94,255,0.35), rgba(99,60,255,0.25))",
                    border: "1px solid rgba(54,94,255,0.3)",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{PLATFORM_META[p]?.label ?? p}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tab content — angle cards grid                                     */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabContentVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={tabContentTransition}
        >
          {cards.length === 0 ? (
            <div
              className="flex items-center justify-center rounded-xl border py-12"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--text-tertiary)",
              }}
            >
              <p className="text-sm">
                No copy generated for {PLATFORM_META[activeTab]?.label ?? activeTab}.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              {cards.map((c, i) => (
                <AdCopyCard
                  key={`${activeTab}-${c.angleName}-${i}`}
                  variant={c.variant}
                  angleName={c.angleName}
                  funnelStage={c.funnelStage}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
