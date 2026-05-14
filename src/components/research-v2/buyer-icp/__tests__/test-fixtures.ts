import type {
  AwarenessLevelCard,
  BuyerICPArtifact,
  ClusterVenue,
  FirmographicCut,
  Persona,
  TriggerCard,
} from '@/types/buyer-icp-artifact';

export const personaFixture: Persona = {
  name: 'Jordan Lee',
  title: 'VP Revenue Operations',
  company: 'Acme Cloud',
  sourceUrl: 'https://example.com/jordan-lee',
  role: 'decision-maker',
  seniority: 'VP+',
  evidence: 'Public profile shows Jordan owns revenue systems and pipeline governance.',
};

export const firmographicCutFixture: FirmographicCut = {
  cutType: 'employeeBands',
  value: 'B2B SaaS companies with 200-1000 employees',
  accountCount: '1,200+ accounts',
  source: 'LinkedIn company search',
  sourceUrl: 'https://example.com/firmographic-cut',
  dateObserved: '2026-05-15',
};

export const awarenessLevelFixture: AwarenessLevelCard = {
  level: 'problem-aware',
  share: '~35%',
  evidence: 'Queries cluster around pipeline attribution pain before vendor comparisons.',
  sampleQuery: 'why is pipeline attribution wrong',
};

export const triggerFixture: TriggerCard = {
  name: 'New RevOps leader hired',
  detectionSignal: 'VP Revenue Operations job changes in target accounts.',
  window: 'weeks',
  evidence: 'Public job-change announcements often precede tooling audits.',
  sourceUrl: 'https://example.com/revops-trigger',
};

export const clusterVenueFixture: ClusterVenue = {
  bucketType: 'slack-group',
  name: 'RevOps Co-op',
  audienceSize: '15,000+ members',
  sourceUrl: 'https://example.com/revops-coop',
  whyItMatters: 'Operators ask tactical attribution and forecasting questions there.',
};

export const buyerIcpArtifactFixture: BuyerICPArtifact = {
  sectionTitle: 'Buyer & ICP Validation',
  verdict: 'The ICP exists and is reachable through public RevOps channels.',
  statusSummary:
    'Named operators, firmographic cuts, and cluster venues all point to a reachable ICP.',
  confidence: 8,
  sources: [
    {
      title: 'LinkedIn company search',
      url: 'https://example.com/linkedin-search',
      whyItMatters: 'Supports the account-count cut.',
      accessedAt: '2026-05-15',
    },
    {
      title: 'RevOps Co-op public page',
      url: 'https://example.com/revops-coop',
      whyItMatters: 'Supports the cluster venue.',
      accessedAt: '2026-05-15',
    },
  ],
  icpExistenceCheck: {
    prose: '**Reachable accounts** are visible in public company indexes.',
    firmographicCuts: [firmographicCutFixture],
  },
  personaReality: {
    prose: 'Named RevOps leaders match the claimed buying committee.',
    personas: [personaFixture],
  },
  awarenessDistribution: {
    prose: 'Most demand appears problem-aware before vendor comparison.',
    levels: [awarenessLevelFixture],
  },
  buyingContext: {
    prose: 'Hiring and stack-change events move passive accounts into active review.',
    triggers: [triggerFixture],
  },
  clusters: {
    prose: 'The audience clusters in practitioner communities.',
    venues: [clusterVenueFixture],
  },
};
