/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VoiceOfCustomerRenderer } from '../voice-of-customer';
import type { VoiceOfCustomerArtifact } from '@/lib/managed-agents/schemas/voc-objection-evidence';

const fixture: VoiceOfCustomerArtifact = {
  sectionTitle: 'Voice of Customer — TestCo',
  verdict: 'Pricing complaints dominate but success-state language is rich.',
  statusSummary: 'Strong signal, converges on cost vs value.',
  confidence: 7.5,
  sources: [
    { title: 'G2 reviews', url: 'https://www.g2.com/products/testco/reviews', whyItMatters: 'pain' },
    { title: 'Reddit', url: 'https://reddit.com/r/test', whyItMatters: 'pain' },
    { title: 'Capterra', url: 'https://capterra.com/testco', whyItMatters: 'objection' },
    { title: 'Customer stories', url: 'https://testco.com/customers', whyItMatters: 'success' },
    { title: 'HN', url: 'https://news.ycombinator.com/from?site=testco.com', whyItMatters: 'meta' },
  ],
  painLanguage: {
    prose: 'Buyers complain about per-seat pricing first.\n\nReporting depth is a secondary theme.',
    quotes: [
      {
        verbatimText: 'Pricing scales painfully with team size.',
        source: 'g2',
        sourceUrl: 'https://www.g2.com/products/testco/reviews/1',
        painTheme: 'Per-seat pricing',
        painIntensity: 'high',
      },
      {
        verbatimText: 'Reporting is shallow without Pro tier.',
        source: 'reddit',
        sourceUrl: 'https://reddit.com/r/test/comments/abc',
        painTheme: 'Reporting depth',
        painIntensity: 'medium',
      },
      {
        verbatimText: 'Mobile app feels like an afterthought.',
        source: 'hackernews',
        sourceUrl: 'https://news.ycombinator.com/item?id=123',
        painTheme: 'Mobile experience',
        painIntensity: 'low',
      },
    ],
  },
  objections: {
    prose: 'Objections cluster into price, feature, and switching cost.',
    items: [
      {
        objectionText: 'Per-seat pricing plus minimums means real cost is 2-3× sticker.',
        category: 'price',
        frequency: 'recurring',
        howToHandle: 'Lead with annualized total cost including required tier.',
        sourceUrl: 'https://www.g2.com/products/testco/reviews/2',
      },
      {
        objectionText: 'Reporting depth is too shallow for our BI needs.',
        category: 'feature',
        frequency: 'occasional',
        howToHandle: 'Position TestCo as system-of-record with BI downstream.',
        sourceUrl: 'https://capterra.com/testco/r/3',
      },
      {
        objectionText: 'Migrating from Jira and retraining is more painful than the upside.',
        category: 'switching-cost',
        frequency: 'recurring',
        howToHandle: 'Offer parallel-run pilot with white-glove import.',
        sourceUrl: 'https://reddit.com/r/test/comments/def',
      },
    ],
  },
  switchingStories: {
    prose: 'Switching narratives originate from Asana, Trello, and Jira most often.',
    stories: [
      {
        priorSolution: 'Asana',
        reasonToLeave: 'Hit a ceiling on customization of views and statuses.',
        decisionPath: 'Marketing ops champion ran trial → 25-seat Standard → Pro rollout.',
        exampleCompany: 'Referenced in customer stories.',
        sourceUrl: 'https://testco.com/customers/asana-switch',
      },
      {
        priorSolution: 'Trello',
        reasonToLeave: 'Outgrew Kanban-only paradigm; needed dependencies and timeline.',
        decisionPath: 'PMO lead trialed alongside Trello → migrated boards → consolidated.',
        sourceUrl: 'https://reddit.com/r/test/comments/trello',
      },
      {
        priorSolution: 'Jira',
        reasonToLeave: 'Jira was hostile to non-engineering stakeholders.',
        decisionPath: 'PM lead built parallel views → moved cross-functional work first.',
        exampleCompany: 'TestCo customer case study.',
        sourceUrl: 'https://testco.com/customers/jira-switch',
      },
    ],
  },
  decisionCriteria: {
    prose: 'Decision criteria are typically stated by champions and blockers.',
    criteria: [
      {
        criterion: 'Visual, color-coded views',
        statedBy: 'champion',
        evidenceQuote: 'We needed boards we could see at a glance.',
        sourceUrl: 'https://www.g2.com/products/testco/reviews/4',
      },
      {
        criterion: 'SSO and audit logs required',
        statedBy: 'blocker',
        evidenceQuote: 'Without SSO we cannot pass security review.',
        sourceUrl: 'https://capterra.com/testco/r/5',
      },
      {
        criterion: 'Per-seat budget must fit current line item',
        statedBy: 'buyer',
        evidenceQuote: 'We have a finance cap of $20 per seat.',
        sourceUrl: 'https://reddit.com/r/test/comments/budget',
      },
      {
        criterion: 'Cross-functional visibility',
        statedBy: 'influencer',
        evidenceQuote: 'I want one place to see marketing and product work.',
        sourceUrl: 'https://testco.com/customers/cross-functional',
      },
    ],
  },
  successLanguage: {
    prose: 'Success language centers on visibility and alignment.',
    quotes: [
      {
        verbatimText: 'We can finally see everything in one place.',
        source: 'g2',
        sourceUrl: 'https://www.g2.com/products/testco/reviews/6',
        afterStatePattern: 'Single source of truth across teams',
      },
      {
        verbatimText: 'Our standups got 30 minutes shorter.',
        source: 'reddit',
        sourceUrl: 'https://reddit.com/r/test/comments/standup',
        afterStatePattern: 'Time saved in routine syncs',
      },
      {
        verbatimText: 'Leadership finally trusts the roadmap.',
        source: 'other',
        sourceUrl: 'https://testco.com/customers/roadmap-trust',
        afterStatePattern: 'Executive confidence in delivery',
      },
    ],
  },
};

