import type {
  BuyerICPArtifact,
  DemandIntentArtifact,
  MarketCategoryArtifact,
} from '@/types/positioning-artifact';

export const marketCategoryArtifact = {
  sectionTitle: 'Market & Category Intelligence - TestCo',
  verdict: 'TestCo sits in a growing workflow automation category with buyer confusion at the category edges.',
  statusSummary: 'Clear demand signals, visible adjacent-category confusion, and an expanding maturity profile.',
  confidence: 8,
  sources: [
    {
      title: 'Automation market report',
      url: 'https://example.com/automation-market-report',
      whyItMatters: 'Category-level trajectory signal.',
    },
    {
      title: 'Workflow funding tracker',
      url: 'https://example.com/workflow-funding',
      whyItMatters: 'Funding-flow signal.',
    },
    {
      title: 'Buyer education guide',
      url: 'https://example.com/buyer-education',
      whyItMatters: 'Maturity signal.',
    },
  ],
  strategicInsight: {
    strategicVerdict:
      'TestCo should claim workflow automation as an operating-control category, not another task tracker.',
    nonObviousRead:
      'The category opening is buyer fear of hidden process drift, not generic enthusiasm for automation.',
    secondOrderImplication:
      'Messaging should prove governed workflow control before asking buyers to believe broad productivity claims.',
    keyTension: {
      tension:
        'Buyers want automation speed but still need enough control to trust cross-functional handoffs.',
      side:
        'Take the controlled-automation side and make auditability part of the category frame.',
      costOfPosition:
        'This narrows the story away from generic productivity and toward operational buyers with process risk.',
    },
  },
  categoryPowerBet: {
    bet:
      'Own controlled workflow automation for teams that have outgrown task management but distrust opaque AI operators.',
    whyNow:
      'Funding, search behavior, and adjacent-category confusion make the operating-control frame available now.',
    riskAccepted:
      'The bet concedes some broad task-management language to win a sharper operations category.',
  },
  categoryDefinition: {
    prose: 'Buyers understand the workflow automation promise but still confuse the category with task management and CRM.',
    adjacentCategories: [
      {
        name: 'Task management',
        whyBuyersConfuseIt: 'Both products organize work and ownership.',
        disambiguatingSignal: 'Automation depth and workflow branching.',
        sourceTitle: 'Task market guide',
        sourceUrl: 'https://example.com/task-market-guide',
      },
      {
        name: 'CRM automation',
        whyBuyersConfuseIt: 'Both products touch revenue operations workflows.',
        disambiguatingSignal: 'Cross-functional process coverage outside sales.',
        sourceTitle: 'CRM automation review',
        sourceUrl: 'https://example.com/crm-automation-review',
      },
    ],
  },
  marketSize: {
    prose: 'Demand is expanding through public reports, funding, and search behavior.',
    signals: [
      {
        signalType: 'public-data',
        name: 'Workflow software category growth',
        evidence: 'Industry report describes sustained workflow software expansion.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'Automation market report',
        sourceUrl: 'https://example.com/automation-market-report',
        dateObserved: '2026-05-20',
      },
      {
        signalType: 'funding-flow',
        name: 'Automation funding rounds',
        evidence: 'Multiple workflow automation vendors raised new growth rounds.',
        trajectory: 'expanding',
        methodology: 'bottom-up',
        sourceTitle: 'Workflow funding tracker',
        sourceUrl: 'https://example.com/workflow-funding',
        dateObserved: '2026-05-20',
      },
      {
        signalType: 'search-trend',
        name: 'Process automation searches',
        evidence: 'Search interest clusters around operational automation problems.',
        trajectory: 'stable',
        methodology: 'bottom-up',
        sourceTitle: 'Search trend sample',
        sourceUrl: 'https://example.com/search-trend-sample',
        dateObserved: '2026-05-20',
      },
    ],
    bottomUpTam: {
      recipeName: 'keyword-demand-reachable-revenue',
      formula: 'monthly keyword volume x 12 x commercial-intent share x conversion rate x ACV',
      reachableRevenueEstimate:
        '$1.15M directional reachable revenue from keyword demand, conversion, and ACV inputs.',
      inputs: [
        {
          inputType: 'keyword-volume',
          label: 'Workflow automation keyword volume',
          value: '2,000 monthly searches from keyword sample.',
          status: 'sourced',
          sourceTitle: 'Keyword sample',
          sourceUrl: 'https://example.com/keyword-sample',
          dateObserved: '2026-05-20',
        },
        {
          inputType: 'commercial-intent-share',
          label: 'Commercial-intent share',
          value: '40% commercial-intent share from comparison and pricing query mix.',
          status: 'sourced',
          sourceTitle: 'Search trend sample',
          sourceUrl: 'https://example.com/search-trend-sample',
          dateObserved: '2026-05-20',
        },
        {
          inputType: 'conversion-rate',
          label: 'Visitor-to-opportunity conversion',
          value: '2% conversion from pricing-page funnel sample.',
          status: 'sourced',
          sourceTitle: 'Pricing sample',
          sourceUrl: 'https://example.com/pricing-sample',
          dateObserved: '2026-05-20',
        },
        {
          inputType: 'acv',
          label: 'Annual contract value',
          value: '$6,000 ACV from pricing sample.',
          status: 'sourced',
          sourceTitle: 'Pricing sample',
          sourceUrl: 'https://example.com/pricing-sample',
          dateObserved: '2026-05-20',
        },
      ],
      caveats: ['Renderer fixture uses directional sample values.'],
    },
  },
  structuralForces: {
    prose: 'Regulation, platform shifts, and buyer behavior are changing how teams evaluate workflow automation.',
    forces: [
      {
        forceType: 'regulation',
        name: 'Auditability requirements',
        evidence: 'Buyers ask for traceable workflow approvals.',
        implication: 'Compliance-ready workflow logs become table stakes.',
        impact: 'high',
        direction: 'accelerating',
        sourceTitle: 'Compliance automation note',
        sourceUrl: 'https://example.com/compliance-automation',
      },
      {
        forceType: 'platform-shift',
        name: 'AI-native workflow builders',
        evidence: 'AI-assisted builders lower setup friction.',
        implication: 'Legacy workflow builders need clearer differentiation.',
        impact: 'medium',
        direction: 'accelerating',
        sourceTitle: 'AI workflow builders',
        sourceUrl: 'https://example.com/ai-workflow-builders',
      },
      {
        forceType: 'buyer-behavior',
        name: 'Operations-owned tooling',
        evidence: 'Revenue and customer operations teams own more workflow purchases.',
        implication: 'Messaging must speak to operators, not just admins.',
        impact: 'medium',
        direction: 'neutral',
        sourceTitle: 'Ops buyer survey',
        sourceUrl: 'https://example.com/ops-buyer-survey',
      },
    ],
  },
  categoryMaturity: {
    prose: 'The category is growing: enough competitors exist for comparison, but buyer education still matters.',
    classification: {
      stage: 'growing',
      evidenceSummary: 'Player count, buyer education, and feature differentiation indicate a growing market.',
      supportingSignals: [
        {
          signalType: 'player-count',
          evidence: 'Multiple workflow automation vendors are visible in analyst and search results.',
          implication: 'Buyers can comparison-shop the category.',
          sourceUrl: 'https://example.com/player-count',
        },
        {
          signalType: 'buyer-education',
          evidence: 'Educational pages still explain core category vocabulary.',
          implication: 'Narrative clarity remains a conversion lever.',
          sourceUrl: 'https://example.com/buyer-education',
        },
      ],
    },
  },
} satisfies MarketCategoryArtifact;

