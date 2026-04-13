import { describe, it, expect } from 'vitest';
import { estimateTokenCount } from '../token-count';

describe('estimateTokenCount', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('returns 0 for falsy input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(estimateTokenCount(null as any)).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(estimateTokenCount(undefined as any)).toBe(0);
  });

  it('estimates ~1 token per 4 characters', () => {
    // 100 chars → 25 tokens
    const text = 'a'.repeat(100);
    expect(estimateTokenCount(text)).toBe(25);
  });

  it('rounds up for non-divisible lengths', () => {
    // 5 chars → ceil(5/4) = 2
    expect(estimateTokenCount('hello')).toBe(2);
  });

  it('handles unicode text', () => {
    // Unicode chars are still counted by string length
    const text = 'Hello world! 🚀';
    expect(estimateTokenCount(text)).toBe(Math.ceil(text.length / 4));
  });

  it('handles large documents', () => {
    const text = 'word '.repeat(10_000); // ~50K chars
    expect(estimateTokenCount(text)).toBe(Math.ceil(text.length / 4));
  });
});
