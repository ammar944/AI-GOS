#!/usr/bin/env node
// zz-e2e-introspect-wizard.mjs — dump every onboarding field on the CURRENT
// visible wizard step: key, control type, required marker, current value, options.
import { chromium } from 'playwright-core';
const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/research-v3'));
  if (!page) throw new Error('No /research-v3 page found over CDP');

  const stepText = await page.locator('text=/Step \\d+ of 8/').first().textContent().catch(() => null);
  console.log('STEP:', stepText);
  const still = await page.locator('text=/still need input/').allTextContents().catch(() => []);
  console.log('STILL:', JSON.stringify(still));

  const report = await page.evaluate(() => {
    const out = [];
    const wrappers = Array.from(document.querySelectorAll('[data-testid^="onboarding-field-"]'));
    for (const w of wrappers) {
      const rect = w.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && w.offsetParent !== null;
      if (!visible) continue;
      const key = w.getAttribute('data-testid').replace('onboarding-field-', '');
      const radios = w.querySelectorAll('[role="radio"]');
      const checks = w.querySelectorAll('[role="checkbox"]');
      const combobox = w.querySelector('[role="combobox"], select');
      const textInput = w.querySelector('input[type="text"], textarea, input:not([type])');
      const labelEl = w.querySelector('label');
      const requiredMark = /\*|required/i.test(w.textContent.slice(0, 200));
      let type = 'unknown', value = null, options = null, checked = null;
      if (radios.length) {
        type = 'radio';
        options = Array.from(radios).map((r) => (r.textContent || r.getAttribute('aria-label') || '').trim());
        checked = Array.from(radios).some((r) => r.getAttribute('aria-checked') === 'true');
      } else if (checks.length) {
        type = 'checkbox';
        options = Array.from(checks).map((c) => (c.textContent || c.getAttribute('aria-label') || '').trim());
        checked = Array.from(checks).some((c) => c.getAttribute('aria-checked') === 'true');
      } else if (combobox) {
        type = combobox.tagName === 'SELECT' ? 'select' : 'combobox';
        if (combobox.tagName === 'SELECT') options = Array.from(combobox.options).map((o) => o.value);
        value = combobox.textContent?.trim() || combobox.value || null;
      } else if (textInput) {
        type = textInput.tagName === 'TEXTAREA' ? 'textarea' : 'text';
        value = textInput.value || '';
      }
      const labelText = (labelEl?.textContent || '').trim().slice(0, 60);
      out.push({ key, type, required: requiredMark, value: typeof value === 'string' ? value.slice(0, 30) : value, checked, options, label: labelText });
    }
    return out;
  });

  console.log('FIELDS:');
  for (const f of report) {
    console.log(`  ${f.key.padEnd(26)} ${String(f.type).padEnd(9)} req=${f.required?1:0} checked=${f.checked} value=${JSON.stringify(f.value)} opts=${f.options ? JSON.stringify(f.options) : '-'}`);
  }
  await browser.close();
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
