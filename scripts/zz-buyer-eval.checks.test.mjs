// Unit tests for the new deterministic buyer-eval checks that the original gate
// was BLIND to (c77ff0e1 scored 10/10 while every one of these defects shipped).
//
// Run: node --test scripts/zz-buyer-eval.checks.test.mjs
//
// These cover the pure scoring functions only — no Supabase, no network. The
// fixtures mirror the exact shape of run c77ff0e1's persisted artifact.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateBudgetPartition,
  evaluateCacUnit,
  evaluatePersonaContainment,
  evaluateCompetitorCount,
  evaluateVocLaundering,
  evaluateVocEmptyDespiteEvidence,
  evaluateSectionEmptiness,
  evaluateQuotes,
  scoreFromChecks,
} from './zz-buyer-eval.mjs';

// --- BUDGET-PARTITION ---

test('BUDGET-PARTITION FAILs the c77 double-count (25000 + 5000 + 5000 = 35000)', () => {
  const body = {
    campaignOverview: { monthlyBudgetValue: 25000 },
    projectedResults: [
      { phaseMonthlyBudgetValue: 25000 },
      { phaseMonthlyBudgetValue: 5000 },
      { phaseMonthlyBudgetValue: 5000 },
    ],
  };
  const check = evaluateBudgetPartition(body);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.evidence.includes('phaseBudgetSum=$35,000'));
  assert.ok(check.evidence.includes('duplicateFullSpend=true'));
  assert.ok(check.neverShipReasons.length >= 1);
});

test('BUDGET-PARTITION PASSes a true partition that sums to the monthly total', () => {
  const body = {
    campaignOverview: { monthlyBudgetValue: 25000 },
    projectedResults: [
      { phaseMonthlyBudgetValue: 15000 },
      { phaseMonthlyBudgetValue: 5000 },
      { phaseMonthlyBudgetValue: 5000 },
    ],
  };
  const check = evaluateBudgetPartition(body);
  assert.equal(check.status, 'PASS');
  assert.equal(check.neverShipReasons.length, 0);
});

test('BUDGET-PARTITION PASSes SEQUENTIAL phases at the monthly rate in DISTINCT windows (run 3b568ea0)', () => {
  // Two phases run back-to-back, each at the full $25k/month rate. Summing them
  // ($50k) and comparing to the $25k monthly is the false-positive bug: distinct
  // durationLabels = different time windows = NOT phantom spend.
  const body = {
    campaignOverview: { monthlyBudgetValue: 25000 },
    projectedResults: [
      { durationLabel: 'Months 1-2', phaseMonthlyBudgetValue: 25000 },
      { durationLabel: 'Month 3', phaseMonthlyBudgetValue: 25000 },
    ],
  };
  const check = evaluateBudgetPartition(body);
  assert.equal(check.status, 'PASS');
  assert.equal(check.neverShipReasons.length, 0);
  assert.ok(check.evidence.includes('windows=2'));
  assert.ok(check.evidence.includes('maxWindowSum=$25,000'));
  assert.ok(check.evidence.includes('overAllocatedWindows=0'));
  assert.ok(check.evidence.includes('duplicateFullSpend=false'));
});

test('BUDGET-PARTITION FAILs CONCURRENT rows in the SAME window summing past monthly', () => {
  // Three rows all in "Months 1-3" run at the same time; their concurrent sum
  // ($35k) over-allocates the $25k monthly — real phantom spend (the c77 shape,
  // now made explicit with a shared window).
  const body = {
    campaignOverview: { monthlyBudgetValue: 25000 },
    projectedResults: [
      { durationLabel: 'Months 1-3', phaseMonthlyBudgetValue: 15000 },
      { durationLabel: 'Months 1-3', phaseMonthlyBudgetValue: 12000 },
      { durationLabel: 'Months 1-3', phaseMonthlyBudgetValue: 8000 },
    ],
  };
  const check = evaluateBudgetPartition(body);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.evidence.includes('windows=1'));
  assert.ok(check.evidence.includes('maxWindowSum=$35,000'));
  assert.ok(check.evidence.includes('overAllocatedWindows=1'));
  assert.ok(check.neverShipReasons.some((r) => r.includes('concurrent move budgets')));
});

// --- CAC-UNIT ---

test('CAC-UNIT FAILs when a trial-KPI implied CAC beats a paid-customer target >5x with no bridge', () => {
  const body = {
    projectedResults: [
      { kpi: 'Qualified Business-plan trial', impliedCacValue: 133.69, kpiCostValue: 3000 },
      { kpi: 'Qualified trial', impliedCacValue: 135.14, kpiCostValue: 3000 },
    ],
  };
  const check = evaluateCacUnit(body);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.evidence.includes('unitMismatchOffenders=2'));
  assert.ok(check.evidence.includes('22.4x') || check.evidence.includes('22.2x'));
  assert.ok(check.neverShipReasons.length >= 1);
});

