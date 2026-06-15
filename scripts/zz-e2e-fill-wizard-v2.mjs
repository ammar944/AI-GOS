#!/usr/bin/env node
// zz-e2e-fill-wizard-v2.mjs — drift-resilient wizard filler.
// Loops on the ACTUAL "Step N of 8" (not a counter), fills every visible empty
// field (text via value map + generic fallback; radios/checkboxes/selects via
// known choice + first-option fallback), advances, then clicks Run audit.
import { chromium } from 'playwright-core';

const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';

const TEXT_VALUES = {
  builtFor: 'Cross-functional teams at mid-market & enterprise: ops, marketing, product, PM.',
  idealCustomer:
    'Mid-market ops, product, and research teams (50-500 employees) building shared workflows on structured data.',
  industry: 'B2B SaaS, professional services, media, education',
  jobTitles: 'Operations managers, product managers, UX researchers, marketing ops, RevOps',
  companySize: '50-500 employees, $10M-$100M revenue',
  geographicFocus: 'US-first, global self-serve',
  triggers: 'Teams outgrow spreadsheets; new ops/research hires; tool-sprawl consolidation pushes.',
  currentAlternative: 'Google Sheets/Excel, Notion, legacy PM tools (Asana/Jira).',
  coreFeatures:
    'Relational database with spreadsheet UI, linked records, automations, interfaces, AI agents on shared data.',
  firstValueMoment: 'Turn a spreadsheet into a linked base in minutes.',
  activationEvent: 'Invite a teammate + first automation runs.',
  retentionDrivers: "Becomes the team's shared system of record.",
  pricingTiers: 'Free $0; Team $20/seat/mo; Business $45/seat/mo; Enterprise custom',
  targetPlan: 'Business plan',
  avgLtv: '$18,000',
  targetCac: '$3,000',
  monthlyAdBudget: '$25,000/month',
  topCompetitors: 'Notion, monday.com, ClickUp, Smartsheet, Coda',
  whyCustomersChooseYou:
    'Relational data model + automations + AI agents in one platform — build custom apps without code.',
  lossReasons: 'Lose on perceived complexity vs Notion; price vs Sheets.',
  competitorAdvantages: 'Competitors win on brand familiarity and bundled docs.',
  primaryGoal90Days: 'Qualified Business-plan trials from ops/PM teams.',
  monthlyPipelineTarget: '$400K pipeline / ~120 trials/mo',
  commonObjections: 'Pricing complexity, lock-in/export concerns, learning curve for advanced features.',
  keyPromises: 'One source of truth; apps in minutes; AI agents that cite sources.',
  brandPositioning: 'The AI-native platform for building custom apps on shared data.',
  budgetSplit: '60% Google, 25% Meta, 15% LinkedIn',
  whatsWorking: 'Branded search converts.',
  whatsNotWorking: 'Cold Meta CPL too high.',
  currentCac: '$4,200',
  monthlyRevenue: '$12M MRR',
  // metric fields — proper numeric defaults so media-plan math is not confounded
  avgSalesCycle: 'Self-serve same week; mid-market sales-assisted 45-60 days',
  visitorToSignup: '3%',
  signupToActivation: '35%',
  activationToPaid: '6%',
  demoToClose: '20%',
  growthTrend: 'Flat-to-slightly-up; paid contribution declining as non-brand CPCs rose',
};
const GENERIC_TEXT = 'Mid-market B2B teams adopting shared-data workflows; see company context above.';
// optional URL/free fields we must NOT junk-fill
const SKIP_KEYS = new Set(['salesLoomUrl']);

const RADIO_VALUES = {
  salesMotion: 'Hybrid',
  pricingModel: 'Per seat',
  conversionPath: 'Free trial',
  acv: /\$1K.*\$10K/,
  awarenessLevel: 'Solution-aware',
  creativeCapacity: /Standard/,
  leadListAvailable: 'No',
};
const CHECKBOX_VALUES = { channels: ['Meta', 'Google', 'LinkedIn', 'Organic'] };

