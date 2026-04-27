/**
 * synthesize-scripts — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/synthesize-scripts/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   synthesize_scriptsInputSchema,
//   type synthesize_scriptsInput,
// } from "../../../skills/synthesize-scripts/references/input-schema";
//
// export {
//   synthesize_scriptsOutputSchema,
//   type synthesize_scriptsOutput,
// } from "../../../skills/synthesize-scripts/references/output-schema";
//
// export { buildReport } from "../../../skills/synthesize-scripts/scripts/generate-report";

export const SKILL_NAME = "synthesize-scripts";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
