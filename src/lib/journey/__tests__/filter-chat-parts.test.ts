import { describe, expect, it } from 'vitest';
import { filterJourneyMessageParts } from '../filter-chat-parts';

describe('filterJourneyMessageParts', () => {
  it('hides reasoning and journey research tool parts', () => {
    const parts = [
      { type: 'reasoning', text: 'hidden' },
      { type: 'tool-researchIndustry', state: 'output-available' },
      { type: 'tool-askUser', state: 'input-available' },
      { type: 'text', text: 'keep me' },
    ];

    expect(filterJourneyMessageParts(parts)).toEqual([
      { type: 'tool-askUser', state: 'input-available' },
      { type: 'text', text: 'keep me' },
    ]);
  });

  it('hides research tool invocations as well as outputs', () => {
    const parts = [
      { type: 'tool-invocation', toolName: 'researchIndustry' },
      { type: 'tool-invocation', toolName: 'askUser' },
    ];

    expect(filterJourneyMessageParts(parts)).toEqual([
      { type: 'tool-invocation', toolName: 'askUser' },
    ]);
  });

  it('drops malformed parts instead of throwing during Journey message filtering', () => {
    const parts = [
      undefined,
      null,
      { text: 'missing type' },
      { type: 'text', text: 'keep me' },
      { type: 'tool-researchCompetitors', state: 'output-available' },
    ];

    expect(filterJourneyMessageParts(parts)).toEqual([
      { type: 'text', text: 'keep me' },
    ]);
  });
});
