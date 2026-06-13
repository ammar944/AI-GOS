import { describe, expect, it } from 'vitest';

import { buildStrategyBriefPrompt } from '../composer';

describe('buildStrategyBriefPrompt', (): void => {
  it('includes committed section markdown, evidence slice, and refinement', (): void => {
    const prompt = buildStrategyBriefPrompt({
      committedSectionMarkdown: {
        positioningVoiceOfCustomer: '## VoC\nQuote A',
      },
      evidencePoolSlice: 'Run-level evidence pool\n- g2 review ...',
      refinement: 'Reframe around cold calling.',
      onboardingFrame: 'Primary objective: leads.',
      priorBrief: null,
    });

    expect(prompt).toContain('Quote A');
    expect(prompt).toContain('evidence pool');
    expect(prompt).toContain('Reframe around cold calling.');
    expect(prompt).toContain('Do not invent');
  });
});
