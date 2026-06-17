// Unit tests for the SaaSLaunch paid-media COVERAGE eval graders. These cover the
// pure functions only — no Supabase, no network. Fixtures mirror the persisted
// paidMediaPlanBody shape and exercise each fabrication/coverage catch.
//
// Run: node --test scripts/zz-saaslaunch-coverage-eval.checks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scanResidue,
  isBareLabel,
  valueIsGap,
  rowIsGap,
  classifySourceSection,
  groundingIsHollow,
  evidencePackIsGrounded,
  resolveLocator,
  sectionIsInsufficient,
  acquisitionSufficiencyTier,
  vocUsableQuoteCount,
  buyerIcpGroundedCount,
  gradeSlot,
  gradeCoverage,
  summarize,
  SLOT_SPECS,
} from './zz-saaslaunch-coverage-eval.mjs';

const specFor = (key) => SLOT_SPECS.find((spec) => spec.key === key);

function goodCampaignOverview() {
  return {
    prose: 'Concentrate the $25k/mo budget on Meta high-intent ABM first because demand is account-driven, then scale winning angles in phase 2.',
    platform: 'Meta',
    monthlyBudget: '$25,000/mo',
    monthlyBudgetValue: 25000,
    monthlyBudgetProvenance: 'user-supplied',
    dailySpend: '$833/day',
    dailySpendValue: 833,
    dailySpendProvenance: 'derived',
    totalMonths: 4,
    phaseCount: 2,
    primaryKpi: 'Marketing Qualified Leads',
  };
}

function goodAudienceRow() {
  return {
    slot: '01',
    archetype: 'High-Intent ABM',
    dailyBudget: '$80/day',
    dailyBudgetValue: 80,
    dailyBudgetProvenance: 'derived',
    detail: 'ABM list of RevOps and finance leaders at 50-200 employee SaaS firms, paired with a 1% lookalike.',
    sourceSection: 'positioningBuyerICP',
    grounding: 'BuyerICP persona 2 names RevOps leaders at mid-market SaaS as the primary economic buyer.',
    evidencePack: {
      status: 'grounded',
      refs: [
        {
          sourceSection: 'positioningBuyerICP',
          evidenceKind: 'persona',
          locator: 'body.personaReality.personas[1]',
          excerpt: 'Dana Ruiz, VP RevOps — named economic buyer at mid-market SaaS.',
        },
      ],
    },
  };
}

// --- scanResidue ---

test('scanResidue catches the SaaSLaunch template placeholder tokens', () => {
  assert.ok(scanResidue('$[Budget]').length > 0);
  assert.ok(scanResidue('$[X] / Month').length > 0);
  assert.ok(scanResidue('[X]').length > 0);
  assert.ok(scanResidue('[Angle 1 — short name]').length > 0);
  assert.ok(scanResidue('[link to document]').length > 0);
  assert.ok(scanResidue('[Primary KPI]').length > 0);
  assert.ok(scanResidue('[Definition, e.g. Marketing Qualified Leads]').length > 0);
  assert.ok(scanResidue('"[Direct quote or paraphrased pattern from competitor reviews.]"').length > 0);
  assert.ok(scanResidue('[Layered interest targeting based on client ICP — list industries here]').length > 0);
});

test('scanResidue does NOT flag legitimate content', () => {
  assert.equal(scanResidue('Months 1-2 · Heavy Testing').length, 0);
  assert.equal(scanResidue('$25,000/mo across three audiences').length, 0);
  assert.equal(scanResidue('Marketing Qualified Leads').length, 0);
  assert.equal(scanResidue('ABM list of RevOps leaders at mid-market SaaS firms').length, 0);
});

// --- isBareLabel ---

test('isBareLabel flags framework names used as content', () => {
  assert.equal(isBareLabel('Problem-Solution-Transformation'), true);
  assert.equal(isBareLabel('PST 1'), true);
  assert.equal(isBareLabel('Objection 2'), true);
  assert.equal(isBareLabel('USP'), true);
  assert.equal(isBareLabel('Before / After'), true);
});

test('isBareLabel passes a real hook', () => {
  assert.equal(isBareLabel('Stop losing 3 hours a week to manual reconciliation'), false);
});

// --- valueIsGap / rowIsGap ---

