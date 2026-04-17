import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { maybeCachedSystem, systemBlock } from '../prompt-cache';

const LONG_PROMPT = 'a'.repeat(2048);
const SHORT_PROMPT = 'hi';

describe('maybeCachedSystem', () => {
  const original = process.env.RESEARCH_PROMPT_CACHE;

  beforeEach(() => {
    delete process.env.RESEARCH_PROMPT_CACHE;
  });

  afterEach(() => {
    if (original !== undefined) process.env.RESEARCH_PROMPT_CACHE = original;
  });

  it('passes through as string when flag is off', () => {
    expect(maybeCachedSystem(LONG_PROMPT)).toBe(LONG_PROMPT);
  });

  it('passes through as string when flag is on but prompt is too short', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'true';
    expect(maybeCachedSystem(SHORT_PROMPT)).toBe(SHORT_PROMPT);
  });

  it('wraps as cached block array when flag is on and prompt is long', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'true';
    const result = maybeCachedSystem(LONG_PROMPT);
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('text');
    expect(result[0]?.text).toBe(LONG_PROMPT);
    expect(result[0]?.cache_control?.type).toBe('ephemeral');
    expect(result[0]?.cache_control?.ttl).toBe('1h');
  });

  it('respects custom TTL', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'true';
    const result = maybeCachedSystem(LONG_PROMPT, '5m');
    if (!Array.isArray(result)) throw new Error('expected array');
    expect(result[0]?.cache_control?.ttl).toBe('5m');
  });

  it('returns empty string unchanged', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'true';
    expect(maybeCachedSystem('')).toBe('');
  });
});

describe('systemBlock', () => {
  const original = process.env.RESEARCH_PROMPT_CACHE;

  beforeEach(() => {
    delete process.env.RESEARCH_PROMPT_CACHE;
  });

  afterEach(() => {
    if (original !== undefined) process.env.RESEARCH_PROMPT_CACHE = original;
  });

  it('emits a plain text block without cache_control when flag is off', () => {
    const b = systemBlock(LONG_PROMPT);
    expect(b.type).toBe('text');
    expect(b.cache_control).toBeUndefined();
  });

  it('attaches cache_control when flag is on and prompt is long', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'true';
    const b = systemBlock(LONG_PROMPT, '5m');
    expect(b.cache_control?.ttl).toBe('5m');
  });

  it('skips cache_control when prompt is too short', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'true';
    expect(systemBlock(SHORT_PROMPT).cache_control).toBeUndefined();
  });
});
