// Account-Health Cockpit — shared Fathom anti-fabrication gate (spec §5.3).
//
// Re-implemented inline because the agency scripts are .mjs and cannot import the
// TS gate at src/lib/agency-intelligence/fathom/gate.ts without a build step.
// Logic is kept IDENTICAL to that module (normalizeForGate +
// gateQuoteAgainstTranscript + sha256 over the normalized quote). Keep the two
// in sync if either changes.
//
// Shared by:
//   - scripts/zz-sync-fathom.mjs (raw sync provenance / --list-attributed)
//   - the offline signal-uploader (npm run agency:upload-signals), which gates
//     each staged quote against the stored transcript before upsert.

import { createHash } from 'node:crypto';

const MIN_QUOTE_LENGTH = 12; // mirrors fathom/gate.ts MIN_QUOTE_LENGTH + the DB check

export function sha256(input) {
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}

export function normalizeForGate(input) {
  return (input ?? '')
    .normalize('NFKC')
    .replace(/[‘’‚‛′‵]/g, "'") // curly/prime single quotes
    .replace(/[“”„‟″‶]/g, '"') // curly/prime double quotes
    .replace(/[–—‒―−]/g, '-') // en/em/figure/horizontal dashes, minus
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Accept only if the normalized quote is a substring of a single normalized
 * transcript turn's text and is at least MIN_QUOTE_LENGTH chars. Cross-turn
 * concatenations never match a single turn → reject. Summary-only quotes (the
 * summary is not passed here) cannot match any turn → reject. When the same
 * substring appears in more than one turn, the FIRST matching turn wins (its
 * index/speaker are returned); the quote is always verbatim from a real turn.
 */
export function gateQuoteAgainstTranscript(quote, transcript) {
  const normalizedQuote = normalizeForGate(quote ?? '');
  if (normalizedQuote.length < MIN_QUOTE_LENGTH) {
    return { accepted: false, reason: 'too_short', normalizedQuote };
  }
  for (let i = 0; i < transcript.length; i++) {
    const turn = transcript[i];
    const normalizedTurn = normalizeForGate(turn?.text ?? '');
    if (normalizedTurn.includes(normalizedQuote)) {
      return {
        accepted: true,
        matchedTurnIndex: i,
        speaker: turn?.speaker?.display_name ?? null,
        timestamp: turn?.timestamp ?? null,
        normalizedQuoteSha256: sha256(normalizedQuote),
        normalizedQuote,
      };
    }
  }
  return { accepted: false, reason: 'no_turn_match', normalizedQuote };
}
