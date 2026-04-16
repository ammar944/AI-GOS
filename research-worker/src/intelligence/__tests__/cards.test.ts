import { describe, expect, it } from 'vitest';
import { extractJsonObject } from '../cards/_shared';

describe('extractJsonObject', () => {
  it('parses bare JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses fenced JSON', () => {
    expect(extractJsonObject('```json\n{"a":2}\n```')).toEqual({ a: 2 });
  });
  it('parses JSON with leading prose', () => {
    expect(extractJsonObject('Here is the result:\n{"a":3}\nEnd.')).toEqual({ a: 3 });
  });
  it('returns null on invalid JSON', () => {
    expect(extractJsonObject('nope')).toBeNull();
    expect(extractJsonObject('{ bad json }')).toBeNull();
  });
});
