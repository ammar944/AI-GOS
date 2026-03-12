import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
  extractResearchOutputs,
  createEmptyState,
  calculateCompletion,
  hasAnsweredFields,
  getAnsweredFields,
  extractAskUserResults,
} from '../session-state';

describe('createEmptyState', () => {
  it('returns a state with all required fields null', () => {
    const state = createEmptyState();
    expect(state.businessModel).toBeNull();
    expect(state.industry).toBeNull();
    expect(state.icpDescription).toBeNull();
    expect(state.productDescription).toBeNull();
    expect(state.competitors).toBeNull();
    expect(state.offerPricing).toBeNull();
    expect(state.marketingChannels).toBeNull();
    expect(state.goals).toBeNull();
  });

  it('returns phase onboarding and 0% completion', () => {
    const state = createEmptyState();
    expect(state.phase).toBe('onboarding');
    expect(state.requiredFieldsCompleted).toBe(0);
    expect(state.completionPercent).toBe(0);
  });
});

describe('calculateCompletion', () => {
  it('returns 0 when no required fields are filled', () => {
    const state = createEmptyState();
    const result = calculateCompletion(state);
    expect(result.requiredFieldsCompleted).toBe(0);
    expect(result.completionPercent).toBe(0);
  });

  it('counts string fields correctly', () => {
    const state = createEmptyState();
    state.businessModel = 'B2B SaaS';
    state.industry = 'AI tooling';
    const result = calculateCompletion(state);
    expect(result.requiredFieldsCompleted).toBe(2);
    expect(result.completionPercent).toBe(25); // 2/8
  });

  it('counts array fields with values as complete', () => {
    const state = createEmptyState();
    state.marketingChannels = ['Google Ads'];
    const result = calculateCompletion(state);
    expect(result.requiredFieldsCompleted).toBe(1);
  });

  it('does not count empty string as complete', () => {
    const state = createEmptyState();
    state.businessModel = '  ';
    const result = calculateCompletion(state);
    expect(result.requiredFieldsCompleted).toBe(0);
  });

  it('returns 100% when all 8 required fields are filled', () => {
    const state = createEmptyState();
    state.businessModel = 'B2B SaaS';
    state.industry = 'AI';
    state.icpDescription = 'CTOs';
    state.productDescription = 'Analytics';
    state.competitors = 'Mixpanel';
    state.offerPricing = '$500/mo';
    state.marketingChannels = ['Google Ads'];
    state.goals = 'More leads';
    const result = calculateCompletion(state);
    expect(result.requiredFieldsCompleted).toBe(8);
    expect(result.completionPercent).toBe(100);
  });
});

describe('hasAnsweredFields', () => {
  it('returns false for empty state', () => {
    const state = createEmptyState();
    expect(hasAnsweredFields(state)).toBe(false);
  });

  it('returns true when at least one required field is set', () => {
    const state = createEmptyState();
    state.businessModel = 'B2B SaaS';
    expect(hasAnsweredFields(state)).toBe(true);
  });
});

describe('getAnsweredFields', () => {
  it('returns empty object when no fields are set', () => {
    const state = createEmptyState();
    expect(getAnsweredFields(state)).toEqual({});
  });

  it('includes both required and optional fields that have values', () => {
    const state = createEmptyState();
    state.businessModel = 'B2B SaaS';
    state.companyName = 'Acme AI';
    const answered = getAnsweredFields(state);
    expect(answered).toEqual({
      businessModel: 'B2B SaaS',
      companyName: 'Acme AI',
    });
  });

  it('excludes empty string fields', () => {
    const state = createEmptyState();
    state.businessModel = '';
    state.companyName = 'Acme AI';
    const answered = getAnsweredFields(state);
    expect(answered).not.toHaveProperty('businessModel');
    expect(answered).toHaveProperty('companyName');
  });
});

describe('extractAskUserResults', () => {
  it('returns empty object when no askUser tool parts exist', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
      } as UIMessage,
    ];
    expect(extractAskUserResults(messages)).toEqual({});
  });

  it('extracts output from tool-askUser parts with output-available state', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-askUser',
            state: 'output-available',
            toolCallId: 'ask-1',
            input: { fieldName: 'businessModel' },
            output: { value: 'B2B SaaS', confirmed: true },
          },
        ],
      } as UIMessage,
    ];
    const result = extractAskUserResults(messages);
    expect(result).toEqual({
      businessModel: { value: 'B2B SaaS', confirmed: true },
    });
  });

  it('skips tool-askUser parts that are not output-available', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-askUser',
            state: 'input-available',
            toolCallId: 'ask-2',
            input: { fieldName: 'industry' },
            output: null,
          },
        ],
      } as UIMessage,
    ];
    const result = extractAskUserResults(messages);
    expect(result).toEqual({});
  });
});

