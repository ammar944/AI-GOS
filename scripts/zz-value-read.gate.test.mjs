// Unit tests for the offline value-read deterministic ceiling (the Phase-0
// fabrication floor underneath the LLM value-read).
//
// Run: node --test scripts/zz-value-read.gate.test.mjs
//
// The ceiling is the half that can NEVER be talked past by the LLM:
//   absent -> 2, refuted/gate-violation -> 4, unsupported -> 7, clean -> 10.
// Honest gaps are NEUTRAL — they must never lower a ceiling. Importing the
// module must not boot the CLI (IS_CLI guard), or this import would exit.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deterministicCeiling, countRefuted } from './zz-value-read.mjs';

const cleanVerification = {
  verifiedCount: 18,
  unsupportedCount: 0,
  claims: [{ status: 'verified', entailmentVerdict: 'supported' }],
};

function artifact(over = {}) {
  return { body: { keyFindings: ['x'] }, verification: cleanVerification, ...over };
}

test('absent section (errored / no body) -> ceiling 2', () => {
  assert.equal(deterministicCeiling({ artifact: null, errored: true, gateViolations: 0 }).ceiling, 2);
  assert.equal(deterministicCeiling({ artifact: { body: {} }, errored: false, gateViolations: 0 }).ceiling, 2);
  assert.equal(deterministicCeiling({ artifact: null, errored: true, gateViolations: 0 }).band, 'absent');
});

test('clean section (verifier ran, 0 unsupported, substantive) -> ceiling 9 (never a deterministic 10)', () => {
  const r = deterministicCeiling({ artifact: artifact(), errored: false, gateViolations: 0 });
  assert.equal(r.ceiling, 9, 'nothing the deterministic layer sees certifies a perfect 10 — prose fabrication is invisible to it');
  assert.equal(r.band, 'clean');
});

