#!/usr/bin/env node
// zz-gap8-section-gates.mjs — deterministic per-priority (A-G) gates over a
// zz-dump-run-sections.mjs bundle dir. Each section file is the full `data`
// object with the body at `.body`. Exit 0 = all HARD gates pass, else 2.
// Usage: node scripts/zz-gap8-section-gates.mjs <bundleDir>
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = process.argv[2];
if (!DIR) { console.error('Usage: node scripts/zz-gap8-section-gates.mjs <bundleDir>'); process.exit(2); }

async function body(zone) {
  try {
    const raw = JSON.parse(await readFile(join(DIR, `${zone}.json`), 'utf8'));
    return raw.body ?? raw;
  } catch { return null; }
}
async function manifest() {
  try { return JSON.parse(await readFile(join(DIR, '_manifest.json'), 'utf8')); } catch { return null; }
}
function allStrings(v, acc = []) {
  if (typeof v === 'string') acc.push(v);
  else if (Array.isArray(v)) for (const x of v) allStrings(x, acc);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, acc);
  return acc;
}
const sentences = (s) => (s ? (s.match(/[.!?]/g) || []).length : 0);

const rows = [];
function gate(id, prio, hard, pass, detail) { rows.push({ id, prio, hard, pass, detail }); }

const EDU = /opportunity cost|profit margin|gross profit|balance sheet|mission statement|liquid assets|bootstrapping|direct deposit|wire transfer|remittance|california secretary|secretary of state/i;
const CATEGORY_COMMERCIAL = /spend management|expense management|corporate card|ap automation|accounts payable|procurement|bill pay|card controls|finance automation|expense report|virtual card/i;
const BANNED = /\bblockGap\b|verifiedCount|quarantine|source-liveness|containment|keyword_volume|web_search|FIRECRAWL_API_KEY|API_KEY|\b403\b|\b429\b|rate_limited|prepass/;

