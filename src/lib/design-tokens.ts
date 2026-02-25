/**
 * Design tokens mirroring `.dark {}` CSS variables from globals.css.
 * Single source of truth for JS consumers (charts, gradients, conditional styling).
 * All values are rgb/rgba strings for JS compatibility.
 */

export const bg = Object.freeze({
  base: "rgb(7, 9, 14)",
  elevated: "rgb(10, 13, 20)",
  surface: "rgb(12, 14, 19)",
  hover: "rgb(20, 23, 30)",
  active: "rgb(25, 28, 35)",
  card: "rgb(12, 14, 19)",
  cardBlue: "rgba(51, 136, 255, 0.09)",
  black: "rgb(0, 0, 0)",
} as const);

export const text = Object.freeze({
  primary: "rgb(252, 252, 250)",
  heading: "rgb(252, 252, 250)",
  white: "rgb(255, 255, 255)",
  secondary: "rgb(205, 208, 213)",
  tertiary: "rgb(100, 105, 115)",
  quaternary: "rgb(49, 53, 63)",
  muted: "rgb(32, 35, 45)",
} as const);

export const border = Object.freeze({
  line: "rgb(31, 31, 31)",
  subtle: "rgba(255, 255, 255, 0.08)",
  default: "rgb(31, 31, 31)",
  hover: "rgb(45, 45, 50)",
  focus: "rgb(54, 94, 255)",
  strong: "rgb(50, 50, 55)",
} as const);

export const accent = Object.freeze({
  blue: "rgb(54, 94, 255)",
  blueHover: "rgb(0, 111, 255)",
  blueSecondary: "rgb(0, 62, 161)",
  blueSubtle: "rgba(51, 136, 255, 0.09)",
  blueGlow: "rgba(54, 94, 255, 0.15)",
  cyan: "rgb(80, 248, 228)",
  pink: "rgb(255, 202, 226)",
} as const);

export const semantic = Object.freeze({
  success: "#22c55e",
  successSubtle: "rgba(34, 197, 94, 0.10)",
  warning: "#f59e0b",
  error: "#ef4444",
} as const);

export const shadow = Object.freeze({
  xs: "0 1px 2px rgba(0,0,0,0.3)",
  sm: "0 2px 4px rgba(0,0,0,0.3)",
  md: "0 4px 8px rgba(0,0,0,0.3)",
  lg: "0 8px 24px rgba(0,0,0,0.3)",
  glow: "0 0 20px rgba(54, 94, 255, 0.2)",
  card: "0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.02)",
  elevated: "0 4px 16px rgba(0, 0, 0, 0.5)",
} as const);

export const space = Object.freeze({
  0: "0",
  1: "5px",
  2: "10px",
  3: "16px",
  4: "24px",
  5: "32px",
  6: "48px",
  7: "56px",
  8: "64px",
} as const);

export const radius = Object.freeze({
  none: "0px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "32px",
  full: "999px",
} as const);

export const chart = Object.freeze([
  "rgb(54, 94, 255)",   // Electric blue
  "rgb(0, 111, 255)",   // Bright blue
  "rgb(80, 248, 228)",  // Cyan
  "rgb(255, 202, 226)", // Pink
  "rgb(112, 234, 255)", // Light cyan
] as const);

export const gradient = Object.freeze({
  primary: "linear-gradient(135deg, rgb(54, 94, 255) 0%, rgb(0, 111, 255) 100%)",
  accent: "linear-gradient(135deg, rgb(54, 94, 255), rgb(0, 111, 255))",
  text: "linear-gradient(180deg, rgb(252, 252, 250) 0%, rgb(150, 150, 150) 100%)",
  surface: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)",
} as const);

export const tokens = {
  bg,
  text,
  border,
  accent,
  semantic,
  shadow,
  space,
  radius,
  chart,
  gradient,
} as const;

export type Tokens = typeof tokens;

export default tokens;
