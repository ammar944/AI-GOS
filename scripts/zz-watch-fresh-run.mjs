import { config } from 'dotenv';
config({ path: '/Users/ammar/Dev-Projects/AI-GOS/.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RUN = 'd838ed4e-7cc7-43ef-ad94-dea30abdb1c2';
const { data, error } = await sb.from('journey_sessions').select('job_status,phase').eq('run_id', RUN).maybeSingle();
if (error) { console.log('ERR', error.message); process.exit(2); }
if (!data) { console.log('NO_SESSION_YET'); process.exit(3); }
const job = data.job_status ? Object.values(data.job_status)[0] : null;
console.log('phase:', data.phase, '| job:', job?.status ?? 'none', '| lastUpdate:', job?.updates?.slice(-1)[0]?.message?.slice(0,100) ?? '');
process.exit(data.phase === 'onboarding' || job?.status === 'complete' ? 0 : 1);
