import { describe, expect, it } from 'vitest';

import type { StrategyBriefBody } from '../schema';
import { validateStrategyBriefSupport } from '../support';

const baseBody = (sourceEvidence: string[]): StrategyBriefBody => ({
  positioning: { oneLiner: 'x', valueProp: 'y', mechanism: 'z' },
  angles: [
    {
      name: 'a',
      vignette: 'v',
      coreEmotion: 'e',
      adFrame: 'f',
      rank: 1,
      sourceEvidence,
    },
  ],
  lexicon: { approved: [], banned: [] },
  funnelStance: 'phase 1',
  gaps: [],
  changelog: [{ revision: 1, summary: 's', rationale: 'r', at: 'now' }],
});

describe('validateStrategyBriefSupport', (): void => {
  const committedSectionIds = ['positioningVoiceOfCustomer'];
  const evidenceSourceUrls = ['https://g2.com/review/123'];

  it('passes when every angle traces to a committed section or evidence url', (): void => {
    const result = validateStrategyBriefSupport({
      body: baseBody([
        'positioningVoiceOfCustomer',
        'https://g2.com/review/123',
      ]),
      committedSectionIds,
      evidenceSourceUrls,
    });

    expect(result.ok).toBe(true);
  });

  it('fails with named offenders when an angle cites nothing known', (): void => {
    const result = validateStrategyBriefSupport({
      body: baseBody(['positioningMadeUpSection']),
      committedSectionIds,
      evidenceSourceUrls,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unsupported[0]).toContain('a');
      expect(result.unsupported[0]).toContain('positioningMadeUpSection');
    }
  });
});
