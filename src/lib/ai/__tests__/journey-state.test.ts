import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { parseCollectedFields } from '../journey-state';

function makeTextMessage(text: string): UIMessage {
  return {
    id: `msg-${text.slice(0, 12)}`,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

function makeAskUserResultMessage(
  fieldName: string,
  value: unknown,
): UIMessage {
  return {
    id: `ask-${fieldName}`,
    role: 'assistant',
    parts: [
      {
        type: 'tool-askUser',
        state: 'output-available',
        toolCallId: `call-${fieldName}`,
        toolName: 'askUser',
        input: { fieldName, options: [] },
        output: value,
      } as unknown as UIMessage['parts'][number],
    ],
  };
}

describe('parseCollectedFields', () => {
  it('returns an empty snapshot for no messages', () => {
    const snapshot = parseCollectedFields([]);

    expect(snapshot.collectedFields).toEqual({});
    expect(snapshot.requiredFieldCount).toBe(0);
    expect(snapshot.synthComplete).toBe(false);
    expect(snapshot.keywordResearchComplete).toBe(false);
    expect(snapshot.mediaPlanComplete).toBe(false);
    expect(snapshot.strategistModeReady).toBe(false);
    expect(snapshot.competitorFastHitsCalledFor.size).toBe(0);
  });

  it('extracts accepted prefill fields using the current field-catalog labels', () => {
    const snapshot = parseCollectedFields([
      makeTextMessage(`Here's what I found about the company:
Company Name: Acme
Business Model: B2B SaaS
Product Description: Pipeline growth programs for B2B SaaS teams
Top Competitors: KlientBoost, Directive
Ideal Customer Profile: Series A-B SaaS companies with lean GTM teams
Pricing Tiers: Starter $4k/mo, Growth $8k/mo
Goals: More qualified demos
Unique Edge: SaaS-only positioning with pipeline attribution
Please use this context and begin the research journey.`),
    ]);

    expect(snapshot.collectedFields).toMatchObject({
      companyName: 'Acme',
      businessModel: 'B2B SaaS',
      productDescription: 'Pipeline growth programs for B2B SaaS teams',
      topCompetitors: 'KlientBoost, Directive',
      primaryIcpDescription: 'Series A-B SaaS companies with lean GTM teams',
      pricingTiers: 'Starter $4k/mo, Growth $8k/mo',
      goals: 'More qualified demos',
      uniqueEdge: 'SaaS-only positioning with pipeline attribution',
    });
    expect(snapshot.requiredFieldCount).toBe(7);
  });

  it('counts pricing context when only monthly ad budget is present', () => {
    const snapshot = parseCollectedFields([
      makeTextMessage(`Here's what I found about the company:
Business Model: B2B SaaS
Product Description: Paid media for SaaS
Top Competitors: Hey Digital
Ideal Customer Profile: Series A SaaS leaders
Monthly Ad Budget: $15,000/month
Goals: Lower CAC
Unique Edge: SaaS-native demand gen`),
    ]);

    expect(snapshot.requiredFieldCount).toBe(7);
    expect(snapshot.collectedFields.monthlyAdBudget).toBe('$15,000/month');
    expect(snapshot.collectedFields.pricingTiers).toBeUndefined();
  });

  it('lets explicit askUser results override accepted prefill values', () => {
    const snapshot = parseCollectedFields([
      makeTextMessage(`Here's what I found about the company:
Business Model: Agency / Services
Goals: More leads`),
      makeAskUserResultMessage('businessModel', 'B2B SaaS'),
      makeAskUserResultMessage('goals', 'Lower CAC'),
    ]);

    expect(snapshot.collectedFields.businessModel).toBe('B2B SaaS');
    expect(snapshot.collectedFields.goals).toBe('Lower CAC');
  });

  it('detects synth completion from a completed synthesizeResearch tool part', () => {
    const snapshot = parseCollectedFields([
      {
        id: 'synth',
        role: 'assistant',
        parts: [
          {
            type: 'tool-synthesizeResearch',
            state: 'output-available',
            toolCallId: 'call-synth',
            toolName: 'synthesizeResearch',
            input: { context: '...' },
            output: { status: 'complete', section: 'crossAnalysis' },
          } as unknown as UIMessage['parts'][number],
        ],
      },
    ]);

    expect(snapshot.synthComplete).toBe(true);
  });

  it('unlocks Strategist Mode once keyword intel completes', () => {
    const snapshot = parseCollectedFields([
      {
        id: 'synth-and-keywords',
        role: 'assistant',
        parts: [
          {
            type: 'tool-synthesizeResearch',
            state: 'output-available',
            toolCallId: 'call-synth',
            toolName: 'synthesizeResearch',
            input: { context: '...' },
            output: { status: 'complete', section: 'strategicSynthesis' },
          } as unknown as UIMessage['parts'][number],
          {
            type: 'tool-researchKeywords',
            state: 'output-available',
            toolCallId: 'call-keywords',
            toolName: 'researchKeywords',
            input: { context: '...' },
            output: { status: 'complete', section: 'keywordIntel' },
          } as unknown as UIMessage['parts'][number],
        ],
      },
    ]);

    expect(snapshot.synthComplete).toBe(true);
    expect(snapshot.keywordResearchComplete).toBe(true);
    expect(snapshot.mediaPlanComplete).toBe(false);
    expect(snapshot.strategistModeReady).toBe(true);
  });

  it('keeps Strategist Mode ready when a legacy media plan completion exists', () => {
    const snapshot = parseCollectedFields([
      {
        id: 'downstream-complete',
        role: 'assistant',
        parts: [
          {
            type: 'tool-synthesizeResearch',
            state: 'output-available',
            toolCallId: 'call-synth',
            toolName: 'synthesizeResearch',
            input: { context: '...' },
            output: { status: 'complete', section: 'strategicSynthesis' },
          } as unknown as UIMessage['parts'][number],
          {
            type: 'tool-researchKeywords',
            state: 'output-available',
            toolCallId: 'call-keywords',
            toolName: 'researchKeywords',
            input: { context: '...' },
            output: { status: 'complete', section: 'keywordIntel' },
          } as unknown as UIMessage['parts'][number],
          {
            type: 'tool-researchMediaPlan',
            state: 'output-available',
            toolCallId: 'call-media-plan',
            toolName: 'researchMediaPlan',
            input: { context: '...' },
            output: { status: 'complete', section: 'mediaPlan' },
          } as unknown as UIMessage['parts'][number],
        ],
      },
    ]);

    expect(snapshot.mediaPlanComplete).toBe(true);
    expect(snapshot.strategistModeReady).toBe(true);
  });
});

describe('competitorFastHitsCalledFor', () => {
  it('tracks completed and in-flight competitorFastHits calls', () => {
    const snapshot = parseCollectedFields([
      {
        id: 'done',
        role: 'assistant',
        parts: [
          {
            type: 'tool-competitorFastHits',
            state: 'output-available',
            toolCallId: 'done-call',
            toolName: 'competitorFastHits',
            input: { competitorUrl: 'HubSpot.COM' },
            output: { status: 'complete' },
          } as unknown as UIMessage['parts'][number],
        ],
      },
      {
        id: 'running',
        role: 'assistant',
        parts: [
          {
            type: 'tool-competitorFastHits',
            state: 'input-available',
            toolCallId: 'running-call',
            toolName: 'competitorFastHits',
            input: { competitorUrl: 'pagerduty.com' },
          } as unknown as UIMessage['parts'][number],
        ],
      },
    ]);

    expect(snapshot.competitorFastHitsCalledFor.has('hubspot.com')).toBe(true);
    expect(snapshot.competitorFastHitsCalledFor.has('pagerduty.com')).toBe(true);
  });
});