test('CAC-UNIT PASSes when a trial->paid bridge (customerCacValue) is present', () => {
  const body = {
    projectedResults: [
      { kpi: 'Qualified trial', impliedCacValue: 134, kpiCostValue: 3000, customerCacValue: 2800 },
    ],
  };
  const check = evaluateCacUnit(body);
  assert.equal(check.status, 'PASS');
  assert.equal(check.evidence.includes('rowsWithTrialToPaidBridge=1'), true);
});

test('CAC-UNIT PASSes when an honest customer-CAC sensitivity band is present (no disclosed rate)', () => {
  const body = {
    projectedResults: [
      {
        kpi: 'Qualified trial',
        impliedCacValue: 134,
        kpiCostValue: 3000,
        costPerTrialLabel: 'Cost per qualified trial (signup) — not customer CAC',
        customerCacBandLowValue: 536,
        customerCacBandHighValue: 1340,
      },
    ],
  };
  const check = evaluateCacUnit(body);
  assert.equal(check.status, 'PASS');
  assert.equal(check.evidence.includes('rowsWithTrialToPaidBridge=1'), true);
});

test('CAC-UNIT PASSes when the KPI is a paid customer (not a funnel stage)', () => {
  const body = {
    projectedResults: [
      { kpi: 'Paying customer', impliedCacValue: 134, kpiCostValue: 3000 },
    ],
  };
  const check = evaluateCacUnit(body);
  assert.equal(check.status, 'PASS');
});

// --- PERSONA-CONTAINMENT ---

test('PERSONA-CONTAINMENT is ADVISORY (not a hard never-ship) and surfaces the count + names for the judge', () => {
  const icp = {
    personaReality: {
      personas: [
        { name: 'Rachel Pleasants McLean', vendorSourced: true, sourceUrl: 'https://x' },
        { name: 'Bridget McMullan', vendorSourced: true },
        { name: 'champion (role)', vendorSourced: false },
      ],
    },
  };
  const check = evaluatePersonaContainment(icp);
  // Offline the eval cannot prove a named persona is fabricated vs a real
  // on-page customer — that is the engine source-liveness gate's job + the cold
  // judge's noFabrication backstop. So this surfaces the count but does NOT
  // never-ship (a clean run with a real named case-study buyer must not fail).
  assert.equal(check.status, 'ADVISORY');
  assert.equal(check.vendorSourcedNamedPersonaCount, 2);
  assert.ok(check.evidence.includes('Rachel Pleasants McLean'));
  assert.equal(check.neverShipReasons.length, 0);
});

test('PERSONA-CONTAINMENT PASSes when personas are role archetypes (no named humans)', () => {
  const icp = {
    personaReality: {
      personas: [
        { name: 'economic buyer', vendorSourced: false },
        { name: 'champion', vendorSourced: false },
      ],
    },
  };
  const check = evaluatePersonaContainment(icp);
  assert.equal(check.status, 'PASS');
  assert.equal(check.vendorSourcedNamedPersonaCount, 0);
});

// --- COMPETITOR-COUNT ---

test('COMPETITOR-COUNT FAILs per-advertiser when claimed verified ads exceed captured creatives', () => {
  const comp = {
    adEvidence: {
      advertiserGroups: [
        { domain: 'clickup.com', creatives: Array.from({ length: 6 }, (_, i) => ({ id: i, platform: 'meta' })) },
        { domain: 'smartsheet.com', creatives: Array.from({ length: 12 }, (_, i) => ({ id: i, platform: 'google' })) },
      ],
    },
    adPresence: {
      signals: [
        { competitor: 'ClickUp', evidence: '20 verified Meta creatives, 15 verified LinkedIn — 35 total verified.' },
        { competitor: 'Smartsheet', evidence: '11 verified Google ads — 29 total verified, the most in the set.' },
      ],
    },
  };
  const check = evaluateCompetitorCount(comp);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.evidence.includes('ClickUp: claimed 35 verified vs 6 captured'));
  assert.ok(check.evidence.includes('Smartsheet: claimed 29 verified vs 12 captured'));
  assert.ok(check.neverShipReasons.length >= 1);
});

