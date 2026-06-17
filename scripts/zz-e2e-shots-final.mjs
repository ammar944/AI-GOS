// zz-e2e-shots-final.mjs — desktop + mobile screenshots of a finished run's
// audit reader, for the convergence report's UI proof (Lane 7).
// Usage: E2E_RUN_ID=<run> [E2E_OUT=<dir>] node scripts/zz-e2e-shots-final.mjs
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const RUN = process.env.E2E_RUN_ID;
if (!RUN) { console.error('set E2E_RUN_ID'); process.exit(1); }
const OUT = process.env.E2E_OUT ?? `tmp/audit-${RUN.slice(0,8)}/shots`;
await mkdir(OUT, { recursive: true });
const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());

const SURFACES = [
  ['reader-top', `?runId=${RUN}`, 0],
  ['paidmedia-top', `?runId=${RUN}&section=positioningPaidMediaPlan`, 0],
  ['paidmedia-mid', `?runId=${RUN}&section=positioningPaidMediaPlan`, 2400],
  ['paidmedia-deep', `?runId=${RUN}&section=positioningPaidMediaPlan`, 5200],
  ['buyer-icp', `?runId=${RUN}&section=positioningBuyerICP`, 700],
  ['competitor', `?runId=${RUN}&section=positioningCompetitorLandscape`, 1500],
  ['voc', `?runId=${RUN}&section=positioningVoiceOfCustomer`, 700],
  ['offer', `?runId=${RUN}&section=positioningOfferDiagnostic`, 600],
  ['demand', `?runId=${RUN}&section=positioningDemandIntent`, 600],
];
const base = 'http://localhost:3000/research-v3';

async function pass(tag, w, h) {
  await page.setViewportSize({ width: w, height: h });
  for (const [name, qs, scrollY] of SURFACES) {
    await page.goto(`${base}${qs}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('audit-reader-shell').waitFor({ state: 'visible', timeout: 45_000 })
      .catch(() => console.log(`WARN ${tag}/${name}: shell not visible`));
    await page.waitForTimeout(2600);
    if (scrollY > 0) {
      await page.evaluate((y) => {
        const main = document.querySelector('main');
        (main ?? window).scrollTo?.(0, y);
        if (main) main.scrollTop = y;
      }, scrollY);
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: `${OUT}/${tag}-${name}.jpeg`, type: 'jpeg', quality: 74 });
    console.log(`shot ${tag}/${name}`);
  }
}

await pass('desktop', 1640, 940);
await pass('mobile', 390, 844);
await browser.close();
console.log(`DONE -> ${OUT}`);
