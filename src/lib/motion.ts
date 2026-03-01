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

// -------------------------------------------------------------------------
// New motion variants (V2 design system)
// -------------------------------------------------------------------------

/** Press-to-scale feedback — use as whileTap on interactive elements */
export const pressScale: Variants = {
  rest: { scale: 1 },
  press: { scale: 0.95, transition: { type: 'spring', stiffness: 600, damping: 30 } },
};

/** Subtle lift on hover — use as whileHover on cards */
export const hoverLift: Variants = {
  rest: { y: 0, boxShadow: '0 0 0 0 transparent' },
  hover: {
    y: -2,
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

/** Pulsing opacity for status indicators */
export const statusPulse: Variants = {
  idle: { opacity: 1 },
  pulse: {
    opacity: [1, 0.4, 1],
    transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' },
  },
};

/** Fast stagger container — tighter 30ms child delay */
export const fastStagger: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03,
    },
  },
};

/** Pop-in entrance for chips and badges */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.88 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 500, damping: 28 },
  },
};
