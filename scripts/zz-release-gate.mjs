#!/usr/bin/env node
// zz-release-gate.mjs — the SINGLE combined release gate for a research run.
//
// A run may ship ONLY IF BOTH halves clear the bar:
//   1. DETERMINISTIC : `node scripts/zz-buyer-eval.mjs <run_id>` exits 0
//      (budget partition, CAC units, persona containment, competitor counts,
//      VoC laundering, deny-list, cascade … all the liar-catcher floors).
//   2. JUDGE         : the local-agent verdict at tmp/judge/<slug>/verdict.json
//      has overallScore >= threshold AND mediaPlanNumericallyCoherent === true
//      AND noFabrication === true (the same predicate the judge --gate uses).
//
// Exit 0 = SHIP. Exit 2 = blocked by a gate. Exit 1 = setup error (missing
// verdict, gather not run, etc.). Read-only against Supabase (via buyer-eval).
//
// Usage:
//   node scripts/zz-release-gate.mjs <run_id> [--threshold 9]
//
// Prereq: gather + judge first so the verdict exists —
//   node scripts/zz-judge-run.mjs <run_id>          # GATHER
//   (local Codex/Claude Code agent writes tmp/judge/<slug>/verdict.json)
//   node scripts/zz-release-gate.mjs <run_id>       # combined gate
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeGatePasses, verdictSchema } from './zz-judge-run.mjs';

// True only as the process entrypoint; false when imported (e.g. by the unit test
// reusing combineReleaseGate). Keeps the pure predicate importable without spawning
// buyer-eval, reading the DB, or exiting.
const IS_CLI = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

const argv = process.argv.slice(2);

function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

const VALUE_FLAGS = new Set(['--threshold', '--bundle']);
const positional = argv.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));
const RUN_ID = positional[0];
const BUNDLE_DIR = flagValue('--bundle'); // offline-safe: run the gate stack against a dumped bundle, no DB
const THRESHOLD = Number(flagValue('--threshold') ?? '8');

if (IS_CLI && !RUN_ID) {
  console.error('Usage: node scripts/zz-release-gate.mjs <run_id> [--threshold n] [--bundle <dir>]');
  process.exit(1);
}

const here = fileURLToPath(new URL('.', import.meta.url));
const slug = (RUN_ID ?? '').slice(0, 8);
const verdictPath = join(process.cwd(), 'tmp', 'judge', slug, 'verdict.json');

function runBuyerEval(runId) {
  return new Promise((resolve) => {
    const args = [join(here, 'zz-buyer-eval.mjs'), ...(runId ? [runId] : []), ...(BUNDLE_DIR ? ['--bundle', BUNDLE_DIR] : [])];
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: 1, stdout, stderr: String(err) }));
  });
}

