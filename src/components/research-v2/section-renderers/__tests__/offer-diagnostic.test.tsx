/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import {
  OfferDiagnosticRenderer,
  isOfferDiagnosticHonestlyUnavailable,
} from '../offer-diagnostic';
import type { OfferPerformanceArtifact } from '@/types/positioning-artifact';

const fixture: OfferPerformanceArtifact = {
  sectionTitle: 'Offer & Performance Diagnostic — monday.com',
  verdict: 'Strong PMF but funnel and enterprise penetration are diagnostic pressure points.',
  statusSummary: 'Healthy growth with proven PLG; offer efficiency lags.',
  confidence: 7.5,
  sources: [
    { title: 'FY2023 20-F', url: 'https://www.sec.gov/example1', whyItMatters: 'Authoritative revenue source.' },
    { title: 'Press release', url: 'https://ir.monday.com/example2', whyItMatters: 'Customer metrics.' },
    { title: 'Pricing page', url: 'https://monday.com/pricing/', whyItMatters: 'Offer structure.' },
    { title: 'IR hub', url: 'https://ir.monday.com/quarterly', whyItMatters: 'Cohort retention.' },
    { title: 'G2 reviews', url: 'https://www.g2.com/products/monday-com/reviews', whyItMatters: 'External validation.' },
  ],
  strategicInsight: {
    strategicVerdict:
      'monday.com should diagnose enterprise proof depth as the paid-media constraint, not top-level PMF.',
    nonObviousRead:
      'The offer risk is that PLG scale masks a smaller set of buyers ready for multi-team expansion.',
    secondOrderImplication:
      'Paid media should separate SMB activation proof from enterprise expansion proof instead of blending both motions.',
    keyTension: {
      tension:
        'The brand has broad PLG credibility but enterprise buyers need a narrower proof path.',
      side:
        'Take the enterprise-proof side and stop letting horizontal Work OS language carry every segment.',
      costOfPosition:
        'This reduces generalist breadth in exchange for sharper paid-media conversion diagnostics.',
    },
  },
  orderedMoves: [
    {
      rank: 1,
      move: 'Separate SMB trial messaging from enterprise proof messaging in paid tests.',
      dependsOn: [],
      rationale:
        'The fixture shows different funnel constraints for self-serve activation and enterprise upsell.',
    },
  ],
  provesWrongIf: {
    metric: 'enterprise-intent traffic to sales-qualified opportunity rate',
    threshold: 'below 3 percent sales-qualified opportunity rate',
    window: 'first 45 days of segmented paid tests',
  },
  singleBindingConstraint: {
    constraint:
      'The binding constraint is enterprise proof specificity, not whether the product has broad market fit.',
    whyBinding:
      'The fixture has strong revenue and customer metrics but weaker proof for the SMB to enterprise transition.',
    unlockCondition:
      'Publish segmented enterprise adoption proof before scaling enterprise paid-media spend.',
  },
  offerMarketFit: {
    prose: 'monday.com shows clear PMF: $972M revenue, 225K+ customers, >110% NDR.',
    proofPoints: [
      {
        metric: 'FY2023 Revenue',
        value: '$972.9M (+41% YoY)',
        reportedBy: 'company-own',
        confidence: 'high',
        sourceUrl: 'https://ir.monday.com/example2',
      },
      {
        metric: 'Total Customers',
        value: '225,000+ customers',
        reportedBy: 'company-own',
        confidence: 'high',
        sourceUrl: 'https://ir.monday.com/example2',
      },
      {
        metric: 'Net Dollar Retention',
        value: '>110%',
        reportedBy: 'company-own',
        confidence: 'medium',
        sourceUrl: 'https://ir.monday.com/quarterly',
      },
    ],
  },
  funnelDiagnosis: {
    prose: 'Two visible funnel breaks: high S&M intensity and short trial window.',
    breaks: [
      {
        stageName: 'Top-of-funnel acquisition',
        metric: 'S&M % of revenue',
        magnitude: '~60% of revenue',
        hypothesis: 'Heavy paid-search dependency to fuel trial signups.',
        sourceUrl: 'https://ir.monday.com/example2',
      },
      {
        stageName: 'Trial → Paid conversion',
        metric: 'Trial window length',
        magnitude: '14 days',
        hypothesis: 'Too short for cross-functional Work OS deployments.',
        sourceUrl: 'https://monday.com/pricing/',
      },
    ],
  },
  channelTruth: {
    prose: 'Three observable channels: self-serve, paid digital, and enterprise direct.',
    channels: [
      {
        channelName: 'Self-serve / Product-Led Web',
        hasWorked: 'yes',
        quantifiedEvidence: '225K+ customers acquired via free trial.',
        sourceUrl: 'https://monday.com/pricing/',
      },
      {
        channelName: 'Enterprise Direct Sales',
        hasWorked: 'partial',
        quantifiedEvidence: '2,077 customers >$50K ARR; <1% of base.',
        sourceUrl: 'https://ir.monday.com/example2',
      },
      {
        channelName: 'Channel Partners',
        hasWorked: 'unknown',
        quantifiedEvidence: 'Formal partner program announced; revenue not disclosed.',
        sourceUrl: 'https://ir.monday.com/quarterly',
      },
    ],
  },
  retentionHealth: {
    prose: 'NDR exceeds 110% for 10+ user cohort; activation driven by board creation.',
    signals: [
      {
        signalType: 'retention',
        metric: 'NDR (10+ user cohort)',
        value: '>110%',
        sourceUrl: 'https://ir.monday.com/quarterly',
      },
      {
        signalType: 'activation',
        metric: 'Published templates',
        value: '200+ ready-made templates',
        sourceUrl: 'https://monday.com/pricing/',
      },
      {
        signalType: 'first-value-moment',
        metric: 'Shared board with collaborator',
        value: 'Key activation event documented in onboarding.',
        sourceUrl: 'https://monday.com/pricing/',
      },
    ],
  },
  redFlags: {
    prose: 'Three red flags: S&M efficiency, positioning ambiguity, enterprise penetration gap.',
    items: [
      {
        claimedMotion: 'Product-led growth as primary engine',
        actualEvidence: '~60% S&M-to-revenue ratio funded by paid acquisition.',
        contradiction: 'True PLG companies operate at 40-45% S&M; this is paid-acquisition-led.',
        severity: 'high',
      },
      {
        claimedMotion: "Horizontal 'Work OS' platform across WM, CRM, Dev, Service",
        actualEvidence: 'Each surface competes against deeper category leaders.',
        contradiction: 'Generalist positioning increases CAC and lengthens enterprise cycles.',
        severity: 'medium',
      },
      {
        claimedMotion: 'Enterprise-ready, upmarket momentum',
        actualEvidence: '>$50K ARR customers <1% of 225K+ base.',
        contradiction: 'Strong percentage growth masks low absolute penetration.',
        severity: 'medium',
      },
    ],
  },
};

