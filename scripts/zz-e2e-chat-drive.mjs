#!/usr/bin/env node
// zz-e2e-chat-drive.mjs — drive the Audit Reader chat-edit loop (Probe 3).
// Sends a sequence of strategist messages, waits each turn out, captures the
// chat panel text + tool badges + screenshots. DB readback done separately.
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const RUN = process.argv[2];
const OUT = join(process.cwd(), 'tmp', 'grill', 'chat');
const STEPS = [
  'Draft the strategy brief.',
  "Reframe the brief: position this as a tool for cross-functional ops teams, not a generic database; ban the phrase \"operations hub\" everywhere and add a changelog.",
  'Rerun the Voice of Customer section focusing on pricing objections.',
  'In the Competitor Landscape, tighten the headline takeaway to one sentence a CMO could repeat.',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const transcript = [];
function log(m) { const l = `[chat ${new Date().toISOString()}] ${m}`; transcript.push(l); console.log(l); }

async function panelText(page) {
  return page.evaluate(() => {
    const ta = document.querySelector('textarea[placeholder*="strategist" i]');
    const panel = ta ? ta.closest('div')?.parentElement?.parentElement : null;
    return panel ? panel.innerText.slice(0, 4000) : '(panel not found)';
  });
}
async function toolBadges(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('[data-testid]'))
    .map((e) => e.getAttribute('data-testid')).filter((id) => /tool|rerun|edit|brief|claim|narrative/i.test(id)));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find((p) => p.url().includes('/research-v3')) ?? (await ctx.newPage());
  try { await page.setViewportSize({ width: 1480, height: 1020 }); } catch (e) { log(`viewport set failed: ${e.message}`); }
  await page.goto(`http://localhost:3000/research-v3?runId=${RUN}`, { waitUntil: 'domcontentloaded' });
  const ta = page.locator('textarea[placeholder*="strategist" i]');
  await ta.waitFor({ state: 'visible', timeout: 35_000 });
  log(`chat textarea visible on run ${RUN}`);

  const results = [];
  for (let i = 0; i < STEPS.length; i += 1) {
    const msg = STEPS[i];
    log(`STEP ${i + 1}: sending: ${msg}`);
    const before = await page.evaluate(() => document.querySelectorAll('textarea[placeholder*="strategist" i]').length);
    await ta.fill(msg);
    await ta.press('Enter');
    // wait for busy (textarea disabled) then done (enabled), bounded
    const started = Date.now();
    let sawBusy = false;
    while (Date.now() - started < 120_000) {
      const disabled = await ta.isDisabled().catch(() => false);
      if (disabled) sawBusy = true;
      if (sawBusy && !disabled) break;
      await sleep(1500);
    }
    const elapsed = Date.now() - started;
    await sleep(2500); // settle
    const text = await panelText(page);
    const badges = await toolBadges(page);
    log(`STEP ${i + 1} done: sawBusy=${sawBusy} elapsedMs=${elapsed} badges=${JSON.stringify(badges)}`);
    results.push({ step: i + 1, msg, sawBusy, elapsedMs: elapsed, badges, panelTail: text.slice(-1500) });
    await page.screenshot({ path: join(OUT, `step-${i + 1}.png`), fullPage: false }).catch(() => {});
    await writeFile(join(OUT, `step-${i + 1}-panel.txt`), text, 'utf8');
  }
  await writeFile(join(OUT, 'results.json'), JSON.stringify({ run: RUN, results }, null, 2), 'utf8');
  await writeFile(join(OUT, 'transcript.log'), transcript.join('\n') + '\n', 'utf8');
  log('chat drive complete');
  await browser.close();
}
main().catch(async (e) => { log(`ABORT ${e instanceof Error ? e.message : String(e)}`); await mkdir(OUT, { recursive: true }); await writeFile(join(OUT, 'transcript.log'), transcript.join('\n') + '\n', 'utf8'); process.exitCode = 1; });
