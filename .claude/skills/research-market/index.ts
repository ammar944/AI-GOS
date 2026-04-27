/**
 * research-market — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/research-market/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   research_marketInputSchema,
//   type research_marketInput,
// } from "../../../skills/research-market/references/input-schema";
//
// export {
//   research_marketOutputSchema,
//   type research_marketOutput,
// } from "../../../skills/research-market/references/output-schema";
//
// export { buildReport } from "../../../skills/research-market/scripts/generate-report";

export const SKILL_NAME = "research-market";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
