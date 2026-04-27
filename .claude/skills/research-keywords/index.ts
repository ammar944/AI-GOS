/**
 * research-keywords — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/research-keywords/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   research_keywordsInputSchema,
//   type research_keywordsInput,
// } from "../../../skills/research-keywords/references/input-schema";
//
// export {
//   research_keywordsOutputSchema,
//   type research_keywordsOutput,
// } from "../../../skills/research-keywords/references/output-schema";
//
// export { buildReport } from "../../../skills/research-keywords/scripts/generate-report";

export const SKILL_NAME = "research-keywords";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
