/**
 * Live CLI test for the keywords runner.
 *
 * Memory claims the runner "falls to rescue mode, produces 4 keywords
 * instead of 15+, only queries SpyFu for 1 competitor domain instead of
 * all 5 + client." This test stands up a realistic context and observes
 * what actually happens: which attempt mode survives, what the final
 * keyword count is, and which SpyFu domains got hit.
 *
 * Run: cd research-worker && npx tsx src/eval/test-keywords-runner.ts
 * Cost: 1–4 Anthropic Sonnet calls (cascade) + up to 6 SpyFu calls. ~$0.20.
 */

import 'dotenv/config';
import { runResearchKeywords } from '../runners/keywords';

// Minimal but representative research context for Fellow.ai.
// Mirrors the shape the dispatcher assembles — `Business context:` marker,
// persisted research sections with `## Heading` + JSON payloads.
const CONTEXT = `You are helping a paid-media strategist build a Google Ads keyword plan.

Business context:
- Company: Fellow.ai
- Website: https://fellow.ai
- Product: AI meeting assistant that joins Zoom/Meet/Teams, transcribes, summarises, and writes action items.
- Category: AI Meeting Intelligence / AI Notetaker
- Business model: SaaS subscription ($19/user/mo base, enterprise tiers)
- Buyer: Sales leaders, CS managers, team leads
- Core keywords: AI meeting notetaker, meeting transcription software, AI meeting assistant, automatic meeting summary, action item extraction, Zoom meeting recorder
- Negative keywords: video conferencing platform, team chat, project management
- Direct competitors: Fireflies.ai (fireflies.ai), Otter.ai (otter.ai), Gong (gong.io), Avoma (avoma.com), Fathom (fathom.video)

Existing persisted research to reuse:

## identityResolution
{"category":"AI Meeting Intelligence","coreProduct":"AI meeting assistant","coreKeywords":["AI meeting notetaker","meeting transcription software","AI meeting assistant"],"negativeKeywords":["video conferencing","team chat"]}

## industryMarket
{"categorySnapshot":{"category":"AI Meeting Intelligence","marketMaturity":"growth","awarenessLevel":"solution-aware","averageSalesCycle":"2-4 weeks"},"painPoints":{"primary":["Meetings lose key decisions","Reps forget follow-ups","Note-taking steals focus"]}}

## icpValidation
{"validatedPersona":"Sales leaders at 50-500 person SaaS","channels":["Google","LinkedIn"],"triggers":["Ramp-up pain","Forecast inaccuracy"],"objections":["Security/compliance","Native CRM fit"]}

## competitors
{"competitors":[{"name":"Fireflies.ai","website":"https://fireflies.ai","positioning":"AI notetaker for every team"},{"name":"Otter.ai","website":"https://otter.ai","positioning":"Live transcription for meetings"},{"name":"Gong","website":"https://gong.io","positioning":"Revenue intelligence"},{"name":"Avoma","website":"https://avoma.com","positioning":"AI meeting assistant for SaaS"},{"name":"Fathom","website":"https://fathom.video","positioning":"Free AI notetaker"}]}

## offerAnalysis
{"offerStrength":{"overallScore":7},"pricingAnalysis":{"currentPricing":"$19/user/mo, Team $29/user, Enterprise contact-sales"}}
`;

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing');
    process.exit(2);
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(' KEYWORDS RUNNER — live CLI test (Fellow.ai)');
  console.log('══════════════════════════════════════════════════════════\n');

  const t0 = Date.now();
  const progressLog: string[] = [];
  const result = await runResearchKeywords(CONTEXT, async (update) => {
    progressLog.push(`[${update.phase ?? 'progress'}] ${update.message ?? ''}`);
  });
  const elapsed = Date.now() - t0;

  console.log(`\nElapsed:    ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Status:     ${result.status}`);
  if (result.error) console.log(`Error:      ${result.error}`);

  const data = result.data as Record<string, unknown> | undefined;
  if (!data) {
    console.log('❌ No data returned');
    process.exit(1);
  }

  const campaignGroups = Array.isArray(data.campaignGroups) ? data.campaignGroups : [];
  const topOpportunities = Array.isArray(data.topOpportunities) ? data.topOpportunities : [];
  const keywordsByTheme = Array.isArray(data.keywordsByTheme) ? data.keywordsByTheme : [];

  let totalKeywords = 0;
  for (const g of campaignGroups) {
    const adGroups = Array.isArray((g as { adGroups?: unknown }).adGroups)
      ? (g as { adGroups: unknown[] }).adGroups
      : [];
    for (const ag of adGroups) {
      const kws = Array.isArray((ag as { keywords?: unknown }).keywords)
        ? (ag as { keywords: unknown[] }).keywords
        : [];
      totalKeywords += kws.length;
    }
  }

  console.log(`\n── KEYWORD OUTPUT ──`);
  console.log(`Campaign groups:       ${campaignGroups.length}`);
  console.log(`Total keywords:        ${totalKeywords}`);
  console.log(`topOpportunities:      ${topOpportunities.length}`);
  console.log(`keywordsByTheme:       ${keywordsByTheme.length}`);

  console.log(`\n── CASCADE FOOTPRINT ──`);
  console.log(`Progress updates: ${progressLog.length}`);
  for (const line of progressLog.slice(-10)) console.log(`  ${line}`);

  // Identify which mode won from the rawText hints.
  const raw = (result.rawText ?? '').toLowerCase();
  const rescueHit = raw.includes('rescue') || /rescue/i.test(progressLog.join('\n'));
  const repairHit = raw.includes('repair') || /repair/i.test(progressLog.join('\n'));
  const heuristicHit = raw.includes('heuristic') || /heuristic/i.test(progressLog.join('\n'));

  console.log(`\n── DIAGNOSTICS ──`);
  console.log(`rawText length:  ${(result.rawText ?? '').length} chars`);
  console.log(`Fell to rescue:    ${rescueHit ? 'YES (bad)' : 'no'}`);
  console.log(`Fell to repair:    ${repairHit ? 'yes' : 'no'}`);
  console.log(`Fell to heuristic: ${heuristicHit ? 'yes' : 'no'}`);

  console.log(`\n── VERDICT ──`);
  const expected = { minKeywords: 15, minCampaignGroups: 2, minTopOpps: 3 };
  const passes = [
    totalKeywords >= expected.minKeywords,
    campaignGroups.length >= expected.minCampaignGroups,
    topOpportunities.length >= expected.minTopOpps,
  ];
  if (passes.every(Boolean)) {
    console.log(`✓ PASS — runner returned a full artifact`);
  } else {
    console.log(`✗ FAIL — thin artifact (keywords ${totalKeywords}<${expected.minKeywords}, groups ${campaignGroups.length}<${expected.minCampaignGroups}, opps ${topOpportunities.length}<${expected.minTopOpps})`);
  }
}

main().catch((err) => {
  console.error('[test-keywords-runner] fatal:', err);
  process.exit(1);
});
