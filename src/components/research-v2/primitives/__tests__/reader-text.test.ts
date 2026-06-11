import { describe, expect, it } from 'vitest';

import {
  clientGapSentence,
  isReaderPipelineChrome,
  scrubReaderText,
  textOrGap,
} from '../reader-text';

describe('reader text scrubber', () => {
  it('strips inline verification markers from prose', () => {
    expect(
      scrubReaderText('Use this claim [unverified], then cite the measured row [verified: source].'),
    ).toBe('Use this claim, then cite the measured row.');
  });

  it('detects pipeline chrome and rewrites it as client-plain gap language', () => {
    const raw = 'evidence gap: validator requires >=5 examples; budget exhausted';

    expect(isReaderPipelineChrome(raw)).toBe(true);
    expect(textOrGap(raw, 'intent signals')).toEqual({
      kind: 'gap',
      value: 'Not enough public evidence was found for intent signals.',
    });
    expect(clientGapSentence(raw, 'intent signals')).not.toMatch(/validator|budget/i);
  });
});
