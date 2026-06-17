import { config } from 'dotenv'; config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN='3b568ea0-b734-46ec-9618-e91b50405107';
const { data: arts } = await sb.from('research_artifacts').select('id').eq('run_id', RUN);
const { data: secs } = await sb.from('research_artifact_sections').select('zone,status,error,updated_at,data').eq('artifact_id', arts[0].id).eq('zone','positioningBuyerICP');
const s = secs[0];
console.log('status:', s.status, 'updated:', s.updated_at);
console.log('error:', JSON.stringify(s.error)?.slice(0,500));
// peek the data body persona/trigger counts if present
const b = s.data?.body ?? s.data ?? {};
console.log('data.body keys:', Object.keys(b).join(', ') || '(empty)');
const personas = b.personaReality?.personas ?? b.personas;
const triggers = b.buyingContext?.triggers ?? b.triggers;
console.log('personas len:', Array.isArray(personas)?personas.length:'n/a', '| triggers len:', Array.isArray(triggers)?triggers.length:'n/a');
if (Array.isArray(personas)) personas.slice(0,5).forEach((p,i)=>console.log(`  persona[${i}]:`, JSON.stringify(p).slice(0,160)));
if (Array.isArray(triggers)) triggers.slice(0,5).forEach((t,i)=>console.log(`  trigger[${i}]:`, JSON.stringify(t).slice(0,140)));
