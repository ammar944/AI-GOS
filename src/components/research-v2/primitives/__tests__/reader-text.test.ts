import { describe, expect, it } from 'vitest';

import {
  clientGapSentence,
  isReaderPipelineChrome,
  looksLikeNavMenuGarbage,
  scrubReaderText,
  stripMoneyProvenanceSuffix,
  textOrGap,
} from '../reader-text';

describe('reader text scrubber', () => {
  it('strips inline verification markers from prose', () => {
    expect(
      scrubReaderText('Use this claim [unverified], then cite the measured row [verified: source].'),
    ).toBe('Use this claim, then cite the measured row.');
  });

  it('rewrites markdown links to their label and drops image-only links', () => {
    expect(
      scrubReaderText('See [the pricing page](https://example.com/pricing) for detail.'),
    ).toBe('See the pricing page for detail.');
    expect(
      scrubReaderText('Before ![hero image](https://cdn.example.com/img.jpg?auto=webp) after.'),
    ).toBe('Before after.');
    // A link whose label is only an image collapses entirely.
    expect(
      scrubReaderText('Nav [![alt](https://cdn.example.com/a.jpg)](https://example.com) item.'),
    ).toBe('Nav item.');
  });

  it('keeps the >=3-link nav-garbage gate intact', () => {
    const navDump =
      '[Home](https://a.com) [Pricing](https://a.com/p) [Blog](https://a.com/b)';
    expect(looksLikeNavMenuGarbage(navDump)).toBe(true);
    expect(looksLikeNavMenuGarbage('See [one link](https://a.com).')).toBe(false);
  });

  it('strips the aggregate unverified-figures footnote', () => {
    expect(
      scrubReaderText(
        'Spend is $500k. [3 figures in this field are unverified — see section badge]',
      ),
    ).toBe('Spend is $500k.');
    expect(
      scrubReaderText('[1 figure in this field is unverified] The rest holds.'),
    ).toBe('The rest holds.');
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

  it('flags pipeline tool tokens, including underscore-token web_search only', () => {
    for (const token of [
      'keyword_volume',
      'keyword_trends',
      'adlibrary',
      'google_ads',
      'meta_ads',
      'linkedin_ads',
      'web_search',
    ]) {
      expect(isReaderPipelineChrome(`measured via ${token} probe`)).toBe(true);
    }
    // The plain-English phrase is client language, not a tool token.
    expect(isReaderPipelineChrome('we ran a broad web search')).toBe(false);
  });
});

describe('stripMoneyProvenanceSuffix', () => {
  it('removes trailing provenance parentheticals from money display strings', () => {
    expect(stripMoneyProvenanceSuffix('$3,000 (user-supplied)')).toBe('$3,000');
    expect(stripMoneyProvenanceSuffix('$100/day (operator-supplied)')).toBe('$100/day');
    expect(stripMoneyProvenanceSuffix('$120 (tool-measured)')).toBe('$120');
    expect(stripMoneyProvenanceSuffix('$9,000 (source-reported)')).toBe('$9,000');
    expect(stripMoneyProvenanceSuffix('$33.33 (model-estimated)')).toBe('$33.33');
    expect(stripMoneyProvenanceSuffix('$50 (unknown)')).toBe('$50');
  });

  it('leaves non-provenance parentheticals alone', () => {
    expect(stripMoneyProvenanceSuffix('$49 (per seat)')).toBe('$49 (per seat)');
    expect(stripMoneyProvenanceSuffix('$3,000')).toBe('$3,000');
  });
});
