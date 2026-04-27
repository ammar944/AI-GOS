/**
 * ingest-fathom — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/ingest-fathom/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   ingest_fathomInputSchema,
//   type ingest_fathomInput,
// } from "../../../skills/ingest-fathom/references/input-schema";
//
// export {
//   ingest_fathomOutputSchema,
//   type ingest_fathomOutput,
// } from "../../../skills/ingest-fathom/references/output-schema";
//
// export { buildReport } from "../../../skills/ingest-fathom/scripts/generate-report";

export const SKILL_NAME = "ingest-fathom";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
