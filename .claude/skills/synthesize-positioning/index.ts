/**
 * synthesize-positioning — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/synthesize-positioning/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   synthesize_positioningInputSchema,
//   type synthesize_positioningInput,
// } from "../../../skills/synthesize-positioning/references/input-schema";
//
// export {
//   synthesize_positioningOutputSchema,
//   type synthesize_positioningOutput,
// } from "../../../skills/synthesize-positioning/references/output-schema";
//
// export { buildReport } from "../../../skills/synthesize-positioning/scripts/generate-report";

export const SKILL_NAME = "synthesize-positioning";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
