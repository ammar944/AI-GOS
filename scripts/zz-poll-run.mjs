import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = '9a9412a2-ea4d-4653-a136-19c84df2984f';
const { data } = await sb.from('journey_sessions').select('job_status,phase').eq('run_id', RUN).single();
const job = Object.values(data.job_status)[0];
console.log('jobStatus:', job.status, '| sessionPhase:', data.phase, '| updates:', job.updates.length);
for (const u of job.updates.slice(-10)) console.log(u.at.slice(11,19), '|', u.phase, '|', (u.message||'').slice(0,120));
