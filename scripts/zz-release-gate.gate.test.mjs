// Unit tests for the combined release predicate (offline, no spawn / DB / file IO).
//
// Run: node --test scripts/zz-release-gate.gate.test.mjs
//
// A run ships ONLY when the deterministic buyer-eval passed AND the judge cleared
// the bar AND the live/value gate is not an explicit fail. warn / not_evaluated are
// advisory and never block. Importing the module must not spawn buyer-eval or exit.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { combineReleaseGate } from './zz-release-gate.mjs';

const cleanVerdict = {
  overallScore: 8,
  wouldPay: 'yes',
  oneLineVerdict: 'sharp and trustworthy',
  mediaPlanNumericallyCoherent: true,
  noFabrication: true,
  perSection: [],
  strengths: [],
  problems: [],
  topFixes: [],
  fabricationFindings: [],
};
const okJudge = { ok: true, verdict: cleanVerdict };

test('SHIPS when buyer passes, judge clears the 8 bar, and live gate is not evaluated', () => {
  const r = combineReleaseGate({ buyerPass: true, judge: okJudge, live: { status: 'not_evaluated' }, threshold: 8 });
  assert.equal(r.shipped, true);
  assert.equal(r.judgePass, true);
  assert.equal(r.blockers.length, 0);
});

test('SHIPS when the live/value gate is a WARN (advisory, non-blocking)', () => {
  const r = combineReleaseGate({ buyerPass: true, judge: okJudge, live: { status: 'warn', reasons: ['thin VoC'] }, threshold: 8 });
  assert.equal(r.shipped, true);
  assert.equal(r.liveBlocks, false);
});

test('SHIPS when the live/value gate explicitly PASSES', () => {
  const r = combineReleaseGate({ buyerPass: true, judge: okJudge, live: { status: 'pass' }, threshold: 8 });
  assert.equal(r.shipped, true);
});

test('defaults live to not_evaluated (advisory) when no live readout is provided', () => {
  const r = combineReleaseGate({ buyerPass: true, judge: okJudge, threshold: 8 });
  assert.equal(r.liveStatus, 'not_evaluated');
  assert.equal(r.shipped, true);
});

test('BLOCKS when the live/value gate explicitly FAILS', () => {
  const r = combineReleaseGate({ buyerPass: true, judge: okJudge, live: { status: 'fail', reasons: ['empty-despite-evidence'] }, threshold: 8 });
  assert.equal(r.shipped, false);
  assert.equal(r.liveBlocks, true);
  assert.ok(r.blockers.includes('live/value gate'));
});

test('BLOCKS when the deterministic buyer-eval failed', () => {
  const r = combineReleaseGate({ buyerPass: false, judge: okJudge, live: { status: 'pass' }, threshold: 8 });
  assert.equal(r.shipped, false);
  assert.ok(r.blockers.includes('deterministic buyer-eval'));
});

test('BLOCKS when the judge is below the bar', () => {
  const r = combineReleaseGate({ buyerPass: true, judge: { ok: true, verdict: { ...cleanVerdict, overallScore: 7 } }, live: { status: 'pass' }, threshold: 8 });
  assert.equal(r.shipped, false);
  assert.equal(r.judgePass, false);
  assert.ok(r.blockers.includes('judge'));
});

test('BLOCKS when the judge verdict is missing/invalid (judge.ok false)', () => {
  const r = combineReleaseGate({ buyerPass: true, judge: { ok: false, reason: 'no verdict.json' }, live: { status: 'pass' }, threshold: 8 });
  assert.equal(r.shipped, false);
  assert.equal(r.judgePass, false);
});

test('BLOCKS when the judge reports fabrication even with a high score', () => {
  const r = combineReleaseGate({
    buyerPass: true,
    judge: { ok: true, verdict: { ...cleanVerdict, overallScore: 9, noFabrication: false, fabricationFindings: ['invented persona'] } },
    live: { status: 'pass' },
    threshold: 8,
  });
  assert.equal(r.shipped, false);
  assert.equal(r.judgePass, false);
});

test('respects a custom threshold', () => {
  const v9 = { ok: true, verdict: { ...cleanVerdict, overallScore: 9 } };
  assert.equal(combineReleaseGate({ buyerPass: true, judge: v9, live: { status: 'pass' }, threshold: 9 }).shipped, true);
  assert.equal(combineReleaseGate({ buyerPass: true, judge: okJudge, live: { status: 'pass' }, threshold: 9 }).shipped, false);
});

test('collects every blocker at once', () => {
  const r = combineReleaseGate({
    buyerPass: false,
    judge: { ok: true, verdict: { ...cleanVerdict, overallScore: 4 } },
    live: { status: 'fail' },
    threshold: 8,
  });
  assert.equal(r.shipped, false);
  assert.deepEqual(r.blockers, ['deterministic buyer-eval', 'judge', 'live/value gate']);
});
