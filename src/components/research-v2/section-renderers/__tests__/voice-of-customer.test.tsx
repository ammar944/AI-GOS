/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  VoiceOfCustomerRenderer,
  isVoiceOfCustomerHonestlyUnavailable,
} from '../voice-of-customer';
import type { VoiceOfCustomerArtifact } from '@/types/positioning-artifact';

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
  strategicInsight: {
    strategicVerdict:
      'TestCo should treat price anxiety as the visible objection and switching confidence as the real blocker.',
    nonObviousRead:
      'The pricing complaint is a proxy for uncertainty that teams will actually reach the promised after-state.',
    secondOrderImplication:
      'VoC-backed copy should prove migration confidence before defending the sticker price.',
    keyTension: {
      tension:
        'Buyers want richer workflow value but fear the implementation cost will erase the gain.',
      side:
        'Take the migration-confidence side and make switching proof more prominent than feature breadth.',
      costOfPosition:
        'This concedes some premium-positioning swagger to reduce buyer anxiety earlier in the funnel.',
    },
  },
  fourForcesBalanceVerdict: {
    push:
      'Push comes from reporting depth, mobile friction, and pricing scaling pain.',
    pull:
      'Pull comes from richer success-state language around workflow visibility and coordination.',
    anxiety:
      'Anxiety centers on migration effort and total cost exceeding the visible product gain.',
    habit:
      'Habit is staying with Jira, Trello, or Asana because retraining looks harder than tolerating gaps.',
    balanceVerdict:
      'The balance favors proof-led migration reassurance before aggressive value expansion claims.',
  },
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

function buildHonestlyUnavailableVoc(): VoiceOfCustomerArtifact {
  const artifact = structuredClone(fixture);
  artifact.confidence = 0.1;
  artifact.painLanguage.quotes = [];
  artifact.painLanguage.blockGap = {
    summary: 'evidence gap: section exceeded its time budget — rerun to retry',
    foundCount: 0,
    requiredCount: 3,
    sourcingPlan: ['Rerun this section to retry — it exceeded its time budget'],
  };
  artifact.objections.items = [];
  artifact.switchingStories.stories = [];
  artifact.decisionCriteria.criteria = [];
  artifact.successLanguage.quotes = [];
  return artifact;
}

describe('VoiceOfCustomerRenderer', () => {
  it('renders 5 editorial blocks with verdict and findings', () => {
    render(<VoiceOfCustomerRenderer artifact={fixture} />);
    expect(screen.getByTestId('verdict-hero')).toHaveTextContent(
      /pricing complaints dominate/i,
    );
    expect(screen.getByTestId('key-findings')).toBeInTheDocument();
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('Pain language');
    expect(blocks[1]).toHaveTextContent('Objections');
    expect(blocks[2]).toHaveTextContent('Switching stories');
    expect(blocks[3]).toHaveTextContent('Decision criteria');
    expect(blocks[4]).toHaveTextContent('Success language');
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
    expect(success[0]).toHaveTextContent('After-state');
    expect(success[0]).toHaveTextContent('Single source of truth');

    // Pain quotes and success quotes are distinct testid namespaces.
    const pain = screen.queryAllByTestId('voc-quote');
    expect(pain.length).toBeGreaterThanOrEqual(3);
    expect(success).not.toEqual(expect.arrayContaining(pain));
  });

  it('renders a GapNote instead of long nav-menu quote dumps', () => {
    const navDump = Array.from({ length: 4 })
      .map((_, index) => `[Menu ${index}](https://example.com/${index})`)
      .join(' ');
    const artifact = structuredClone(fixture);
    artifact.painLanguage.quotes = [
      {
        ...artifact.painLanguage.quotes[0],
        verbatimText: `${navDump} ${'navigation '.repeat(200)}`,
      },
    ];

    render(<VoiceOfCustomerRenderer artifact={artifact} />);

    expect(screen.queryByText(/Menu 0/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('gap-note').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByTestId('voc-quote')).toHaveLength(0);
  });

  it('detects a wholly-empty artifact as honestly unavailable', () => {
    expect(isVoiceOfCustomerHonestlyUnavailable(fixture)).toBe(false);
    expect(
      isVoiceOfCustomerHonestlyUnavailable(buildHonestlyUnavailableVoc()),
    ).toBe(true);
  });

  it('renders ONE compact honest gap note, not five carpet-bombed panels, when wholly unavailable', () => {
    render(<VoiceOfCustomerRenderer artifact={buildHonestlyUnavailableVoc()} />);

    expect(screen.getByTestId('voc-honestly-unavailable')).toBeInTheDocument();
    // Exactly one quiet trust note — no subsection walls.
    expect(screen.getAllByTestId('gap-note')).toHaveLength(1);
    expect(screen.queryAllByTestId('subsection')).toHaveLength(0);
    expect(screen.queryAllByTestId('voc-quote')).toHaveLength(0);
    expect(screen.queryAllByTestId('objection-item')).toHaveLength(0);
    // Honest framing, never the raw pipeline placeholder string.
    expect(
      screen.getByText(/Not enough public evidence was found/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/exceeded its time budget — rerun to retry/i),
    ).not.toBeInTheDocument();
  });

  it('keeps the full body for a PARTIAL shortfall (one block populated)', () => {
    const artifact = buildHonestlyUnavailableVoc();
    // Restore one block — this is a partial shortfall, not wholly unavailable.
    artifact.objections.items = structuredClone(fixture).objections.items;

    expect(isVoiceOfCustomerHonestlyUnavailable(artifact)).toBe(false);

    render(<VoiceOfCustomerRenderer artifact={artifact} />);

    expect(
      screen.queryByTestId('voc-honestly-unavailable'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('subsection')).toHaveLength(5);
    expect(screen.getAllByTestId('objection-item').length).toBeGreaterThanOrEqual(3);
  });
});
