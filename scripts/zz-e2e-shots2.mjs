import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const RUN = process.env.E2E_RUN_ID ?? 'f3993043-b6ce-4b27-a547-7ef02929f3fa';
const OUT = process.env.E2E_OUT ?? 'tmp/ui-audit-final2';
await mkdir(OUT, { recursive: true });
const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());
await page.setViewportSize({ width: 1640, height: 940 });

async function shot(name, url, scrollY = 0, settle = 3000) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('audit-reader-shell').waitFor({ state: 'visible', timeout: 45_000 }).catch(() => console.log(`WARN ${name}: reader shell not visible`));
  await page.waitForTimeout(settle);
  if (scrollY > 0) {
    await page.evaluate((y) => {
      const main = document.querySelector('main');
      (main ?? window).scrollTo?.(0, y);
      if (main) main.scrollTop = y;
    }, scrollY);
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: `${OUT}/${name}.jpeg`, type: 'jpeg', quality: 72 });
  console.log(`shot ${name}`);
}

// Cold-load proof: fresh navigation each shot IS a cold load.
await shot('01-cold-load-memo', `http://localhost:3000/research-v3?runId=${RUN}`);
await shot('02-memo-moves', `http://localhost:3000/research-v3?runId=${RUN}`, 900);
await shot('03-deck-top', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`);
await shot('04-deck-audiences', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`, 2400);
await shot('05-deck-creative-framework', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`, 4800);
await shot('06-deck-projections-funnels', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`, 6600);
await shot('07-deck-deep-kpis', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`, 8600);
await shot('08-voc-quotes', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningVoiceOfCustomer`, 700);
await shot('09-competitor-pricing', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningCompetitorLandscape`, 2000);
await browser.close();
