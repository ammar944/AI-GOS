#!/usr/bin/env node
// zz-e2e-fill-wizard.mjs — take-over wizard filler for the live proof run.
// Fills empty fields by data-testid (immune to label drift), steps all 8
// sections, clicks Run audit.
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
};

const RADIO_ACTIONS = [
  { key: 'salesMotion', name: 'Hybrid' },
  { key: 'pricingModel', name: 'Per seat' },
  { key: 'conversionPath', name: 'Free trial' },
  { key: 'acv', name: /\$1K.*\$10K/ },
  { key: 'awarenessLevel', name: 'Solution-aware' },
  { key: 'creativeCapacity', name: /Standard/ },
  { key: 'leadListAvailable', name: 'No' },
];

const CHECKBOX_ACTIONS = [
  { key: 'channels', names: ['Meta', 'Google', 'LinkedIn', 'Organic'] },
];

function log(message) {
  console.log(`[fill ${new Date().toISOString()}] ${message}`);
}

async function fillVisibleTextFields(page) {
  const wrappers = page.locator('[data-testid^="onboarding-field-"]');
  const count = await wrappers.count();
  for (let i = 0; i < count; i += 1) {
    const wrapper = wrappers.nth(i);
    if (!(await wrapper.isVisible().catch(() => false))) continue;
    const testId = await wrapper.getAttribute('data-testid');
    const key = testId?.replace('onboarding-field-', '');
    if (!key || !(key in TEXT_VALUES)) continue;
    const control = wrapper.locator('input[type="text"], textarea, input:not([type])').first();
    if ((await control.count()) === 0) continue;
    const current = await control.inputValue().catch(() => null);
    if (current === null || current.trim() !== '') continue;
    await control.scrollIntoViewIfNeeded().catch(() => {});
    await control.fill(TEXT_VALUES[key]);
    log(`filled ${key}`);
  }
}

async function applyOptionActions(page) {
  for (const action of RADIO_ACTIONS) {
    const field = page.getByTestId(`onboarding-field-${action.key}`);
    if ((await field.count()) === 0 || !(await field.isVisible().catch(() => false))) continue;
    const option = field.getByRole('radio', { name: action.name });
    if ((await option.count()) === 0) continue;
    const first = option.first();
    if ((await first.getAttribute('aria-checked').catch(() => null)) === 'true') continue;
    await first.click();
    log(`radio ${action.key}`);
  }
  for (const action of CHECKBOX_ACTIONS) {
    const field = page.getByTestId(`onboarding-field-${action.key}`);
    if ((await field.count()) === 0 || !(await field.isVisible().catch(() => false))) continue;
    for (const name of action.names) {
      const option = field.getByRole('checkbox', { name });
      if ((await option.count()) === 0) continue;
      const first = option.first();
      if ((await first.getAttribute('aria-checked').catch(() => null)) === 'true') continue;
      await first.click();
      log(`checkbox ${action.key}=${name}`);
    }
  }
}

async function currentStep(page) {
  const text = await page
    .locator('text=/Step \\d+ of 8/')
    .first()
    .textContent()
    .catch(() => null);
  const match = text?.match(/Step (\d+) of 8/);
  return match ? Number(match[1]) : null;
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/research-v3'));
  if (!page) throw new Error('No /research-v3 page found over CDP');
  page.setDefaultTimeout(20_000);
  log(`page ${page.url()}`);

  for (let step = 1; step <= 8; step += 1) {
    const seen = await currentStep(page);
    log(`on step ${seen}`);
    await fillVisibleTextFields(page);
    await applyOptionActions(page);
    if (step < 8) {
      await page.getByRole('button', { name: 'Continue' }).click();
      await page.waitForTimeout(800);
      const next = await currentStep(page);
      if (next !== step + 1) {
        const still = await page
          .locator('text=/still need input/')
          .allTextContents()
          .catch(() => []);
        const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
        throw new Error(
          `did not advance from step ${step} (now ${next}). still=${JSON.stringify(still)} alerts=${JSON.stringify(alerts)}`,
        );
      }
    }
  }

  const runAudit = page.getByRole('button', { name: /Run audit/i });
  await runAudit.waitFor({ state: 'visible', timeout: 15_000 });
  await runAudit.click();
  log('clicked Run audit');
  await page
    .getByTestId('audit-reader-shell')
    .waitFor({ state: 'visible', timeout: 60_000 })
    .then(() => log('audit reader visible — fan-out started'))
    .catch(() => log('WARN reader not visible in 60s; rely on DB polling'));
  await browser.close();
}

main().catch((error) => {
  console.error(`[fill] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