describe('extractResearchOutputs', () => {
  it('returns empty object when no research tool parts exist', () => {
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Go research.' }],
      } as UIMessage,
    ];
    expect(extractResearchOutputs(messages)).toEqual({});
  });

  it('extracts a researchOffer tool output keyed by boundary section id', () => {
    const output = {
      status: 'complete',
      sectionId: 'offerAnalysis',
      content: 'Offer analysis narrative.',
    };
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchOffer',
            state: 'output-available',
            toolCallId: 'offer-1',
            input: {},
            output,
          },
        ],
      } as UIMessage,
    ];

    const result = extractResearchOutputs(messages);
    // researchOffer → offerAnalysis (canonical) → offerAnalysis (boundary)
    expect(result).toHaveProperty('offerAnalysis');
    expect(result['offerAnalysis']).toMatchObject({ status: 'complete' });
  });

  it('extracts a researchIndustry tool output keyed by boundary section id', () => {
    const output = {
      status: 'complete',
      sectionId: 'industryResearch',
      content: 'Industry narrative.',
    };
    const messages: UIMessage[] = [
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'industry-1',
            input: {},
            output,
          },
        ],
      } as UIMessage,
    ];

    const result = extractResearchOutputs(messages);
    // researchIndustry → industryResearch (canonical) → industryMarket (boundary)
    expect(result).toHaveProperty('industryMarket');
    expect(result['industryMarket']).toMatchObject({ status: 'complete' });
  });

  it('extracts synthesizeResearch tool output keyed by boundary section id', () => {
    const output = {
      status: 'complete',
      sectionId: 'strategicSynthesis',
      content: 'Strategic synthesis narrative.',
    };
    const messages: UIMessage[] = [
      {
        id: 'assistant-3',
        role: 'assistant',
        parts: [
          {
            type: 'tool-synthesizeResearch',
            state: 'output-available',
            toolCallId: 'synth-1',
            input: {},
            output,
          },
        ],
      } as UIMessage,
    ];

    const result = extractResearchOutputs(messages);
    // synthesizeResearch → strategicSynthesis (canonical) → crossAnalysis (boundary)
    expect(result).toHaveProperty('crossAnalysis');
    expect(result['crossAnalysis']).toMatchObject({ status: 'complete' });
  });

  it('skips tool parts that are not output-available', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-4',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchOffer',
            state: 'input-streaming',
            toolCallId: 'offer-2',
            input: {},
            output: null,
          },
        ],
      } as UIMessage,
    ];
    expect(extractResearchOutputs(messages)).toEqual({});
  });

  it('skips tool parts with unknown status values', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-5',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchOffer',
            state: 'output-available',
            toolCallId: 'offer-3',
            input: {},
            output: { status: 'pending' },
          },
        ],
      } as UIMessage,
    ];
    expect(extractResearchOutputs(messages)).toEqual({});
  });

  it('accepts partial and error statuses in addition to complete', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-6',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchCompetitors',
            state: 'output-available',
            toolCallId: 'comp-1',
            input: {},
            output: { status: 'partial', content: 'partial data' },
          },
          {
            type: 'tool-researchICP',
            state: 'output-available',
            toolCallId: 'icp-1',
            input: {},
            output: { status: 'error', message: 'timeout' },
          },
        ],
      } as UIMessage,
    ];

    const result = extractResearchOutputs(messages);
    // researchCompetitors → competitorIntel (canonical) → competitors (boundary)
    expect(result).toHaveProperty('competitors');
    // researchICP → icpValidation (canonical) → icpValidation (boundary)
    expect(result).toHaveProperty('icpValidation');
  });

  it('parses stringified JSON tool outputs', () => {
    const output = JSON.stringify({
      status: 'complete',
      sectionId: 'offerAnalysis',
      content: 'Stringified offer analysis.',
    });
    const messages: UIMessage[] = [
      {
        id: 'assistant-7',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchOffer',
            state: 'output-available',
            toolCallId: 'offer-4',
            input: {},
            output,
          },
        ],
      } as UIMessage,
    ];

    const result = extractResearchOutputs(messages);
    expect(result).toHaveProperty('offerAnalysis');
    expect((result['offerAnalysis'] as Record<string, unknown>)['content']).toBe(
      'Stringified offer analysis.',
    );
  });

  it('extracts multiple research sections from one message', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-multi',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchOffer',
            state: 'output-available',
            toolCallId: 'offer-5',
            input: {},
            output: { status: 'complete', content: 'Offer data.' },
          },
          {
            type: 'tool-synthesizeResearch',
            state: 'output-available',
            toolCallId: 'synth-2',
            input: {},
            output: { status: 'complete', content: 'Synthesis data.' },
          },
        ],
      } as UIMessage,
    ];

    const result = extractResearchOutputs(messages);
    expect(result).toHaveProperty('offerAnalysis');
    expect(result).toHaveProperty('crossAnalysis');
  });
});
