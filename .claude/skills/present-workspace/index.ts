/**
 * present-workspace — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/present-workspace/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   present_workspaceInputSchema,
//   type present_workspaceInput,
// } from "../../../skills/present-workspace/references/input-schema";
//
// export {
//   present_workspaceOutputSchema,
//   type present_workspaceOutput,
// } from "../../../skills/present-workspace/references/output-schema";
//
// export { buildReport } from "../../../skills/present-workspace/scripts/generate-report";

export const SKILL_NAME = "present-workspace";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
