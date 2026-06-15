import { chromium } from 'playwright-core';
const CDP = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const RUN = process.env.E2E_RUN_ID ?? 'f3993043-b6ce-4b27-a547-7ef02929f3fa';
const zone = process.argv[2];
if (!zone) throw new Error('usage: zz-e2e-rerun-zone.mjs <zone>');
const browser = await chromium.connectOverCDP(CDP);
const page = browser.contexts()[0]?.pages().find((p) => p.url().includes('/research-v3'));
if (!page) throw new Error('research-v3 tab not found');
const result = await page.evaluate(async ({ runId, zone }) => {
  const response = await fetch('/api/research-v2/rerun-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId, zone, executionMode: 'lab' }),
  });
  return { status: response.status, body: (await response.text()).slice(0, 300) };
}, { runId: RUN, zone });
console.log(JSON.stringify(result, null, 2));
await browser.close().catch(() => {});
