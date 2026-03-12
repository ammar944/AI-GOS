import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { shouldAutoSendJourneyMessages } from '../chat-auto-send';

describe('shouldAutoSendJourneyMessages', () => {
  it('ignores realtime synthetic assistant messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'realtime-industryMarket-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'realtime-industryMarket',
            toolName: 'researchIndustry',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(shouldAutoSendJourneyMessages(messages)).toBe(false);
  });

  it('auto-sends for normal completed tool outputs', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-askUser',
            state: 'output-available',
            toolCallId: 'ask-1',
            toolName: 'askUser',
            input: { fieldName: 'companySize' },
            output: { fieldName: 'companySize', selectedLabel: '11-50 employees' },
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(shouldAutoSendJourneyMessages(messages)).toBe(true);
  });
});