test('valueIsGap recognises honest gap phrasing', () => {
  assert.equal(valueIsGap('Gap: client did not supply sales assets'), true);
  assert.equal(valueIsGap('Client has not supplied a sales process doc — what to upload: SOP'), true);
  assert.equal(valueIsGap('unknown'), true);
  assert.equal(valueIsGap('Speed-to-lead under 5 minutes via round-robin routing'), false);
});

test('rowIsGap detects a sales-asset gap object (empty url + not-supplied note)', () => {
  const gap = { label: 'Sales Process', assetType: 'doc', url: '', note: 'Client did not supply assets — upload your SOP and SDR opt-in flow.' };
  assert.equal(rowIsGap(gap, specFor('salesProcess').gapFields), true);
});

// --- classifySourceSection / groundingIsHollow ---

test('classifySourceSection separates research / operator / ungrounded', () => {
  assert.equal(classifySourceSection('positioningBuyerICP'), 'research');
  assert.equal(classifySourceSection('gtmBrief'), 'operator');
  assert.equal(classifySourceSection('unattributed'), 'ungrounded');
  assert.equal(classifySourceSection(''), 'ungrounded');
  assert.equal(classifySourceSection('madeUpSection'), 'ungrounded');
});

test('groundingIsHollow flags empty, residue, restated-source, and bare grounding', () => {
  assert.equal(groundingIsHollow('', 'positioningBuyerICP'), true);
  assert.equal(groundingIsHollow('BuyerICP', 'positioningBuyerICP'), true); // too short
  assert.equal(groundingIsHollow('[fill in specifics]', 'positioningBuyerICP'), true);
  assert.equal(groundingIsHollow('positioningBuyerICP', 'positioningBuyerICP'), true);
  assert.equal(groundingIsHollow('BuyerICP persona 2 names RevOps leaders as the economic buyer.', 'positioningBuyerICP'), false);
});

// --- evidencePackIsGrounded ---

test('evidencePackIsGrounded accepts a grounded pack with a fully-populated ref', () => {
  const row = {
    evidencePack: {
      status: 'grounded',
      refs: [{ sourceSection: 'positioningBuyerICP', evidenceKind: 'persona', locator: 'body.personas[0]', excerpt: 'Dana Ruiz, VP RevOps.' }],
    },
  };
  assert.equal(evidencePackIsGrounded(row), true);
});

test('evidencePackIsGrounded rejects a gap pack, a missing pack, and a malformed ref', () => {
  // status gap with empty refs
  assert.equal(evidencePackIsGrounded({ evidencePack: { status: 'gap', refs: [] } }), false);
  // no evidencePack at all
  assert.equal(evidencePackIsGrounded({ sourceSection: 'positioningBuyerICP' }), false);
  // grounded status but refs empty
  assert.equal(evidencePackIsGrounded({ evidencePack: { status: 'grounded', refs: [] } }), false);
  // grounded with a ref missing the excerpt
  assert.equal(
    evidencePackIsGrounded({ evidencePack: { status: 'grounded', refs: [{ sourceSection: 'positioningBuyerICP', evidenceKind: 'persona', locator: 'body.personas[0]', excerpt: '' }] } }),
    false,
  );
  // grounded with a ref missing the locator
  assert.equal(
    evidencePackIsGrounded({ evidencePack: { status: 'grounded', refs: [{ sourceSection: 'positioningBuyerICP', evidenceKind: 'persona', locator: '', excerpt: 'Dana Ruiz.' }] } }),
    false,
  );
});

// --- Campaign Overview (templated): residue is a hard failure ---

test('Campaign Overview FAILs on template residue in budget/KPI', () => {
  const overview = { ...goodCampaignOverview(), monthlyBudget: '$[Budget]', primaryKpi: '[Primary KPI]' };
  const result = gradeSlot(specFor('campaignOverview'), { campaignOverview: overview });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.length >= 2);
  assert.equal(result.tag, 'templated');
});

test('Campaign Overview PASSes when fully filled with honest numbers', () => {
  const result = gradeSlot(specFor('campaignOverview'), { campaignOverview: goodCampaignOverview() });
  assert.equal(result.status, 'pass');
  assert.equal(result.hardFailures.length, 0);
  assert.ok(result.evidencePaths.length >= 4);
});

test('Campaign Overview FAILs (absent) when the slot is missing entirely', () => {
  const result = gradeSlot(specFor('campaignOverview'), {});
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('absent')));
});

// --- Audience Types (synthesized): grounding + hollow ---