async function run() {
  // ---- A: Market sizing ----
  const mc = await body('positioningMarketCategory');
  if (mc) {
    const tam = mc.marketSize?.bottomUpTam ?? {};
    const inputs = tam.inputs ?? [];
    const sourced = inputs.filter((i) => i.status === 'sourced').length;
    const est = String(tam.reachableRevenueEstimate ?? '');
    // A2: no fabricated TAM — if <4 inputs sourced, no $ figure in the estimate.
    const hasDollar = /\$\s?\d/.test(est);
    gate('A2-no-fabricated-tam', 'A', true, sourced >= 4 || !hasDollar, `sourcedInputs=${sourced}/4 est="${est.slice(0,60)}"`);
    // A1: signals populated OR honest directional cap (improvement over signals:[] + 4/4 gap)
    const signals = (mc.marketSize?.signals ?? []).length;
    gate('A1-signals-or-honest-cap', 'A', false, signals >= 1 || /directional/i.test(est), `signals=${signals}`);
  } else gate('A-market', 'A', true, false, 'positioningMarketCategory.json missing');

  // ---- B: Demand commercial quality ----
  const di = await body('positioningDemandIntent');
  if (di) {
    const kws = di.keywordDemand?.keywords ?? [];
    const blob = kws.map((k) => String(k.keyword ?? '').toLowerCase()).join(' | ');
    const commercial = kws.filter((k) => k.intentType === 'commercial');
    // B1: a category-commercial term present AND >=3 commercial keywords
    gate('B1-category-commercial-present', 'B', true, CATEGORY_COMMERCIAL.test(blob) && commercial.length >= 3, `categoryTerm=${CATEGORY_COMMERCIAL.test(blob)} commercialCount=${commercial.length}`);
    // B2: no generic educational term tagged commercial
    const eduAsCommercial = commercial.filter((k) => EDU.test(String(k.keyword ?? '')));
    gate('B2-no-educational-as-commercial', 'B', true, eduAsCommercial.length === 0, `eduTaggedCommercial=${eduAsCommercial.map((k)=>k.keyword).join(',') || 'none'}`);
    // B3: question/venue/intent block present where evidence (advisory)
    const qm = (di.questionMining?.questions ?? di.questionMining?.items ?? []).length;
    const vm = (di.venueMap?.venues ?? di.venueMap?.items ?? []).length;
    const is = (di.intentSignals?.items ?? []).length;
    gate('B3-question-venue-intent', 'B', false, qm + vm + is > 0, `questions=${qm} venues=${vm} intent=${is}`);
  } else gate('B-demand', 'B', true, false, 'positioningDemandIntent.json missing');

  // ---- C: BuyerICP consistency/depth ----
  const bi = await body('positioningBuyerICP');
  if (bi) {
    const personas = bi.personaReality?.personas ?? [];
    const n = personas.length;
    // C1: >=3 personas -> evidenceGap reconciled
    const c1 = n < 3 || (bi.evidenceGap !== true && bi.evidenceGapReport?.reason !== 'insufficient_named_buyer_personas');
    gate('C1-evidencegap-reconciled', 'C', true, c1, `personas=${n} evidenceGap=${bi.evidenceGap} reason=${bi.evidenceGapReport?.reason ?? 'none'}`);
    // C2: no shared aggregate-listing laundering (>2 personas sharing one URL, or G2/capterra aggregate URL)
    const urls = personas.map((p) => p.sourceUrl ?? p.evidenceUrl ?? p.url ?? '');
    const counts = {}; let maxShare = 0;
    for (const u of urls) { counts[u] = (counts[u] || 0) + 1; maxShare = Math.max(maxShare, counts[u]); }
    const aggregate = urls.filter((u) => /g2\.com\/products\/[^/]+\/reviews\/?$|capterra\.com\/p\/\d+\/[^/]+\/reviews\/?$/i.test(u));
    gate('C2-no-listing-laundering', 'C', true, n === 0 || (maxShare <= 2 && aggregate.length === 0), `maxShare=${maxShare} aggregateUrls=${aggregate.length}`);
  } else gate('C-buyericp', 'C', true, false, 'positioningBuyerICP.json missing');

  // ---- D: VoC decision evidence ----
  const voc = await body('positioningVoiceOfCustomer');
  if (voc) {
    const q = voc.painLanguage?.quotes ?? [];
    const hosts = [...new Set(q.map((x) => String(x.sourceUrl ?? x.url ?? '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0]).filter(Boolean))];
    const allHaveText = q.every((x) => String(x.verbatimText ?? x.quote ?? x.text ?? '').length > 0 && String(x.sourceUrl ?? x.url ?? '').length > 0);
    gate('D1-counts-equal-rows-and-distinct', 'D', true, q.length >= 3 && hosts.length >= 3 && allHaveText, `quotes=${q.length} distinctHosts=${hosts.length} allHaveText=${allHaveText}`);
    // D2: no fanning — no objection/switching/criteria/success entry is a verbatim copy of a pain quote
    const pain = new Set(q.map((x) => String(x.verbatimText ?? x.quote ?? x.text ?? '')));
    const derived = [
      ...(voc.objections?.items ?? []).map((x) => x.objectionText ?? x.text ?? ''),
      ...(voc.switchingStories?.stories ?? []).map((x) => x.summary ?? x.verbatimText ?? ''),
      ...(voc.decisionCriteria?.criteria ?? []).map((x) => x.criterion ?? x.text ?? ''),
      ...(voc.successLanguage?.quotes ?? []).map((x) => x.verbatimText ?? x.quote ?? ''),
    ];
    const fanned = derived.filter((d) => d && pain.has(d));
    gate('D2-no-fanning', 'D', true, fanned.length === 0, `fannedCopies=${fanned.length}`);
  } else gate('D-voc', 'D', true, false, 'positioningVoiceOfCustomer.json missing');

  // ---- E: Offer + Exec fact ledger ----
  const man = await manifest();
  const ledger = man?.thesis?.factLedger ?? man?.thesis?.appendix?.factLedger ?? null;
  if (ledger?.facts) {
    const acvVals = ledger.facts.filter((f) => f.factKey === 'acv' || f.label === 'acv')
      .flatMap((f) => [f.winner?.normalizedValue ?? 0, ...(f.readings ?? []).map((r) => r.normalizedValue ?? 0)]);
    gate('E1-no-valuation-as-acv', 'E', true, !acvVals.some((v) => v >= 1e9), `acvMax=${Math.max(0, ...acvVals)}`);
    const budgetWinners = ledger.facts.filter((f) => /budget/i.test(f.factKey ?? f.label ?? '')).map((f) => f.winner?.normalizedValue ?? 0);
    gate('E3-budget-winner-not-stray', 'E', true, !budgetWinners.some((v) => v > 0 && v < 1000), `budgetWinners=${budgetWinners.join(',') || 'none'}`);
  } else gate('E-ledger', 'E', false, true, 'no factLedger in manifest (advisory)');
  // E2: offer 40% CAC overshoot labeled operator-reported (or absent)
  const od = await body('positioningOfferDiagnostic');
  if (od) {
    const odStrings = allStrings(od);
    const unlabeled = odStrings.filter((s) => /40%|cac overshoot|\$4,?200/i.test(s) && !/operator|client brief|brief|user-supplied|self-reported|not disclosed|undisclosed/i.test(s));
    gate('E2-cac-operator-labeled', 'E', true, unlabeled.length === 0, `unlabeledOvershoot=${unlabeled.length}`);
  }

  // ---- G: Reader cleanliness ----
  for (const zone of ['positioningMarketCategory','positioningBuyerICP','positioningCompetitorLandscape','positioningVoiceOfCustomer','positioningDemandIntent','positioningOfferDiagnostic','positioningPaidMediaPlan']) {
    const b = await body(zone);
    if (!b) continue;
    // G1: no banned raw term in reader-facing string leaves
    const leaks = allStrings(b).filter((s) => BANNED.test(s));
    gate(`G1-no-banned-terms[${zone.replace('positioning','')}]`, 'G', true, leaks.length === 0, leaks.length ? `LEAK: ${leaks[0].slice(0,70)}` : 'clean');
    // G3: verdict <=1 sentence, statusSummary <=2 sentences
    const vOk = sentences(b.verdict) <= 1;
    const sOk = sentences(b.statusSummary) <= 2;
    gate(`G3-length[${zone.replace('positioning','')}]`, 'G', false, vOk && sOk, `verdictSent=${sentences(b.verdict)} statusSent=${sentences(b.statusSummary)}`);
  }

  // ---- report ----
  console.log(`\n  GAP-8 SECTION GATES — bundle ${DIR}\n  ${'-'.repeat(70)}`);
  let hardFail = 0;
  for (const r of rows) {
    const mark = r.pass ? '✓' : (r.hard ? '✗' : '⚠');
    if (!r.pass && r.hard) hardFail++;
    console.log(`  ${mark} [${r.prio}] ${r.id.padEnd(42)} ${r.detail}`);
  }
  console.log(`  ${'-'.repeat(70)}`);
  console.log(`  ${hardFail === 0 ? 'ALL HARD GATES PASS' : `${hardFail} HARD GATE(S) FAILED`}\n`);
  process.exit(hardFail === 0 ? 0 : 2);
}
run().catch((e) => { console.error(e); process.exit(2); });
