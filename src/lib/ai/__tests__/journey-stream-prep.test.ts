import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
  compactJourneyMessagesForModel,
  sanitizeJourneyMessages,
} from '../journey-stream-prep';

describe('sanitizeJourneyMessages', () => {
  it('drops incomplete tool states from older assistant messages before model conversion', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-older',
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
      {
        id: 'assistant-latest',
        role: 'assistant',
        parts: [
          {
            type: 'tool-askUser',
            state: 'input-available',
            toolCallId: 'ask-2',
            input: { fieldName: 'goals' },
          },
          {
            type: 'text',
            text: 'Latest assistant turn',
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
    expect(sanitized[1]).toEqual(messages[1]);
  });

  it('preserves the latest assistant message when it includes reasoning and an input-available tool part', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-old',
        role: 'assistant',
        parts: [
          {
            type: 'tool-askUser',
            state: 'input-available',
            toolCallId: 'ask-old',
            input: { fieldName: 'companySize' },
          },
          {
            type: 'text',
            text: 'Older assistant turn',
          },
        ],
      } as UIMessage,
      {
        id: 'assistant-latest',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Need to confirm the next step before asking anything else.',
          },
          {
            type: 'tool-researchCompetitors',
            state: 'input-available',
            toolCallId: 'competitors-1',
            toolName: 'researchCompetitors',
            input: { topCompetitors: ['Drift', 'HubSpot'] },
          },
          {
            type: 'text',
            text: 'I have enough to launch competitor research.',
          },
        ],
      } as UIMessage,
    ];

    const sanitized = sanitizeJourneyMessages(messages);

    expect(sanitized[0]?.parts).toEqual([
      expect.objectContaining({
        type: 'text',
        text: 'Older assistant turn',
      }),
    ]);
    expect(sanitized[1]).toEqual(messages[1]);
  });

  it('preserves the latest assistant approval-requested tool part when reasoning is present', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-latest',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'I should wait for confirmation before continuing.',
          },
          {
            type: 'tool-researchOffer',
            state: 'approval-requested',
            toolCallId: 'offer-1',
            toolName: 'researchOffer',
            input: { productDescription: 'Fractional RevOps support' },
            approval: { id: 'approval-offer-1' },
          },
          {
            type: 'text',
            text: 'Ready to continue once approved.',
          },
        ],
      } as UIMessage,
    ];

    const sanitized = sanitizeJourneyMessages(messages);

    expect(sanitized[0]).toEqual(messages[0]);
  });

  it('drops raw thinking replay blocks that Anthropic rejects on resend', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-thinking',
        role: 'assistant',
        parts: [
          {
            type: 'thinking',
            thinking: 'Private chain-of-thought',
          },
          {
            type: 'redacted_thinking',
            data: 'encrypted',
          },
          {
            type: 'text',
            text: 'Visible assistant response',
          },
        ],
      } as UIMessage,
    ];

    const sanitized = sanitizeJourneyMessages(messages);

    expect(sanitized[0]?.parts).toEqual([
      expect.objectContaining({
        type: 'text',
        text: 'Visible assistant response',
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
