import { describe, expect, it } from 'vitest';

import {
  BuyerICPArtifactSchema,
  validateBuyerICPMinimums,
  type BuyerICPArtifact,
} from '../buyer-icp';

const BUYER_ICP_FIXTURE: BuyerICPArtifact = {
  sectionTitle: 'Buyer & ICP Validation',
  verdict: 'ICP exists and is reachable through RevOps-led buying circles.',
  statusSummary:
    'Named RevOps and revenue leaders show the ICP exists across mid-market SaaS companies. The strongest evidence is concentrated in account-growth triggers, RevOps communities, and operator newsletters.',
  confidence: 8,
  sources: [
    {
      title: 'RevOps Co-op',
      url: 'https://revopscoop.com',
      whyItMatters: 'Public community and newsletter proof for the RevOps audience.',
    },
    {
      title: 'Pavilion',
      url: 'https://www.joinpavilion.com',
      whyItMatters: 'Public executive community that includes revenue leaders.',
    },
  ],
  icpExistenceCheck: {
    prose:
      'The ICP exists as a visible slice of B2B SaaS accounts where RevOps, Sales Ops, and GTM leadership own forecasting, meeting hygiene, and pipeline inspection. Public company filters show enough reachable accounts across industry, employee band, and revenue band to support a focused outbound wedge.',
    firmographicCuts: [
      {
        cutType: 'industry',
        value: 'B2B SaaS companies with recurring-revenue GTM teams',
        accountCount: '~4,000 accounts',
        source: 'LinkedIn company search',
        sourceUrl: 'https://www.linkedin.com/company',
        dateObserved: '2026-05-14',
      },
      {
        cutType: 'employeeBands',
        value: '200-1000 employees with dedicated RevOps or Sales Ops roles',
        accountCount: '~1,200 accounts',
        source: 'Apollo account filters',
        sourceUrl: 'https://www.apollo.io',
        dateObserved: '2026-05-14',
      },
      {
        cutType: 'revenueBands',
        value: '$20M-$200M ARR companies hiring revenue operations managers',
        accountCount: '~800 accounts',
        source: 'Clay public templates and job-board sampling',
        sourceUrl: 'https://www.clay.com',
        dateObserved: '2026-05-14',
      },
    ],
  },
  personaReality: {
    prose:
      'The real buyer circle is not one persona. Champions are RevOps directors who feel the workflow pain, economic buyers are revenue executives accountable for forecast quality, and influencers include sales managers who need cleaner meeting execution. Named public profiles confirm these roles exist inside the ICP rather than being archetypes.',
    personas: [
      {
        name: 'Alex Priest',
        title: 'Director of Revenue Operations',
        company: 'Acme SaaS',
        sourceUrl: 'https://www.linkedin.com/in/alex-priest',
        role: 'champion',
        seniority: 'Director',
        teamSize: '5 RevOps operators',
        evidence: 'Public profile names revenue operations ownership and GTM systems scope.',
      },
      {
        name: 'Beth Quinton',
        title: 'VP Revenue Operations',
        company: 'Bravo Analytics',
        sourceUrl: 'https://www.linkedin.com/in/beth-quinton',
        role: 'decision-maker',
        seniority: 'VP+',
        teamSize: '12 revenue operations and enablement',
        evidence: 'Conference bio connects her role to revenue process and forecast inspection.',
      },
      {
        name: 'Carlos Rivera',
        title: 'Chief Revenue Officer',
        company: 'Charlie Cloud',
        sourceUrl: 'https://www.linkedin.com/in/carlos-rivera',
        role: 'economic-buyer',
        seniority: 'C-level',
        evidence: 'Executive bio owns pipeline quality, forecast accuracy, and GTM productivity.',
      },
      {
        name: 'Dana Shah',
        title: 'Sales Operations Manager',
        company: 'Delta Software',
        sourceUrl: 'https://www.linkedin.com/in/dana-shah',
        role: 'end-user',
        seniority: 'Manager',
        teamSize: 'Sales ops team not publicly disclosed',
        evidence: 'Public profile lists sales operations, CRM governance, and meeting workflow support.',
      },
      {
        name: 'Erin Tan',
        title: 'Head of Sales Enablement',
        company: 'Echo GTM',
        sourceUrl: 'https://www.linkedin.com/in/erin-tan',
        role: 'influencer',
        seniority: 'Head',
        teamSize: 'Enablement team not publicly disclosed',
        evidence: 'Podcast profile ties enablement work to rep productivity and process adoption.',
      },
    ],
  },
  awarenessDistribution: {
    prose:
      'Awareness is uneven. Many accounts are still problem-aware around meeting waste and forecast inspection, while a smaller product-aware group compares AI meeting assistants and revenue intelligence tooling directly. The ICP has enough language at every Schwartz level to target by awareness stage.',
    levels: [
      {
        level: 'unaware',
        share: '~15%',
        evidence: 'Generic searches around sales team productivity rarely name meeting intelligence.',
        sampleQuery: 'sales team productivity problems',
      },
      {
        level: 'problem-aware',
        share: '~35%',
        evidence: 'Review and community language names meeting follow-up, CRM hygiene, and forecast misses.',
        sampleQuery: 'sales meeting notes not syncing to crm',
      },
      {
        level: 'solution-aware',
        share: '~25%',
        evidence: 'Search results include categories like AI meeting assistant and revenue intelligence.',
        sampleQuery: 'best ai meeting assistant for sales teams',
      },
      {
        level: 'product-aware',
        share: '~15%',
        evidence: 'Comparison queries mention known vendors and feature-specific alternatives.',
        sampleQuery: 'gong alternative meeting notes crm',
      },
      {
        level: 'most-aware',
        share: '~10%',
        evidence: 'Buyer posts ask about implementation, integrations, pricing, and rollout friction.',
        sampleQuery: 'fellow app salesforce integration pricing',
      },
    ],
  },
  buyingContext: {
    prose:
      'The buying context becomes active when the company can observe revenue-process stress from outside. Hiring spikes, tool migrations, and executive changes are all public signals that a RevOps leader may need workflow controls, meeting hygiene, and better GTM operating cadence.',
    triggers: [
      {
        name: 'Revenue leadership change',
        detectionSignal: 'New CRO or VP Revenue announcement on LinkedIn or company news',
        window: 'immediate',
        evidence: 'New executives often review operating cadence and forecasting process in the first quarter.',
        sourceUrl: 'https://www.linkedin.com',
      },
      {
        name: 'RevOps hiring spike',
        detectionSignal: 'Multiple open RevOps, Sales Ops, or GTM Systems roles',
        window: 'weeks',
        evidence: 'Hiring signals process scaling and operational debt that meeting workflow can support.',
        sourceUrl: 'https://www.indeed.com',
      },
      {
        name: 'CRM or sales-platform migration',
        detectionSignal: 'Job descriptions mention Salesforce migration, HubSpot cleanup, or GTM stack rebuild',
        window: 'quarters',
        evidence: 'Platform migrations create a window to reset meeting capture and CRM hygiene.',
        sourceUrl: 'https://www.linkedin.com/jobs',
      },
    ],
  },
  clusters: {
    prose:
      'The ICP clusters in operator-led revenue communities and newsletters more than broad SaaS founder media. RevOps Co-op, Pavilion, and revenue-operations newsletters are credible channels because the audience already discusses process, tooling, and operating cadence in public.',
    venues: [
      {
        bucketType: 'community',
        name: 'RevOps Co-op',
        audienceSize: '15,000+ members',
        sourceUrl: 'https://revopscoop.com',
        whyItMatters: 'Dedicated RevOps audience with public community and events footprint.',
      },
      {
        bucketType: 'community',
        name: 'Pavilion',
        audienceSize: '10,000+ go-to-market executives',
        sourceUrl: 'https://www.joinpavilion.com',
        whyItMatters: 'Revenue executives and operators discuss GTM operating systems.',
      },
      {
        bucketType: 'newsletter',
        name: 'RevOps Co-op Newsletter',
        audienceSize: 'Subscriber count publicly described by publisher',
        sourceUrl: 'https://revopscoop.com/newsletter',
        whyItMatters: 'Newsletter reaches the same RevOps operator audience outside the community.',
      },
      {
        bucketType: 'newsletter',
        name: 'The Revenue Letter',
        audienceSize: 'Subscriber count not publicly disclosed',
        sourceUrl: 'https://www.therevenueletter.com',
        whyItMatters: 'Revenue operations and sales leadership topics match the ICP buying circle.',
      },
    ],
  },
};

