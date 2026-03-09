import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
  applyAutoDetectedChatConfirmation,
  extractConfirmedJourneyFields,
  extractResearchOutputs,
  setProposedField,
  createEmptyState,
} from '../session-state';

describe('extractResearchOutputs', () => {
  it('preserves typed wave 1 payloads alongside generic metadata', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-wave-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-wave-1',
            input: { sectionId: 'offerAnalysis' },
            output: {
              status: 'complete',
              sectionId: 'offerAnalysis',
              content: 'Offer analysis narrative.',
              citations: [
                {
                  number: 1,
                  url: 'https://example.com/offer',
                  title: 'Offer report',
                },
              ],
              fileIds: ['offer-file'],
              data: {
                offerClarity: {
                  clearlyArticulated: true,
                  solvesRealPain: true,
                  benefitsEasyToUnderstand: true,
                  transformationMeasurable: true,
                  valuePropositionObvious: true,
                },
                offerStrength: {
                  painRelevance: 8,
                  urgency: 7,
                  differentiation: 6,
                  tangibility: 8,
                  proof: 5,
                  pricingLogic: 7,
                  overallScore: 7,
                },
                marketOfferFit: {
                  marketWantsNow: true,
                  competitorsOfferSimilar: true,
                  priceMatchesExpectations: true,
                  proofStrongForColdTraffic: false,
                  transformationBelievable: true,
                },
                redFlags: ['weak_or_no_proof'],
                recommendation: {
                  status: 'adjust_messaging',
                  reasoning: 'Needs stronger proof.',
                  actionItems: ['Refresh case studies'],
                },
              },
            },
          },
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-wave-1-b',
            input: { sectionId: 'strategicSynthesis' },
            output: {
              status: 'complete',
              sectionId: 'strategicSynthesis',
              content: 'Strategic synthesis narrative.',
              fileIds: ['strategy-file'],
              data: {
                keyInsights: [
                  {
                    insight: 'Differentiation should focus on faster time to value.',
                    implication: 'Lead with speed in messaging.',
                    priority: 'high',
                  },
                ],
                recommendedPositioning:
                  'Own the fastest path to revenue visibility.',
                positioningStrategy: {
                  primary: 'Fast, operator-friendly attribution.',
                  alternatives: ['Lead with implementation support'],
                  differentiators: ['Fast deployment'],
                  avoidPositions: ['Generic all-in-one analytics'],
                },
                recommendedPlatforms: [
                  {
                    platform: 'LinkedIn',
                    reasoning: 'Buyers are concentrated there.',
                    priority: 'primary',
                  },
                ],
                potentialBlockers: ['Thin proof library'],
                nextSteps: ['Rewrite launch messaging around speed'],
              },
            },
          },
        ],
      } as UIMessage,
    ];

    expect(extractResearchOutputs(messages)).toEqual({
      offerAnalysis: {
        status: 'complete',
        section: 'offerAnalysis',
        data: {
          content: 'Offer analysis narrative.',
          fileIds: ['offer-file'],
          citations: [
            {
              number: 1,
              url: 'https://example.com/offer',
              title: 'Offer report',
            },
          ],
          provenance: {
            status: 'sourced',
            citationCount: 1,
          },
          claims: [],
          missingData: [],
          data: expect.objectContaining({
            recommendation: expect.objectContaining({
              status: 'adjust_messaging',
            }),
          }),
        },
        durationMs: 0,
        completedAt: expect.any(String),
      },
      strategicSynthesis: {
        status: 'complete',
        section: 'strategicSynthesis',
        data: {
          content: 'Strategic synthesis narrative.',
          fileIds: ['strategy-file'],
          citations: [],
          provenance: {
            status: 'missing',
            citationCount: 0,
          },
          claims: [],
          missingData: [],
          data: expect.objectContaining({
            recommendedPositioning: 'Own the fastest path to revenue visibility.',
          }),
        },
        durationMs: 0,
        completedAt: expect.any(String),
      },
    });
  });

  it('preserves structured citations and provenance for generateResearch outputs', () => {
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
            output: {
              status: 'complete',
              sectionId: 'industryResearch',
              content: 'Market size remains stable.',
              citations: [
                {
                  number: 1,
                  url: 'https://example.com/report',
                  title: 'Industry report',
                },
              ],
              provenance: {
                status: 'sourced',
                citationCount: 1,
              },
              fileIds: ['file-1'],
            },
          },
        ],
      } as UIMessage,
    ];

    expect(extractResearchOutputs(messages)).toEqual({
      industryResearch: {
        status: 'complete',
        section: 'industryResearch',
        data: {
          content: 'Market size remains stable.',
          fileIds: ['file-1'],
          citations: [
            {
              number: 1,
              url: 'https://example.com/report',
              title: 'Industry report',
            },
          ],
          provenance: {
            status: 'sourced',
            citationCount: 1,
          },
          claims: [],
          missingData: [],
        },
        durationMs: 0,
        completedAt: expect.any(String),
      },
    });
  });

  it('derives visible citations from markdown footnotes when structured metadata is missing', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-2',
            input: { sectionId: 'competitorIntel' },
            output: {
              status: 'complete',
              sectionId: 'competitorIntel',
              content:
                'Competitor pressure is rising.\n\n[1]: https://example.com/competitor-report Competitor report',
              fileIds: [],
            },
          },
        ],
      } as UIMessage,
    ];

    expect(extractResearchOutputs(messages)).toEqual({
      competitorIntel: {
        status: 'complete',
        section: 'competitorIntel',
        data: {
          content:
            'Competitor pressure is rising.\n\n[1]: https://example.com/competitor-report Competitor report',
          fileIds: [],
          citations: [
            {
              number: 1,
              url: 'https://example.com/competitor-report',
              title: 'Competitor report',
            },
          ],
          provenance: {
            status: 'sourced',
            citationCount: 1,
          },
          claims: [],
          missingData: [],
        },
        durationMs: 0,
        completedAt: expect.any(String),
      },
    });
  });

  it('preserves the original completion timestamp and supports stringified tool outputs', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-3',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-3',
            input: { sectionId: 'strategicSynthesis' },
            output: JSON.stringify({
              status: 'complete',
              sectionId: 'strategicSynthesis',
              content: 'Strategic direction is clear.\n\n[1]: https://example.com/strategy Strategy memo',
              completedAt: '2026-03-07T00:00:00.000Z',
              fileIds: ['file-2'],
            }),
          },
        ],
      } as UIMessage,
    ];

    expect(extractResearchOutputs(messages)).toEqual({
      strategicSynthesis: {
        status: 'complete',
        section: 'strategicSynthesis',
        data: {
          content:
            'Strategic direction is clear.\n\n[1]: https://example.com/strategy Strategy memo',
          fileIds: ['file-2'],
          citations: [
            {
              number: 1,
              url: 'https://example.com/strategy',
              title: 'Strategy memo',
            },
          ],
          provenance: {
            status: 'sourced',
            citationCount: 1,
          },
          claims: [],
          missingData: [],
        },
        durationMs: 0,
        completedAt: '2026-03-07T00:00:00.000Z',
      },
    });
  });
});

