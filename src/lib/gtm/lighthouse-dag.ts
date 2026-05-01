/**
 * Canonical DAG order for the 5 lighthouse skills.
 *
 * PRD: gtm-conversational-canvas (T6)
 *
 * Earlier skills feed prior_stages context into later ones via
 * dispatch-skill.ts → collectPriorStageOutputs(). This array is the single
 * source of truth — dispatch-skill.ts re-uses it and the orchestrator system
 * prompt enumerates it for "run the full pipeline" requests.
 *
 * Mirrors the LIGHTHOUSE_5 constant historically inlined in dispatch-skill.ts.
 * Exported here so other modules (orchestrator.ts, prompts) can import without
 * pulling in the dispatch machinery.
 */

import type { LighthouseSkill } from "@/lib/gtm/types";

export const LIGHTHOUSE_DAG_ORDER = [
  "ingest-url",
  "ingest-identity",
  "research-market",
  "research-competitor",
  "research-icp",
] as const satisfies readonly LighthouseSkill[];

export type LighthouseDagOrder = typeof LIGHTHOUSE_DAG_ORDER;
