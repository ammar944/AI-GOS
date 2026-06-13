import { describe, expect, it } from 'vitest';

import {
  STRATEGY_BRIEF_SECTION_ID,
  strategyBriefArtifactSchema,
} from '../schema';

const validBrief = {
  sectionTitle: 'Offer & Angle Brief',
  verdict:
    'Lead with the AI cold-caller reframe; talk-time billing is the primary USP.',
  statusSummary: 'Drafted from 6 committed sections. 2 gaps flagged.',
  confidence: 0.7,
  sources: [{ title: 'VoC section', url: 'https://app.internal/run/x#voc' }],
  body: {
    positioning: {
      oneLiner: 'The first AI cold caller for real estate and insurance.',
      valueProp: 'Dials every lead you paid for; you only pay for talk time.',
      mechanism:
        'AI outbound agent + workflow loop connecting inbound, outbound, follow-up.',
    },
    angles: [
      {
        name: 'You Paid for the Leads. The AI Calls Them.',
        vignette: 'An agent buys 200 leads and works 30; the rest go cold.',
        coreEmotion: 'wasted-spend indignation',
        adFrame: 'Lead with the lost-lead moment, not the product.',
        rank: 1,
        sourceEvidence: ['positioningVoiceOfCustomer'],
      },
    ],
    lexicon: {
      approved: ['AI cold caller', 'talk time'],
      banned: [
        {
          term: 'AI receptionist',
          reason: 'Every competitor says it; undersells outbound.',
        },
      ],
    },
    funnelStance:
      'Phase 1 instant form to calendar; Phase 2 LP test gated on lead quality.',
    gaps: [],
    changelog: [
      {
        revision: 1,
        summary: 'Initial draft',
        rationale: 'Composed from committed sections',
        at: '2026-06-12T00:00:00.000Z',
      },
    ],
  },
};

describe('strategyBriefArtifactSchema', (): void => {
  it('accepts a valid brief', (): void => {
    expect(strategyBriefArtifactSchema.safeParse(validBrief).success).toBe(
      true,
    );
  });

  it('rejects a brief without angles or changelog', (): void => {
    const bad = {
      ...validBrief,
      body: { ...validBrief.body, angles: [], changelog: [] },
    };

    expect(strategyBriefArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('exports the section id', (): void => {
    expect(STRATEGY_BRIEF_SECTION_ID).toBe('strategyBrief');
  });
});