test('Audience Types PASSes a grounded, substantive row', () => {
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [goodAudienceRow()] });
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.sourceSections, ['positioningBuyerICP']);
});

test('Audience Types FAILs an ungrounded synthesized row (sourceSection=unattributed)', () => {
  const row = { ...goodAudienceRow(), sourceSection: 'unattributed' };
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [row] });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('ungrounded')));
});

test('Audience Types FAILs a row with hollow grounding', () => {
  const row = { ...goodAudienceRow(), grounding: 'BuyerICP' };
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [row] });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('hollow')));
});

test('Audience Types WARNs (not fails) on an honest gap row — gap not counted as coverage', () => {
  const gapRow = { slot: '01', archetype: 'TBD', dailyBudget: 'unknown', detail: 'Gap: BuyerICP produced no grounded persona to target yet.', sourceSection: 'positioningBuyerICP', grounding: 'Gap: awaiting persona discovery.' };
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [gapRow] });
  assert.equal(result.status, 'warn');
  assert.equal(result.hardFailures.length, 0);
  assert.ok(result.missing.some((m) => m.includes('honest gap')));
});

// --- Row-level evidence pointer (evidencePack) on research-grounded rows ---

test('Audience Types FAILs a research-grounded substantive row that carries no evidencePack', () => {
  const { evidencePack, ...rowWithoutPack } = goodAudienceRow();
  void evidencePack;
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [rowWithoutPack] });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('no row-level evidence pointer')));
});

test("Audience Types FAILs a research-grounded row whose evidencePack.status is 'gap' (refs empty)", () => {
  const row = { ...goodAudienceRow(), evidencePack: { status: 'gap', refs: [], note: 'No grounded locator found upstream.' } };
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [row] });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('no row-level evidence pointer')));
});

test('Audience Types PASSes a research-grounded row WITH a valid evidencePack', () => {
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [goodAudienceRow()] });
  assert.equal(result.status, 'pass');
  assert.equal(result.hardFailures.length, 0);
  assert.ok(result.evidencePaths.some((p) => p.endsWith('.evidencePack')));
});

test('an honest gap row still WARNs even without an evidencePack (gap rows are exempt)', () => {
  const gapRow = { slot: '01', archetype: 'TBD', dailyBudget: 'unknown', detail: 'Gap: BuyerICP produced no grounded persona to target yet.', sourceSection: 'positioningBuyerICP', grounding: 'Gap: awaiting persona discovery.' };
  const result = gradeSlot(specFor('audienceTypes'), { audienceTypes: [gapRow] });
  assert.equal(result.status, 'warn');
  assert.equal(result.hardFailures.length, 0);
});

// --- resolveLocator (the dotted + indexed path grammar from paid-media-evidence-pack.ts) ---

test('resolveLocator walks the builder dotted + indexed locator grammar', () => {
  const body = {
    personaReality: { personas: [{ name: 'Dana Ruiz' }, { name: 'Sam Lee' }] },
    buyingContext: { triggers: [{ name: 'New CFO hire' }] },
    competitorSet: { competitors: [{ name: 'Acme' }, { name: 'Globex' }] },
  };
  // strips the leading `body.` and walks dotted keys + bracket indices
  assert.equal(resolveLocator(body, 'body.personaReality.personas[1]')?.name, 'Sam Lee');
  assert.equal(resolveLocator(body, 'body.buyingContext.triggers[0]')?.name, 'New CFO hire');
  assert.equal(resolveLocator(body, 'body.competitorSet.competitors[0]')?.name, 'Acme');
  // out-of-range index, unknown key, and indexing a non-array do NOT resolve
  assert.equal(resolveLocator(body, 'body.personaReality.personas[99]'), undefined);
  assert.equal(resolveLocator(body, 'body.personaReality.personas[2]'), undefined);
  assert.equal(resolveLocator(body, 'body.noSuchKey.personas[0]'), undefined);
  assert.equal(resolveLocator(body, 'body.personaReality.personas'), undefined); // node is an array, not a row
  assert.equal(resolveLocator(undefined, 'body.personaReality.personas[0]'), undefined);
});

// --- Row-level evidence RESOLUTION: a grounded pack whose locator does not resolve
// to a real node in the (PRESENT) cited upstream body is a fabrication hard-failure.
// Distinct from missing-upstream laundering: here the section body IS in the run. ---

