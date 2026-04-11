import { describe, it, expect } from 'vitest';
import { buildSalesCallIntelligenceBlock } from '../context-block';
import type { SalesCallInsights, FathomCallMeta } from '../types';

const MOCK_META: FathomCallMeta = {
  recordingId: 12345,
  shareUrl: 'https://fathom.video/share/abc123',
  title: 'Discovery Call — Acme Corp',
  date: '2026-04-03T14:00:00Z',
  durationSeconds: 2520,
  attendees: [{ name: 'Alice', email: 'alice@acme.com', isExternal: true }],
  summary: null,
  actionItems: [],
  documentId: 'doc-1',
  status: 'ready',
};

const MOCK_INSIGHTS: SalesCallInsights = {
  businessHealthSummary: 'Growing 30% YoY but CAC doubled',
  callType: 'discovery',
  painPoints: [{ pain: 'Cannot track ROAS', severity: 'critical', quote: 'We have no idea what works' }],
  budgetSignals: { mentionedSpend: '$15K/mo', priceSensitivity: 'low', quotes: [] },
  competitorMentions: [{ name: 'HubSpot', sentiment: 'negative', context: 'Too expensive' }],
  buyingTriggers: [{ trigger: 'Q2 board pressure', urgency: 'immediate' }],
  objections: [],
  icpSignals: { role: 'VP Marketing', industry: 'B2B SaaS' },
  currentMarketing: { channels: ['Google Ads', 'LinkedIn'], monthlySpend: '$15K', quotes: [] },
  goalsAndOutcomes: { primaryGoal: '50 demos/month', quotes: [] },
  notableQuotes: [],
};

describe('buildSalesCallIntelligenceBlock', () => {
  it('renders a structured context block', () => {
    const block = buildSalesCallIntelligenceBlock(MOCK_META, MOCK_INSIGHTS);
    expect(block).toContain('SALES CALL INTELLIGENCE');
    expect(block).toContain('Discovery Call — Acme Corp');
    expect(block).toContain('Cannot track ROAS');
    expect(block).toContain('$15K/mo');
    expect(block).toContain('HubSpot');
    expect(block).toContain('Q2 board pressure');
    expect(block).toContain('Google Ads');
    expect(block).toContain('50 demos/month');
    expect(block).toContain('Growing 30% YoY');
    expect(block).toContain('END SALES CALL INTELLIGENCE');
  });

  it('handles empty categories gracefully', () => {
    const emptyInsights: SalesCallInsights = {
      businessHealthSummary: 'No details shared',
      callType: 'other',
      painPoints: [],
      budgetSignals: { priceSensitivity: 'medium', quotes: [] },
      competitorMentions: [],
      buyingTriggers: [],
      objections: [],
      icpSignals: {},
      currentMarketing: { channels: [], quotes: [] },
      goalsAndOutcomes: { quotes: [] },
      notableQuotes: [],
    };
    const block = buildSalesCallIntelligenceBlock(MOCK_META, emptyInsights);
    expect(block).toContain('SALES CALL INTELLIGENCE');
    expect(block).toContain('No details shared');
  });
});
