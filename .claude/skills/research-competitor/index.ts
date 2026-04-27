/**
 * research-competitor — Hermes Skill Bridge
 *
 * The agent does ALL collection via web_search + browser tools.
 * This file only exports schemas and the report generator.
 * No orchestrator. No API clients. No env vars.
 */

export {
  ResearchCompetitorInputSchema,
  type ResearchCompetitorInput,
} from "../schemas/input";

export {
  ResearchCompetitorOutputSchema,
  type ResearchCompetitorOutput,
} from "../schemas/output";

// Report generator for final HTML rendering
export { buildReport } from "../scripts/generate-report";
