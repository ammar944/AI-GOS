/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { OfferDiagnosticRenderer } from '../offer-diagnostic';
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
      {
        metric: 'G2 user rating',
        value: '4.7/5 across 10K+ reviews',
        reportedBy: 'external-source',
        confidence: 'low',
        sourceUrl: 'https://www.g2.com/products/monday-com/reviews',
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
      {
        stageName: 'Enterprise upsell',
        metric: 'Customers >$50K ARR / total',
        magnitude: '~0.9% (2,077 of 225K+)',
        hypothesis: 'Friction in SMB→enterprise transition.',
        sourceUrl: 'https://ir.monday.com/example2',
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
        channelName: 'Paid Digital & Brand',
        hasWorked: 'yes',
        quantifiedEvidence: 'FY2023 S&M ~$582M funded global paid campaigns.',
        sourceUrl: 'https://ir.monday.com/example2',
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
        signalType: 'retention',
        metric: 'NDR (>$50K ARR cohort)',
        value: '>115%',
        sourceUrl: 'https://ir.monday.com/example2',
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
      {
        claimedMotion: 'Fast trial-to-paid via 14-day free trial',
        actualEvidence: '14-day window vs. multi-team Work OS evaluation needs.',
        contradiction: 'Trial length optimized for SMB at the expense of multi-team accounts.',
        severity: 'low',
      },
    ],
  },
};

describe('OfferDiagnosticRenderer', () => {
  it('renders 5 subsection blocks with correct labels', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('1 · Offer-Market Fit');
    expect(blocks[1]).toHaveTextContent('2 · Funnel Diagnosis');
    expect(blocks[2]).toHaveTextContent('3 · Channel Truth');
    expect(blocks[3]).toHaveTextContent('4 · Retention Health');
    expect(blocks[4]).toHaveTextContent('5 · Red Flags');
  });

  it('renders prose for every subsection', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    const prose = screen.getAllByTestId('subsection-prose');
    expect(prose).toHaveLength(5);
    expect(prose[0]).toHaveTextContent('monday.com shows clear PMF');
    expect(prose[1]).toHaveTextContent('Two visible funnel breaks');
    expect(prose[2]).toHaveTextContent('Three observable channels');
    expect(prose[3]).toHaveTextContent('NDR exceeds 110%');
    expect(prose[4]).toHaveTextContent('Three red flags');
  });

  it('renders ≥3 proof-point-item rows (schema minimum)', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    expect(screen.getAllByTestId('proof-point-item').length).toBeGreaterThanOrEqual(3);
  });

  it('renders ≥2 funnel-break-item rows (schema minimum)', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    expect(screen.getAllByTestId('funnel-break-item').length).toBeGreaterThanOrEqual(2);
  });

  it('renders ≥3 channel-item rows (schema minimum)', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    expect(screen.getAllByTestId('channel-item').length).toBeGreaterThanOrEqual(3);
  });

  it('renders ≥3 retention-item rows (schema minimum)', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    expect(screen.getAllByTestId('retention-item').length).toBeGreaterThanOrEqual(3);
  });

  it('renders ≥3 red-flag-item rows (schema minimum)', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    expect(screen.getAllByTestId('red-flag-item').length).toBeGreaterThanOrEqual(3);
  });

  it('renders ≥3 distinct channelName values', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    const channelItems = screen.getAllByTestId('channel-item');
    const distinctNames = new Set(channelItems.map(el => el.textContent?.trim()));
    expect(distinctNames.size).toBeGreaterThanOrEqual(3);
  });

  it('renders reportedBy, confidence, hasWorked, signalType, severity pills with label transforms', () => {
    render(<OfferDiagnosticRenderer artifact={fixture} />);
    // reportedBy label transforms
    expect(screen.getAllByText('Company-own').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('External').length).toBeGreaterThanOrEqual(1);
    // hasWorked label transforms (proves pill rendering)
    expect(screen.getAllByText('Yes').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Partial').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(1);
    // signalType label transform
    expect(screen.getAllByText('First value').length).toBeGreaterThanOrEqual(1);
  });
});
