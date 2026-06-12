import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const RUN = 'f3993043-b6ce-4b27-a547-7ef02929f3fa';
const OUT = 'tmp/ui-audit-final';
await mkdir(OUT, { recursive: true });
const browser = await chromium.connectOverCDP(CDP_URL);
const context = browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());
await page.setViewportSize({ width: 1640, height: 940 });

async function shot(name, url, scrollY = 0, settle = 2500) {
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

await shot('01-reader-top-brief', `http://localhost:3000/research-v3?runId=${RUN}`);
await shot('02-paidmedia-deck-top', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`);
await shot('03-paidmedia-deck-mid', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`, 2400);
await shot('04-paidmedia-deck-deep', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningPaidMediaPlan`, 6000);
await shot('05-demand-section', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningDemandIntent`, 800);
await shot('06-competitor-table', `http://localhost:3000/research-v3?runId=${RUN}&section=positioningCompetitorLandscape`, 2000);
await browser.close();
