#!/usr/bin/env node
// zz-verify-e2e-run.mjs — objective PASS/FAIL gate for a full research E2E run.
// Reads the persisted artifact for a run_id from Supabase (no writes) and asserts
// the run is structurally complete + the "idk" fix held with real input.
//
// Usage: node scripts/zz-verify-e2e-run.mjs <run_id>
//
// Exit 0 = all HARD checks PASS. Exit 1 = >=1 HARD FAIL. Exit 2 = setup/DB error.
// WARN lines are advisory (ARI honest badges, 45s review timeout, slot counts).
// Criteria grounded in docs/handoffs/2026-06-09-full-e2e-gate.md (lanes C/D).
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';

const RUN_ID = process.argv[2];
if (!RUN_ID) {
  console.error('Usage: node scripts/zz-verify-e2e-run.mjs <run_id>');
  process.exit(2);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const CORPUS = 'deepResearchProgram';
const POSITIONING_SIX = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
];
const PAID_MEDIA = 'positioningPaidMediaPlan';
const EXPECTED_ZONES = [CORPUS, ...POSITIONING_SIX, PAID_MEDIA];
const CAPSTONE_ZONES = [PAID_MEDIA, 'positioningSynthesis', 'positioningCrossSectionReasoning'];

const results = [];
const hard = (name, ok, detail) => results.push({ name, ok, detail, level: 'HARD' });
const warn = (name, ok, detail) => results.push({ name, ok, detail, level: 'WARN' });
const bodyOf = (sec) => sec?.data?.body ?? sec?.data ?? {};

