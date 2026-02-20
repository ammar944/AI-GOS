import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repairDoubleEncodedUTF8, hasDoubleEncodedMarkers } from '../spyfu-client';

// Suppress console.warn from repair logging during tests
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('repairDoubleEncodedUTF8', () => {
  describe('double-encoded repair', () => {
    it('repairs "franÃ§ais" → "français"', () => {
      expect(repairDoubleEncodedUTF8('fran\u00C3\u00A7ais')).toBe('français');
    });

    it('repairs "cafÃ©" → "café"', () => {
      expect(repairDoubleEncodedUTF8('caf\u00C3\u00A9')).toBe('café');
    });

    it('repairs "rÃ©sumÃ©" → "résumé"', () => {
      expect(repairDoubleEncodedUTF8('r\u00C3\u00A9sum\u00C3\u00A9')).toBe('résumé');
    });

    it('repairs "naÃ¯ve" → "naïve"', () => {
      expect(repairDoubleEncodedUTF8('na\u00C3\u00AFve')).toBe('naïve');
    });

    it('repairs "Ã¼ber" → "über"', () => {
      expect(repairDoubleEncodedUTF8('\u00C3\u00BCber')).toBe('über');
    });
  });

  describe('idempotent on correct UTF-8', () => {
    it('passes through "français" unchanged', () => {
      expect(repairDoubleEncodedUTF8('français')).toBe('français');
    });

    it('passes through "café" unchanged', () => {
      expect(repairDoubleEncodedUTF8('café')).toBe('café');
    });

    it('passes through "résumé" unchanged', () => {
      expect(repairDoubleEncodedUTF8('résumé')).toBe('résumé');
    });
  });

  describe('pure ASCII passthrough', () => {
    it('passes through "hello world" unchanged', () => {
      expect(repairDoubleEncodedUTF8('hello world')).toBe('hello world');
    });

    it('passes through empty string', () => {
      expect(repairDoubleEncodedUTF8('')).toBe('');
    });

    it('passes through "marketing attribution" unchanged', () => {
      expect(repairDoubleEncodedUTF8('marketing attribution')).toBe('marketing attribution');
    });
  });

  describe('special characters passthrough', () => {
    it('passes through "™" unchanged', () => {
      expect(repairDoubleEncodedUTF8('™')).toBe('™');
    });

    it('passes through "©" unchanged', () => {
      expect(repairDoubleEncodedUTF8('©')).toBe('©');
    });

    it('passes through "€" unchanged', () => {
      expect(repairDoubleEncodedUTF8('€')).toBe('€');
    });

    it('passes through "£" unchanged', () => {
      expect(repairDoubleEncodedUTF8('£')).toBe('£');
    });
  });

  describe('edge cases', () => {
    it('handles very long strings (1000+ chars)', () => {
      const long = 'a'.repeat(1000) + 'caf\u00C3\u00A9' + 'b'.repeat(1000);
      const result = repairDoubleEncodedUTF8(long);
      expect(result).toContain('café');
      expect(result).not.toContain('\u00C3');
    });

    it('handles string with only non-ASCII characters', () => {
      const input = 'éèêë';
      expect(repairDoubleEncodedUTF8(input)).toBe(input);
    });
  });
});

describe('hasDoubleEncodedMarkers', () => {
  it('returns true for double-encoded strings', () => {
    expect(hasDoubleEncodedMarkers('fran\u00C3\u00A7ais')).toBe(true);
    expect(hasDoubleEncodedMarkers('caf\u00C3\u00A9')).toBe(true);
    expect(hasDoubleEncodedMarkers('\u00C3\u00BCber')).toBe(true);
  });

  it('returns false for clean ASCII', () => {
    expect(hasDoubleEncodedMarkers('hello world')).toBe(false);
    expect(hasDoubleEncodedMarkers('marketing attribution')).toBe(false);
  });

  it('returns false for correctly-encoded UTF-8', () => {
    expect(hasDoubleEncodedMarkers('café')).toBe(false);
    expect(hasDoubleEncodedMarkers('über')).toBe(false);
  });
});
