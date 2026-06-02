/**
 * phase5-live-adprobe.ts — Phase 5 LIVE behavioral sign-off for the ad-engine
 * resurrection. Drives the REAL integrated path (runCompetitorAdProbeSteps:
 * 3-way google+meta+linkedin allSettled + Foreplay direct prepass) against LIVE
 * SearchAPI / LinkedIn / Foreplay, then runs the adapter (buildCompetitorAd-
 * EvidenceGroups: cross-provider dedup + counts + gaps) and reports the
 * definition-of-done assertions.
 *
 * BOUNDED: maxAdvertisers caps advertiser count; the probe has its own internal
 * deadline + per-Foreplay 9s timeout. THROWAWAY — do not commit.
 *
 * Run: npx tsx scripts/phase5-live-adprobe.ts
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local', override: false });

import { runCompetitorAdProbeSteps } from '../src/lib/lab-engine/agents/run-section';
import { buildCompetitorAdEvidenceGroups } from '../src/lib/lab-engine/agents/tools/competitor-ad-adapter';
import { googleAdsAgentTool } from '../src/lib/lab-engine/agents/tools/google-ads';
import { metaAdsAgentTool } from '../src/lib/lab-engine/agents/tools/meta-ads';
import { linkedInAdsAgentTool } from '../src/lib/lab-engine/agents/tools/linkedin-ads';
import { saaslaunchResearchInput } from '../src/lib/lab-engine/fixtures/saaslaunch';

const MAX_ADVERTISERS = Number(process.env.PHASE5_MAX_ADVERTISERS ?? '3');

// Ad-rich real brands (proven by the bounded probes): Notion -> SearchAPI
// google+meta+linkedin (24 LinkedIn ads); Airtable -> Foreplay video creatives
// (r2.foreplay.co) + likely Meta SearchAPI (the cross-provider dedup candidate);
// ClickUp -> SearchAPI coverage.
const researchInput = {
  ...saaslaunchResearchInput,
  competitorSeeds: [
    { name: 'ClickUp', domain: 'clickup.com' }, // Foreplay resolves to the real "ClickUp" brand -> videos should surface
    { name: 'Airtable', domain: 'airtable.com' }, // Foreplay resolves to "sergegatari" reseller -> brand-guard should REJECT
  ],
};

const researchTools = {
  google_ads: googleAdsAgentTool,
  meta_ads: metaAdsAgentTool,
  linkedin_ads: linkedInAdsAgentTool,
};

function host(u?: string | null): string {
  if (!u) return '∅';
  try {
    return new URL(u).host;
  } catch {
    return '(bad)';
  }
}

async function main(): Promise<void> {
  console.log('=== Phase 5 LIVE ad-probe sign-off ===');
  console.log('SEARCHAPI_KEY:', Boolean(process.env.SEARCHAPI_KEY), '| FOREPLAY_API_KEY:', Boolean(process.env.FOREPLAY_API_KEY), '| ENABLE_FOREPLAY:', process.env.ENABLE_FOREPLAY ?? '(unset)');
  console.log('advertisers:', researchInput.competitorSeeds.map((s) => s.name).join(', '), `(max ${MAX_ADVERTISERS})`);
  console.log('LAB_AD_EVIDENCE_STRICT:', process.env.LAB_AD_EVIDENCE_STRICT ?? '(unset/off)');
  console.log('\n--- running live probe (google+meta+linkedin allSettled + Foreplay direct) ---');

  const t0 = process.hrtime.bigint();
  const steps = await runCompetitorAdProbeSteps({
    maxAdvertisers: MAX_ADVERTISERS,
    researchInput: researchInput as typeof saaslaunchResearchInput,
    researchTools,
  });
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`probe returned ${steps.length} step(s) in ${(elapsedMs / 1000).toFixed(1)}s`);

  // Raw per-(toolName) tally from the steps (PRE-adapter), so cross-provider
  // collapse is observable: count raw ads by toolName, then compare to deduped.
  const rawByTool: Record<string, number> = {};
  const rawIdsByTool: Record<string, Set<string>> = {};
  for (const step of steps) {
    step.toolResults.forEach((tr) => {
      const out = tr.output as { type?: string; ads?: Array<{ id?: string }>; reason?: string };
      if (out?.type === 'result' && Array.isArray(out.ads)) {
        rawByTool[tr.toolName] = (rawByTool[tr.toolName] ?? 0) + out.ads.length;
        rawIdsByTool[tr.toolName] ??= new Set();
        out.ads.forEach((a) => a.id && rawIdsByTool[tr.toolName].add(String(a.id)));
      } else if (out?.type === 'gap') {
        console.log(`  [gap] ${tr.toolName}: ${out.reason}`);
      }
    });
  }
  console.log('raw ads by toolName (pre-dedup):', rawByTool);

  const groups = buildCompetitorAdEvidenceGroups({ steps });

  console.log(`\n=== ${groups.length} advertiser group(s) (post-adapter, deduped) ===`);
  const platformsWithCreatives = new Set<string>();
  let foreplayVideoCount = 0;
  let linkedinCreativeCount = 0;
  let transcriptCount = 0;

  for (const g of groups) {
    console.log(`\n▶ ${g.advertiserName}  domain=${g.domain ?? '∅'}`);
    console.log(`   platforms=${g.platforms.join(',')} displayableTotal=${g.displayableTotal} returned=${g.returnedCreativeCount}`);
    console.log(`   rawCounts=${JSON.stringify(g.rawCounts)} displayableCounts=${JSON.stringify(g.displayableCounts)}`);
    g.creatives.forEach((c, i) => {
      if (c.platform) platformsWithCreatives.add(c.platform);
      if ((c as { source?: string }).source === 'foreplay' && c.videoUrl) foreplayVideoCount += 1;
      if (c.platform === 'linkedin') linkedinCreativeCount += 1;
      if ((c as { transcript?: string }).transcript) transcriptCount += 1;
      console.log(
        `     [${i}] ${c.platform} src=${(c as { source?: string }).source ?? '∅'} id=${c.id}` +
          ` video=${host(c.videoUrl)} image=${host(c.imageUrl)}` +
          ` transcript=${(c as { transcript?: string }).transcript ? `${(c as { transcript?: string }).transcript!.length}ch` : 'no'}` +
          ` headline="${(c.headline ?? '').slice(0, 40)}"`,
      );
    });
    if (g.dataGaps.length) console.log(`   dataGaps: ${g.dataGaps.map((d) => `${d.platform ?? ''}:${d.reason}`).join(' | ')}`);
    if (g.sourceErrors.length) console.log(`   sourceErrors: ${g.sourceErrors.map((e) => `${e.platform}:${e.message}`).join(' | ')}`);
  }

  // --- Definition-of-done assertions ---
  console.log('\n================ DEFINITION OF DONE ================');
  const totalCreatives = groups.reduce((n, g) => n + g.creatives.length, 0);
  const a1 = platformsWithCreatives.size >= 2;
  const a2 = linkedinCreativeCount > 0;
  const a3 = foreplayVideoCount > 0;
  const a4 = groups.some((g) => g.displayableTotal > 0);
  console.log(`creatives total: ${totalCreatives} across platforms {${[...platformsWithCreatives].join(',')}}`);
  console.log(`[${a1 ? 'PASS' : 'FAIL'}] creatives across >=2 platforms`);
  console.log(`[${a2 ? 'PASS' : 'WARN'}] LinkedIn creatives present (${linkedinCreativeCount})`);
  console.log(`[${a3 ? 'PASS' : 'WARN'}] Foreplay video creatives present (${foreplayVideoCount}); transcripts=${transcriptCount}`);
  console.log(`[${a4 ? 'PASS' : 'FAIL'}] >=1 group has displayableTotal > 0`);
  // Cross-provider dedup observability: did any toolName feed Foreplay (meta_ads/linkedin_ads synthetic) ids that overlap SearchAPI?
  console.log('\nDedup observability — raw distinct ids per toolName vs deduped creatives per group:');
  console.log('  (a meta_ads tally inflated by Foreplay-injected rows collapsing to fewer deduped meta creatives = cross-provider join working)');
  console.log('\nNOTE: a genuinely Foreplay-excluded brand (e.g. Notion) yields SearchAPI-only — expected, not a failure.');
  console.log('====================================================');
}

void main().catch((e) => {
  console.error('Phase 5 probe error:', e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
