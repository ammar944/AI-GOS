import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  parseStrategyBriefForRender,
  StrategyBriefCard,
} from '../strategy-brief-card';

function validStrategyBrief(): Record<string, unknown> {
  return {
    sectionTitle: 'Offer & Angle Brief',
    verdict: 'Lead with accountable revenue meetings.',
    statusSummary: 'Ready for media planning.',
    confidence: 0.82,
    sources: [{ title: 'Fellow', url: 'https://fellow.app' }],
    body: {
      positioning: {
        oneLiner: 'Fellow keeps revenue meetings accountable.',
        valueProp: 'Turn meeting chaos into owned execution.',
        mechanism: 'Shared agendas, notes, and follow-up ownership.',
      },
      angles: [
        {
          name: 'The dropped handoff',
          vignette: 'I left the meeting without a clear owner.',
          coreEmotion: 'frustration',
          adFrame: 'Open on the missed follow-up.',
          rank: 1,
          sourceEvidence: ['positioningVoiceOfCustomer'],
        },
      ],
      lexicon: {
        approved: ['accountability'],
        banned: [{ term: 'AI meeting copilot', reason: 'Too generic.' }],
      },
      funnelStance: 'Demand capture first.',
      gaps: [],
      changelog: [
        {
          revision: 1,
          summary: 'Initial brief.',
          rationale: 'Six committed sections were available.',
          at: '2026-06-13T00:00:00.000Z',
        },
      ],
    },
  };
}

describe('StrategyBriefCard', () => {
  it('normalizes body fields onto the generic renderer surface', () => {
    const renderable = parseStrategyBriefForRender(validStrategyBrief());

    expect(renderable).toMatchObject({
      sectionTitle: 'Offer & Angle Brief',
      positioning: {
        oneLiner: 'Fellow keeps revenue meetings accountable.',
      },
      lexicon: {
        approved: ['accountability'],
      },
    });
    expect(renderable).not.toHaveProperty('body');
  });

  it('renders the strategy brief label and normalized sections', () => {
    render(<StrategyBriefCard artifact={validStrategyBrief()} />);

    expect(screen.getByText('Offer & Angle Brief')).toBeInTheDocument();
    expect(
      screen.getByText('Lead with accountable revenue meetings.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Positioning')).toBeInTheDocument();
    expect(screen.getAllByText('Angles').length).toBeGreaterThan(0);
    expect(screen.getByText('Lexicon')).toBeInTheDocument();
  });
});
