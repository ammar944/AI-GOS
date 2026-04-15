import { describe, it, expect } from 'vitest';
import { buildPass1Prompt } from '../prompts/ad-scripts-pass1';
import { buildPass2Prompt } from '../prompts/ad-scripts-pass2';

const basePass1Opts = {
  companyName: 'TestCo',
  awarenessLevel: 'problem-aware',
  count: 3,
  trimmedResearchContext: 'Test research context.',
  styleReferences: null,
  targetAudience: 'B2B SaaS founders',
};

describe('buildPass1Prompt — brand voice injection', () => {
  it('injects all three sections when full brandVoiceNotes provided', () => {
    const { system } = buildPass1Prompt({
      ...basePass1Opts,
      brandVoiceNotes: {
        tone: 'Authoritative, data-driven',
        constraints: 'Never use buzzwords like synergy',
        goodExample: 'We cut CAC by 40% in 90 days.',
        badExample: 'Leverage our synergistic solutions!',
      },
    });
    expect(system).toContain('BRAND VOICE — HARD RULES');
    expect(system).toContain('Never use buzzwords like synergy');
    expect(system).toContain('BRAND VOICE — TONE');
    expect(system).toContain('Authoritative, data-driven');
    expect(system).toContain('BRAND VOICE — EXAMPLES');
    expect(system).toContain('We cut CAC by 40%');
    expect(system).toContain('Leverage our synergistic');
  });

  it('injects only tone section when only tone provided', () => {
    const { system } = buildPass1Prompt({
      ...basePass1Opts,
      brandVoiceNotes: {
        tone: 'Casual and friendly',
        constraints: '',
        goodExample: '',
        badExample: '',
      },
    });
    expect(system).toContain('BRAND VOICE — TONE');
    expect(system).toContain('Casual and friendly');
    expect(system).not.toContain('BRAND VOICE — HARD RULES');
    expect(system).not.toContain('BRAND VOICE — EXAMPLES');
  });

  it('injects only constraints when only constraints provided', () => {
    const { system } = buildPass1Prompt({
      ...basePass1Opts,
      brandVoiceNotes: {
        tone: '',
        constraints: 'Always mention SOC2 compliance',
        goodExample: '',
        badExample: '',
      },
    });
    expect(system).toContain('BRAND VOICE — HARD RULES');
    expect(system).toContain('Always mention SOC2 compliance');
    expect(system).not.toContain('BRAND VOICE — TONE');
  });

  it('injects examples section when only goodExample provided', () => {
    const { system } = buildPass1Prompt({
      ...basePass1Opts,
      brandVoiceNotes: {
        tone: '',
        constraints: '',
        goodExample: 'Short, punchy copy.',
        badExample: '',
      },
    });
    expect(system).toContain('BRAND VOICE — EXAMPLES');
    expect(system).toContain('Short, punchy copy.');
  });

  it('produces no brand voice sections when brandVoiceNotes is null', () => {
    const { system } = buildPass1Prompt({
      ...basePass1Opts,
      brandVoiceNotes: null,
    });
    expect(system).not.toContain('BRAND VOICE');
  });

  it('produces no brand voice sections when brandVoiceNotes is undefined', () => {
    const { system } = buildPass1Prompt({
      ...basePass1Opts,
    });
    expect(system).not.toContain('BRAND VOICE');
  });
});

describe('buildPass2Prompt — brand voice compliance', () => {
  const basePass2Opts = {
    companyName: 'TestCo',
    awarenessLevel: 'solution-aware',
    pass1Scripts: [{ hook: 'Test hook', body: 'Test body', cta: 'Test CTA' }],
  };

  it('injects compliance check with full brandVoiceNotes', () => {
    const { system } = buildPass2Prompt({
      ...basePass2Opts,
      brandVoiceNotes: {
        tone: 'Professional',
        constraints: 'Never use exclamation marks',
        goodExample: 'Clean, measured copy.',
        badExample: '',
      },
    });
    expect(system).toContain('BRAND VOICE COMPLIANCE CHECK');
    expect(system).toContain('Never use exclamation marks');
    expect(system).toContain('Target tone: Professional');
    expect(system).toContain('Voice benchmark: Clean, measured copy.');
  });

  it('uses "No specific constraints." fallback when constraints empty', () => {
    const { system } = buildPass2Prompt({
      ...basePass2Opts,
      brandVoiceNotes: {
        tone: 'Casual',
        constraints: '',
        goodExample: '',
        badExample: '',
      },
    });
    expect(system).toContain('BRAND VOICE COMPLIANCE CHECK');
    expect(system).toContain('No specific constraints.');
  });

  it('omits compliance check when brandVoiceNotes is null', () => {
    const { system } = buildPass2Prompt({
      ...basePass2Opts,
      brandVoiceNotes: null,
    });
    expect(system).not.toContain('BRAND VOICE COMPLIANCE CHECK');
  });

  it('always includes 43-check audit framework regardless of brand voice', () => {
    const withVoice = buildPass2Prompt({
      ...basePass2Opts,
      brandVoiceNotes: { tone: 'Bold', constraints: 'Test', goodExample: '', badExample: '' },
    });
    const withoutVoice = buildPass2Prompt({
      ...basePass2Opts,
      brandVoiceNotes: null,
    });
    // Both should contain the humanization audit in system or prompt
    const withAll = withVoice.system + withVoice.prompt;
    const withoutAll = withoutVoice.system + withoutVoice.prompt;
    expect(withAll).toContain('AUDIT');
    expect(withoutAll).toContain('AUDIT');
  });
});
