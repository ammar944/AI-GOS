import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { extractResearchDispatchState } from '../research-dispatch-state';

describe('extractResearchDispatchState', () => {
  it('treats tool invocations as queued research', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolName: 'researchIndustry',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(extractResearchDispatchState(messages)).toEqual({
      industryMarket: { status: 'queued' },
    });
  });

  it('treats queued tool outputs as active research', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolName: 'researchIndustry',
            output: { status: 'queued', section: 'industryMarket' },
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(extractResearchDispatchState(messages)).toEqual({
      industryMarket: { status: 'queued' },
    });
  });

  it('parses queued tool outputs when the payload is stringified JSON', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-2b',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolName: 'researchIndustry',
            output: JSON.stringify({ status: 'queued', section: 'industryMarket' }),
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(extractResearchDispatchState(messages)).toEqual({
      industryMarket: { status: 'queued' },
    });
  });

  it('surfaces immediate dispatch errors', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-3',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolName: 'researchIndustry',
            output: { status: 'error', section: 'industryMarket', error: 'Worker unreachable' },
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(extractResearchDispatchState(messages)).toEqual({
      industryMarket: { status: 'error', error: 'Worker unreachable' },
    });
  });

  it('clears queued dispatch state when a later completed research result arrives', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-queued',
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolName: 'researchIndustry',
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
      {
        id: 'assistant-complete',
        role: 'assistant',
        parts: [
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolName: 'researchIndustry',
            output: JSON.stringify({
              status: 'complete',
              section: 'industryMarket',
              data: {
                categorySnapshot: {
                  category: 'B2B SaaS',
                  marketSize: 'Estimated SAM: $4.2B',
                  marketMaturity: 'growing',
                  buyingBehavior: 'roi_based',
                  awarenessLevel: 'medium',
                  averageSalesCycle: '45-90 days',
                },
                painPoints: {
                  primary: ['Attribution is unreliable'],
                },
                marketDynamics: {
                  demandDrivers: ['Pressure to lower CAC'],
                  buyingTriggers: ['Pipeline targets missed'],
                  barriersToPurchase: ['Tool fatigue'],
                },
                messagingOpportunities: {
                  summaryRecommendations: ['Lead with revenue visibility'],
                },
              },
              durationMs: 1200,
            }),
          } as unknown as UIMessage['parts'][number],
        ],
      } as UIMessage,
    ];

    expect(extractResearchDispatchState(messages)).toEqual({});
  });
});
