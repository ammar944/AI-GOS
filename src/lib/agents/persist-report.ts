// src/lib/agents/persist-report.ts
// Stub: persists validated terminal schema to Supabase
// TODO: wire to Supabase company_intel table write

import type { ResearchReport } from './types';

export async function persistAgentReport(report: ResearchReport): Promise<{ ok: boolean }> {
  console.log('[persistAgentReport] Would persist to Supabase:', Object.keys(report));
  // TODO: insert into company_intel or equivalent table
  return { ok: true };
}