async function loadJudgeVerdict() {
  let raw;
  try {
    raw = await readFile(verdictPath, 'utf8');
  } catch {
    return { ok: false, reason: `no judge verdict at ${verdictPath} — gather (zz-judge-run.mjs ${RUN_ID}) then have a local agent write the verdict first` };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, reason: `judge verdict.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
  const shape = verdictSchema.safeParse(parsed);
  if (!shape.success) {
    return { ok: false, reason: `judge verdict.json does not match the required shape: ${shape.error.issues.slice(0, 2).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` };
  }
  return { ok: true, verdict: shape.data };
}

// Offline-safe live/value gate. Reads an OPTIONAL persisted live-quality-gate
// readout ({ status: 'pass' | 'warn' | 'fail', reasons: [] }) from the bundle dir
// or tmp/judge/<slug>/live-gate.json. Absent => not_evaluated (advisory, never
// blocks). A future phase persists this from src/lib/research-v3/live-quality-gate.ts;
// the release gate is wired to CONSUME it now without requiring a live DB or the
// in-process engine, which is what keeps this step offline-safe + testable.
const LIVE_GATE_STATUSES = new Set(['pass', 'warn', 'fail']);
async function loadLiveGateReadout() {
  const candidates = [
    ...(BUNDLE_DIR ? [join(BUNDLE_DIR, 'live-gate.json')] : []),
    join(process.cwd(), 'tmp', 'judge', slug, 'live-gate.json'),
  ];
  for (const path of candidates) {
    let raw;
    try { raw = await readFile(path, 'utf8'); } catch { continue; }
    try {
      const parsed = JSON.parse(raw);
      const status = typeof parsed?.status === 'string' ? parsed.status : null;
      if (!status || !LIVE_GATE_STATUSES.has(status)) {
        return { status: 'not_evaluated', reasons: [`live-gate.json at ${path} has an invalid status`], path };
      }
      const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.filter((r) => typeof r === 'string') : [];
      return { status, reasons, path };
    } catch {
      return { status: 'not_evaluated', reasons: [`live-gate.json at ${path} is not valid JSON`], path };
    }
  }
  return { status: 'not_evaluated', reasons: ['no live-gate.json present (advisory)'], path: null };
}

// PURE release predicate — the single source of truth for SHIP. A run ships only
// when the deterministic buyer-eval passed AND the judge cleared the bar AND the
// live/value gate is not an explicit fail (warn / not_evaluated are advisory and
// do not block). Exported + side-effect-free so the unit test exercises every
// combination offline (no spawn, no DB, no file IO).
export function combineReleaseGate({ buyerPass, judge, live, threshold }) {
  const judgePass = judge?.ok === true && judgeGatePasses(judge.verdict, threshold);
  const liveStatus = live?.status ?? 'not_evaluated';
  const liveBlocks = liveStatus === 'fail';
  const shipped = buyerPass === true && judgePass === true && !liveBlocks;
  const blockers = [];
  if (buyerPass !== true) blockers.push('deterministic buyer-eval');
  if (!judgePass) blockers.push('judge');
  if (liveBlocks) blockers.push('live/value gate');
  return { shipped, judgePass, liveStatus, liveBlocks, blockers };
}

function line() { return '═'.repeat(68); }

async function main() {
  const buyer = await runBuyerEval(RUN_ID);
  const buyerPass = buyer.code === 0;

  // Pull the buyer-eval final score line for the scorecard (best-effort).
  const buyerScoreLine = (buyer.stdout.match(/Final score: .+/g) ?? []).slice(-1)[0] ?? 'Final score: (see buyer-eval report)';
  const buyerNeverShip = (buyer.stdout.match(/Never-ship penalties: .+/g) ?? []).slice(-1)[0] ?? '';

  const judge = await loadJudgeVerdict();
  const live = await loadLiveGateReadout();
  const combined = combineReleaseGate({ buyerPass, judge, live, threshold: THRESHOLD });
  const { shipped, judgePass } = combined;

  console.log('');
  console.log(line());
  console.log(`  RELEASE GATE — run ${slug}  ·  threshold ${THRESHOLD}/10${BUNDLE_DIR ? `  ·  offline bundle ${BUNDLE_DIR}` : ''}`);
  console.log(line());
  console.log(`  [1] DETERMINISTIC buyer-eval : ${buyerPass ? 'PASS' : 'FAIL'} (exit ${buyer.code})`);
  console.log(`        ${buyerScoreLine.trim()}`);
  if (buyerNeverShip && !buyerPass) console.log(`        ${buyerNeverShip.trim()}`);
  if (buyer.code === 1) console.log(`        setup error: ${buyer.stderr.trim().split('\n').slice(-1)[0] ?? 'unknown'}`);
  console.log('');
  if (!judge.ok) {
    console.log(`  [2] JUDGE verdict            : MISSING / INVALID`);
    console.log(`        ${judge.reason}`);
  } else {
    const v = judge.verdict;
    console.log(`  [2] JUDGE verdict            : ${judgePass ? 'PASS' : 'BELOW BAR'}`);
    console.log(`        score ${v.overallScore}/10  ·  coherent=${v.mediaPlanNumericallyCoherent === true ? 'yes' : 'NO'}  ·  noFabrication=${v.noFabrication === true ? 'yes' : 'NO'}  ·  fabFindings=${v.fabricationFindings?.length ?? 0}`);
    if (!judgePass) {
      const reasons = [];
      if (!(v.overallScore >= THRESHOLD)) reasons.push(`score ${v.overallScore} < ${THRESHOLD}`);
      if (v.mediaPlanNumericallyCoherent !== true) reasons.push('media plan NOT numerically coherent');
      if (v.noFabrication !== true || (v.fabricationFindings?.length ?? 0) > 0) reasons.push('fabrication present');
      console.log(`        blocked: ${reasons.join('; ')}`);
    }
  }
  console.log('');
  const liveLabel = combined.liveStatus === 'not_evaluated' ? 'NOT EVALUATED (advisory)' : combined.liveStatus.toUpperCase();
  console.log(`  [3] LIVE/VALUE gate          : ${liveLabel}${combined.liveBlocks ? ' — BLOCKS' : ''}`);
  if (live.reasons?.length) console.log(`        ${live.reasons.slice(0, 3).join('; ')}`);
  console.log('');
  console.log(line());
  console.log(`  ${shipped ? 'SHIP ✅ — all gates passed' : 'BLOCKED ❌ — ' + combined.blockers.join(' + ') + ' gate failed'}`);
  console.log(line());

  // Exit 1 only when the run/verdict could not be evaluated at all.
  if (buyer.code === 1) process.exit(1);
  if (!judge.ok) process.exit(1);
  process.exit(shipped ? 0 : 2);
}

if (IS_CLI) {
  main().catch((error) => {
    console.error(`FATAL release gate failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