export const buyerIcpArtifact = {
  sectionTitle: 'Buyer & ICP Validation - TestCo',
  verdict: 'The strongest ICP is operations-led mid-market teams with visible workflow complexity.',
  statusSummary: 'Firmographic cuts, named personas, and venue signals converge on RevOps and CX Ops buyers.',
  confidence: 7.5,
  sources: [
    { title: 'Customer page', url: 'https://example.com/customers', whyItMatters: 'Named company evidence.' },
    { title: 'LinkedIn profile set', url: 'https://example.com/linkedin-profiles', whyItMatters: 'Persona evidence.' },
    { title: 'Community directory', url: 'https://example.com/community-directory', whyItMatters: 'Venue evidence.' },
  ],
  strategicInsight: {
    strategicVerdict:
      'The strongest ICP is operations-led buyers with enough workflow complexity to feel task-tool drift.',
    nonObviousRead:
      'The buyer is not the loudest automation enthusiast; it is the operator accountable for handoff failure.',
    secondOrderImplication:
      'Targeting should weight operational ownership signals above broad company-size filters.',
    keyTension: {
      tension:
        'The ICP wants faster process execution but fears another tool that adds coordination overhead.',
      side:
        'Take the operational-accountability side and sell controlled workflow improvement before automation breadth.',
      costOfPosition:
        'This excludes lower-complexity teams that only want lightweight task automation.',
    },
  },
  icpExistenceCheck: {
    prose: 'The ICP exists as a repeated pattern across company size, operations function, and workflow tooling.',
    firmographicCuts: [
      {
        cutType: 'industry',
        value: 'B2B SaaS',
        accountCount: '120 sampled accounts',
        source: 'Customer page',
        sourceUrl: 'https://example.com/customers',
        dateObserved: '2026-05-20',
      },
      {
        cutType: 'employeeBands',
        value: '100-1,000 employees',
        accountCount: '80 sampled accounts',
        source: 'LinkedIn company search',
        sourceUrl: 'https://example.com/company-search',
        dateObserved: '2026-05-20',
      },
      {
        cutType: 'techStack',
        value: 'CRM plus warehouse plus support desk',
        source: 'Stack profile sample',
        sourceUrl: 'https://example.com/stack-profile',
        dateObserved: '2026-05-20',
      },
    ],
  },
  personaReality: {
    prose: 'Real buyers are operations leaders who own cross-functional process reliability.',
    personas: [
      {
        name: 'Maya Chen',
        title: 'Director of Revenue Operations',
        company: 'ExampleCloud',
        sourceUrl: 'https://example.com/maya-chen',
        role: 'champion',
        seniority: 'Director',
        teamSize: '12',
        evidence: 'Owns routing, enrichment, and handoff workflows.',
      },
      {
        name: 'Jordan Lee',
        title: 'VP Customer Operations',
        company: 'Northstar Support',
        sourceUrl: 'https://example.com/jordan-lee',
        role: 'economic-buyer',
        seniority: 'VP',
        teamSize: '25',
        evidence: 'Owns support automation and escalation process budgets.',
      },
    ],
  },
  awarenessDistribution: {
    prose: 'Awareness spans every Schwartz rung, with concentration in problem-aware and solution-aware demand.',
    levels: [
      { level: 'unaware', share: '10%', evidence: 'Generic operations content attracts early-stage traffic.', sampleQuery: 'operations process examples' },
      { level: 'problem-aware', share: '30%', evidence: 'Buyers search for handoff and routing fixes.', sampleQuery: 'sales handoff automation' },
      { level: 'solution-aware', share: '35%', evidence: 'Buyers compare automation platforms.', sampleQuery: 'workflow automation tools' },
      { level: 'product-aware', share: '20%', evidence: 'Vendor-name searches appear in review sites.', sampleQuery: 'testco reviews' },
      { level: 'most-aware', share: '5%', evidence: 'Pricing and implementation searches show late-stage intent.', sampleQuery: 'testco pricing' },
    ],
  },
  buyingContext: {
    prose: 'Trigger moments appear when operational volume breaks manual routing and reporting.',
    triggers: [
      {
        name: 'CRM migration',
        detectionSignal: 'New CRM administrator job posts.',
        window: 'quarters',
        evidence: 'Migration projects expose workflow gaps.',
        sourceUrl: 'https://example.com/crm-migration',
      },
      {
        name: 'Support volume spike',
        detectionSignal: 'Public hiring for support operations.',
        window: 'weeks',
        evidence: 'Scaling support teams need repeatable escalation workflows.',
        sourceUrl: 'https://example.com/support-hiring',
      },
    ],
  },
  clusters: {
    prose: 'The ICP gathers in operator communities and newsletters rather than broad founder channels.',
    venues: [
      {
        bucketType: 'community',
        name: 'RevOps Co-op',
        audienceSize: '10k+ members',
        sourceUrl: 'https://example.com/revops-coop',
        whyItMatters: 'Dense RevOps practitioner audience.',
      },
      {
        bucketType: 'newsletter',
        name: 'Ops Weekly',
        audienceSize: '25k subscribers',
        sourceUrl: 'https://example.com/ops-weekly',
        whyItMatters: 'Operations buyers read practical workflow content.',
      },
    ],
  },
} satisfies BuyerICPArtifact;

