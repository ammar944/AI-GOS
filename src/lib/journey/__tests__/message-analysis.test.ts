import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { analyzeJourneyMessages } from '../message-analysis';

describe('analyzeJourneyMessages', () => {
  it('derives statuses, pending ask-user prompts, and approval state in one pass', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-1',
            input: { sectionId: 'industryResearch' },
            output: { sectionId: 'industryResearch', status: 'complete', content: 'Industry output' },
          },
          {
            type: 'tool-askUser',
            state: 'input-available',
            toolCallId: 'ask-1',
            input: { fieldName: 'companySize' },
          },
        ],
      } as UIMessage,
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-editBlueprint',
            state: 'approval-requested',
            toolCallId: 'approval-1',
            input: { section: 'mediaPlan' },
          },
          {
            type: 'tool-generateResearch',
            state: 'input-available',
            toolCallId: 'research-2',
            input: { sectionId: 'keywordIntel' },
          },
        ],
      } as UIMessage,
    ];

    const result = analyzeJourneyMessages(messages, {
      researchStreaming: {
        keywordIntel: {
          text: 'fresh chunk',
          status: 'running',
        },
      },
      invalidatedResearchSections: ['mediaPlan'],
    });

    expect(result.sectionStatuses).toEqual({
      industryResearch: 'complete',
      keywordIntel: 'running',
      mediaPlan: 'queued',
    });
    expect(result.completedResearchOutputCounts).toEqual({
      industryResearch: 1,
    });
    expect(result.pendingAskUser).toEqual({
      toolCallId: 'ask-1',
      fieldName: 'companySize',
    });
    expect(result.hasPendingApproval).toBe(true);
  });

  it('treats output-available research parts with error payloads as failed sections', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-error',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-error',
            input: { sectionId: 'industryResearch' },
            output: {
              status: 'error',
              sectionId: 'industryResearch',
              error: 'Revision chain rejected',
            },
          },
        ],
      } as UIMessage,
    ];

    const result = analyzeJourneyMessages(messages);

    expect(result.sectionStatuses).toEqual({
      industryResearch: 'error',
    });
    expect(result.completedResearchOutputCounts).toEqual({});
  });
});