describe('BuyerICPArtifactSchema', () => {
  it('accepts a full fixture with all five sub-sections populated', () => {
    const result = BuyerICPArtifactSchema.safeParse(BUYER_ICP_FIXTURE);
    expect(result.success).toBe(true);
  });

  it('rejects when firmographicCuts is missing', () => {
    const result = BuyerICPArtifactSchema.safeParse({
      ...BUYER_ICP_FIXTURE,
      icpExistenceCheck: {
        prose: BUYER_ICP_FIXTURE.icpExistenceCheck.prose,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-enum persona role', () => {
    const result = BuyerICPArtifactSchema.safeParse({
      ...BUYER_ICP_FIXTURE,
      personaReality: {
        ...BUYER_ICP_FIXTURE.personaReality,
        personas: [
          {
            ...BUYER_ICP_FIXTURE.personaReality.personas[0],
            role: 'buyer',
          },
          ...BUYER_ICP_FIXTURE.personaReality.personas.slice(1),
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-enum cluster bucketType', () => {
    const result = BuyerICPArtifactSchema.safeParse({
      ...BUYER_ICP_FIXTURE,
      clusters: {
        ...BUYER_ICP_FIXTURE.clusters,
        venues: [
          {
            ...BUYER_ICP_FIXTURE.clusters.venues[0],
            bucketType: 'forum',
          },
          ...BUYER_ICP_FIXTURE.clusters.venues.slice(1),
        ],
      },
    });
    expect(result.success).toBe(false);
  });

  it('passes validateBuyerICPMinimums on the full fixture', () => {
    expect(validateBuyerICPMinimums(BUYER_ICP_FIXTURE)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('fails validateBuyerICPMinimums when only four personas are present', () => {
    const artifact: BuyerICPArtifact = {
      ...BUYER_ICP_FIXTURE,
      personaReality: {
        ...BUYER_ICP_FIXTURE.personaReality,
        personas: BUYER_ICP_FIXTURE.personaReality.personas.slice(0, 4),
      },
    };

    const result = validateBuyerICPMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'personas: have 4, need >=5 named real persons at named real ICP companies.',
    );
  });

  it('fails validateBuyerICPMinimums when an awareness level is missing', () => {
    const artifact: BuyerICPArtifact = {
      ...BUYER_ICP_FIXTURE,
      awarenessDistribution: {
        ...BUYER_ICP_FIXTURE.awarenessDistribution,
        levels: BUYER_ICP_FIXTURE.awarenessDistribution.levels.filter(
          (level) => level.level !== 'most-aware',
        ),
      },
    };

    const result = validateBuyerICPMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'awarenessDistribution: missing Schwartz levels most-aware.',
    );
  });

  it('fails validateBuyerICPMinimums when only one newsletter is present', () => {
    const artifact: BuyerICPArtifact = {
      ...BUYER_ICP_FIXTURE,
      clusters: {
        ...BUYER_ICP_FIXTURE.clusters,
        venues: BUYER_ICP_FIXTURE.clusters.venues.filter(
          (venue) =>
            venue.bucketType !== 'newsletter' ||
            venue.name === 'RevOps Co-op Newsletter',
        ),
      },
    };

    const result = validateBuyerICPMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('clusters: have 1 newsletter venues, need >=2.');
  });

  it('fails validateBuyerICPMinimums when a persona sourceUrl is invalid', () => {
    const artifact: BuyerICPArtifact = {
      ...BUYER_ICP_FIXTURE,
      personaReality: {
        ...BUYER_ICP_FIXTURE.personaReality,
        personas: [
          {
            ...BUYER_ICP_FIXTURE.personaReality.personas[0],
            sourceUrl: 'not-a-url',
          },
          ...BUYER_ICP_FIXTURE.personaReality.personas.slice(1),
        ],
      },
    };

    const result = validateBuyerICPMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'personas[0] (Alex Priest): sourceUrl is not a valid URL.',
    );
  });
});
