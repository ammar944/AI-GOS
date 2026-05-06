import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import {
  mergeWorkspaceSectionMessages,
  readWorkspaceSectionMessages,
  serializeWorkspaceMessages,
  WorkspaceMessagesValidationError,
} from '@/lib/journey/workspace-messages';

function makeTextMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

describe('workspace message storage helpers', () => {
  it('returns empty section messages for empty state', () => {
    expect(readWorkspaceSectionMessages(null, 'industryMarket')).toEqual([]);
    expect(readWorkspaceSectionMessages(undefined, 'competitors')).toEqual([]);
  });

  it('reads legacy flat message arrays without crashing', () => {
    const legacyMessage = makeTextMessage('message-1', 'Review this market card');

    expect(readWorkspaceSectionMessages([legacyMessage], 'industryMarket')).toEqual([
      legacyMessage,
    ]);
  });

  it('reads versioned per-section messages', () => {
    const industryMessage = makeTextMessage('industry-1', 'Market question');
    const competitorMessage = makeTextMessage('competitors-1', 'Competitor question');

    const envelope = {
      schemaVersion: 1,
      workspace: {
        industryMarket: [industryMessage],
        competitors: [competitorMessage],
      },
    };

    expect(readWorkspaceSectionMessages(envelope, 'industryMarket')).toEqual([
      industryMessage,
    ]);
    expect(readWorkspaceSectionMessages(envelope, 'competitors')).toEqual([
      competitorMessage,
    ]);
    expect(readWorkspaceSectionMessages(envelope, 'mediaPlan')).toEqual([]);
  });

  it('preserves other sections when merging one section', () => {
    const existingCompetitorMessage = makeTextMessage(
      'competitors-1',
      'Competitor question',
    );
    const nextIndustryMessage = makeTextMessage('industry-1', 'Market question');

    const result = mergeWorkspaceSectionMessages(
      {
        schemaVersion: 1,
        workspace: {
          competitors: [existingCompetitorMessage],
        },
      },
      'industryMarket',
      [nextIndustryMessage],
    );

    expect(result.workspace.competitors).toEqual([existingCompetitorMessage]);
    expect(result.workspace.industryMarket).toEqual([nextIndustryMessage]);
  });

  it('rejects malformed messages during serialization', () => {
    expect(() => serializeWorkspaceMessages([{ id: 'missing-parts', role: 'user' }]))
      .toThrow(WorkspaceMessagesValidationError);
  });

  it('strips reasoning and incomplete tool parts from persistable messages', () => {
    const message: UIMessage = {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'reasoning',
          text: 'private chain of thought',
        } as UIMessage['parts'][number],
        {
          type: 'tool-editCard',
          toolCallId: 'call-incomplete',
          state: 'input-streaming',
          input: { cardId: 'card-1' },
        } as UIMessage['parts'][number],
        {
          type: 'tool-editCard',
          toolCallId: 'call-complete',
          state: 'output-available',
          input: { cardId: 'card-1' },
          output: { status: 'proposed' },
        } as UIMessage['parts'][number],
      ],
    };

    expect(serializeWorkspaceMessages([message])).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-editCard',
            toolCallId: 'call-complete',
            state: 'output-available',
            input: { cardId: 'card-1' },
            output: { status: 'proposed' },
          },
        ],
      },
    ]);
  });
});
