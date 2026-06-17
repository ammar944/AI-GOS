// Unit tests for the hardened judge release predicate.
//
// Run: node --test scripts/zz-judge-run.gate.test.mjs
//
// A run passes ONLY when score >= threshold AND mediaPlanNumericallyCoherent
// AND noFabrication AND no fabricationFindings — importing the module must not
// touch the DB or exit (covered implicitly: this import would hang/exit otherwise).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { judgeGatePasses, verdictSchema } from './zz-judge-run.mjs';

const clean = {
  overallScore: 9,
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

test('verdictSchema requires the two new release booleans', () => {
  const missingBooleans = { ...clean };
  delete missingBooleans.mediaPlanNumericallyCoherent;
  delete missingBooleans.noFabrication;
  assert.equal(verdictSchema.safeParse(missingBooleans).success, false);
  assert.equal(verdictSchema.safeParse(clean).success, true);
});

test('judgeGatePasses TRUE only for score>=threshold AND coherent AND noFabrication', () => {
  assert.equal(judgeGatePasses(clean, 9), true);
});

test('judgeGatePasses FALSE when below the score threshold', () => {
  assert.equal(judgeGatePasses({ ...clean, overallScore: 8 }, 9), false);
});

test('judgeGatePasses FALSE when the media plan is not numerically coherent', () => {
  assert.equal(judgeGatePasses({ ...clean, mediaPlanNumericallyCoherent: false }, 9), false);
});

test('judgeGatePasses FALSE when fabrication is present (boolean false)', () => {
  assert.equal(judgeGatePasses({ ...clean, noFabrication: false }, 9), false);
});

test('judgeGatePasses FALSE when fabricationFindings is non-empty even if noFabrication lies true', () => {
  assert.equal(judgeGatePasses({ ...clean, noFabrication: true, fabricationFindings: ['invented persona'] }, 9), false);
});

test('judgeGatePasses FALSE for a null/garbage verdict', () => {
  assert.equal(judgeGatePasses(null, 9), false);
  assert.equal(judgeGatePasses({}, 9), false);
});

test('judgeGatePasses respects a custom threshold', () => {
  assert.equal(judgeGatePasses({ ...clean, overallScore: 7 }, 7), true);
  assert.equal(judgeGatePasses({ ...clean, overallScore: 6 }, 7), false);
});