function buyerIcpUpstreamBody() {
  // A genuinely-grounded BuyerICP body so the section is NOT insufficient — the only
  // thing under test is whether the evidencePack locator resolves into it.
  return {
    personaReality: { personas: [{ name: 'Dana Ruiz', role: 'VP RevOps' }, { name: 'Sam Lee', role: 'Head of Finance' }] },
  };
}

test('Audience Types FAILs a grounded row whose evidencePack locator does NOT resolve to a real upstream node (present section)', () => {
  const row = {
    ...goodAudienceRow(),
    evidencePack: {
      status: 'grounded',
      refs: [
        {
          sourceSection: 'positioningBuyerICP',
          evidenceKind: 'persona',
          // personas[99] does not exist in the present BuyerICP body below.
          locator: 'body.personaReality.personas[99]',
          excerpt: 'Dana Ruiz, VP RevOps — named economic buyer at mid-market SaaS.',
        },
      ],
    },
  };
  const sections = [
    { zone: 'positioningPaidMediaPlan', data: { body: { audienceTypes: [row] } } },
    { zone: 'positioningBuyerICP', verification_tier: 'needs_review', data: { body: buyerIcpUpstreamBody() } },
  ];
  const { slots } = gradeCoverage(sections);
  const audience = slots.find((s) => s.slot === 'Audience Types');
  assert.equal(audience.status, 'fail');
  assert.ok(
    audience.hardFailures.some((f) => f.includes('does not resolve')),
    `expected a "does not resolve" fabrication failure, got: ${JSON.stringify(audience.hardFailures)}`,
  );
});

test('Audience Types PASSes a grounded row whose evidencePack locator DOES resolve to a real upstream node', () => {
  const row = {
    ...goodAudienceRow(),
    evidencePack: {
      status: 'grounded',
      refs: [
        {
          sourceSection: 'positioningBuyerICP',
          evidenceKind: 'persona',
          // personas[1] = Sam Lee, a real node in the present BuyerICP body below.
          locator: 'body.personaReality.personas[1]',
          excerpt: 'Sam Lee, Head of Finance — named economic buyer at mid-market SaaS.',
        },
      ],
    },
  };
  const sections = [
    { zone: 'positioningPaidMediaPlan', data: { body: { audienceTypes: [row] } } },
    { zone: 'positioningBuyerICP', verification_tier: 'needs_review', data: { body: buyerIcpUpstreamBody() } },
  ];
  const { slots } = gradeCoverage(sections);
  const audience = slots.find((s) => s.slot === 'Audience Types');
  assert.equal(audience.status, 'pass');
  assert.equal(audience.hardFailures.length, 0);
});

test('an unresolvable locator into an ABSENT upstream section is NOT relabeled as fabrication (stays missing-upstream laundering)', () => {
  const row = {
    ...goodAudienceRow(),
    evidencePack: {
      status: 'grounded',
      refs: [
        {
          sourceSection: 'positioningBuyerICP',
          evidenceKind: 'persona',
          locator: 'body.personaReality.personas[99]',
          excerpt: 'Dana Ruiz, VP RevOps.',
        },
      ],
    },
  };
  // NOTE: no positioningBuyerICP section in the run at all.
  const sections = [
    { zone: 'positioningPaidMediaPlan', data: { body: { audienceTypes: [row] } } },
  ];
  const { slots } = gradeCoverage(sections);
  const audience = slots.find((s) => s.slot === 'Audience Types');
  assert.equal(audience.status, 'fail');
  // The existing missing-upstream laundering check owns this case.
  assert.ok(audience.hardFailures.some((f) => f.includes('laundering') && f.includes('missing')));
  // It must NOT be relabeled as a fabrication / does-not-resolve failure.
  assert.ok(!audience.hardFailures.some((f) => f.includes('does not resolve')));
});

// --- Creative Framework (synthesized): bare label ---

test('Creative Framework FAILs a bare-label hook with no content', () => {
  const row = { label: 'Static Ad 1', angleType: 'Problem-Solution-Transformation', hook: 'PST 1', executesAngle: 'Angle 1', sourceSection: 'positioningVoiceOfCustomer', grounding: 'VoC pain extract about manual reconciliation drudgery.' };
  const result = gradeSlot(specFor('creativeFramework'), { creativeFramework: [row, row, row] });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('bare label')));
});

// --- Sales Process (static_asset): fabricated links ---

