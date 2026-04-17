import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { maybeCachedSystem, systemBlock } from '../prompt-cache';

const LONG_PROMPT = 'a'.repeat(2048);
const SHORT_PROMPT = 'hi';

// Caching is ON by default (post-2026-04-17): production environments never
// set RESEARCH_PROMPT_CACHE, which meant cacheReadTokens=0 on every run and
// zero caching in the real world. Opt-out is via RESEARCH_PROMPT_CACHE=false.

describe('maybeCachedSystem', () => {
  const original = process.env.RESEARCH_PROMPT_CACHE;

  beforeEach(() => {
    delete process.env.RESEARCH_PROMPT_CACHE;
  });

  afterEach(() => {
    if (original !== undefined) process.env.RESEARCH_PROMPT_CACHE = original;
    else delete process.env.RESEARCH_PROMPT_CACHE;
  });

  it('caches by default when prompt is long enough (no env var set)', () => {
    const result = maybeCachedSystem(LONG_PROMPT);
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result).toHaveLength(1);
    expect(result[0]?.cache_control?.type).toBe('ephemeral');
    expect(result[0]?.cache_control?.ttl).toBe('1h');
  });

  it('still passes through as string when prompt is too short (even with default on)', () => {
    expect(maybeCachedSystem(SHORT_PROMPT)).toBe(SHORT_PROMPT);
  });

  it('opts out when RESEARCH_PROMPT_CACHE=false', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'false';
    expect(maybeCachedSystem(LONG_PROMPT)).toBe(LONG_PROMPT);
  });

  it('wraps as cached block array when explicitly enabled', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'true';
    const result = maybeCachedSystem(LONG_PROMPT);
    expect(Array.isArray(result)).toBe(true);
    if (!Array.isArray(result)) return;
    expect(result[0]?.type).toBe('text');
    expect(result[0]?.text).toBe(LONG_PROMPT);
    expect(result[0]?.cache_control?.type).toBe('ephemeral');
  });

  it('respects custom TTL', () => {
    const result = maybeCachedSystem(LONG_PROMPT, '5m');
    if (!Array.isArray(result)) throw new Error('expected array');
    expect(result[0]?.cache_control?.ttl).toBe('5m');
  });

  it('returns empty string unchanged', () => {
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
    else delete process.env.RESEARCH_PROMPT_CACHE;
  });

  it('emits a cached text block by default when prompt is long', () => {
    const b = systemBlock(LONG_PROMPT);
    expect(b.type).toBe('text');
    expect(b.cache_control?.type).toBe('ephemeral');
  });

  it('omits cache_control when opted out via =false', () => {
    process.env.RESEARCH_PROMPT_CACHE = 'false';
    const b = systemBlock(LONG_PROMPT);
    expect(b.cache_control).toBeUndefined();
  });

  it('skips cache_control when prompt is too short', () => {
    expect(systemBlock(SHORT_PROMPT).cache_control).toBeUndefined();
  });

  it('respects custom TTL when caching applies', () => {
    const b = systemBlock(LONG_PROMPT, '5m');
    expect(b.cache_control?.ttl).toBe('5m');
  });
});
