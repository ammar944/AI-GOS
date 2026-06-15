#!/usr/bin/env node
// zz-e2e-fill-wizard-neutral.mjs — subject-AGNOSTIC wizard filler.
// Relies on corpus auto-prefill for real subject facts; fills ONLY remaining
// empty fields with neutral, non-fabricated placeholders so we never inject one
// company's facts into another's run. Same robust step loop as v2.
import { chromium } from 'playwright-core';
const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';

// Neutral gap values — deliberately generic; corpus prefill supplies real facts.
const TEXT_VALUES = {
  builtFor: 'Teams in this product category who need its core capability.',
  idealCustomer: 'Small-to-mid B2B teams evaluating tools in this category.',
  industry: 'B2B software',
  jobTitles: 'The product’s primary decision-makers and end users.',
  companySize: '10-500 employees',
  geographicFocus: 'Primarily US / English-speaking markets',
  triggers: 'A recurring pain the product solves becomes urgent enough to evaluate tools.',
  currentAlternative: 'Manual processes, spreadsheets, or an incumbent tool.',
  coreFeatures: 'Per the product description on the company website.',
  firstValueMoment: 'The user completes the product’s core workflow for the first time.',
  activationEvent: 'The user finishes key setup and returns to use it again.',
  retentionDrivers: 'The product becomes embedded in the team’s weekly routine.',
  pricingTiers: 'Per the company pricing page.',
  targetPlan: 'Core paid plan',
  avgLtv: '$3,000',
  targetCac: '$600',
  monthlyAdBudget: '$10,000/month',
  topCompetitors: 'The leading alternatives in this product category.',
  whyCustomersChooseYou: 'A differentiated take on the category’s core job-to-be-done.',
  lossReasons: 'Price sensitivity and preference for an incumbent.',
  competitorAdvantages: 'Incumbents win on brand familiarity and breadth.',
  primaryGoal90Days: 'Grow qualified trials/demand from paid acquisition.',
  monthlyPipelineTarget: '$50K pipeline / ~30 qualified leads per month',
  commonObjections: 'Pricing, switching cost, and proof it handles real use cases.',
  keyPromises: 'Solve the category’s core pain faster and more simply.',
  brandPositioning: 'A focused, modern tool for its category.',
  budgetSplit: '60% Google, 25% Meta, 15% LinkedIn',
  whatsWorking: 'Branded/high-intent search converts.',
  whatsNotWorking: 'Cold prospecting CPL is high.',
  currentCac: '$800',
  monthlyRevenue: 'Not publicly disclosed',
  avgSalesCycle: 'Self-serve same week; sales-assisted ~30 days',
  visitorToSignup: '3%',
  signupToActivation: '35%',
  activationToPaid: '5%',
  demoToClose: '20%',
  growthTrend: 'Growing steadily',
};
const GENERIC_TEXT = 'Per the company website and pricing page.';
const SKIP_KEYS = new Set(['salesLoomUrl']);
const RADIO_VALUES = {
  salesMotion: /Self|Hybrid/, pricingModel: /seat|tier|Subscription/, conversionPath: /trial|Freemium|Free/,
  acv: /\$1K.*\$10K|Under/, awarenessLevel: 'Solution-aware', creativeCapacity: /Lean|Standard/, leadListAvailable: 'No',
};
const CHECKBOX_VALUES = { channels: ['Meta', 'Google', 'LinkedIn', 'Organic'] };

function log(m) { console.log(`[neutral ${new Date().toISOString()}] ${m}`); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function currentStep(page) {
  const t = await page.locator('text=/Step \\d+ of 8/').first().textContent().catch(() => null);
  const m = t?.match(/Step (\d+) of 8/); return m ? Number(m[1]) : null;
}
async function fillStep(page) {
  const wrappers = page.locator('[data-testid^="onboarding-field-"]');
  const count = await wrappers.count();
  for (let i = 0; i < count; i += 1) {
    const w = wrappers.nth(i);
    if (!(await w.isVisible().catch(() => false))) continue;
    const key = (await w.getAttribute('data-testid'))?.replace('onboarding-field-', '');
    if (!key) continue;
    const radios = w.getByRole('radio'); const checks = w.getByRole('checkbox');
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
      if (names) { for (const n of names) { const o = w.getByRole('checkbox', { name: n }); if ((await o.count()) > 0 && (await o.first().getAttribute('aria-checked').catch(() => null)) !== 'true') await o.first().click().catch(() => {}); } }
      else { const anyChecked = await checks.evaluateAll((els) => els.some((e) => e.getAttribute('aria-checked') === 'true')).catch(() => false); if (!anyChecked) await checks.first().click().catch(() => {}); }
      log(`checkbox ${key}`); continue;
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
      await fillStep(page);
      await page.getByRole('button', { name: 'Continue' }).click().catch(() => {});
      await sleep(900);
      if ((await currentStep(page)) === step) {
        const still = await page.locator('text=/still need input/').allTextContents().catch(() => []);
        throw new Error(`stuck at step ${step}. still=${JSON.stringify(still)}`);
      }
    }
  }
  const runAudit = page.getByRole('button', { name: /Run audit/i });
  await runAudit.waitFor({ state: 'visible', timeout: 15_000 });
  await runAudit.click();
  log('clicked Run audit');
  await page.getByTestId('audit-reader-shell').waitFor({ state: 'visible', timeout: 60_000 })
    .then(() => log('audit reader visible — fan-out started')).catch(() => log('WARN reader not visible in 60s; rely on DB polling'));
  await browser.close();
}
main().catch((e) => { console.error(`[neutral] FAILED: ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