test('COMPETITOR-COUNT PASSes when claimed counts are within captured evidence', () => {
  const comp = {
    adEvidence: {
      advertiserGroups: [
        { domain: 'stackby.com', creatives: Array.from({ length: 4 }, (_, i) => ({ id: i, platform: 'meta' })) },
      ],
    },
    adPresence: {
      signals: [{ competitor: 'Stackby', evidence: '4 verified Meta creatives.' }],
    },
  };
  const check = evaluateCompetitorCount(comp);
  assert.equal(check.status, 'PASS');
});

test('COMPETITOR-COUNT is N-A when there are no captured creative arrays to cross-check', () => {
  const comp = { adPresence: { signals: [{ competitor: 'X', evidence: '9 verified.' }] } };
  const check = evaluateCompetitorCount(comp);
  assert.equal(check.status, 'N-A');
});

// --- VOC-LAUNDERING ---

test('VOC-LAUNDERING FAILs when paid-media sources VoC voice while VoC produced ZERO usable quotes', () => {
  const paidMedia = {
    competitorReviewInsights: [
      { sourceSection: 'positioningVoiceOfCustomer', complaint: 'mobile is painful' },
      { sourceSection: 'positioningVoiceOfCustomer' },
    ],
    creativeFramework: [{ sourceSection: 'positioningVoiceOfCustomer' }],
  };
  // No quote records at all — the section produced nothing usable.
  const voc = { painLanguage: { quotes: [] }, retrievalSummary: 'Not enough public evidence was found.' };
  const check = evaluateVocLaundering(paidMedia, voc);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.evidence.includes('vocUsableQuoteRecords=0'));
  assert.ok(check.evidence.includes('vocSourcedPaidRows=3'));
  assert.ok(check.neverShipReasons.length >= 1);
});

test('VOC-LAUNDERING PASSes when VoC surfaced real captured pain extracts (citing them is honest)', () => {
  const paidMedia = {
    competitorReviewInsights: [{ sourceSection: 'positioningVoiceOfCustomer' }],
  };
  // VoC surfaced a real (directional) pain extract — paid-media may honestly cite it.
  const voc = {
    painLanguage: {
      quotes: [{ verbatim: 'Checking on my phone can be a little painful', sourceUrl: 'https://g2.com/r/1' }],
    },
  };
  const check = evaluateVocLaundering(paidMedia, voc);
  assert.equal(check.status, 'PASS');
  assert.ok(check.evidence.includes('vocUsableQuoteRecords=1'));
});

test('VOC-LAUNDERING PASSes when the plan does not source any voice from VoC', () => {
  const paidMedia = {
    competitorReviewInsights: [{ sourceSection: 'positioningCompetitorLandscape' }],
  };
  const voc = { painLanguage: { quotes: [] } };
  const check = evaluateVocLaundering(paidMedia, voc);
  assert.equal(check.status, 'PASS');
});

// --- scoring wiring: the new checks actually drag the score down ---

test('scoreFromChecks caps at 6 on a core FAIL and subtracts every never-ship penalty', () => {
  const checks = [
    evaluateBudgetPartition({
      campaignOverview: { monthlyBudgetValue: 25000 },
      projectedResults: [{ phaseMonthlyBudgetValue: 25000 }, { phaseMonthlyBudgetValue: 5000 }, { phaseMonthlyBudgetValue: 5000 }],
    }),
    evaluateCacUnit({
      projectedResults: [{ kpi: 'trial', impliedCacValue: 134, kpiCostValue: 3000 }],
    }),
  ];
  const score = scoreFromChecks(checks);
  assert.ok(score.cap <= 6, `expected cap<=6, got ${score.cap}`);
  assert.ok(score.score < 9, `c77-shaped defects must drop below the 9 gate, got ${score.score}`);
  assert.ok(score.capReasons.some((r) => r.includes('BUDGET-PARTITION') || r.includes('CAC-UNIT')));
});

// --- QUOTES reads the real verbatimText field (c9bc2056 blind spot) ---

test('QUOTES reads quotes stored under verbatimText (not just verbatim/quote/text)', () => {
  // The VoC artifact stores quote strings under `verbatimText`. Before the fix the
  // collector only looked at quote/verbatim/text/value, so it read ZERO quotes and
  // could not see laundered/unpermalinked quotes at all.
  const voc = {
    painLanguage: {
      quotes: [
        {
          verbatimText: 'Checking on my phone can be a little painful sometimes.',
          sourceUrl: 'https://www.capterra.com/p/146652/Airtable/reviews/1769670/',
        },
      ],
    },
  };
  const check = evaluateQuotes(voc);
  assert.ok(
    check.evidence.includes('quoteRecords=1'),
    `expected the verbatimText quote to be read, got: ${check.evidence}`,
  );
});

