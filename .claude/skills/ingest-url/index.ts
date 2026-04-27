/**
 * ingest-url — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/ingest-url/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   ingest_urlInputSchema,
//   type ingest_urlInput,
// } from "../../../skills/ingest-url/references/input-schema";
//
// export {
//   ingest_urlOutputSchema,
//   type ingest_urlOutput,
// } from "../../../skills/ingest-url/references/output-schema";
//
// export { buildReport } from "../../../skills/ingest-url/scripts/generate-report";

export const SKILL_NAME = "ingest-url";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
