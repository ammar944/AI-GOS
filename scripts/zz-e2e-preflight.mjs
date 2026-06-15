#!/usr/bin/env node
// zz-e2e-preflight.mjs — one command that answers "is the E2E harness ready?"
// before you spend a cent. Checks dev server, CDP Chrome, required env presence,
// and that a structurally-clean run exists to test against. Honest about what it
// can and cannot prove (key VALIDITY is proven by a real judge/section run).
//
// Usage: node scripts/zz-e2e-preflight.mjs [--require-cdp] [--require-model]
// Exit 0 = ready (all HARD checks pass). Exit 2 = not ready.
import { BASE_URL, CDP_URL, envPresence, getCleanRunId, serviceRoleClient } from './_e2e-env.mjs';

const argv = process.argv.slice(2);
const REQUIRE_CDP = argv.includes('--require-cdp');
const REQUIRE_MODEL = argv.includes('--require-model');

const rows = [];
function record(label, status, detail, hard) {
  rows.push({ label, status, detail, hard });
}

async function reachable(url, init = {}) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(4000) });
    return { ok: true, code: res.status };
  } catch (err) {
    return { ok: false, code: err?.name === 'TimeoutError' ? 'timeout' : 'refused' };
  }
}

async function main() {
  // 1. Dev server (HARD) — any HTTP response means it's up.
  const dev = await reachable(BASE_URL);
  record('dev server', dev.ok ? 'OK' : 'DOWN', `${BASE_URL} → ${dev.code}`, true);

  // 2. CDP Chrome (HARD only with --require-cdp; otherwise a WARN — Tier1/2/judge don't need it).
  const cdp = await reachable(`${CDP_URL}/json/version`);
  record('cdp chrome', cdp.ok ? 'OK' : 'DOWN', `${CDP_URL}/json/version → ${cdp.code}${cdp.ok ? '' : ' (run zz-e2e-bootstrap)'}`, REQUIRE_CDP);

  // 3. Required env presence (HARD) — presence only, never the value.
  const required = envPresence(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'CLERK_SECRET_KEY']);
  for (const e of required) {
    record(`env ${e.name}`, e.present ? 'OK' : 'MISSING', e.present ? 'present (value not validated)' : 'absent from .env.local', true);
  }

  // 4. Model keys (HARD only with --require-model). Presence ≠ valid — validity is
  //    proven by zz-judge-run.mjs / a live section run, NOT here.
  const model = envPresence(['ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY']);
  const anyModel = model.some((m) => m.present);
  record('model key', anyModel ? 'OK' : 'MISSING', `${model.filter((m) => m.present).map((m) => m.name).join(', ') || 'none present'} (presence only — validity proven by a real judge/section run)`, REQUIRE_MODEL);

  // 5. A structurally-clean run to test against (SOFT) — useful, not blocking.
  let cleanRun = null;
  try {
    cleanRun = await getCleanRunId(serviceRoleClient());
  } catch (err) {
    cleanRun = null;
    record('clean run', 'WARN', `lookup failed: ${err.message}`, false);
  }
  if (cleanRun !== null) {
    record('clean run', 'OK', `${cleanRun.slice(0, 8)} (structurally 6/6, 0 errors — content not judged)`, false);
  } else if (!rows.some((r) => r.label === 'clean run')) {
    record('clean run', 'WARN', 'no structurally-clean complete run found', false);
  }

  // ---- Report ----
  const line = '─'.repeat(60);
  console.log(line);
  console.log('  E2E PREFLIGHT');
  console.log(line);
  for (const r of rows) {
    const mark = r.status === 'OK' ? '✓' : r.status === 'WARN' ? '•' : '✗';
    console.log(`  ${mark} ${r.label.padEnd(28)} ${r.status.padEnd(7)} ${r.detail}`);
  }
  console.log(line);

  const hardFails = rows.filter((r) => r.hard && r.status !== 'OK');
  if (hardFails.length) {
    console.log(`  NOT READY — ${hardFails.length} hard check(s) failing: ${hardFails.map((r) => r.label).join(', ')}`);
    console.log(line);
    process.exit(2);
  }
  console.log('  READY — hard checks pass. (WARN/• items are advisory.)');
  console.log(line);
  process.exit(0);
}

main().catch((e) => {
  console.error('[preflight] FATAL', e);
  process.exit(2);
});