function log(m) { console.log(`[fillv2 ${new Date().toISOString()}] ${m}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function currentStep(page) {
  const t = await page.locator('text=/Step \\d+ of 8/').first().textContent().catch(() => null);
  const m = t?.match(/Step (\d+) of 8/);
  return m ? Number(m[1]) : null;
}

async function fillStep(page) {
  const wrappers = page.locator('[data-testid^="onboarding-field-"]');
  const count = await wrappers.count();
  for (let i = 0; i < count; i += 1) {
    const w = wrappers.nth(i);
    if (!(await w.isVisible().catch(() => false))) continue;
    const testId = await w.getAttribute('data-testid');
    const key = testId?.replace('onboarding-field-', '');
    if (!key) continue;

    const radios = w.getByRole('radio');
    const checks = w.getByRole('checkbox');
    if ((await radios.count()) > 0) {
      const anyChecked = await radios.evaluateAll((els) => els.some((e) => e.getAttribute('aria-checked') === 'true')).catch(() => false);
      if (anyChecked) continue;
      const want = RADIO_VALUES[key];
      let opt = want ? w.getByRole('radio', { name: want }) : radios.first();
      if (want && (await opt.count()) === 0) opt = radios.first();
      if ((await opt.count()) > 0) { await opt.first().click().catch(() => {}); log(`radio ${key}`); }
      continue;
    }
    if ((await checks.count()) > 0) {
      const names = CHECKBOX_VALUES[key];
      if (names) {
        for (const n of names) {
          const o = w.getByRole('checkbox', { name: n });
          if ((await o.count()) > 0 && (await o.first().getAttribute('aria-checked').catch(() => null)) !== 'true') {
            await o.first().click().catch(() => {});
          }
        }
      } else {
        const anyChecked = await checks.evaluateAll((els) => els.some((e) => e.getAttribute('aria-checked') === 'true')).catch(() => false);
        if (!anyChecked) await checks.first().click().catch(() => {});
      }
      log(`checkbox ${key}`);
      continue;
    }
    if (SKIP_KEYS.has(key)) continue;
    const control = w.locator('input[type="text"], textarea, input:not([type])').first();
    if ((await control.count()) === 0) continue;
    const cur = await control.inputValue().catch(() => null);
    if (cur === null || cur.trim() !== '') continue;
    await control.scrollIntoViewIfNeeded().catch(() => {});
    await control.fill(TEXT_VALUES[key] ?? GENERIC_TEXT).catch(() => {});
    log(`text ${key}${TEXT_VALUES[key] ? '' : ' (generic)'}`);
  }
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/research-v3'));
  if (!page) throw new Error('No /research-v3 page found over CDP');
  page.setDefaultTimeout(20_000);
  log(`page ${page.url()}`);

  let guard = 0;
  while (guard < 16) {
    guard += 1;
    const step = await currentStep(page);
    log(`on step ${step}`);
    await fillStep(page);
    if (step === 8) break;
    await page.getByRole('button', { name: 'Continue' }).click().catch(() => {});
    await sleep(900);
    const next = await currentStep(page);
    if (next === step) {
      // retry once: fill again (covers fields that appeared after partial fill)
      await fillStep(page);
      await page.getByRole('button', { name: 'Continue' }).click().catch(() => {});
      await sleep(900);
      const next2 = await currentStep(page);
      if (next2 === step) {
        const still = await page.locator('text=/still need input/').allTextContents().catch(() => []);
        const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
        throw new Error(`stuck at step ${step}. still=${JSON.stringify(still)} alerts=${JSON.stringify(alerts)}`);
      }
    }
  }

  const runAudit = page.getByRole('button', { name: /Run audit/i });
  await runAudit.waitFor({ state: 'visible', timeout: 15_000 });
  await runAudit.click();
  log('clicked Run audit');
  await page.getByTestId('audit-reader-shell').waitFor({ state: 'visible', timeout: 60_000 })
    .then(() => log('audit reader visible — fan-out started'))
    .catch(() => log('WARN reader not visible in 60s; rely on DB polling'));
  await browser.close();
}

main().catch((e) => { console.error(`[fillv2] FAILED: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
