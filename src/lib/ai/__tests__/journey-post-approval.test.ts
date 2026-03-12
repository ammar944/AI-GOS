import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { parseCollectedFields } from '../journey-state';
import {
  getPostApprovalPlan,
  getPostCompetitorPlan,
} from '../journey-post-approval';

function makeUserTextMessage(text: string): UIMessage {
  return {
    id: `user-${Math.random()}`,
    role: 'user',
    parts: [
      {
        type: 'text',
        text,
      } as unknown as UIMessage['parts'][number],
    ],
  } as UIMessage;
}

describe('parseCollectedFields with accepted prefill context', () => {
  it('extracts accepted prefill fields from the kickoff message', () => {
    const snapshot = parseCollectedFields([
      makeUserTextMessage(`Here's what I found about the company:
Company Name: SaaSLaunch
Business Model: Agency / Services
Industry Vertical: B2B SaaS Marketing
Product Description: Full-funnel growth systems

Please use this context and begin the research journey.`),
    ]);

    expect(snapshot.collectedFields.companyName).toBe('SaaSLaunch');
    expect(snapshot.collectedFields.businessModel).toBe('Agency / Services');
    expect(snapshot.collectedFields.industryVertical).toBe('B2B SaaS Marketing');
    expect(snapshot.collectedFields.productDescription).toBe('Full-funnel growth systems');
  });
});

describe('getPostApprovalPlan', () => {
  it('asks for competitors first when wave-two context is still missing', () => {
    const snapshot = parseCollectedFields([
      makeUserTextMessage(`Here's what I found about the company:
Business Model: Agency / Services
Ideal Customer Profile: B2B SaaS founders

Please use this context and begin the research journey.`),
    ]);

    expect(getPostApprovalPlan(snapshot)).toEqual({
      missingInputs: ['competitors', 'product description', 'pricing or budget'],
      nextField: 'topCompetitors',
      nextWaveReady: false,
    });
  });

  it('marks the next wave ready once competitors and pricing context exist', () => {
    const snapshot = parseCollectedFields([
      makeUserTextMessage(`Here's what I found about the company:
Business Model: Agency / Services
Ideal Customer Profile: B2B SaaS founders
Product Description: Paid media growth systems for SaaS
Top Competitors: Refine Labs, Kalungi
Pricing Tiers: Retainer-based packages

Please use this context and begin the research journey.`),
    ]);

    expect(getPostApprovalPlan(snapshot)).toEqual({
      missingInputs: [],
      nextField: null,
      nextWaveReady: true,
    });
  });

  it('treats accepted monthly budget as valid pricing context', () => {
    const snapshot = parseCollectedFields([
      makeUserTextMessage(`Here's what I found about the company:
Business Model: Agency / Services
Ideal Customer Profile: B2B SaaS founders
Product Description: Paid media growth systems for SaaS
Top Competitors: Refine Labs, Kalungi
Monthly Ad Budget: $12,000
Goals: Generate more qualified demos

Please use this context and begin the research journey.`),
    ]);

    expect(getPostApprovalPlan(snapshot)).toEqual({
      missingInputs: [],
      nextField: null,
      nextWaveReady: true,
    });
  });

  it('asks for pricing first after competitors are already shared', () => {
    const snapshot = parseCollectedFields([
      makeUserTextMessage(`Here's what I found about the company:
Business Model: Agency / Services
Product Description: Paid media growth systems for SaaS
Ideal Customer Profile: B2B SaaS founders

Please use this context and begin the research journey.`),
    ]);

    expect(getPostCompetitorPlan(snapshot)).toEqual({
      missingInputs: ['pricing or budget'],
      nextField: 'pricingContext',
      nextWaveReady: false,
    });
  });

  it('asks for product description before pricing if competitor context exists but the offer is unclear', () => {
    const snapshot = parseCollectedFields([
      makeUserTextMessage(`Here's what I found about the company:
Business Model: Agency / Services
Ideal Customer Profile: B2B SaaS founders
Top Competitors: Refine Labs, Kalungi

Please use this context and begin the research journey.`),
    ]);

    expect(getPostApprovalPlan(snapshot)).toEqual({
      missingInputs: ['product description', 'pricing or budget'],
      nextField: 'productDescription',
      nextWaveReady: false,
    });
  });
});
