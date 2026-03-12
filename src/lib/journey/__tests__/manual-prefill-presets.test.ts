import { describe, expect, it } from 'vitest';
import { getManualPrefillPreset } from '../manual-prefill-presets';

describe('getManualPrefillPreset', () => {
  it('returns the SaaSLaunch preset for the SaaSLaunch domain', () => {
    const preset = getManualPrefillPreset({
      websiteUrl: 'https://www.saslaunch.net',
    });

    expect(preset?.label).toBe('SaaSLaunch');
    expect(preset?.values.topCompetitors).toContain('Hey Digital');
  });

  it('returns null for unrelated companies', () => {
    expect(
      getManualPrefillPreset({
        websiteUrl: 'https://example.com',
        companyName: 'Example Co',
      }),
    ).toBeNull();
  });
});
