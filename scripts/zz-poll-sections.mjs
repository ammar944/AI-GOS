import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = process.argv[2] ?? '9a9412a2-ea4d-4653-a136-19c84df2984f';
const { data: arts } = await sb.from('research_artifacts').select('id,status,children_total,children_complete').eq('run_id', RUN);
if (!arts?.length) { console.log('NO_ARTIFACT'); process.exit(0); }
const a = arts[0];
const { data: secs } = await sb.from('research_artifact_sections').select('zone,status,updated_at').eq('artifact_id', a.id);
const done = (secs ?? []).filter((s) => s.status === 'complete').length;
const errored = (secs ?? []).filter((s) => s.status === 'error');
console.log(`artifact=${a.status} children=${a.children_complete}/${a.children_total} sections_complete=${done}/${secs?.length ?? 0} errors=${errored.length}`);
for (const s of secs ?? []) console.log(' ', s.zone, '|', s.status, '|', s.updated_at?.slice(11, 19));
if (errored.length) console.log('ERRORED:', errored.map((s) => s.zone).join(','));
