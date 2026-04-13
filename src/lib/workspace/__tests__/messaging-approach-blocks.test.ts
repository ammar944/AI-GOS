import { describe, it, expect } from 'vitest';
import { messagingApproachToBlocks } from '../messaging-approach-blocks';

describe('messagingApproachToBlocks', () => {
  it('splits on blank lines', () => {
    const blocks = messagingApproachToBlocks('First para.\n\nSecond para.');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].body).toBe('First para.');
    expect(blocks[1].body).toBe('Second para.');
  });

  it('splits PAS-style segments on Agitate/Solution', () => {
    const text =
      'PAS: Pain – buyers fear compliance Agitate – lawsuits rising Solution – we are safe';
    const blocks = messagingApproachToBlocks(text);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks.some((b) => /Pain/i.test(b.body) || /Pain/i.test(b.heading ?? ''))).toBe(true);
  });

  it('returns single block for plain prose', () => {
    const blocks = messagingApproachToBlocks('One continuous sentence without structure.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].body).toContain('continuous');
  });
});