describe('VoiceOfCustomerRenderer', () => {
  it('renders 5 sub-section blocks with the canonical labels 1-5', () => {
    render(<VoiceOfCustomerRenderer artifact={fixture} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('1 · Pain Language');
    expect(blocks[1]).toHaveTextContent('2 · Objections');
    expect(blocks[2]).toHaveTextContent('3 · Switching Stories');
    expect(blocks[3]).toHaveTextContent('4 · Decision Criteria');
    expect(blocks[4]).toHaveTextContent('5 · Success Language');
  });

  it('renders >=3 pain quotes with voc-quote testid', () => {
    render(<VoiceOfCustomerRenderer artifact={fixture} />);
    const quotes = screen.getAllByTestId('voc-quote');
    expect(quotes.length).toBeGreaterThanOrEqual(3);
    expect(quotes[0]).toHaveTextContent('Pricing scales painfully');
    expect(quotes[0]).toHaveTextContent('Per-seat pricing');
    expect(quotes[0]).toHaveTextContent(/high/i);
  });

  it('renders >=3 objection rows with objection-item testid', () => {
    render(<VoiceOfCustomerRenderer artifact={fixture} />);
    const objections = screen.getAllByTestId('objection-item');
    expect(objections.length).toBeGreaterThanOrEqual(3);
    expect(objections[0]).toHaveTextContent('Per-seat pricing');
    expect(objections[0]).toHaveTextContent(/price/i);
    expect(objections[0]).toHaveTextContent(/recurring/i);
  });

  it('renders >=3 switching rows with switching-item testid', () => {
    render(<VoiceOfCustomerRenderer artifact={fixture} />);
    const switching = screen.getAllByTestId('switching-item');
    expect(switching.length).toBeGreaterThanOrEqual(3);
    expect(switching[0]).toHaveTextContent('Asana');
    expect(switching[0]).toHaveTextContent('ceiling on customization');
  });

  it('renders >=3 decision criterion rows with criterion-item testid', () => {
    render(<VoiceOfCustomerRenderer artifact={fixture} />);
    const criteria = screen.getAllByTestId('criterion-item');
    expect(criteria.length).toBeGreaterThanOrEqual(3);
    expect(criteria[0]).toHaveTextContent('Visual, color-coded views');
    expect(criteria[0]).toHaveTextContent(/champion/i);
  });

  it('renders >=3 success quotes with success-quote testid (distinct from voc-quote)', () => {
    render(<VoiceOfCustomerRenderer artifact={fixture} />);
    const success = screen.getAllByTestId('success-quote');
    expect(success.length).toBeGreaterThanOrEqual(3);
    expect(success[0]).toHaveTextContent('finally see everything');
    expect(success[0]).toHaveTextContent('after-state');
    expect(success[0]).toHaveTextContent('Single source of truth');

    // Pain quotes and success quotes are distinct testid namespaces.
    const pain = screen.queryAllByTestId('voc-quote');
    expect(pain.length).toBeGreaterThanOrEqual(3);
    expect(success).not.toEqual(expect.arrayContaining(pain));
  });
});
