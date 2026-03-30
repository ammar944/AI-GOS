import { describe, it, expect } from 'vitest';
import { sanitizeScript, dedupScripts } from '../runners/ad-scripts';

describe('sanitizeScript', () => {
  it('replaces spaced em dash with period and capitalizes next word', () => {
    const script = { body: 'First clause — second clause' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('First clause. Second clause');
  });

  it('replaces unspaced em dash with comma', () => {
    const script = { body: 'word—another' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('word, another');
  });

  it('replaces remaining em dashes with comma', () => {
    const script = { body: '—start of sentence' };
    const result = sanitizeScript(script);
    expect(result.body).toBe(',start of sentence');
  });

  it('strips en dashes the same as em dashes', () => {
    const script = { body: 'word – another word' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('word. Another word');
  });

  it('preserves hyphens in compound words', () => {
    const script = { body: 'well-known best-in-class high-quality' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('well-known best-in-class high-quality');
  });

  it('handles multiple em dashes in same string', () => {
    const script = { body: 'A — B — C' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('A. B. C');
  });

  it('replaces en dash in numeric ranges with "to"', () => {
    const script = { body: 'Founders at $500K–$5M ARR spend 3–6 months' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('Founders at $500K to $5M ARR spend 3 to 6 months');
  });

  it('replaces en dash in percentage ranges with "to"', () => {
    const script = { body: 'conversion rates of 10%–15%' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('conversion rates of 10% to 15%');
  });

  it('handles em dash at end of string', () => {
    const script = { body: 'some text —' };
    const result = sanitizeScript(script);
    expect(result.body).not.toContain('—');
  });

  it('sanitizes all string fields on the script object', () => {
    const script = {
      headline: 'Test — headline',
      body: 'Test — body',
      cta: 'Click — here',
      subheadline: 'Sub — line',
      title: 'Title — dash',
      designDirection: 'Design — note',
      angle: 'painPoint',
      confidenceScore: 8,
    };
    const result = sanitizeScript(script);
    expect(result.headline).not.toContain('—');
    expect(result.body).not.toContain('—');
    expect(result.cta).not.toContain('—');
    expect(result.subheadline).not.toContain('—');
    expect(result.title).not.toContain('—');
    expect(result.designDirection).not.toContain('—');
    // Non-string fields preserved
    expect(result.angle).toBe('painPoint');
    expect(result.confidenceScore).toBe(8);
  });

  it('sanitizes string arrays (hookVariants)', () => {
    const script = {
      body: 'clean body',
      hookVariants: ['Hook one — with dash', 'Hook two — another'],
    };
    const result = sanitizeScript(script);
    const variants = result.hookVariants as string[];
    expect(variants[0]).not.toContain('—');
    expect(variants[1]).not.toContain('—');
  });

  it('handles empty string gracefully', () => {
    const script = { body: '' };
    const result = sanitizeScript(script);
    expect(result.body).toBe('');
  });
});

describe('dedupScripts', () => {
  it('returns input unchanged when no duplicates', () => {
    const scripts = [
      { angle: 'painPoint', type: 'video', platform: 'meta', body: 'First script body here' },
      { angle: 'outcome', type: 'static', platform: 'google', body: 'Second script body here' },
      { angle: 'curiosity', type: 'email', platform: 'linkedin', body: 'Third script body here' },
    ];
    const result = dedupScripts(scripts);
    expect(result).toHaveLength(3);
  });

  it('removes duplicate by fingerprint', () => {
    const scripts = [
      { angle: 'painPoint', type: 'video', platform: 'meta', body: 'Same exact body text for both scripts here' },
      { angle: 'painPoint', type: 'video', platform: 'meta', body: 'Same exact body text for both scripts here' },
      { angle: 'outcome', type: 'static', platform: 'google', body: 'Different body text entirely' },
    ];
    const result = dedupScripts(scripts);
    expect(result).toHaveLength(2);
  });

  it('treats different angles as unique even with same body', () => {
    const scripts = [
      { angle: 'painPoint', type: 'video', platform: 'meta', body: 'Same body' },
      { angle: 'outcome', type: 'video', platform: 'meta', body: 'Same body' },
    ];
    const result = dedupScripts(scripts);
    expect(result).toHaveLength(2);
  });

  it('normalizes case and whitespace in fingerprint', () => {
    const scripts = [
      { angle: 'painPoint', type: 'video', platform: 'meta', body: 'Hello  World  Test' },
      { angle: 'painPoint', type: 'video', platform: 'meta', body: 'hello world test' },
    ];
    const result = dedupScripts(scripts);
    expect(result).toHaveLength(1);
  });

  it('handles empty body gracefully', () => {
    const scripts = [
      { angle: 'painPoint', type: 'video', platform: 'meta' },
      { angle: 'painPoint', type: 'video', platform: 'meta' },
    ];
    const result = dedupScripts(scripts);
    expect(result).toHaveLength(1);
  });

  it('keeps all scripts when all are unique', () => {
    const scripts = [
      { angle: 'a', type: 'video', platform: 'meta', body: 'body a' },
      { angle: 'b', type: 'static', platform: 'google', body: 'body b' },
      { angle: 'c', type: 'email', platform: 'linkedin', body: 'body c' },
    ];
    const result = dedupScripts(scripts);
    expect(result).toHaveLength(3);
  });
});
