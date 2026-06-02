import { describe, expect, it } from 'vitest';

import {
  ALL_PRODUCT_PHASES,
  ALL_READER_SECTION_STATUSES,
  PHASE_ICON,
  STATUS_META,
} from '../status';
import { formatSourceIndex, hostname } from '../source';
import { toneToClass, type StatusPillTone } from '../status-pill';

describe('hostname', () => {
  it('strips www prefix from hostnames', () => {
    expect(hostname('https://www.ramp.com/x')).toBe('ramp.com');
  });

  it('returns bare hostname without www', () => {
    expect(hostname('http://g2.com')).toBe('g2.com');
  });

  it('returns empty string for undefined', () => {
    expect(hostname(undefined)).toBe('');
  });

  it('passthrough on malformed URLs', () => {
    expect(hostname('not a url')).toBe('not a url');
  });

  it('preserves subdomains other than www', () => {
    expect(hostname('https://blog.ramp.com')).toBe('blog.ramp.com');
  });
});

describe('formatSourceIndex', () => {
  it('zero-pads single-digit indices', () => {
    expect(formatSourceIndex(1)).toBe('01');
  });

  it('leaves double-digit indices unchanged', () => {
    expect(formatSourceIndex(12)).toBe('12');
  });
});

describe('STATUS_META exhaustiveness', () => {
  it('covers every ReaderSectionStatus value', () => {
    expect(Object.keys(STATUS_META).sort()).toEqual(
      [...ALL_READER_SECTION_STATUSES].sort(),
    );
  });
});

describe('PHASE_ICON exhaustiveness', () => {
  it('covers every ProductPhase value including done', () => {
    expect(Object.keys(PHASE_ICON).sort()).toEqual([...ALL_PRODUCT_PHASES].sort());
  });
});

describe('toneToClass', () => {
  const tones: StatusPillTone[] = ['neutral', 'complete', 'flagged', 'error', 'active'];

  it.each(tones)('maps %s to a non-empty class string', (tone) => {
    expect(toneToClass(tone).length).toBeGreaterThan(0);
  });

  it('maps complete to emerald semantic token', () => {
    expect(toneToClass('complete')).toContain('text-emerald-600');
  });

  it('maps flagged to amber semantic token', () => {
    expect(toneToClass('flagged')).toContain('text-amber-600');
  });

  it('maps error to red semantic token', () => {
    expect(toneToClass('error')).toContain('text-red-600');
  });

  it('maps active to primary semantic token', () => {
    expect(toneToClass('active')).toContain('text-primary');
  });

  it('falls back to neutral for undefined tone', () => {
    expect(toneToClass(undefined)).toBe(toneToClass('neutral'));
  });
});
