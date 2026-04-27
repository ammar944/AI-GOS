/**
 * synthesize-media-plan — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/synthesize-media-plan/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   synthesize_media_planInputSchema,
//   type synthesize_media_planInput,
// } from "../../../skills/synthesize-media-plan/references/input-schema";
//
// export {
//   synthesize_media_planOutputSchema,
//   type synthesize_media_planOutput,
// } from "../../../skills/synthesize-media-plan/references/output-schema";
//
// export { buildReport } from "../../../skills/synthesize-media-plan/scripts/generate-report";

export const SKILL_NAME = "synthesize-media-plan";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
