/**
 * research-voc — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/research-voc/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   research_vocInputSchema,
//   type research_vocInput,
// } from "../../../skills/research-voc/references/input-schema";
//
// export {
//   research_vocOutputSchema,
//   type research_vocOutput,
// } from "../../../skills/research-voc/references/output-schema";
//
// export { buildReport } from "../../../skills/research-voc/scripts/generate-report";

export const SKILL_NAME = "research-voc";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