// --- CAC-UNIT: one-number-double-duty conflation (c9bc2056 shape) ---

test('CAC-UNIT FAILs a funnel KPI that uses an implausibly high paid-CAC as cost-per-signup with no bridge', () => {
  // c9bc2056: kpi="Free trial signups", kpiCostValue=$3,000, no impliedCac, no
  // trial->paid bridge. The old multiple-rule never fired (no separate impliedCac)
  // so this self-falsifying funnel math passed unexamined.
  const check = evaluateCacUnit({
    projectedResults: [{ kpi: 'Free trial signups', kpiCostValue: 3000 }],
  });
  assert.equal(check.status, 'FAIL');
  assert.ok(check.neverShipReasons.length >= 1, 'expected a never-ship penalty');
});

test('CAC-UNIT PASSes a funnel KPI carrying an honest trial->paid customer-CAC band', () => {
  const check = evaluateCacUnit({
    projectedResults: [
      {
        kpi: 'Free trial signups',
        kpiCostValue: 3000,
        customerCacBandLowValue: 9000,
        customerCacBandHighValue: 30000,
      },
    ],
  });
  assert.equal(check.status, 'PASS');
});

test('CAC-UNIT PASSes a legitimate low cost-per-trial benchmark with no bridge', () => {
  // A real $50/trial benchmark is NOT a misapplied paid-customer CAC; the backstop
  // must not false-fail it.
  const check = evaluateCacUnit({
    projectedResults: [{ kpi: 'Free trial signups', kpiCostValue: 50 }],
  });
  assert.equal(check.status, 'PASS');
});

// --- HONESTY: any never-ship penalty is a HARD-FAIL, not a tolerated 9/10 ---

test('scoreFromChecks marks ANY single never-ship penalty as hardFail (no tolerated 9/10 PASS)', () => {
  // QUOTES is a non-core check, so this isolates "one never-ship penalty alone"
  // (no cap reason) — exactly the c9bc2056 case the old gate tolerated at 9/10.
  const checks = [
    evaluateQuotes({
      painLanguage: { quotes: [{ verbatimText: 'It was hard to use the mobile app.' }] },
    }),
  ];
  const score = scoreFromChecks(checks);
  assert.equal(score.neverShipReasons.length, 1);
  assert.equal(score.capReasons.length, 0, 'isolate: no cap reason, only a never-ship');
  assert.equal(score.score, 9, 'old gate would have PASSed this at 9/10');
  assert.equal(score.hardFail, true, 'a single never-ship penalty must hard-fail the liar-catcher floor');
  assert.equal(score.clean, false);
});

test('scoreFromChecks marks a defect-free scorecard as clean (not hardFail)', () => {
  const checks = [
    evaluateCacUnit({ projectedResults: [{ kpi: 'Free trial signups', kpiCostValue: 50 }] }),
  ];
  const score = scoreFromChecks(checks);
  assert.equal(score.neverShipReasons.length, 0);
  assert.equal(score.hardFail, false);
  assert.equal(score.clean, true);
});

// --- VOC-EMPTY-DESPITE-EVIDENCE (decision #2 value floor) ---

test('VOC-EMPTY-DESPITE-EVIDENCE is N-A when there is no acquisitionLedger (true desert, warn-to-judge)', () => {
  const voc = { painLanguage: { quotes: [] }, retrievalSummary: 'Not enough public evidence was found.' };
  const check = evaluateVocEmptyDespiteEvidence(voc);
  assert.equal(check.status, 'N-A');
  assert.equal(check.neverShipReasons.length, 0);
});

test('VOC-EMPTY-DESPITE-EVIDENCE is N-A when the ledger scraped/parsed NOTHING (honest evidence desert)', () => {
  const voc = {
    painLanguage: { quotes: [] },
    evidenceGapReport: {
      acquisitionLedger: [
        { scrapeStatus: 'failed', parserStatus: 'not_attempted', promotionStatus: 'not_applicable', rejectionReason: 'blocked_js_challenge' },
        { scrapeStatus: 'succeeded', parserStatus: 'failed', promotionStatus: 'not_applicable', rejectionReason: 'parser_no_match' },
      ],
    },
  };
  const check = evaluateVocEmptyDespiteEvidence(voc);
  assert.equal(check.status, 'N-A');
  assert.ok(check.evidence.includes('acquired=0'));
  assert.equal(check.neverShipReasons.length, 0);
});

