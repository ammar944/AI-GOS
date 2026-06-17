// Poll a run until artifact is terminal or all sections settle. Re-invokes caller on exit.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const RUN = process.argv[2];
const MAX_MS = Number(process.argv[3] ?? 900000); // 15 min cap
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const start = Date.now();
function ts(){ return new Date().toISOString().slice(11,19); }
while (Date.now() - start < MAX_MS) {
  const { data: arts } = await sb.from('research_artifacts').select('id,status,children_total,children_complete').eq('run_id', RUN);
  if (!arts?.length) { console.log(`[${ts()}] NO_ARTIFACT`); break; }
  const a = arts[0];
  const { data: secs } = await sb.from('research_artifact_sections').select('zone,status').eq('artifact_id', a.id);
  const rows = secs ?? [];
  const done = rows.filter(s=>s.status==='complete').length;
  const err = rows.filter(s=>s.status==='error');
  const active = rows.filter(s=>s.status==='running'||s.status==='queued');
  const hasPaid = rows.some(s=>s.zone==='positioningPaidMediaPlan');
  console.log(`[${ts()}] artifact=${a.status} rollup=${a.children_complete}/${a.children_total} complete=${done}/${rows.length} running/queued=${active.length} err=${err.length} paidMedia=${hasPaid?'present':'absent'}`);
  if (err.length) console.log('  ERR:', err.map(s=>s.zone).join(','));
  if (a.status === 'complete' || (hasPaid && active.length === 0)) {
    console.log(`[${ts()}] TERMINAL`);
    for (const s of rows) console.log('   ', s.zone.padEnd(34), s.status);
    break;
  }
  await new Promise(r=>setTimeout(r, 25000));
}
