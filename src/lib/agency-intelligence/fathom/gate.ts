import { createHash } from 'node:crypto';

/**
 * Deterministic anti-fabrication gate for Fathom signal extraction (spec §5.3).
 *
 * The LLM proposes candidate quotes; this gate is the liar-catcher. A candidate
 * is accepted ONLY if its normalized form is a substring of ONE normalized
 * transcript turn's text — never cross-turn, never summary-only — and is at
 * least 12 characters long. Same discipline as the research pipeline's
 * `verification/provenance-gate.ts`.
 *
 * Pure: no I/O, no network. Uses `node:crypto` for the content hash only.
 */

/** Minimum normalized quote length to be admissible (also a DB check in §4.2). */
export const MIN_QUOTE_LENGTH = 12;

/** A single transcript turn (only `.text` is load-bearing for the gate). */
export interface TranscriptTurn {
  text: string;
  speaker?: { display_name?: string | null } | null;
  timestamp?: string | null;
}

export interface GateAcceptResult {
  accepted: true;
  /** Index of the first transcript turn the normalized quote matched. */
  matchedTurnIndex: number;
  /** `speaker.display_name` of the matched turn, or null. */
  speaker: string | null;
  /** sha256 of the NORMALIZED quote, prefixed `sha256:`. */
  normalizedQuoteSha256: string;
  /** The normalized quote (lowercased, ASCII-folded, whitespace-collapsed). */
  normalizedQuote: string;
}

export interface GateRejectResult {
  accepted: false;
  reason: 'too_short' | 'no_turn_match';
  normalizedQuote: string;
}

export type GateResult = GateAcceptResult | GateRejectResult;

/**
 * Normalize a string for substring comparison:
 * Unicode NFKC → curly quotes/dashes to ASCII → lowercase → collapse
 * whitespace → trim.
 */
export function normalizeForGate(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[‘’‚‛′‵]/g, "'") // curly/prime single quotes
    .replace(/[“”„‟″‶]/g, '"') // curly/prime double quotes
    .replace(/[–—‒―−]/g, '-') // en/em/figure/horizontal dashes, minus
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** sha256 helper: returns `'sha256:' + hex`. */
export function sha256(input: string): string {
  return 'sha256:' + createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Gate a candidate quote against a transcript.
 *
 * Accepts only if the normalized quote is a substring of a single normalized
 * transcript turn's text and is at least {@link MIN_QUOTE_LENGTH} chars.
 * Cross-turn concatenations never match a single turn, so they reject.
 * A quote that lives only in the call summary (not passed here) cannot match
 * any turn and therefore rejects. When the same substring appears in more than
 * one turn, the FIRST matching turn wins (its index/speaker are returned); the
 * quote itself is always verbatim from a real turn regardless.
 */
export function gateQuoteAgainstTranscript(
  quote: string,
  transcript: readonly TranscriptTurn[],
): GateResult {
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
        normalizedQuoteSha256: sha256(normalizedQuote),
        normalizedQuote,
      };
    }
  }

  return { accepted: false, reason: 'no_turn_match', normalizedQuote };
}
