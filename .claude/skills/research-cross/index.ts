/**
 * research-cross — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/research-cross/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   research_crossInputSchema,
//   type research_crossInput,
// } from "../../../skills/research-cross/references/input-schema";
//
// export {
//   research_crossOutputSchema,
//   type research_crossOutput,
// } from "../../../skills/research-cross/references/output-schema";
//
// export { buildReport } from "../../../skills/research-cross/scripts/generate-report";

export const SKILL_NAME = "research-cross";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