test('THIN-CLEAN: verifier clean but <4 load-bearing claims -> ceiling 7 (not exceptional)', () => {
  const r = deterministicCeiling({
    artifact: artifact({ verification: { verifiedCount: 1, unsupportedCount: 0, claims: [{ entailmentVerdict: 'supported' }] } }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7, '1 verified claim cannot certify a section as clean-9');
  assert.equal(r.band, 'thin-clean');
});

test('empty / count-less verification object -> ceiling 7 (cannot certify clean), NEVER 9', () => {
  for (const v of [{}, { claims: [] }, { verifiedCount: 5 } /* missing unsupportedCount */]) {
    const r = deterministicCeiling({ artifact: artifact({ verification: v }), errored: false, gateViolations: 0 });
    assert.equal(r.ceiling, 7, `verification=${JSON.stringify(v)} must not reach clean`);
    assert.equal(r.band, 'unverifiable-count');
  }
});

test('string-serialized counts are coerced: unsupportedCount "9" -> overclaim 7, not clean', () => {
  const r = deterministicCeiling({
    artifact: artifact({ verification: { verifiedCount: '24', unsupportedCount: '9', claims: [] } }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7);
  assert.equal(r.band, 'overclaim');
});

test('placeholder-only body ({evidenceGap}/{note}) -> absent 2, never escapes to clean', () => {
  assert.equal(deterministicCeiling({ artifact: { body: { evidenceGap: true }, verification: cleanVerification }, errored: false, gateViolations: 0 }).ceiling, 2);
  assert.equal(deterministicCeiling({ artifact: { body: { note: 'n/a' }, verification: cleanVerification }, errored: false, gateViolations: 0 }).ceiling, 2);
});

test('no-verification full body -> ceiling 7 (unverified-directional), never clean', () => {
  const r = deterministicCeiling({ artifact: { body: { painLanguage: { quotes: [{ verbatimText: 'x', sourceUrl: 'https://g2.com/x' }] } } }, errored: false, gateViolations: 0 });
  assert.equal(r.ceiling, 7);
  assert.equal(r.band, 'unverified-directional');
});

test('unsupported load-bearing claims shipped -> ceiling 7 (overclaim)', () => {
  const r = deterministicCeiling({
    artifact: artifact({ verification: { verifiedCount: 24, unsupportedCount: 9, claims: [] } }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7);
  assert.equal(r.band, 'overclaim');
});

test('deck-ledger gate violation -> HARD CAP at 4', () => {
  const r = deterministicCeiling({ artifact: artifact(), errored: false, gateViolations: 2 });
  assert.equal(r.ceiling, 4);
  assert.equal(r.band, 'fabrication-cap');
});

test('refuted (evidence-contradicted) claim -> HARD CAP at 4 (the path the live deck never exercised)', () => {
  const withRefuted = artifact({
    verification: {
      verifiedCount: 5,
      unsupportedCount: 0,
      claims: [
        { status: 'verified', entailmentVerdict: 'supported' },
        { status: 'refuted', entailmentVerdict: 'refuted' },
      ],
    },
  });
  const r = deterministicCeiling({ artifact: withRefuted, errored: false, gateViolations: 0 });
  assert.equal(r.ceiling, 4);
  assert.equal(r.band, 'fabrication-cap');
});

test('no verifier verdict + self-labelled evidence-gap (VoC directional path) -> ceiling 7', () => {
  const voc = { body: { evidenceGap: true, painLanguage: { quotes: [] } } }; // no `verification`
  const r = deterministicCeiling({ artifact: voc, errored: false, gateViolations: 0 });
  assert.equal(r.ceiling, 7);
  assert.equal(r.band, 'unverified-directional');
});

test('HONEST GAP is NEUTRAL — a blockGap in a clean section does NOT lower the band below clean', () => {
  const cleanWithGap = artifact({ body: { keyFindings: ['x'], marketSize: { blockGap: { reason: 'no public TAM' } } } });
  const r = deterministicCeiling({ artifact: cleanWithGap, errored: false, gateViolations: 0 });
  assert.equal(r.ceiling, 9, 'honest gaps must not cap a verifier-clean section below the clean ceiling');
  assert.equal(r.band, 'clean');
});

test('precedence: a gate violation caps at 4 EVEN IF unsupportedCount is also > 0', () => {
  const r = deterministicCeiling({
    artifact: artifact({ verification: { verifiedCount: 14, unsupportedCount: 17, claims: [] } }),
    errored: false,
    gateViolations: 2,
  });
  assert.equal(r.ceiling, 4, 'proven laundering outranks the softer overclaim band');
});

test('countRefuted counts entailmentVerdict OR status === refuted, ignores supported/unsupported', () => {
  assert.equal(countRefuted({ claims: [{ entailmentVerdict: 'refuted' }, { status: 'refuted' }, { entailmentVerdict: 'supported' }, { status: 'unsupported' }] }), 2);
  assert.equal(countRefuted({ claims: [] }), 0);
  assert.equal(countRefuted(null), 0);
  assert.equal(countRefuted(undefined), 0);
});

// ---------------------------------------------------------------------------
// evidenceVerdict — body-level deterministic provenance-gate verdict (ceiling-9 path).
// When present, the ceiling derives from its COUNTS, not the outcome string.
// ---------------------------------------------------------------------------
// helper: a clean evidenceVerdict body. `verification` is intentionally OMITTED so we prove
// the ceiling comes from evidenceVerdict, not the legacy verifier counts.
function evArtifact(ev, body = { keyFindings: ['x'] }) {
  return { body: { ...body, evidenceVerdict: ev } };
}

test('(a) evidenceVerdict clean + verifiedRowCount>=4, 0 unsupported, 0 missing -> ceiling 9 (clean)', () => {
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'clean', verifiedRowCount: 11, unsupportedRowCount: 0, rowsMissingRealSource: 0 }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 9);
  assert.equal(r.band, 'clean');
});

test('(b) rowsMissingRealSource>0 -> ceiling 7 (overclaim), even if outcome lies "clean"', () => {
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'clean', verifiedRowCount: 12, unsupportedRowCount: 0, rowsMissingRealSource: 3 }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7, 'a missing-real-source row caps below clean regardless of the outcome label');
  assert.equal(r.band, 'overclaim');
});

test('(b2) unsupportedRowCount>0 -> ceiling 7 (overclaim), even if outcome lies "clean"', () => {
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'clean', verifiedRowCount: 12, unsupportedRowCount: 5, rowsMissingRealSource: 0 }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7);
  assert.equal(r.band, 'overclaim');
});