test('VOC-EMPTY-DESPITE-EVIDENCE FAILs when scrape+parser SUCCEEDED but the section ships zero quotes', () => {
  const voc = {
    painLanguage: { quotes: [] },
    successLanguage: { quotes: [] },
    evidenceGapReport: {
      acquisitionLedger: [
        { scrapeStatus: 'succeeded', parserStatus: 'succeeded', promotionStatus: 'rejected', rejectionReason: 'not_selected' },
        { scrapeStatus: 'succeeded', parserStatus: 'succeeded', promotionStatus: 'rejected', rejectionReason: 'not_selected' },
      ],
    },
  };
  const check = evaluateVocEmptyDespiteEvidence(voc);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.evidence.includes('acquired=2'));
  assert.ok(check.neverShipReasons.some((r) => r.includes('shipped empty despite')));
});

test('VOC-EMPTY-DESPITE-EVIDENCE FAILs when promotable evidence is rejected for count/selection reasons (laundering)', () => {
  // Some quotes shipped, so it does NOT ship empty — but promotable candidates were
  // dropped for insufficient_independent_domains (a count/selection reason).
  const voc = {
    painLanguage: { quotes: [{ verbatimText: 'Onboarding took weeks longer than promised.', sourceUrl: 'https://g2.com/r/1' }] },
    evidenceGapReport: {
      acquisitionLedger: [
        { scrapeStatus: 'succeeded', parserStatus: 'succeeded', promotionStatus: 'promoted' },
        { scrapeStatus: 'succeeded', parserStatus: 'succeeded', promotionStatus: 'rejected', rejectionReason: 'insufficient_independent_domains' },
      ],
    },
  };
  const check = evaluateVocEmptyDespiteEvidence(voc);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.neverShipReasons.some((r) => r.includes('count/selection')));
});

test('VOC-EMPTY-DESPITE-EVIDENCE PASSes when acquisition succeeded and real quotes shipped without count laundering', () => {
  const voc = {
    painLanguage: { quotes: [{ verbatimText: 'Support never resolved the billing bug.', sourceUrl: 'https://trustpilot.com/r/9' }] },
    evidenceGapReport: {
      acquisitionLedger: [
        { scrapeStatus: 'succeeded', parserStatus: 'succeeded', promotionStatus: 'promoted' },
        { scrapeStatus: 'succeeded', parserStatus: 'succeeded', promotionStatus: 'rejected', rejectionReason: 'not_product_review' },
      ],
    },
  };
  const check = evaluateVocEmptyDespiteEvidence(voc);
  assert.equal(check.status, 'PASS');
  assert.equal(check.neverShipReasons.length, 0);
});

// --- SECTION-EMPTINESS (value floor) ---

test('SECTION-EMPTINESS FAILs a complete client section that ships hollow with no honest gap', () => {
  const sections = [
    { zone: 'positioningMarketCategory', status: 'complete', counts_toward_rollup: true, data: { body: { review: { tier: 'verified' } } } },
  ];
  const check = evaluateSectionEmptiness(sections);
  assert.equal(check.status, 'FAIL');
  assert.ok(check.evidence.includes('hollowWithoutHonestGap=1'));
  assert.ok(check.neverShipReasons.some((r) => r.includes('positioningMarketCategory')));
});

test('SECTION-EMPTINESS PASSes a hollow section that states an honest evidence gap (true desert)', () => {
  const sections = [
    {
      zone: 'positioningVoiceOfCustomer',
      status: 'complete',
      counts_toward_rollup: true,
      data: { body: { evidenceGap: true, evidenceGapReport: { reason: 'insufficient_voice_of_customer_sources', sourcingPlan: ['Retry review acquisition.'] } } },
    },
  ];
  const check = evaluateSectionEmptiness(sections);
  assert.equal(check.status, 'PASS');
  assert.equal(check.neverShipReasons.length, 0);
});

test('SECTION-EMPTINESS PASSes a section that carries real client content', () => {
  const sections = [
    {
      zone: 'positioningBuyerICP',
      status: 'complete',
      counts_toward_rollup: true,
      data: { body: { personaReality: { personas: [{ name: 'economic buyer', summary: 'Owns the budget and signs the contract.' }] } } },
    },
  ];
  const check = evaluateSectionEmptiness(sections);
  assert.equal(check.status, 'PASS');
});

test('SECTION-EMPTINESS does NOT fail a hollow section that is excluded from the rollup', () => {
  const sections = [
    { zone: 'positioningPaidMediaPlan', status: 'complete', counts_toward_rollup: false, data: { body: {} } },
  ];
  const check = evaluateSectionEmptiness(sections);
  assert.equal(check.status, 'PASS');
  assert.equal(check.neverShipReasons.length, 0);
});
