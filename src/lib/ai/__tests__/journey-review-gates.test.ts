import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
  getApprovedSections,
  getJourneyApprovalState,
  getLatestApprovedSection,
  getPendingReviewSection,
  hasCompletedResearchOutput,
  hasSectionApprovalMessage,
  shouldSuppressDuplicatePostApprovalReplay,
} from '../journey-review-gates';

describe('hasCompletedResearchOutput', () => {
  it('detects completed realtime research outputs', () => {
    const messages: UIMessage[] = [
      {
        id: 'realtime-industry-1',
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

    expect(hasCompletedResearchOutput(messages, 'researchIndustry')).toBe(true);
    expect(hasCompletedResearchOutput(messages, 'researchOffer')).toBe(false);
  });
});

describe('hasSectionApprovalMessage', () => {
  it('detects hidden artifact approval messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '[SECTION_APPROVED] Looks good — approve Market Overview',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(hasSectionApprovalMessage(messages)).toBe(true);
  });

  it('parses section-scoped approval messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-2',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '[SECTION_APPROVED:competitors] Looks good',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(getLatestApprovedSection(messages)).toBe('competitors');
    expect([...getApprovedSections(messages)]).toEqual(['competitors']);
  });

  it('ignores normal user messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-2',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Tell me more about the ICP',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(hasSectionApprovalMessage(messages)).toBe(false);
  });
});

describe('getPendingReviewSection', () => {
  it('returns the first completed-but-unapproved review section in order', () => {
    const messages: UIMessage[] = [
      {
        id: 'industry',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'industry-call',
            toolName: 'researchIndustry',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'competitors',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchCompetitors',
            state: 'output-available',
            toolCallId: 'competitors-call',
            toolName: 'researchCompetitors',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'approval-1',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '[SECTION_APPROVED:industryMarket] Looks good',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(getPendingReviewSection(messages)).toBe('competitors');
  });
});

describe('getJourneyApprovalState', () => {
  it('keeps approved, latest-approved, and pending-review state aligned after approval', () => {
    const messages: UIMessage[] = [
      {
        id: 'industry',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'industry-call',
            toolName: 'researchIndustry',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'industry-approved',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '[SECTION_APPROVED:industryMarket] Looks good',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'competitors',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchCompetitors',
            state: 'output-available',
            toolCallId: 'competitors-call',
            toolName: 'researchCompetitors',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    const approvalState = getJourneyApprovalState(messages);

    expect([...approvalState.approvedSections]).toEqual(['industryMarket']);
    expect(approvalState.latestApprovedSection).toBe('industryMarket');
    expect(approvalState.pendingReviewSection).toBe('competitors');
  });

  it('returns no approved sections for a fresh run with no approval history', () => {
    const messages: UIMessage[] = [
      {
        id: 'industry',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'industry-call',
            toolName: 'researchIndustry',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    const approvalState = getJourneyApprovalState(messages);

    expect([...approvalState.approvedSections]).toEqual([]);
    expect(approvalState.latestApprovedSection).toBeNull();
    expect(approvalState.pendingReviewSection).toBe('industryMarket');
  });
});

describe('shouldSuppressDuplicatePostApprovalReplay', () => {
  it('suppresses duplicate handoff replay after a hidden wake-up when no new transition happened', () => {
    const messages: UIMessage[] = [
      {
        id: 'competitors-ready',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchCompetitors',
            state: 'output-available',
            toolCallId: 'competitors-call',
            toolName: 'researchCompetitors',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'approval-competitors',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '[SECTION_APPROVED:competitors] Looks good',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'assistant-handoff',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Competitor intel locked in. I’m launching ICP Validation next.',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'hidden-wakeup',
        role: 'user',
        metadata: { hidden: true },
        parts: [
          {
            type: 'text',
            text: '[Research complete] Continue the onboarding conversation.',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(shouldSuppressDuplicatePostApprovalReplay(messages)).toBe(true);
  });

  it('keeps normal progression active after a real next-step transition happened', () => {
    const messages: UIMessage[] = [
      {
        id: 'competitors-ready',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchCompetitors',
            state: 'output-available',
            toolCallId: 'competitors-call',
            toolName: 'researchCompetitors',
            input: {},
            output: '{"status":"complete"}',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'approval-competitors',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: '[SECTION_APPROVED:competitors] Looks good',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'assistant-handoff',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Competitor intel locked in. I’m launching ICP Validation next.',
          } as unknown as UIMessage['parts'][number],
          {
            type: 'tool-researchICP',
            state: 'input-available',
            toolCallId: 'icp-call',
            toolName: 'researchICP',
            input: { primaryIcpDescription: 'Mid-market RevOps leaders' },
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'hidden-wakeup',
        role: 'user',
        metadata: { hidden: true },
        parts: [
          {
            type: 'text',
            text: '[Research complete] Continue the onboarding conversation.',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(shouldSuppressDuplicatePostApprovalReplay(messages)).toBe(false);
  });
});
