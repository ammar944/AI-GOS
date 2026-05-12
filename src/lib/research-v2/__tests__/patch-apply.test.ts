import { describe, it, expect } from 'vitest';

import { applyPatch, isValidPath } from '../patch-apply';

describe('isValidPath', () => {
  it('accepts simple dotted paths', () => {
    expect(isValidPath('foo.bar')).toBe(true);
    expect(isValidPath('keyFindings[0].evidence')).toBe(true);
    expect(isValidPath('sources[2].url')).toBe(true);
  });

  it('rejects empty paths', () => {
    expect(isValidPath('')).toBe(false);
  });

  it('rejects paths with dangerous tokens', () => {
    expect(isValidPath('__proto__.foo')).toBe(false);
    expect(isValidPath('constructor.prototype')).toBe(false);
  });

  it('rejects paths starting with a dot or bracket', () => {
    expect(isValidPath('.foo')).toBe(false);
    expect(isValidPath('[0].bar')).toBe(false);
  });
});

describe('applyPatch', () => {
  it('sets a top-level scalar field', () => {
    const obj = { foo: 'old' };
    const out = applyPatch(obj, { path: 'foo', value: 'new' });
    expect(out).toEqual({ foo: 'new' });
  });

  it('sets a nested field via dot path', () => {
    const obj = { a: { b: { c: 1 } } };
    const out = applyPatch(obj, { path: 'a.b.c', value: 42 });
    expect(out.a.b.c).toBe(42);
  });

  it('sets an array element field via bracket', () => {
    const obj = {
      keyFindings: [{ evidence: 'old' }, { evidence: 'still old' }],
    };
    const out = applyPatch(obj, {
      path: 'keyFindings[0].evidence',
      value: 'new',
    });
    expect(out.keyFindings[0].evidence).toBe('new');
    expect(out.keyFindings[1].evidence).toBe('still old');
  });

  it('throws on invalid path', () => {
    expect(() => applyPatch({}, { path: '__proto__.x', value: 1 })).toThrow();
  });

  it('throws when path traverses a missing intermediate', () => {
    expect(() =>
      applyPatch({ a: {} }, { path: 'a.b.c', value: 1 }),
    ).toThrow(/missing/i);
  });

  it('returns a new object (no mutation of input)', () => {
    const obj = { foo: 'old' };
    const out = applyPatch(obj, { path: 'foo', value: 'new' });
    expect(obj.foo).toBe('old');
    expect(out).not.toBe(obj);
  });
});