export const demandIntentArtifact = {
  sectionTitle: 'Demand & Intent Signals - TestCo',
  verdict: 'Demand is visible across keywords, buyer questions, content gaps, and trigger signals.',
  statusSummary: 'Search and venue evidence show category-aware demand with several unserved topics.',
  confidence: 7,
  sources: [
    { title: 'Keyword sample', url: 'https://example.com/keyword-sample', whyItMatters: 'Keyword demand.' },
    { title: 'People also ask export', url: 'https://example.com/paa-export', whyItMatters: 'Question demand.' },
    { title: 'Community thread sample', url: 'https://example.com/community-thread', whyItMatters: 'Venue demand.' },
  ],
  strategicInsight: {
    strategicVerdict:
      'Demand should be sequenced from workflow pain terms into category education instead of starting at tool labels.',
    nonObviousRead:
      'The most useful intent signal is the buyer asking about process breakdowns before they name automation software.',
    secondOrderImplication:
      'Paid search should learn from problem-language conversion before spending heavily on comparison queries.',
    keyTension: {
      tension:
        'Problem-aware demand is less tidy than category demand but reveals the sharper buying moment.',
      side:
        'Take the problem-aware side and use content to translate pain into the workflow automation frame.',
      costOfPosition:
        'The campaign accepts noisier early traffic to find higher-urgency buyers.',
    },
  },
  orderedMoves: [
    {
      rank: 1,
      move: 'Test problem-aware workflow breakdown terms before category terms.',
      dependsOn: [],
      rationale:
        'The fixture shows repeated workflow pain before buyers commit to a named automation category.',
    },
    {
      rank: 2,
      move: 'Retarget engaged problem-aware visitors with controlled automation proof.',
      dependsOn: [1],
      rationale:
        'The second step depends on proving that problem-aware visitors recognize the category frame.',
    },
  ],
  provesWrongIf: {
    metric: 'problem-aware visit to demo-request conversion',
    threshold: 'below 2 percent qualified demo-request conversion',
    window: 'first 30 days of the test',
  },
  keywordDemand: {
    prose: 'Buyers search for workflow automation, routing, and operations orchestration terms.',
    keywords: [
      {
        keyword: 'workflow automation software',
        monthlyVolume: '12,000',
        cpc: '$8.40 (SpyFu-estimated)',
        intentType: 'commercial',
        top3RankingDomains: ['zapier.com', 'monday.com', 'asana.com'],
        sourceTitle: 'Keyword sample',
        sourceUrl: 'https://example.com/keyword-sample',
        dateObserved: '2026-05-20',
      },
      {
        keyword: 'sales handoff automation',
        monthlyVolume: '1,300',
        intentType: 'transactional',
        top3RankingDomains: ['hubspot.com', 'salesforce.com', 'zapier.com'],
        sourceTitle: 'Keyword sample',
        sourceUrl: 'https://example.com/sales-handoff-keyword',
        dateObserved: '2026-05-20',
      },
      {
        keyword: 'customer operations workflow',
        monthlyVolume: '900',
        intentType: 'informational',
        top3RankingDomains: ['intercom.com', 'zendesk.com', 'example.com'],
        sourceTitle: 'Keyword sample',
        sourceUrl: 'https://example.com/customer-ops-keyword',
        dateObserved: '2026-05-20',
      },
    ],
  },
  questionMining: {
    prose: 'Recurring questions ask how to route work, compare tools, and measure process quality.',
    questions: [
      {
        question: 'How do I automate lead routing between sales and success?',
        surface: 'paa',
        sourceUrl: 'https://example.com/paa-lead-routing',
        frequency: 'recurring',
      },
      {
        question: 'What is the best workflow automation tool for RevOps?',
        surface: 'reddit',
        sourceUrl: 'https://example.com/reddit-revops-workflow',
        frequency: 'recurring',
      },
      {
        question: 'How do teams measure customer operations workflows?',
        surface: 'community',
        sourceUrl: 'https://example.com/community-cxops-workflow',
        frequency: 'occasional',
      },
    ],
  },
  contentGaps: {
    prose: 'Existing content under-serves implementation depth and operator-specific comparisons.',
    gaps: [
      {
        topic: 'RevOps routing playbooks',
        evidenceOfDemand: 'Questions cluster around handoff failures.',
        weakCompetitorAnswerEvidence: 'Competitor content stays generic.',
        opportunity: 'Publish operator-grade routing templates.',
      },
      {
        topic: 'Customer escalation automation',
        evidenceOfDemand: 'Support operations threads cite manual escalations.',
        weakCompetitorAnswerEvidence: 'Top ranking pages focus on ticketing basics.',
        opportunity: 'Show escalation design patterns.',
      },
      {
        topic: 'Workflow ROI measurement',
        evidenceOfDemand: 'Buyers ask how to justify automation spend.',
        weakCompetitorAnswerEvidence: 'Ranking content lacks financial models.',
        opportunity: 'Create ROI calculator content.',
      },
    ],
  },
  intentSignals: {
    prose: 'Trigger signals include job posts, funding, and leadership changes.',
    items: [
      {
        signalType: 'job-posting',
        description: 'Hiring RevOps systems owners signals workflow complexity.',
        sourceUrl: 'https://example.com/revops-job-post',
        exampleCompany: 'ExampleCloud',
      },
      {
        signalType: 'funding',
        description: 'Fresh growth rounds create process-scaling projects.',
        sourceUrl: 'https://example.com/funding-round',
        exampleCompany: 'Northstar Support',
      },
      {
        signalType: 'leadership-change',
        description: 'New operations leaders often re-platform workflow systems.',
        sourceUrl: 'https://example.com/ops-leader-change',
        exampleCompany: 'PipelineWorks',
      },
    ],
  },
  venueMap: {
    prose: 'High-intent buyers gather in operations communities, newsletters, and events.',
    venues: [
      {
        name: 'RevOps Co-op',
        venueType: 'community',
        audienceSize: '10k+ members',
        sourceUrl: 'https://example.com/revops-coop',
      },
      {
        name: 'Ops Weekly',
        venueType: 'newsletter',
        audienceSize: '25k subscribers',
        sourceUrl: 'https://example.com/ops-weekly',
      },
      {
        name: 'Customer Ops Summit',
        venueType: 'event',
        audienceSize: '2k attendees',
        sourceUrl: 'https://example.com/customer-ops-summit',
      },
    ],
  },
} satisfies DemandIntentArtifact;
