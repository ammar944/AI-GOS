import { describe, it, expect } from 'vitest';
import { adScriptSchema, adScriptPackSchema } from '../schemas';

describe('adScriptSchema', () => {
  const validScript = {
    id: 'abc-123',
    title: 'The Invisible Cost of Bad Info',
    type: 'video',
    platform: 'meta',
    awarenessLevel: 'unaware',
    angle: 'painPoint',
    hookType: 'question',
    duration: '60s',
    cta: 'Click the link below',
    body: 'Restaurant owners, when was the last time...',
    groundedIn: [
      { section: 'icpValidation', claim: 'Time-poor owners', label: 'ICP: time-poor owner' },
    ],
    confidenceScore: 8,
    humanizedPass: true,
  };

  it('validates a complete video script', () => {
    expect(() => adScriptSchema.parse(validScript)).not.toThrow();
  });

  it('validates a static ad with headline + designDirection', () => {
    const staticAd = {
      ...validScript,
      type: 'static',
      platform: 'google',
      headline: 'Stop Losing Customers',
      subheadline: 'Your info is wrong on 12 platforms',
      designDirection: 'Split screen before/after dashboards',
      duration: undefined,
    };
    expect(() => adScriptSchema.parse(staticAd)).not.toThrow();
  });

  it('validates a script with humanizedPass: false (Pass 2 failure)', () => {
    const unhumanized = { ...validScript, humanizedPass: false };
    expect(() => adScriptSchema.parse(unhumanized)).not.toThrow();
  });

  it('accepts any section name in groundedIn (v2: string, not enum)', () => {
    const withCustomSection = { ...validScript, groundedIn: [{ section: 'fake', claim: 'x', label: 'y' }] };
    expect(() => adScriptSchema.parse(withCustomSection)).not.toThrow();
  });
});

describe('adScriptPackSchema', () => {
  it('validates a complete pack', () => {
    const pack = {
      scripts: [],
      generatedAt: new Date().toISOString(),
      researchSessionId: 'run-abc',
      styleReferencesUsed: [],
      summary: { totalScripts: 0, byType: {}, byPlatform: {}, byAwareness: {} },
    };
    expect(() => adScriptPackSchema.parse(pack)).not.toThrow();
  });
});
