import type { Transition, Variants } from "framer-motion";

// Spring presets for different interaction types
export const springs = {
  // Quick, snappy (buttons, toggles)
  snappy: { type: "spring", stiffness: 500, damping: 30 } as const,

  // Smooth, natural (cards, panels)
  smooth: { type: "spring", stiffness: 400, damping: 30 } as const,

  // Gentle, elegant (page transitions)
  gentle: { type: "spring", stiffness: 300, damping: 35 } as const,

  // Bouncy (attention-grabbing)
  bouncy: { type: "spring", stiffness: 400, damping: 15 } as const,
} satisfies Record<string, Transition>;

// Easing curves for tween animations
export const easings = {
  // Smooth deceleration
  out: [0.21, 0.45, 0.27, 0.9] as const,

  // Smooth acceleration-deceleration
  inOut: [0.4, 0, 0.2, 1] as const,

  // Quick start, slow end
  expo: [0.16, 1, 0.3, 1] as const,
};

// Common animation variants
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export const fadeDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
};

export const fadeLeft: Variants = {
  initial: { opacity: 0, x: -30 },
  animate: { opacity: 1, x: 0 },
};

export const fadeRight: Variants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
};

// Stagger container for child animations
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Stagger item (use as child of staggerContainer)
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Duration guidelines (in seconds)
export const durations = {
  fast: 0.15, // Hover states
  normal: 0.3, // Standard transitions
  slow: 0.5, // Panel slides
  slower: 0.8, // Page transitions
} as const;