describe('chat confirmation helpers', () => {
  it('extracts explicitly confirmed fields from confirmJourneyFields tool outputs', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-confirm-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-confirmJourneyFields',
            state: 'output-available',
            toolCallId: 'confirm-1',
            output: {
              status: 'confirmed',
              fields: [
                {
                  fieldName: 'businessModel',
                  value: 'B2B SaaS',
                },
              ],
            },
          },
        ],
      } as UIMessage,
    ];

    expect(extractConfirmedJourneyFields(messages)).toEqual({
      businessModel: 'B2B SaaS',
    });
  });

  it('auto-confirms a single recently-presented proposal when the user clearly affirms it', () => {
    let state = createEmptyState();
    state = setProposedField(state, 'businessModel', 'B2B SaaS', {
      source: 'prefill',
      confidence: 89,
      reasoning: 'Found in the homepage hero section.',
    });

    const messages: UIMessage[] = [
      {
        id: 'assistant-confirm-2',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: "Looks like you're a B2B SaaS company.",
          },
        ],
      } as UIMessage,
      {
        id: 'user-confirm-2',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Yes, that is right.',
          },
        ],
      } as UIMessage,
    ];

    const next = applyAutoDetectedChatConfirmation(state, messages);

    expect(next.businessModel).toBe('B2B SaaS');
    expect(next.fieldMeta.businessModel?.status).toBe('confirmed');
    expect(next.fieldMeta.businessModel?.verifiedBy).toBe('chat-confirmation');
    expect(next.proposals.businessModel).toBeUndefined();
  });

  it('does not auto-confirm when the assistant message appears to confirm multiple proposals', () => {
    let state = createEmptyState();
    state = setProposedField(state, 'businessModel', 'B2B SaaS', {
      source: 'prefill',
      confidence: 89,
      reasoning: 'Found in the homepage hero section.',
    });
    state = setProposedField(state, 'industryVertical', 'Fintech', {
      source: 'prefill',
      confidence: 82,
      reasoning: 'Found in the pricing and homepage copy.',
    });

    const messages: UIMessage[] = [
      {
        id: 'assistant-confirm-3',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: "Looks like you're B2B SaaS in fintech.",
          },
        ],
      } as UIMessage,
      {
        id: 'user-confirm-3',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Yes.',
          },
        ],
      } as UIMessage,
    ];

    const next = applyAutoDetectedChatConfirmation(state, messages);

    expect(next.businessModel).toBeNull();
    expect(next.industryVertical).toBeNull();
    expect(next.fieldMeta.businessModel?.status).toBe('proposed');
    expect(next.fieldMeta.industryVertical?.status).toBe('proposed');
  });
});
