/**
 * research-offer — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/research-offer/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   research_offerInputSchema,
//   type research_offerInput,
// } from "../../../skills/research-offer/references/input-schema";
//
// export {
//   research_offerOutputSchema,
//   type research_offerOutput,
// } from "../../../skills/research-offer/references/output-schema";
//
// export { buildReport } from "../../../skills/research-offer/scripts/generate-report";

export const SKILL_NAME = "research-offer";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