test('(c) verifiedRowCount<4 clean -> ceiling 7 (thin-clean), never 9', () => {
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'clean', verifiedRowCount: 2, unsupportedRowCount: 0, rowsMissingRealSource: 0 }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7, '2 verified rows cannot certify a clean-9');
  assert.equal(r.band, 'thin-clean');
});

test("evidenceVerdict outcome 'refuted' -> HARD CAP at 4 (fabrication-cap)", () => {
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'refuted', verifiedRowCount: 5, unsupportedRowCount: 0, rowsMissingRealSource: 0 }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 4);
  assert.equal(r.band, 'fabrication-cap');
});

test("evidenceVerdict outcome 'overclaim' with 0/0 counts -> HARD CAP at 4 (a surviving invention can NEVER read clean)", () => {
  // The agentic runner emits outcome:'overclaim' when an invented claim survives remediation,
  // and in that case rowsMissingRealSource/unsupportedRowCount can both be 0 (an invention is
  // not a missing-source row). Without the explicit overclaim cap this would fall through to
  // clean-9 — the P1-1 Codex finding. The verdict string + cap is the belt; the runner forcing
  // unsupportedRowCount=survivingInventionCount is the suspenders.
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'overclaim', verifiedRowCount: 12, unsupportedRowCount: 0, rowsMissingRealSource: 0 }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 4, 'an overclaim verdict must never read clean even with 0/0 numeric counts');
  assert.equal(r.band, 'fabrication-cap');
});

test('evidenceVerdict counts are not blindly string-trusted: "3" missing-source -> overclaim 7', () => {
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'clean', verifiedRowCount: '12', unsupportedRowCount: '0', rowsMissingRealSource: '3' }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7);
  assert.equal(r.band, 'overclaim');
});

test('evidenceVerdict present but counts unreadable -> falls through to existing verifier logic (no false clean)', () => {
  // unreadable counts + NO verification object -> the no-verifier directional band (7), not clean.
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'clean', verifiedRowCount: 'lots', unsupportedRowCount: null, rowsMissingRealSource: undefined }),
    errored: false,
    gateViolations: 0,
  });
  assert.equal(r.ceiling, 7);
  assert.equal(r.band, 'unverified-directional');
});

test('(d) a section WITHOUT evidenceVerdict scores EXACTLY as before (verifier-clean -> 9)', () => {
  // identical to the legacy clean test — proves the new branch is inert when the field is absent.
  const r = deterministicCeiling({ artifact: artifact(), errored: false, gateViolations: 0 });
  assert.equal(r.ceiling, 9);
  assert.equal(r.band, 'clean');
  assert.equal(r.reason, 'verifier clean (verified 18, 0 unsupported)', 'no-evidenceVerdict path is unchanged — same legacy reason string');
});

test('precedence: a deck-ledger gate violation still caps at 4 even with a clean evidenceVerdict', () => {
  const r = deterministicCeiling({
    artifact: evArtifact({ outcome: 'clean', verifiedRowCount: 11, unsupportedRowCount: 0, rowsMissingRealSource: 0 }),
    errored: false,
    gateViolations: 2,
  });
  assert.equal(r.ceiling, 4, 'proven laundering (gate violation) outranks a clean evidenceVerdict');
  assert.equal(r.band, 'fabrication-cap');
});
