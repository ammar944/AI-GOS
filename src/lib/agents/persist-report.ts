// src/lib/agents/persist-report.ts
// Persist Layer 1 ResearchBundle to Supabase
// Layer 2 (SynthesisOutput) and Layer 3 (MediaPlan) are produced by downstream consumers

import type { ResearchBundle } from './types';

export async function persistAgentReport(report: ResearchBundle): Promise<{ ok: boolean }> {
  console.log('[persistAgentReport] Persisting ResearchBundle sections:', Object.keys(report));
  // TODO: insert into company_intel or research_bundle table
  // The report should be stored as structured JSON so downstream synthesis can read it.
  return { ok: true };
}
