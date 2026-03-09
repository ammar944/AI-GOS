import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
  compactJourneyMessagesForModel,
  sanitizeJourneyMessages,
} from '../journey-stream-prep';

describe('sanitizeJourneyMessages', () => {
  it('drops incomplete tool states before model conversion', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-askUser',
            state: 'input-available',
            toolCallId: 'ask-1',
            input: { fieldName: 'companySize' },
          },
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-1',
            input: { sectionId: 'industryResearch' },
            output: { status: 'complete', sectionId: 'industryResearch', content: 'full content' },
          },
        ],
      } as UIMessage,
    ];

    const sanitized = sanitizeJourneyMessages(messages);

    expect(sanitized[0]?.parts).toEqual([
      expect.objectContaining({
        type: 'tool-generateResearch',
      }),
    ]);
  });
});

describe('compactJourneyMessagesForModel', () => {
  it('trims older generateResearch outputs but preserves recent ones', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-old',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-old',
            input: { sectionId: 'industryResearch' },
            output: {
              status: 'complete',
              sectionId: 'industryResearch',
              content: 'A'.repeat(3000),
              citations: [{ number: 1, url: 'https://example.com' }],
              claims: [{ statement: 'claim' }],
              missingData: ['missing'],
              fileIds: ['file-1'],
            },
          },
        ],
      } as UIMessage,
      {
        id: 'assistant-recent',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-recent',
            input: { sectionId: 'keywordIntel' },
            output: {
              status: 'complete',
              sectionId: 'keywordIntel',
              content: 'recent content',
              citations: [{ number: 1, url: 'https://recent.example.com' }],
            },
          },
        ],
      } as UIMessage,
    ];

    const compacted = compactJourneyMessagesForModel(messages, {
      preserveRecentMessages: 1,
      maxResearchContentChars: 120,
    });

    const oldOutput = (
      compacted[0]?.parts[0] as {
        output?: { content?: string; compacted?: boolean; citations?: unknown[]; fileIds?: unknown[] };
      }
    ).output;
    const recentOutput = (
      compacted[1]?.parts[0] as {
        output?: { content?: string; compacted?: boolean; citations?: unknown[] };
      }
    ).output;

    expect(oldOutput).toEqual({
      status: 'complete',
      sectionId: 'industryResearch',
      content: `${'A'.repeat(120)}…`,
      compacted: true,
    });
    expect(recentOutput).toEqual({
      status: 'complete',
      sectionId: 'keywordIntel',
      content: 'recent content',
      citations: [{ number: 1, url: 'https://recent.example.com' }],
    });
  });
});
