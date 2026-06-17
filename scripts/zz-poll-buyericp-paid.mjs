import { config } from 'dotenv'; config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
const RUN = process.argv[2];
const MAX_MS = Number(process.argv[3] ?? 600000);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const start = Date.now();
const ts = () => new Date().toISOString().slice(11,19);
const { data: arts } = await sb.from('research_artifacts').select('id').eq('run_id', RUN);
const aid = arts[0].id;
while (Date.now() - start < MAX_MS) {
  const { data: secs } = await sb.from('research_artifact_sections').select('zone,status').eq('artifact_id', aid);
  const rows = secs ?? [];
  const get = z => rows.find(s=>s.zone===z)?.status ?? 'absent';
  const icp = get('positioningBuyerICP');
  const paid = get('positioningPaidMediaPlan');
  const allPos = ['positioningMarketCategory','positioningBuyerICP','positioningCompetitorLandscape','positioningVoiceOfCustomer','positioningDemandIntent','positioningOfferDiagnostic'];
  const posComplete = allPos.filter(z=>get(z)==='complete').length;
  console.log(`[${ts()}] buyerICP=${icp} posComplete=${posComplete}/6 paidMedia=${paid}`);
  const paidTerminal = paid==='complete' || paid==='error';
  if (icp==='complete' && paidTerminal) { console.log(`[${ts()}] TERMINAL paid=${paid}`); break; }
  if (icp==='error' && paid==='absent') { console.log(`[${ts()}] BUYERICP_ERRORED_AGAIN`); break; }
  await new Promise(r=>setTimeout(r, 20000));
}
