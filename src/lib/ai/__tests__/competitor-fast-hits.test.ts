import { describe, expect, it } from 'vitest';
import { FAST_HIT_PROMPT } from '../tools/competitor-fast-hits';

describe('competitor-fast-hits prompt alignment', () => {
  it('does not reference Meta Ads Manager in the prompt', () => {
    expect(FAST_HIT_PROMPT).not.toContain('Meta Ads Manager');
    expect(FAST_HIT_PROMPT).not.toContain('metaAds');
  });

  it('uses platform-neutral ad library language', () => {
    expect(FAST_HIT_PROMPT).not.toMatch(/ad activity on Meta\b/i);
    expect(FAST_HIT_PROMPT).toMatch(/public ad.library/i);
  });
});