test('Sales Process FAILs a placeholder/fabricated link', () => {
  const row = { label: 'Sales Process Overview', assetType: 'doc', url: '[link to document]', note: 'End-to-end MQL to closed deal flow.' };
  const result = gradeSlot(specFor('salesProcess'), { salesProcess: [row] });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('fabricated') || f.includes('placeholder')));
});

test('Sales Process WARNs an unverifiable link with no supply/standard provenance', () => {
  const row = { label: 'Sales Process Overview', assetType: 'doc', url: 'https://example.com/secret-doc', note: 'End-to-end flow from MQL to closed deal.' };
  const result = gradeSlot(specFor('salesProcess'), { salesProcess: [row] });
  assert.equal(result.status, 'warn');
  assert.ok(result.missing.some((m) => m.includes('unverifiable')));
});

test('Sales Process WARNs (honest gap) when the client supplied nothing', () => {
  const row = { label: 'Sales Process', assetType: 'gap', url: '', note: 'Client did not supply sales assets — upload your SOP, SDR opt-in flow, and personalization playbook.' };
  const result = gradeSlot(specFor('salesProcess'), { salesProcess: [row] });
  assert.equal(result.status, 'warn');
  assert.equal(result.hardFailures.length, 0);
});

// --- Competitor Insights - Marketing: spend without source ---

test('Competitor Marketing FAILs an est. spend claim with model-estimated provenance', () => {
  const row = {
    competitor: 'Acme', messaging: 'All-in-one ops platform', adPlatforms: 'Meta Ads, LinkedIn — est. $40,000/mo', estSpendProvenance: 'model-estimated',
    icp: 'Mid-market RevOps', angles: 'Consolidation', positioning: 'Category leader', offer: '14-day trial',
    sourceSection: 'positioningCompetitorLandscape', grounding: 'Competitor teardown row 1 from the competitor section.',
  };
  const result = gradeSlot(specFor('competitorMarketingInsights'), { competitorMarketingInsights: [row, row] });
  assert.equal(result.status, 'fail');
  assert.ok(result.hardFailures.some((f) => f.includes('spend')));
});

test('Competitor Marketing PASSes when spend is explicitly unknown', () => {
  const row = {
    competitor: 'Acme', messaging: 'All-in-one ops platform', adPlatforms: 'Meta Ads, LinkedIn — monthly spend unknown', estSpendProvenance: 'unknown',
    icp: 'Mid-market RevOps', angles: 'Consolidation', positioning: 'Category leader', offer: '14-day trial',
    sourceSection: 'positioningCompetitorLandscape', grounding: 'Competitor teardown row 1 from the competitor section.',
    evidencePack: {
      status: 'grounded',
      refs: [
        {
          sourceSection: 'positioningCompetitorLandscape',
          evidenceKind: 'competitorTeardown',
          locator: 'body.teardowns[0]',
          excerpt: 'Acme — all-in-one ops platform; Meta + LinkedIn; spend not disclosed.',
        },
      ],
    },
  };
  const result = gradeSlot(specFor('competitorMarketingInsights'), { competitorMarketingInsights: [row, row] });
  assert.equal(result.status, 'pass');
});

// --- Competitor Insights - Reviews: EXACTLY 3 ---

test('Competitor Reviews WARNs when fewer than EXACTLY 3 substantive rows', () => {
  const row = {
    complaint: 'Setup took weeks and support ghosted us.',
    howWeLeverage: 'Lead with white-glove onboarding in ad copy.',
    sourceSection: 'positioningCompetitorLandscape',
    grounding: 'Competitor review mining surfaced onboarding pain repeatedly.',
    evidencePack: {
      status: 'grounded',
      refs: [
        {
          sourceSection: 'positioningCompetitorLandscape',
          evidenceKind: 'reviewExcerpt',
          locator: 'body.reviewMining.complaints[0]',
          excerpt: 'G2 review: "Onboarding took weeks and support went dark on us."',
        },
      ],
    },
  };
  const result = gradeSlot(specFor('competitorReviewInsights'), { competitorReviewInsights: [row] });
  assert.equal(result.status, 'warn');
  assert.ok(result.missing.some((m) => m.includes('EXACTLY 3')));
});

// --- KPIs slot: CAC unit honesty advisory on projectedResults ---

