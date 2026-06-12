import { config } from 'dotenv';
config({ path: '/Users/ammar/Dev-Projects/AI-GOS/.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = process.argv[2];
const { data: arts } = await sb.from('research_artifacts').select('id,status,children_total,children_complete').eq('run_id', RUN);
const art = arts?.[0];
if (!art) { console.log('NO_ARTIFACT_YET'); process.exit(1); }
const { data: secs } = await sb.from('research_artifact_sections').select('zone,status').eq('artifact_id', art.id);
const counts = {};
for (const s of secs ?? []) counts[s.status] = (counts[s.status] ?? 0) + 1;
const errors = (secs ?? []).filter(s => s.status === 'error').map(s => s.zone);
console.log(`artifact=${art.status} ${art.children_complete}/${art.children_total} | ${JSON.stringify(counts)}${errors.length ? ' | ERRORS: ' + errors.join(',') : ''}`);
const totalZones = (secs ?? []).length;
const done = (secs ?? []).filter(s => s.status === 'complete' || s.status === 'error').length;
process.exit(totalZones >= 8 && done === totalZones ? 0 : 1);
