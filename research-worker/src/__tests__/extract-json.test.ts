import { describe, it, expect } from 'vitest';
import { extractJson } from '../runner';

describe('extractJson', () => {
  describe('raw JSON', () => {
    it('parses valid JSON directly', () => {
      expect(extractJson('{"key": "value"}')).toEqual({ key: 'value' });
    });

    it('parses JSON array', () => {
      expect(extractJson('[1, 2, 3]')).toEqual([1, 2, 3]);
    });

    it('parses nested objects', () => {
      const nested = '{"a": {"b": {"c": 1}}, "d": [1, 2]}';
      expect(extractJson(nested)).toEqual({ a: { b: { c: 1 } }, d: [1, 2] });
    });

    it('handles whitespace around JSON', () => {
      expect(extractJson('  \n {"key": 1} \n  ')).toEqual({ key: 1 });
    });
  });

  describe('fenced JSON', () => {
    it('extracts JSON from ```json fences', () => {
      const input = '```json\n{"key": "value"}\n```';
      expect(extractJson(input)).toEqual({ key: 'value' });
    });

    it('extracts JSON from ``` fences without language tag', () => {
      const input = '```\n{"key": "value"}\n```';
      expect(extractJson(input)).toEqual({ key: 'value' });
    });

    it('extracts JSON with surrounding text', () => {
      const input = 'Here is the result:\n```json\n{"score": 85}\n```\nDone.';
      expect(extractJson(input)).toEqual({ score: 85 });
    });
  });

  describe('brace heuristic fallback', () => {
    it('extracts JSON from text with leading/trailing prose', () => {
      const input = 'The analysis:\n{"result": "good"}\nEnd of output.';
      expect(extractJson(input)).toEqual({ result: 'good' });
    });

    it('handles JSON embedded in markdown', () => {
      const input = '## Output\n{"data": [1,2,3]}\n\n## Notes';
      expect(extractJson(input)).toEqual({ data: [1, 2, 3] });
    });
  });

  describe('trailing comma fix', () => {
    it('fixes trailing comma before closing brace', () => {
      const input = '{"a": 1, "b": 2,}';
      expect(extractJson(input)).toEqual({ a: 1, b: 2 });
    });

    it('fixes trailing comma before closing bracket', () => {
      const input = '{"items": [1, 2, 3,]}';
      expect(extractJson(input)).toEqual({ items: [1, 2, 3] });
    });

    it('fixes nested trailing commas', () => {
      const input = '{"a": {"b": 1,}, "c": [1,],}';
      expect(extractJson(input)).toEqual({ a: { b: 1 }, c: [1] });
    });

    it('fixes trailing comma in prose-wrapped JSON', () => {
      const input = 'Result: {"score": 90, "grade": "A",} end';
      expect(extractJson(input)).toEqual({ score: 90, grade: 'A' });
    });
  });

  describe('truncated / malformed output', () => {
    it('still fails on truly truncated JSON (incomplete value)', () => {
      const input = '```json\n{"key": "val';
      expect(() => extractJson(input)).toThrow('No parseable JSON found');
    });

    it('extracts JSON from unclosed fence with complete JSON inside', () => {
      const input = '```json\n{"key": "value"}\nsome trailing text';
      expect(extractJson(input)).toEqual({ key: 'value' });
    });

    it('extracts JSON from unclosed fence with trailing comma', () => {
      const input = '```json\n{"score": 85, "grade": "A",}\nmore text here';
      expect(extractJson(input)).toEqual({ score: 85, grade: 'A' });
    });

    it('fails on completely non-JSON text', () => {
      expect(() => extractJson('Hello world')).toThrow('No parseable JSON found');
    });

    it('fails on empty string', () => {
      expect(() => extractJson('')).toThrow('No parseable JSON found');
    });

    it('fails on just whitespace', () => {
      expect(() => extractJson('   \n  ')).toThrow('No parseable JSON found');
    });
  });
});
