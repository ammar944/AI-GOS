/**
 * ingest-identity — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/ingest-identity/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   ingest_identityInputSchema,
//   type ingest_identityInput,
// } from "../../../skills/ingest-identity/references/input-schema";
//
// export {
//   ingest_identityOutputSchema,
//   type ingest_identityOutput,
// } from "../../../skills/ingest-identity/references/output-schema";
//
// export { buildReport } from "../../../skills/ingest-identity/scripts/generate-report";

export const SKILL_NAME = "ingest-identity";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
