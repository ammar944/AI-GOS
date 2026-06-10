#!/usr/bin/env node
// zz-e2e-report-data.mjs — collect all data for an E2E run report (read-only).
// Usage: node scripts/zz-e2e-report-data.mjs <run_id> > tmp/e2e-report-data.json
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';

const RUN_ID = process.argv[2];
if (!RUN_ID) { console.error('usage: node scripts/zz-e2e-report-data.mjs <run_id>'); process.exit(2); }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const out = { runId: RUN_ID, collectedAt: new Date().toISOString() };

const { data: js } = await sb
  .from('journey_sessions')
  .select('id,created_at,job_status,onboarding_data,phase')
  .eq('run_id', RUN_ID)
  .single();
out.session = {
  id: js?.id,
  createdAt: js?.created_at,
  phase: js?.phase,
  onboarding: js?.onboarding_data ?? null,
  corpusJob: js?.job_status ? Object.values(js.job_status)[0] : null,
};

const { data: arts } = await sb
  .from('research_artifacts')
  .select('id,status,children_total,children_complete,profile_persisted_at,created_at,updated_at')
  .eq('run_id', RUN_ID);
out.artifact = arts?.[0] ?? null;

if (out.artifact) {
  const { data: secs, error: se } = await sb
    .from('research_artifact_sections')
    .select('zone,status,verification_tier,counts_toward_rollup,updated_at,data')
    .eq('artifact_id', out.artifact.id);
  if (se) console.error('sections error:', se.message);
  out.sections = secs ?? [];

  const { data: events, error: ee } = await sb
    .from('research_section_events')
    .select('zone,event_type,created_at,payload')
    .eq('artifact_id', out.artifact.id)
    .order('created_at', { ascending: true });
  if (ee) console.error('events error:', ee.message);
  out.events = events ?? [];
}

console.log(JSON.stringify(out));