describe('OfferDiagnosticRenderer', () => {
  it('renders binding constraint as the verdict hero', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);

    expect(screen.getByTestId('verdict-hero')).toHaveTextContent(
      /binding constraint is enterprise proof specificity/i,
    );
    expect(screen.getByTestId('key-findings')).toBeInTheDocument();
  });

  it('renders five narrative blocks and funnel math rows', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);

    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('Offer-market fit');
    expect(blocks[1]).toHaveTextContent('Funnel diagnosis');
    expect(screen.getAllByTestId('funnel-break-item').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByTestId('funnel-math').length).toBeGreaterThanOrEqual(2);
  });

  it('renders channels, retention signals, red flags, and tripwire cards', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);

    expect(screen.getAllByTestId('channel-item').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByTestId('retention-item').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByTestId('red-flag-item').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Tripwire')).toBeInTheDocument();
    expect(screen.getByText('enterprise-intent traffic to sales-qualified opportunity rate')).toBeInTheDocument();
  });

  function buildHonestlyUnavailableArtifact(): OfferPerformanceArtifact {
    const artifact = structuredClone(fixture);
    artifact.confidence = 0.1;
    artifact.offerMarketFit.proofPoints = [];
    artifact.offerMarketFit.blockGap = {
      summary: 'evidence gap: section exceeded its time budget — rerun to retry',
      foundCount: 0,
      requiredCount: 3,
      sourcingPlan: ['Rerun this section to retry — it exceeded its time budget'],
    };
    artifact.funnelDiagnosis.breaks = [];
    artifact.channelTruth.channels = [];
    artifact.retentionHealth.signals = [];
    artifact.redFlags.items = [];
    return artifact;
  }

  it('detects a deadline-exhaustion (all-empty) artifact as honestly unavailable', () => {
    expect(isOfferDiagnosticHonestlyUnavailable(fixture)).toBe(false);
    expect(
      isOfferDiagnosticHonestlyUnavailable(buildHonestlyUnavailableArtifact()),
    ).toBe(true);
  });

  it('renders ONE compact honest gap note, not 38 placeholder fields, when unavailable', () => {
    render(<OfferDiagnosticRenderer artifact={buildHonestlyUnavailableArtifact()} />);

    expect(screen.getByTestId('offer-honestly-unavailable')).toBeInTheDocument();
    // Exactly one quiet trust note — no subsection walls, no funnel-math placeholder grid.
    expect(screen.getAllByTestId('gap-note')).toHaveLength(1);
    expect(screen.queryAllByTestId('subsection')).toHaveLength(0);
    expect(screen.queryAllByTestId('funnel-math')).toHaveLength(0);
    // Honest framing, never the raw pipeline placeholder string.
    expect(screen.getByText(/Not enough public evidence was found/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/exceeded its time budget — rerun to retry/i),
    ).not.toBeInTheDocument();
  });
});
