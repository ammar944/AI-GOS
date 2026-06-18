import { describe, it, expect } from 'vitest';
import {
  gateQuoteAgainstTranscript,
  normalizeForGate,
  sha256,
  MIN_QUOTE_LENGTH,
  type TranscriptTurn,
} from '../gate';

// A small Zuppler-shaped transcript (mirrors the spec's F1/F2 fixtures).
const transcript: TranscriptTurn[] = [
  { speaker: { display_name: 'Ammar' }, timestamp: '00:00:05', text: 'Thanks for hopping on today.' },
  {
    speaker: { display_name: 'CEO' },
    timestamp: '00:01:12',
    text: 'Honestly, I am absolutely not happy with the responsiveness from your team.',
  },
  {
    speaker: { display_name: 'CEO' },
    timestamp: '00:02:30',
    text: 'The 13K was for you guys to build out the funnel, and it is not done.',
  },
];

describe('anti-fabrication gate', () => {
  it('G1: verbatim substring of one turn → kept', () => {
    const result = gateQuoteAgainstTranscript(
      'absolutely not happy with the responsiveness from your team',
      transcript,
    );
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.matchedTurnIndex).toBe(1);
      expect(result.speaker).toBe('CEO');
      expect(result.normalizedQuoteSha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  it('G2: paraphrase (not a verbatim substring) → rejected', () => {
    const result = gateQuoteAgainstTranscript(
      'the CEO is unhappy about how slow the team responds',
      transcript,
    );
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('no_turn_match');
  });

  it('G3: cross-turn concatenation → rejected', () => {
    // Real fragments, but spanning turn 1 and turn 2 — never a single-turn substring.
    const result = gateQuoteAgainstTranscript(
      'from your team. The 13K was for you guys to build out',
      transcript,
    );
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('no_turn_match');
  });

  it('G4: quote shorter than the minimum length → rejected', () => {
    const short = 'not done'; // < 12 chars; also appears in turn 2
    expect(normalizeForGate(short).length).toBeLessThan(MIN_QUOTE_LENGTH);
    const result = gateQuoteAgainstTranscript(short, transcript);
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('too_short');
  });

  it('G5: whitespace + curly-quote variant → kept after normalization', () => {
    // Turn 1 raw text uses a straight apostrophe ("I am ..."); here we feed a
    // curly apostrophe + uppercase + collapsed-whitespace variant of a real
    // span ("I'm absolutely not happy"). Add a curly-quote/whitespace turn.
    const curlyTranscript: TranscriptTurn[] = [
      {
        speaker: { display_name: 'CEO' },
        timestamp: '00:01:12',
        text: "I'm absolutely not happy with the team.",
      },
    ];
    const variant = '  I’M   Absolutely  Not Happy ';
    const result = gateQuoteAgainstTranscript(variant, curlyTranscript);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.matchedTurnIndex).toBe(0);
      // Hash is over the normalized form, so the variant and a clean copy agree.
      expect(result.normalizedQuoteSha256).toBe(sha256("i'm absolutely not happy"));
    }
  });

  it('G6: quote present only in the summary (not in any turn) → rejected', () => {
    // Plausible CSM summary sentence that no speaker said verbatim.
    const summaryOnly = 'Client expressed dissatisfaction and threatened to terminate the contract.';
    const result = gateQuoteAgainstTranscript(summaryOnly, transcript);
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('no_turn_match');
  });
});
