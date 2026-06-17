import { chromium } from 'playwright-core';
const CDP = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const RUN = process.env.E2E_RUN_ID;
const section = process.argv[2];
if (!RUN || !section) throw new Error('usage: E2E_RUN_ID=<run> node zz-e2e-dispatch-section.mjs <section_id>');
const browser = await chromium.connectOverCDP(CDP);
const page = browser.contexts()[0].pages().find(p=>p.url().includes('/research-v3')) ?? browser.contexts()[0].pages()[0];
const result = await page.evaluate(async ({ runId, section }) => {
  const r = await fetch('/api/research-v2/run-lab-section', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_id: runId, section_id: section }),
  });
  return { status: r.status, body: (await r.text()).slice(0, 400) };
}, { runId: RUN, section });
console.log(JSON.stringify(result, null, 2));
await browser.close();