async function main() {
  const { data: arts, error: ae } = await sb
    .from('research_artifacts')
    .select('id, run_id, status, children_total, children_complete, profile_persisted_at')
    .eq('run_id', RUN_ID);
  if (ae) { console.error('DB error:', ae.message); process.exit(2); }
  if (!arts?.length) { console.error(`No research_artifacts row for run_id ${RUN_ID}`); process.exit(2); }
  const parent = arts[0];

  const { data: secs } = await sb
    .from('research_artifact_sections')
    .select('zone, status, verification_tier, counts_toward_rollup, data')
    .eq('artifact_id', parent.id);
  const byZone = new Map((secs ?? []).map((s) => [s.zone, s]));

  const { data: events } = await sb
    .from('research_section_events')
    .select('id')
    .eq('artifact_id', parent.id)
    .eq('event_type', 'profile_persisted');

  // --- run-level (Lane D) ---
  hard('artifact status=complete', parent.status === 'complete', `status=${parent.status}`);
  hard('rollup children 6/6', parent.children_total === 6 && parent.children_complete === 6, `${parent.children_complete}/${parent.children_total}`);
  hard('profile persisted', !!parent.profile_persisted_at, `profile_persisted_at=${parent.profile_persisted_at ?? 'null'}`);
  hard('exactly one profile_persisted event', (events?.length ?? 0) === 1, `count=${events?.length ?? 0}`);

  // --- presence + status of every zone ---
  for (const zone of EXPECTED_ZONES) {
    const s = byZone.get(zone);
    hard(`${zone} committed`, !!s && s.status === 'complete', s ? `status=${s.status}` : 'MISSING');
  }

  // --- rollup scoping (Lane D: W5) ---
  for (const zone of POSITIONING_SIX) {
    const s = byZone.get(zone);
    if (s) hard(`${zone}: counts_toward_rollup=true`, s.counts_toward_rollup === true, `flag=${s.counts_toward_rollup}`);
  }
  const misflagged = CAPSTONE_ZONES.filter((z) => byZone.get(z)?.counts_toward_rollup === true);
  hard('no capstone mis-flagged into rollup', misflagged.length === 0, misflagged.join(', ') || 'clean');

  // --- sources present (Lane C) — skip corpus (no data.sources on corpus path) ---
  for (const zone of [...POSITIONING_SIX, PAID_MEDIA]) {
    const s = byZone.get(zone);
    if (!s) continue;
    const srcs = s.data?.sources ?? [];
    hard(`${zone}: >=1 source`, Array.isArray(srcs) && srcs.length > 0, `sources=${Array.isArray(srcs) ? srcs.length : 'n/a'}`);
  }

  // --- FIX UNDER TEST 1 (commit 753116f5): competitor ad wall real, not idk ---
  const comp = byZone.get('positioningCompetitorLandscape');
  const groups = bodyOf(comp)?.adEvidence?.advertiserGroups ?? [];
  const advNames = groups.map((g) => String(g.advertiserName ?? ''));
  const hasIdkAdvertiser = advNames.some((n) => n.trim().toLowerCase() === 'idk');
  const displayableTotal = groups.reduce((t, g) => t + (Number(g.displayableTotal) || 0), 0);
  hard('competitor wall: no "idk" advertiser', !hasIdkAdvertiser, `advertisers=[${advNames.join(', ')}]`);
  // Compound seed regression (run 9a9412a2): "X and Y" must never reach the wall as ONE advertiser.
  const hasCompoundAdvertiser = advNames.some((n) => /\s(?:and|&)\s/i.test(n));
  hard('competitor wall: no compound advertiser names', !hasCompoundAdvertiser, `advertisers=[${advNames.join(', ')}]`);
  // Anti-starvation: a zero-creative wall is acceptable ONLY when every group proves
  // the lookups actually ran (per-platform checked evidence). Brief competitors that
  // genuinely run no ads are an honest finding, not a failure.
  const everyGroupProbed = groups.length > 0 && groups.every((g) => Array.isArray(g.platforms) && g.platforms.length > 0);
  hard(
    'competitor wall: creatives present OR honest probed-zero',
    displayableTotal > 0 || everyGroupProbed,
    displayableTotal > 0
      ? `displayableTotal=${displayableTotal}`
      : `displayableTotal=0, probed platforms per group: ${groups.map((g) => `${g.advertiserName}:[${(g.platforms ?? []).join('/')}]`).join(' ')}`,
  );
  // prose must not fabricate counts on an empty wall (Lane C)
  const prose = String(bodyOf(comp)?.adEvidence?.prose ?? '');
  const proseHasCounts = /\b\d+\s+(ad|ads|creative|creatives|video|videos|carousel|display)\b/i.test(prose);
  if (displayableTotal === 0) {
    hard('competitor prose not fabricated on empty wall', !proseHasCounts, proseHasCounts ? 'prose asserts ad counts against empty wall' : 'deterministic summary');
  }

  // --- FIX UNDER TEST 2 (commit 753116f5): paid-media budget resolved ---
  const pmp = byZone.get(PAID_MEDIA);
  const pmpBody = bodyOf(pmp);
  const pmpStr = JSON.stringify(pmpBody ?? {});
  hard('paid-media: no $[Budget] placeholder', !pmpStr.includes('$[Budget]'), `$[Budget] count=${(pmpStr.match(/\$\[Budget\]/g) ?? []).length}`);
  hard('paid-media: no [brief: token', !pmpStr.includes('[brief:'), `[brief: count=${(pmpStr.match(/\[brief:/g) ?? []).length}`);
  const monthlyBudget = String(pmpBody?.campaignOverview?.monthlyBudget ?? '');
  hard('paid-media: monthly budget resolved', monthlyBudget.length > 0 && !monthlyBudget.includes('$[Budget]'), `campaignOverview.monthlyBudget=${JSON.stringify(monthlyBudget)}`);

  // --- broad non-answer leak scan across all section bodies (Lane C) ---
  const leakZones = [];
  for (const zone of EXPECTED_ZONES) {
    const s = byZone.get(zone);
    if (!s) continue;
    const str = JSON.stringify(bodyOf(s) ?? {});
    if (str.includes('$[Budget]') || str.includes('[brief:') || /"idk(\s+idk)*"/i.test(str)) leakZones.push(zone);
  }
  hard('no $[Budget]/[brief:/idk token in any section body', leakZones.length === 0, leakZones.join(', ') || 'clean');

  // --- advisory ---
  for (const zone of [...POSITIONING_SIX, PAID_MEDIA]) {
    const s = byZone.get(zone);
    if (!s) continue;
    const tier = s.verification_tier ?? 'n/a';
    warn(`${zone} tier`, tier === 'verified' || tier === 'needs_review', `tier=${tier}`);
  }
  if (pmp?.data?.review) {
    warn('paid-media agentic review ran (not 45s-timeout)', pmp.data.review.tier !== 'unavailable', `review.tier=${pmp.data.review.tier}`);
  }
  const counts = {
    phases: pmpBody?.campaignPhases?.length, aud: pmpBody?.audienceTypes?.length,
    angles: pmpBody?.anglesToTest?.length, creatives: pmpBody?.creativeFramework?.length,
    funnels: pmpBody?.funnelIdeation?.length, kpis: pmpBody?.kpis?.length,
  };
  const slotOk = counts.phases === 2 && counts.aud === 3 && counts.angles === 4 && counts.creatives === 8 && counts.funnels === 3 && counts.kpis === 3;
  warn('paid-media slot counts (2/3/4/8/3/3)', slotOk, JSON.stringify(counts));

  // --- report ---
  console.log(`\n=== E2E gate: run ${RUN_ID} (artifact ${parent.id}) ===\n`);
  let hardFail = 0;
  for (const r of results) {
    const tag = r.ok ? 'PASS' : r.level === 'WARN' ? 'WARN' : 'FAIL';
    if (!r.ok && r.level === 'HARD') hardFail++;
    console.log(`${tag.padEnd(4)} [${r.level}] ${r.name} — ${r.detail}`);
  }
  console.log('');
  if (hardFail === 0) {
    console.log('GATE: PASS — all hard checks green. (Review WARN lines for advisory badges.)');
    process.exit(0);
  }
  console.log(`GATE: FAIL — ${hardFail} hard check(s) failed.`);
  process.exit(1);
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
