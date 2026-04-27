/**
 * ingest-docs — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/ingest-docs/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   ingest_docsInputSchema,
//   type ingest_docsInput,
// } from "../../../skills/ingest-docs/references/input-schema";
//
// export {
//   ingest_docsOutputSchema,
//   type ingest_docsOutput,
// } from "../../../skills/ingest-docs/references/output-schema";
//
// export { buildReport } from "../../../skills/ingest-docs/scripts/generate-report";

export const SKILL_NAME = "ingest-docs";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
