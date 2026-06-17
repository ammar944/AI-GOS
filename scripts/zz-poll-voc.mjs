// zz-poll-voc.mjs — poll one zone until terminal, then dump its body. Read-only DB.
import { config } from 'dotenv'; config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'node:fs/promises';
const RUN = process.argv[2];
const ZONE = process.argv[3] ?? 'positioningVoiceOfCustomer';
const OUT = process.argv[4] ?? `tmp/after-${ZONE}.json`;
const MAX_MS = Number(process.argv[5] ?? 420000);
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ts = () => new Date().toISOString().slice(11, 19);
const { data: arts } = await sb.from('research_artifacts').select('id').eq('run_id', RUN);
const aid = arts?.[0]?.id;
if (!aid) { console.log('no artifact'); process.exit(2); }
const start = Date.now();
let last = '';
while (Date.now() - start < MAX_MS) {
  const { data: secs } = await sb.from('research_artifact_sections')
    .select('zone,status,verification_tier,data').eq('artifact_id', aid).eq('zone', ZONE);
  const s = secs?.[0];
  const status = s?.status ?? 'absent';
  if (status !== last) { console.log(`[${ts()}] ${ZONE}=${status} tier=${s?.verification_tier ?? 'n/a'}`); last = status; }
  if (status === 'complete' || status === 'error') {
    const data = s?.data ?? {};
    await writeFile(OUT, JSON.stringify(data, null, 2), 'utf8');
    const body = data.body ?? data;
    const painQ = body?.painLanguage?.quotes?.length ?? 0;
    const succQ = body?.successLanguage?.quotes?.length ?? 0;
    const succGap = body?.successLanguage?.blockGap ? 'yes' : 'no';
    const evGap = body?.evidenceGap === true;
    console.log(`[${ts()}] TERMINAL ${ZONE}=${status} tier=${s?.verification_tier} | evidenceGap=${evGap} painQuotes=${painQ} successQuotes=${succQ} successBlockGap=${succGap}`);
    console.log(`retrievalSummary: ${JSON.stringify(body?.retrievalSummary ?? '').slice(0,160)}`);
    console.log(`dumped -> ${OUT}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 15000));
}
console.log(`[${ts()}] TIMEOUT after ${MAX_MS}ms (last=${last})`);
process.exit(1);
