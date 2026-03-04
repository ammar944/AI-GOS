import { describe, it, expect } from 'vitest';
import type { UIMessage } from 'ai';
import {
  parseCollectedFields,
  type JourneyStateSnapshot,
} from '../journey-state';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAskUserResultMessage(
  fieldName: string,
  value: unknown,
): UIMessage {
  return {
    id: `msg-${fieldName}`,
    role: 'assistant',
    content: '',
    parts: [
      {
        type: 'tool-askUser',
        state: 'output-available',
        toolCallId: `call-${fieldName}`,
        toolName: 'askUser',
        input: { question: 'Q?', fieldName, options: [] },
        output: value,
      } as unknown as UIMessage['parts'][number],
    ],
  };
}

function makeSynthCompleteMessage(): UIMessage {
  return {
    id: 'msg-synth',
    role: 'assistant',
    content: '',
    parts: [
      {
        type: 'tool-synthesizeResearch',
        state: 'output-available',
        toolCallId: 'call-synth',
        toolName: 'synthesizeResearch',
        input: { context: '...' },
        output: { status: 'queued', section: 'crossAnalysis' },
      } as unknown as UIMessage['parts'][number],
    ],
  };
}

// ── parseCollectedFields ──────────────────────────────────────────────────────

describe('parseCollectedFields', () => {
  it('returns empty state for no messages', () => {
    const snap = parseCollectedFields([]);
    expect(snap.collectedFields).toEqual({});
    expect(snap.hasBusinessModel).toBe(false);
    expect(snap.hasIndustry).toBe(false);
    expect(snap.shouldFireStage1).toBe(false);
    expect(snap.synthComplete).toBe(false);
    expect(snap.requiredFieldCount).toBe(0);
  });

  it('detects businessModel collected', () => {
    const messages = [makeAskUserResultMessage('businessModel', 'B2B SaaS')];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(true);
    expect(snap.hasIndustry).toBe(false);
    expect(snap.shouldFireStage1).toBe(false);
  });

  it('sets shouldFireStage1 when both businessModel and industry are collected', () => {
    const messages = [
      makeAskUserResultMessage('businessModel', 'B2B SaaS'),
      makeAskUserResultMessage('industry', 'Developer Tools'),
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(true);
    expect(snap.hasIndustry).toBe(true);
    expect(snap.shouldFireStage1).toBe(true);
  });

  it('counts required fields correctly', () => {
    const messages = [
      makeAskUserResultMessage('businessModel', 'B2B SaaS'),
      makeAskUserResultMessage('industry', 'DevOps'),
      makeAskUserResultMessage('icpDescription', 'Mid-market CTOs'),
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(3);
  });

  it('does not count optional fields in requiredFieldCount', () => {
    const messages = [
      makeAskUserResultMessage('businessModel', 'B2C'),
      makeAskUserResultMessage('companyName', 'Acme Corp'), // optional field
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(1);
  });

  it('detects synthComplete from synthesizeResearch output-available part', () => {
    const messages = [makeSynthCompleteMessage()];
    const snap = parseCollectedFields(messages);
    expect(snap.synthComplete).toBe(true);
  });

  it('does not set synthComplete for other tool completions', () => {
    const messages = [
      {
        id: 'msg-ind',
        role: 'assistant' as const,
        content: '',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'call-ind',
            toolName: 'researchIndustry',
            input: { context: '...' },
            output: { status: 'queued', section: 'industryMarket' },
          } as unknown as UIMessage['parts'][number],
        ],
      },
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.synthComplete).toBe(false);
  });

  it('handles multiSelect marketingChannels as array', () => {
    const messages = [
      makeAskUserResultMessage('marketingChannels', ['Google Ads', 'LinkedIn Ads']),
    ];
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(1);
  });

  it('ignores empty string values as uncollected', () => {
    const messages = [makeAskUserResultMessage('businessModel', '')];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(false);
    expect(snap.requiredFieldCount).toBe(0);
  });

  it('ignores null values as uncollected', () => {
    const messages = [makeAskUserResultMessage('businessModel', null)];
    const snap = parseCollectedFields(messages);
    expect(snap.hasBusinessModel).toBe(false);
  });

  it('handles all 8 required fields collected', () => {
    const required = [
      'businessModel', 'industry', 'icpDescription', 'productDescription',
      'competitors', 'offerPricing', 'marketingChannels', 'goals',
    ];
    const messages = required.map((f) =>
      makeAskUserResultMessage(f, f === 'marketingChannels' ? ['Google Ads'] : `value-${f}`)
    );
    const snap = parseCollectedFields(messages);
    expect(snap.requiredFieldCount).toBe(8);
    expect(snap.shouldFireStage1).toBe(true);
  });
});

// ── competitorFastHitsCalledFor ──────────────────────────────────────────────

describe('competitorFastHitsCalledFor', () => {
  it('returns empty set when no competitorFastHits calls in history', () => {
    const snap = parseCollectedFields([]);
    expect(snap.competitorFastHitsCalledFor.size).toBe(0);
  });

  it('records a domain when competitorFastHits was called with output-available', () => {
    const msg: UIMessage = {
      id: 'msg-cfh',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-competitorFastHits',
          state: 'output-available',
          toolCallId: 'call-cfh',
          toolName: 'competitorFastHits',
          input: { competitorUrl: 'hubspot.com' },
          output: { status: 'complete', data: {} },
        } as unknown as UIMessage['parts'][number],
      ],
    };
    const snap = parseCollectedFields([msg]);
    expect(snap.competitorFastHitsCalledFor.has('hubspot.com')).toBe(true);
  });

  it('records a domain when competitorFastHits is in-flight (input-available)', () => {
    const msg: UIMessage = {
      id: 'msg-cfh2',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-competitorFastHits',
          state: 'input-available',
          toolCallId: 'call-cfh2',
          toolName: 'competitorFastHits',
          input: { competitorUrl: 'pagerduty.com' },
          output: undefined,
        } as unknown as UIMessage['parts'][number],
      ],
    };
    const snap = parseCollectedFields([msg]);
    expect(snap.competitorFastHitsCalledFor.has('pagerduty.com')).toBe(true);
  });

  it('normalises competitorUrl to lowercase when recording', () => {
    const msg: UIMessage = {
      id: 'msg-cfh3',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-competitorFastHits',
          state: 'output-available',
          toolCallId: 'call-cfh3',
          toolName: 'competitorFastHits',
          input: { competitorUrl: 'HubSpot.COM' },
          output: { status: 'complete', data: {} },
        } as unknown as UIMessage['parts'][number],
      ],
    };
    const snap = parseCollectedFields([msg]);
    expect(snap.competitorFastHitsCalledFor.has('hubspot.com')).toBe(true);
  });
});