test('KPIs WARNs when a funnel-stage projectedResults row carries a CAC without a unit label', () => {
  const body = {
    kpis: [
      { metric: 'MQLs', role: 'Primary', definition: 'Marketing qualified leads that book a call.' },
      { metric: 'CPL', role: 'Efficiency', definition: 'Cost per qualified lead.' },
    ],
    projectedResults: [{ kpi: 'Qualified trial signups', impliedCacValue: 134, kpiCostValue: 3000 }],
  };
  const ctx = { projectedResults: body.projectedResults };
  const result = gradeSlot(specFor('kpis'), body, ctx);
  assert.equal(result.status, 'warn');
  assert.ok(result.missing.some((m) => m.includes('costPerTrialLabel')));
});

// --- Cross-slot upstream insufficiency (the headline check) ---

test('sectionIsInsufficient flags an insufficient verification_tier', () => {
  assert.equal(sectionIsInsufficient({ zone: 'positioningVoiceOfCustomer', verification_tier: 'insufficient', data: {} }), true);
});

test('sectionIsInsufficient flags a VoC body with zero usable quotes', () => {
  assert.equal(vocUsableQuoteCount({ painLanguage: [] }), 0);
  assert.equal(sectionIsInsufficient({ zone: 'positioningVoiceOfCustomer', data: { body: { painLanguage: [] } } }), true);
});

test('buyerIcpGroundedCount counts non-gap persona/trigger rows', () => {
  assert.equal(buyerIcpGroundedCount({ personas: [{ name: 'RevOps lead' }], triggers: [] }), 1);
  assert.equal(buyerIcpGroundedCount({ personas: [], triggers: [] }), 0);
});

test('gradeCoverage FAILs Audience Types that launder from an insufficient BuyerICP', () => {
  const sections = [
    { zone: 'positioningPaidMediaPlan', data: { body: { audienceTypes: [goodAudienceRow()] } } },
    { zone: 'positioningBuyerICP', verification_tier: 'insufficient', data: { body: {} } },
  ];
  const { slots } = gradeCoverage(sections);
  const audience = slots.find((s) => s.slot === 'Audience Types');
  assert.equal(audience.status, 'fail');
  assert.ok(audience.hardFailures.some((f) => f.includes('laundering')));
});

test('gradeCoverage REWARDS an honest gap when upstream is insufficient (warn, no laundering)', () => {
  const gapRow = { slot: '01', archetype: 'TBD', dailyBudget: 'unknown', detail: 'Gap: BuyerICP produced no grounded persona yet.', sourceSection: 'positioningBuyerICP', grounding: 'Gap: awaiting persona discovery.' };
  const sections = [
    { zone: 'positioningPaidMediaPlan', data: { body: { audienceTypes: [gapRow] } } },
    { zone: 'positioningBuyerICP', verification_tier: 'insufficient', data: { body: {} } },
  ];
  const { slots } = gradeCoverage(sections);
  const audience = slots.find((s) => s.slot === 'Audience Types');
  assert.equal(audience.status, 'warn');
  assert.equal(audience.hardFailures.length, 0);
});

// --- Cross-slot MISSING upstream (Wave 1 fix): a synthesized row that cites a
// research section ABSENT from the bundle entirely must hard-fail (laundering),
// not silently pass, and the run must report that section as missing upstream.
// Distinct from the insufficient case above: there the section is present but
// empty; here the cited section never appears in the run at all. ---

test('gradeCoverage FAILs Audience Types that cite a BuyerICP section absent from the bundle', () => {
  const sections = [
    { zone: 'positioningPaidMediaPlan', data: { body: { audienceTypes: [goodAudienceRow()] } } },
    // NOTE: no positioningBuyerICP section is present in this run at all.
  ];
  const { slots, summary } = gradeCoverage(sections);
  const audience = slots.find((s) => s.slot === 'Audience Types');
  assert.equal(audience.status, 'fail');
  assert.ok(audience.hardFailures.some((f) => f.includes('laundering') && f.includes('missing')));
  assert.ok(summary.missingUpstreams.includes('positioningBuyerICP'));
});

test('gradeCoverage reports absent research sections as missing upstream', () => {
  const sections = [
    { zone: 'positioningPaidMediaPlan', data: { body: { audienceTypes: [goodAudienceRow()] } } },
  ];
  const { summary } = gradeCoverage(sections);
  for (const zone of [
    'positioningMarketCategory', 'positioningBuyerICP', 'positioningCompetitorLandscape',
    'positioningVoiceOfCustomer', 'positioningDemandIntent', 'positioningOfferDiagnostic',
  ]) {
    assert.ok(summary.missingUpstreams.includes(zone), `${zone} should be reported missing upstream`);
  }
});

