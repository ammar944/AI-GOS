#!/usr/bin/env node
// zz-e2e-clerk-signin.mjs
// Signs the CDP automation Chrome into the local dev app using a Clerk
// backend sign-in token (ticket strategy). No secrets are printed.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { chromium } from 'playwright-core';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const CLERK_API = 'https://api.clerk.com/v1';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function clerkFetch(path, init = {}) {
  const key = requireEnv('CLERK_SECRET_KEY');
  const response = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Clerk API ${path} -> ${response.status}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function main() {
  const users = await clerkFetch('/users?limit=1&order_by=-last_active_at');
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error('No Clerk users found on this instance');
  }
  const userId = users[0].id;
  console.log(`[signin] using user ${userId}`);

  const token = await clerkFetch('/sign_in_tokens', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 600 }),
  });

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error('No default browser context over CDP');
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.Clerk?.loaded === true, null, { timeout: 30_000 });

  const result = await page.evaluate(async (ticket) => {
    const clerk = globalThis.Clerk;
    const signIn = await clerk.client.signIn.create({ strategy: 'ticket', ticket });
    if (signIn.status !== 'complete') return { ok: false, status: signIn.status };
    await clerk.setActive({ session: signIn.createdSessionId });
    return { ok: true, status: signIn.status };
  }, token.token);

  if (!result.ok) throw new Error(`Clerk ticket sign-in incomplete: ${result.status}`);

  await page.goto(`${BASE_URL}/research-v3`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Company URL', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  console.log('[signin] authenticated — /research-v3 form visible');
  await browser.close();
}

main().catch((error) => {
  console.error(`[signin] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
