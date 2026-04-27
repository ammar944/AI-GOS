/**
 * chat-refine — Hermes Skill Bridge
 *
 * Re-exports from the full implementation at skills/chat-refine/.
 * The agent does ALL collection via native tools (web_search, browser_navigate, etc.).
 * This file only exposes schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 *
 * STATUS: scaffolded 2026-04-24. Uncomment re-exports once schemas exist.
 */

// export {
//   chat_refineInputSchema,
//   type chat_refineInput,
// } from "../../../skills/chat-refine/references/input-schema";
//
// export {
//   chat_refineOutputSchema,
//   type chat_refineOutput,
// } from "../../../skills/chat-refine/references/output-schema";
//
// export { buildReport } from "../../../skills/chat-refine/scripts/generate-report";

export const SKILL_NAME = "chat-refine";
export const SKILL_VERSION = "0.1.0";
export const SKILL_STATUS = "scaffold" as const;
