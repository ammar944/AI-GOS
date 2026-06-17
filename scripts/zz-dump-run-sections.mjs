#!/usr/bin/env node
// zz-dump-run-sections.mjs — read-only dump of a research run's persisted
// section bodies, for an offline quality read. No writes to the DB.
//
// Usage: node scripts/zz-dump-run-sections.mjs <run_id> [outDir]
// Writes <outDir>/<zone>.json (full data object per zone) + _manifest.json.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const RUN_ID = process.argv[2];
const OUT_DIR = process.argv[3] || join(process.cwd(), 'tmp', 'e2e-quality');
if (!RUN_ID) { console.error('Usage: node scripts/zz-dump-run-sections.mjs <run_id> [outDir]'); process.exit(2); }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function main() {
  const { data: arts, error: ae } = await sb
    .from('research_artifacts')
    .select('id, run_id, status, children_total, children_complete, thesis')
    .eq('run_id', RUN_ID);
  if (ae) { console.error('DB error:', ae.message); process.exit(2); }
  if (!arts?.length) { console.error(`No artifact for run_id ${RUN_ID}`); process.exit(2); }
  const parent = arts[0];

  const { data: secs, error: se } = await sb
    .from('research_artifact_sections')
    .select('zone, status, verification_tier, verification_flag, counts_toward_rollup, data')
    .eq('artifact_id', parent.id);
  if (se) { console.error('DB error:', se.message); process.exit(2); }

  await mkdir(OUT_DIR, { recursive: true });
  const manifest = [];
  for (const s of secs ?? []) {
    const data = s.data ?? {};
    const body = data.body ?? data;
    const sources = data.sources ?? body?.sources ?? [];
    const review = data.review ?? body?.review ?? null;
    await writeFile(join(OUT_DIR, `${s.zone}.json`), JSON.stringify(data, null, 2), 'utf8');
    manifest.push({
      zone: s.zone,
      status: s.status,
      verification_tier: s.verification_tier ?? null,
      verification_flag: s.verification_flag ?? null,
      counts_toward_rollup: s.counts_toward_rollup,
      sourcesCount: Array.isArray(sources) ? sources.length : 0,
      reviewTier: review?.tier ?? null,
      bodyKeys: body && typeof body === 'object' ? Object.keys(body) : [],
    });
  }
  manifest.sort((a, b) => a.zone.localeCompare(b.zone));

  // Brief / subject metadata so an offline judge bundle is self-describing
  // (zz-judge-run.mjs --bundle reads subjectUrl + briefInput from here).
  const { data: sessionRow } = await sb
    .from('journey_sessions')
    .select('metadata, onboarding_data')
    .eq('run_id', RUN_ID)
    .maybeSingle();

  await writeFile(join(OUT_DIR, '_manifest.json'), JSON.stringify({
    run_id: RUN_ID,
    artifact_id: parent.id,
    status: parent.status,
    children_total: parent.children_total ?? null,
    children_complete: parent.children_complete ?? null,
    rollup: `${parent.children_complete}/${parent.children_total}`,
    thesis: parent.thesis ?? null,
    subjectUrl: sessionRow?.metadata?.websiteUrl ?? null,
    briefInput: sessionRow?.onboarding_data ?? null,
    sections: manifest,
  }, null, 2), 'utf8');

  console.log(`Dumped ${manifest.length} sections for run ${RUN_ID} -> ${OUT_DIR}`);
  for (const m of manifest) {
    console.log(`  ${m.zone.padEnd(34)} status=${m.status} tier=${m.verification_tier ?? 'n/a'} rollup=${m.counts_toward_rollup} sources=${m.sourcesCount} review=${m.reviewTier ?? 'n/a'}`);
  }
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
