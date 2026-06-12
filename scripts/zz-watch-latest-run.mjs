import { config } from 'dotenv';
config({ path: '/Users/ammar/Dev-Projects/AI-GOS/.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// newest journey session = the run the driver just started
const { data: sessions } = await sb
  .from('journey_sessions')
  .select('run_id,phase,created_at')
  .order('created_at', { ascending: false })
  .limit(1);
const run = sessions?.[0];
if (!run) { console.log('NO_SESSION'); process.exit(1); }
const { data: arts } = await sb.from('research_artifacts').select('id,status,children_total,children_complete,thesis').eq('run_id', run.run_id);
const art = arts?.[0];
const { data: secs } = art
  ? await sb.from('research_artifact_sections').select('zone,status,verification_tier').eq('artifact_id', art.id)
  : { data: null };
const counts = {};
for (const s of secs ?? []) counts[s.status] = (counts[s.status] ?? 0) + 1;
const errors = (secs ?? []).filter((s) => s.status === 'error').map((s) => s.zone);
const thesisStatus = art?.thesis && typeof art.thesis === 'object' ? art.thesis.status : 'none';
console.log(
  `run=${run.run_id.slice(0, 8)} created=${run.created_at} phase=${run.phase} | artifact=${art?.status ?? 'none'} ${art?.children_complete ?? 0}/${art?.children_total ?? 0} | sections=${JSON.stringify(counts)} | brief=${thesisStatus}${errors.length ? ' | ERRORS: ' + errors.join(',') : ''}`,
);
const totalZones = (secs ?? []).length;
const done = (secs ?? []).filter((s) => s.status === 'complete' || s.status === 'error').length;
process.exit(totalZones >= 8 && done === totalZones && thesisStatus === 'complete' ? 0 : 1);