// --- Acquisition sufficiency trip-wire (Wave 2): a section's self-reported
// acquisition sufficiency tier is an ADDITIONAL insufficiency signal, never an escape
// hatch, and the heuristics now read the real nested body paths. ---

test('acquisitionSufficiencyTier reads body.evidenceGapReport.sufficiency.tier', () => {
  assert.equal(acquisitionSufficiencyTier({ evidenceGapReport: { sufficiency: { tier: 'insufficient' } } }), 'insufficient');
  assert.equal(acquisitionSufficiencyTier({ evidenceGapReport: { sufficiency: { tier: 'sufficient' } } }), 'sufficient');
  assert.equal(acquisitionSufficiencyTier({}), '');
});

test('sectionIsInsufficient trips on an explicit insufficient sufficiency tier even when personas exist', () => {
  const body = {
    personaReality: { personas: [{ name: 'Dana Ruiz', title: 'VP RevOps' }] },
    evidenceGapReport: { sufficiency: { tier: 'insufficient', rationale: 'only 1 of 3 personas acquired', candidatesFound: 5, promoted: 1, rejected: 4 } },
  };
  assert.equal(sectionIsInsufficient({ zone: 'positioningBuyerICP', data: { body } }), true);
});

test('a self-reported sufficient tier does NOT clear a real gap (no escape hatch)', () => {
  // Zero usable quotes but the section claims sufficiency 'sufficient' — the quote
  // floor still wins; sufficiency can only ADD insufficiency, never remove it.
  const body = {
    painLanguage: { quotes: [] },
    evidenceGapReport: { sufficiency: { tier: 'sufficient', rationale: 'claims fine', candidatesFound: 0, promoted: 0, rejected: 0 } },
  };
  assert.equal(sectionIsInsufficient({ zone: 'positioningVoiceOfCustomer', data: { body } }), true);
});

test('buyerIcpGroundedCount reads the real nested persona/trigger/firmographic/venue paths', () => {
  const body = {
    personaReality: { personas: [{ name: 'Dana Ruiz', title: 'VP RevOps' }] },
    buyingContext: { triggers: [{ name: 'New CFO hire' }] },
    icpExistenceCheck: { firmographicCuts: [{ cutType: 'industry', value: 'SaaS' }] },
    clusters: { venues: [{ name: 'RevOps Co-op' }] },
  };
  assert.equal(buyerIcpGroundedCount(body), 4);
});

test('vocUsableQuoteCount counts verbatimText and evidenceQuote rows', () => {
  const body = {
    painLanguage: { quotes: [{ verbatimText: 'Setup took weeks and support ghosted us.' }] },
    decisionCriteria: { criteria: [{ evidenceQuote: 'We picked the tool with the fastest onboarding.' }] },
  };
  assert.equal(vocUsableQuoteCount(body), 2);
});

test('a real-nested grounded BuyerICP body is NOT flagged insufficient (no false positive)', () => {
  const body = { personaReality: { personas: [{ name: 'Dana Ruiz' }, { name: 'Sam Lee' }] } };
  assert.equal(sectionIsInsufficient({ zone: 'positioningBuyerICP', data: { body } }), false);
});

test('summarize rolls up pass/warn/fail and computes clean', () => {
  const slots = [
    { slot: 'A', status: 'pass', hardFailures: [], missing: [] },
    { slot: 'B', status: 'warn', hardFailures: [], missing: ['x'] },
    { slot: 'C', status: 'fail', hardFailures: ['y'], missing: [] },
  ];
  const summary = summarize(slots);
  assert.equal(summary.pass, 1);
  assert.equal(summary.warn, 1);
  assert.equal(summary.fail, 1);
  assert.equal(summary.clean, false);
  assert.deepEqual(summary.failedSlots, ['C']);
});

test('all 12 template slots are specced', () => {
  assert.equal(SLOT_SPECS.length, 12);
  const expected = [
    'campaignOverview', 'campaignPhases', 'audienceTypes', 'anglesToTest', 'creativeStrategy',
    'creativeFramework', 'funnelIdeation', 'salesProcess', 'competitorMarketingInsights',
    'competitorReviewInsights', 'channelSuggestions', 'kpis',
  ];
  assert.deepEqual(SLOT_SPECS.map((s) => s.key), expected);
});
