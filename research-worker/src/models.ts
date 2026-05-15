/**
 * Centralized model version pins.
 * Env var overrides are preserved for Railway flexibility.
 * Change versions HERE — not in individual runner files.
 */
export const MODELS = {
  /** Fast/cheap — identity, simple research */
  FAST: process.env.MODEL_FAST ?? 'claude-haiku-4-5-20251001',
  /** Draft — first-pass positioning artifacts */
  DRAFT: process.env.MODEL_DRAFT ?? process.env.MODEL_STANDARD ?? 'claude-sonnet-4-6',
  /** Standard — most runners */
  STANDARD: process.env.MODEL_STANDARD ?? 'claude-sonnet-4-6',
  /** Strong — synthesis, planning, complex tasks */
  STRONG: process.env.MODEL_STRONG ?? 'claude-opus-4-6',
} as const;
