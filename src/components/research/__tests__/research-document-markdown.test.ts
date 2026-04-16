import { describe, it, expect } from 'vitest';
import { cardToMarkdown } from '../research-document';
import type { CardState } from '@/lib/workspace/types';

function makeCard(cardType: string, content: Record<string, unknown>): CardState {
  return {
    id: 'test',
    sectionKey: 'industryMarket',
    cardType,
    label: 'Test',
    content,
    status: 'draft',
    versions: [],
  };
}

describe('cardToMarkdown — consolidated array cards (regression)', () => {
  it('trend-card iterates c.trends array (was rendering "undefined (undefined)")', () => {
    const out = cardToMarkdown(
      makeCard('trend-card', {
        trends: [
          { trend: 'Shift to privacy-first AI', direction: 'rising', evidence: 'EU AI Act Aug 2026' },
          { trend: 'Calendar-native adoption', direction: 'stable', evidence: '92% adoption rate' },
        ],
      }),
    ).join('\n');
    expect(out).toContain('Shift to privacy-first AI');
    expect(out).toContain('(rising)');
    expect(out).toContain('EU AI Act Aug 2026');
    expect(out).not.toContain('undefined');
  });

  it('gap-card iterates c.gaps array (White-Space Gaps)', () => {
    const out = cardToMarkdown(
      makeCard('gap-card', {
        gaps: [
          { gap: 'Compliance urgency', type: 'messaging', evidence: 'Lawsuit spike', recommendedAction: 'Run retargeting' },
        ],
      }),
    ).join('\n');
    expect(out).toContain('Compliance urgency');
    expect(out).toContain('(messaging)');
    expect(out).toContain('Evidence: Lawsuit spike');
    expect(out).toContain('Action: Run retargeting');
  });

  it('flag-card iterates c.flags array (Red Flags)', () => {
    const out = cardToMarkdown(
      makeCard('flag-card', {
        flags: [
          { issue: 'Budget too thin', severity: 'high', priority: 1, evidence: '$5K/mo', recommendedAction: 'Shift to retargeting' },
        ],
      }),
    ).join('\n');
    expect(out).toContain('Budget too thin');
    expect(out).toContain('high');
    expect(out).toContain('P1');
    expect(out).toContain('Evidence: $5K/mo');
  });

  it('insight-card iterates c.insights array (Key Insights)', () => {
    const out = cardToMarkdown(
      makeCard('insight-card', {
        insights: [
          { insight: 'Compliance-triggered leads close at 18%', source: 'icp', implication: 'Fast-track these' },
        ],
      }),
    ).join('\n');
    expect(out).toContain('Compliance-triggered leads close at 18%');
    expect(out).toContain('(icp)');
    expect(out).toContain('Implication: Fast-track these');
  });

  it('angle-card iterates c.angles array (Messaging Angles)', () => {
    const out = cardToMarkdown(
      makeCard('angle-card', {
        angles: [
          { angle: 'Security review blocks tool', exampleHook: 'Your IT team flagged it', evidence: '18% close rate' },
        ],
      }),
    ).join('\n');
    expect(out).toContain('Security review blocks tool');
    expect(out).toContain('Hook: Your IT team flagged it');
    expect(out).toContain('Evidence: 18% close rate');
  });

  it('bullet-list renders c.groups (Market Dynamics consolidated groups)', () => {
    const out = cardToMarkdown(
      makeCard('bullet-list', {
        groups: [
          { group: 'Demand Drivers', items: ['EU AI Act', 'HIPAA audits'] },
          { group: 'Buying Triggers', items: ['Security review blocks free tool'] },
        ],
      }),
    ).join('\n');
    expect(out).toContain('**Demand Drivers**');
    expect(out).toContain('- EU AI Act');
    expect(out).toContain('**Buying Triggers**');
    expect(out).toContain('- Security review blocks free tool');
  });

  it('review-cross-analysis-card renders c.commonWeaknesses (was missing case entirely)', () => {
    const out = cardToMarkdown(
      makeCard('review-cross-analysis-card', {
        commonWeaknesses: [
          {
            theme: 'Billing complaints',
            affectedCompetitors: ['Otter', 'Fireflies'],
            frequency: 5,
            exampleQuote: 'Charged without consent',
            leverageAngle: 'Transparent pricing guarantee',
          },
        ],
      }),
    ).join('\n');
    expect(out).toContain('Billing complaints');
    expect(out).toContain('Otter, Fireflies');
    expect(out).toContain('5× frequency');
    expect(out).toContain('Charged without consent');
    expect(out).toContain('Transparent pricing guarantee');
  });

  it('trend-card with empty trends array renders nothing (no "undefined")', () => {
    const out = cardToMarkdown(makeCard('trend-card', { trends: [] })).join('\n');
    expect(out).toBe('');
  });
});
