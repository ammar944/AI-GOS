/**
 * research-icp — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/research-icp/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   research_icpInputSchema,
//   type research_icpInput,
// } from "../../../skills/research-icp/references/input-schema";
//
// export {
//   research_icpOutputSchema,
//   type research_icpOutput,
// } from "../../../skills/research-icp/references/output-schema";
//
// export { buildReport } from "../../../skills/research-icp/scripts/generate-report";

export const SKILL_NAME = "research-icp";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
