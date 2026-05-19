import type { BuyerICPArtifact } from '@/lib/managed-agents/schemas/buyer-icp';
import type { CompetitorLandscapeArtifact } from '@/lib/managed-agents/schemas/competitor-landscape';
import type { DemandIntentArtifact } from '@/lib/managed-agents/schemas/demand-intent-signals';
import type { MarketCategoryArtifact } from '@/lib/managed-agents/schemas/market-category';
import type { OfferPerformanceArtifact } from '@/lib/managed-agents/schemas/offer-performance-diagnostic';
import type { VoiceOfCustomerArtifact } from '@/lib/managed-agents/schemas/voc-objection-evidence';

export const marketCategoryArtifactFixture: MarketCategoryArtifact = {
  sectionTitle: 'Market & Category Intelligence',
  verdict:
    'The category is real, but buyers still describe it through workflow pain rather than a named software budget.',
  statusSummary:
    'Category language splits between CRM, workflow automation, and AI follow-up. The strongest wedge is vertical workflow automation.',
  confidence: 7,
  sources: [
    {
      title: 'Example category report',
      url: 'https://example.com/category-report',
      whyItMatters: 'Supports the category framing and growth trajectory.',
    },
    {
      title: 'Example buyer survey',
      url: 'https://example.com/buyer-survey',
      whyItMatters: 'Shows the category vocabulary buyers use.',
    },
    {
      title: 'Example platform changelog',
      url: 'https://example.com/platform-shift',
    },
  ],
  categoryDefinition: {
    prose:
      'Buyers are not asking for a generic CRM. They are trying to remove follow-up leakage from a high-intent pipeline where response time and context quality decide revenue.',
    adjacentCategories: [
      {
        name: 'Legacy CRM',
        whyBuyersConfuseIt:
          'The buying committee already owns a contact database and initially frames the problem as CRM hygiene.',
        disambiguatingSignal:
          'The urgent budget appears when the team asks for autonomous next steps, not just better fields.',
        sourceTitle: 'CRM comparison',
        sourceUrl: 'https://example.com/crm-comparison',
      },
      {
        name: 'Sales engagement',
        whyBuyersConfuseIt:
          'Outbound cadence tools look similar until the use case requires vertical context and inbound lead handling.',
        disambiguatingSignal:
          'Teams ask whether the system understands listing, territory, and qualification context.',
        sourceTitle: 'Sales engagement overview',
        sourceUrl: 'https://example.com/sales-engagement',
      },
    ],
  },
  marketSize: {
    prose:
      'Public signals point to an expanding software budget, but the budget is fragmented across CRM replacement, automation add-ons, and agency services.',
    signals: [
      {
        signalType: 'analyst-report',
        name: 'Vertical CRM automation spend',
        evidence: 'Category coverage moved from CRM hygiene to AI-assisted workflows.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'Example analyst brief',
        sourceUrl: 'https://example.com/analyst-brief',
        dateObserved: '2026-05-01',
      },
      {
        signalType: 'hiring-velocity',
        name: 'RevOps automation roles',
        evidence: 'Operators are hiring for workflow automation ownership.',
        trajectory: 'expanding',
        methodology: 'bottom-up',
        sourceTitle: 'Example hiring dataset',
        sourceUrl: 'https://example.com/hiring',
        dateObserved: '2026-05-02',
      },
      {
        signalType: 'search-trend',
        name: 'AI follow-up search interest',
        evidence: 'Search demand clusters around fast response and AI follow-up.',
        trajectory: 'expanding',
        methodology: 'bottom-up',
        sourceTitle: 'Example search trend',
        sourceUrl: 'https://example.com/search-trend',
        dateObserved: '2026-05-03',
      },
    ],
  },
  structuralForces: {
    prose:
      'The market is being pulled by stricter lead-response expectations, platform-level AI features, and buyers tiring of generic automation that lacks operating context.',
    forces: [
      {
        forceType: 'regulation',
        name: 'Consent and routing scrutiny',
        evidence: 'Teams need auditable follow-up logic and clearer ownership.',
        implication: 'Compliance-friendly workflow evidence becomes a product proof point.',
        impact: 'medium',
        direction: 'accelerating',
        sourceTitle: 'Example compliance note',
        sourceUrl: 'https://example.com/compliance',
      },
      {
        forceType: 'platform-shift',
        name: 'AI-native CRM expectations',
        evidence: 'CRM vendors are bundling assistants into core workflows.',
        implication: 'Point automation tools need sharper vertical differentiation.',
        impact: 'high',
        direction: 'accelerating',
        sourceTitle: 'Example CRM changelog',
        sourceUrl: 'https://example.com/crm-ai',
      },
      {
        forceType: 'buyer-behavior',
        name: 'Operator demand for fewer tabs',
        evidence: 'Buyers complain about stitching calendars, notes, and sequences.',
        implication: 'The winning product needs visible workflow consolidation.',
        impact: 'high',
        direction: 'accelerating',
        sourceTitle: 'Example buyer thread',
        sourceUrl: 'https://example.com/buyer-thread',
      },
    ],
  },
  categoryMaturity: {
    prose:
      'The category is growing rather than consolidating. Buyers understand the pain, but vendors still compete through adjacent labels.',
    classification: {
      stage: 'growing',
      evidenceSummary:
        'Buyer education is mostly complete around the pain, while vocabulary and vendor shortlists remain unsettled.',
      supportingSignals: [
        {
          signalType: 'buyer-education',
          evidence: 'Searches include workflow and AI-specific language.',
          implication: 'The product can lead with the problem instead of category education.',
          sourceUrl: 'https://example.com/search-trend',
        },
        {
          signalType: 'feature-parity',
          evidence: 'Competitors converge on reminders, templates, and routing.',
          implication: 'Differentiation needs proof of vertical judgment.',
          sourceUrl: 'https://example.com/competitor-features',
        },
      ],
    },
  },
};

export const buyerIcpArtifactFixture: BuyerICPArtifact = {
  sectionTitle: 'Buyer & ICP Validation',
  verdict:
    'The sharpest ICP is an owner-operated team with enough lead flow to feel leakage but not enough operations headcount to build internal automation.',
  statusSummary:
    'The ICP exists in named operator communities and shows an urgent trigger around missed response windows.',
  confidence: 8,
  sources: [
    { title: 'Example operator directory', url: 'https://example.com/operators' },
    { title: 'Example community thread', url: 'https://example.com/community' },
    { title: 'Example newsletter', url: 'https://example.com/newsletter' },
  ],
  icpExistenceCheck: {
    prose:
      'The account pattern is visible in small teams managing high-consideration leads with manual follow-up. The common thread is operational load, not company size alone.',
    firmographicCuts: [
      {
        cutType: 'industry',
        value: 'High-consideration local services',
        accountCount: '2,400+ visible operators',
        source: 'Example operator directory',
        sourceUrl: 'https://example.com/operators',
        dateObserved: '2026-05-01',
      },
      {
        cutType: 'employeeBands',
        value: '5-50 employees',
        accountCount: 'Most public teams in the sample',
        source: 'Example company sample',
        sourceUrl: 'https://example.com/company-sample',
        dateObserved: '2026-05-01',
      },
      {
        cutType: 'techStack',
        value: 'CRM + calendar + SMS tool',
        accountCount: 'Repeated in operator stack posts',
        source: 'Example stack thread',
        sourceUrl: 'https://example.com/stack-thread',
        dateObserved: '2026-05-01',
      },
    ],
  },
  personaReality: {
    prose:
      'The real buyer is close to revenue and operations. Titles vary, but the person cares about missed handoffs and staff time.',
    personas: [
      {
        name: 'Jordan Lee',
        title: 'Founder',
        company: 'Example Homes',
        sourceUrl: 'https://example.com/jordan-lee',
        role: 'economic-buyer',
        seniority: 'Founder',
        teamSize: '18',
        evidence: 'Publicly discusses missed lead follow-up and response speed.',
      },
      {
        name: 'Maya Patel',
        title: 'Operations Lead',
        company: 'Northstar Services',
        sourceUrl: 'https://example.com/maya-patel',
        role: 'champion',
        seniority: 'Manager',
        teamSize: '32',
        evidence: 'Owns lead routing and appointment scheduling workflows.',
      },
      {
        name: 'Sam Rivera',
        title: 'Revenue Operations',
        company: 'Urban Field Co.',
        sourceUrl: 'https://example.com/sam-rivera',
        role: 'influencer',
        seniority: 'Director',
        teamSize: '44',
        evidence: 'Posts about automation evaluation criteria.',
      },
    ],
  },
  awarenessDistribution: {
    prose:
      'Most buyers are problem-aware. They know follow-up leakage hurts revenue but have not yet formed a specific vendor shortlist.',
    levels: [
      {
        level: 'problem-aware',
        share: '45%',
        evidence: 'Public questions frame the issue as missed calls and slow replies.',
        sampleQuery: 'how to respond faster to inbound leads',
      },
      {
        level: 'solution-aware',
        share: '30%',
        evidence: 'Buyers compare CRM automation and appointment-setting services.',
        sampleQuery: 'best CRM automation for small team',
      },
      {
        level: 'product-aware',
        share: '15%',
        evidence: 'A smaller group asks for AI follow-up vendors by name.',
        sampleQuery: 'AI follow up assistant pricing',
      },
    ],
  },
  buyingContext: {
    prose:
      'Urgency spikes when lead volume rises faster than staff capacity. The buyer does not want an AI novelty; they want less leakage next week.',
    triggers: [
      {
        name: 'Lead volume spike',
        detectionSignal: 'Hiring intake coordinators or posting response-time complaints',
        window: 'immediate',
        evidence: 'Repeated operator posts about weekend backlog.',
        sourceUrl: 'https://example.com/backlog-thread',
      },
      {
        name: 'CRM migration',
        detectionSignal: 'Public comparison of CRM or scheduling systems',
        window: 'weeks',
        evidence: 'Teams evaluate automation during CRM replacement.',
        sourceUrl: 'https://example.com/crm-evaluation',
      },
      {
        name: 'Expansion market launch',
        detectionSignal: 'New location announcement with central intake needs',
        window: 'quarters',
        evidence: 'Expansion posts mention repeatable operating process.',
        sourceUrl: 'https://example.com/expansion',
      },
    ],
  },
  clusters: {
    prose:
      'The ICP clusters in operator communities, vertical newsletters, and local-service growth events where practical workflow advice wins.',
    venues: [
      {
        bucketType: 'community',
        name: 'Operator forum',
        audienceSize: '18k members',
        sourceUrl: 'https://example.com/operator-forum',
        whyItMatters: 'Operators ask for workflow fixes in plain language.',
      },
      {
        bucketType: 'newsletter',
        name: 'Growth ops weekly',
        audienceSize: '42k subscribers',
        sourceUrl: 'https://example.com/growth-ops',
        whyItMatters: 'Audience actively evaluates tooling and process.',
      },
      {
        bucketType: 'conference',
        name: 'Local services summit',
        audienceSize: '3k attendees',
        sourceUrl: 'https://example.com/summit',
        whyItMatters: 'High density of owners and operations leads.',
      },
    ],
  },
};

export const competitorLandscapeArtifactFixture: CompetitorLandscapeArtifact = {
  sectionTitle: 'Competitor Landscape & Positioning',
  verdict:
    'Direct competitors converge on all-in-one CRM language; the wedge is verticalized follow-up automation with proof of context quality.',
  statusSummary:
    'The market clusters around breadth, flat-rate packaging, and AI assistance. The visible gap is trust in the actual follow-up quality.',
  confidence: 8,
  sources: [
    { title: 'Example competitor pricing', url: 'https://example.com/pricing' },
    { title: 'Example competitor demo', url: 'https://example.com/demo' },
    { title: 'Example buyer thread', url: 'https://example.com/buyer-thread' },
  ],
  competitorSet: {
    prose:
      'Direct competitors sell CRM breadth. Indirect competitors sell service labor. DIY remains spreadsheet plus calendar coordination for teams below the pain threshold.',
    competitors: [
      {
        name: 'PipelineBase',
        url: 'https://example.com/pipelinebase',
        competitorType: 'direct',
        oneLinePositioning: 'All-in-one CRM for growing local teams.',
        verbatimHeroCopy: 'Turn every lead into a booked appointment.',
        pricingPosition: '$79/user/mo',
        sourceUrl: 'https://example.com/pipelinebase-pricing',
      },
      {
        name: 'FollowFlow',
        url: 'https://example.com/followflow',
        competitorType: 'direct',
        oneLinePositioning: 'AI-powered follow-up and routing.',
        verbatimHeroCopy: 'Never let a hot lead go cold.',
        pricingPosition: '$399/mo flat tier',
        sourceUrl: 'https://example.com/followflow-pricing',
      },
      {
        name: 'Spreadsheet ops',
        url: 'https://example.com/spreadsheet-ops',
        competitorType: 'diy',
        oneLinePositioning: 'Manual tracking with forms and calendars.',
        verbatimHeroCopy: 'Build the workflow yourself.',
        pricingPosition: 'Free to low-cost tools',
        sourceUrl: 'https://example.com/spreadsheet-ops',
      },
    ],
  },
  positioningTaxonomy: {
    prose:
      'The key axes are workflow breadth, AI autonomy, and vertical context. Competitors over-index on breadth; the open position is trustworthy autonomous follow-up.',
    axes: [
      {
        axisName: 'Workflow breadth',
        ourPosition: 'Focused vertical workflow with CRM handoff',
        competitorPositions: [
          { competitor: 'PipelineBase', position: 'All-in-one CRM' },
          { competitor: 'FollowFlow', position: 'Follow-up suite' },
        ],
        evidenceUrl: 'https://example.com/features',
      },
      {
        axisName: 'AI autonomy',
        ourPosition: 'Drafts and sends with operator guardrails',
        competitorPositions: [
          { competitor: 'PipelineBase', position: 'Templates and reminders' },
          { competitor: 'FollowFlow', position: 'Suggested responses' },
        ],
        evidenceUrl: 'https://example.com/ai-features',
      },
    ],
  },
  pricingReality: {
    prose:
      'Pricing anchors around per-seat CRM plans and flat automation tiers. Buyers compare total monthly cost against one operations hire.',
    dataPoints: [
      {
        competitor: 'PipelineBase',
        tierName: 'Grow',
        monthlyPrice: '$79',
        packagingPattern: 'Per-seat',
        gatedSignals: 'Reporting and integrations',
        sourceUrl: 'https://example.com/pipelinebase-pricing',
      },
      {
        competitor: 'FollowFlow',
        tierName: 'Team',
        monthlyPrice: '$399',
        packagingPattern: 'Flat-rate',
        gatedSignals: 'AI message volume',
        sourceUrl: 'https://example.com/followflow-pricing',
      },
    ],
  },
  shareOfVoice: {
    prose:
      'PipelineBase wins generic CRM search. FollowFlow owns AI follow-up terms. DIY dominates community complaints.',
    slices: [
      {
        surface: 'Search: local services CRM',
        winner: 'PipelineBase',
        evidence: 'Top organic comparison pages',
        sourceUrl: 'https://example.com/search-crm',
      },
      {
        surface: 'Search: AI follow up',
        winner: 'FollowFlow',
        evidence: 'Repeated ad and organic coverage',
        sourceUrl: 'https://example.com/search-ai',
      },
      {
        surface: 'Operator communities',
        winner: 'DIY',
        evidence: 'Threads describe spreadsheet workflows',
        sourceUrl: 'https://example.com/operator-forum',
      },
    ],
  },
  publicWeaknesses: {
    prose:
      'Visible complaints center on setup complexity and generic AI copy. Those are useful attack surfaces if the product can prove context quality.',
    items: [
      {
        competitor: 'PipelineBase',
        verbatimQuote: 'The automations took weeks to make useful.',
        source: 'Example review',
        sourceUrl: 'https://example.com/review-setup',
        whyItMatters: 'Setup time weakens the speed promise.',
      },
      {
        competitor: 'FollowFlow',
        verbatimQuote: 'The AI replies sounded generic.',
        source: 'Example community thread',
        sourceUrl: 'https://example.com/review-ai',
        whyItMatters: 'Generic AI creates a direct differentiation wedge.',
      },
    ],
  },
  narrativeArcs: {
    prose:
      'Competitors fight lead chaos and slow response. The sharper villain is generic automation that cannot make a context-aware judgment.',
    arcs: [
      {
        competitor: 'PipelineBase',
        villain: 'Lead chaos',
        hero: 'Centralized CRM',
        transformationClaim: 'A single place to manage every lead',
        sourceUrl: 'https://example.com/pipelinebase',
      },
      {
        competitor: 'FollowFlow',
        villain: 'Slow manual follow-up',
        hero: 'AI assistance',
        transformationClaim: 'Respond before the competitor does',
        sourceUrl: 'https://example.com/followflow',
      },
    ],
  },
};

export const voiceOfCustomerArtifactFixture: VoiceOfCustomerArtifact = {
  sectionTitle: 'Voice of Customer & Objection Evidence',
  verdict:
    'Buyers speak in operational-loss language: missed leads, manual chasing, and generic automation that creates trust risk.',
  statusSummary:
    'The strongest copy should mirror the operator’s fear of leakage while proving that AI output stays on-brand.',
  confidence: 7,
  sources: [
    { title: 'Example review set', url: 'https://example.com/reviews' },
    { title: 'Example community thread', url: 'https://example.com/community' },
    { title: 'Example support thread', url: 'https://example.com/support' },
  ],
  painLanguage: {
    prose:
      'The pain is not abstract productivity. Buyers describe specific missed moments where someone should have replied, qualified, or booked.',
    quotes: [
      {
        verbatimText: 'We know leads are slipping, but nobody owns the next reply.',
        source: 'reddit',
        sourceUrl: 'https://example.com/community/pain-1',
        painTheme: 'ownership gap',
        painIntensity: 'high',
      },
      {
        verbatimText: 'The CRM reminds us after the moment has already passed.',
        source: 'g2',
        sourceUrl: 'https://example.com/reviews/pain-2',
        painTheme: 'late reminders',
        painIntensity: 'medium',
      },
    ],
  },
  objections: {
    prose:
      'Objections cluster around trust, price, and switching cost. The trust objection is the one the product must neutralize first.',
    items: [
      {
        objectionText: 'Will the AI say something off-brand?',
        category: 'trust',
        frequency: 'recurring',
        howToHandle: 'Show approval logs, voice training, and escalation guardrails.',
        sourceUrl: 'https://example.com/objection-trust',
      },
      {
        objectionText: 'We already pay for a CRM.',
        category: 'price',
        frequency: 'recurring',
        howToHandle: 'Frame against missed bookings, not software consolidation.',
        sourceUrl: 'https://example.com/objection-price',
      },
      {
        objectionText: 'Migration will distract the team.',
        category: 'switching-cost',
        frequency: 'occasional',
        howToHandle: 'Lead with overlay setup and CRM handoff, not replacement.',
        sourceUrl: 'https://example.com/objection-switching',
      },
    ],
  },
  switchingStories: {
    prose:
      'Switching stories start when the status quo visibly costs revenue. Teams do not switch because automation is exciting; they switch after repeated lead leakage.',
    stories: [
      {
        priorSolution: 'Manual CRM reminders',
        reasonToLeave: 'Missed response windows',
        decisionPath: 'Founder trialed automation after weekend backlog.',
        exampleCompany: 'Example Homes',
        sourceUrl: 'https://example.com/switching-1',
      },
      {
        priorSolution: 'Appointment-setting service',
        reasonToLeave: 'Inconsistent qualification quality',
        decisionPath: 'Operations lead looked for AI plus internal context.',
        exampleCompany: 'Northstar Services',
        sourceUrl: 'https://example.com/switching-2',
      },
    ],
  },
  decisionCriteria: {
    prose:
      'Decision criteria are practical: time-to-value, CRM handoff quality, message trust, and proof that response speed improves.',
    criteria: [
      {
        criterion: 'Setup time under one week',
        statedBy: 'buyer',
        evidenceQuote: 'We cannot lose a month configuring workflows.',
        sourceUrl: 'https://example.com/criteria-setup',
      },
      {
        criterion: 'CRM handoff stays intact',
        statedBy: 'influencer',
        evidenceQuote: 'If the CRM record is wrong, the team will not trust it.',
        sourceUrl: 'https://example.com/criteria-handoff',
      },
      {
        criterion: 'Message quality control',
        statedBy: 'blocker',
        evidenceQuote: 'Generic AI replies would damage the brand.',
        sourceUrl: 'https://example.com/criteria-quality',
      },
    ],
  },
  successLanguage: {
    prose:
      'Success language shifts from automation to relief: fewer missed leads, cleaner handoffs, and a team that trusts the next step.',
    quotes: [
      {
        verbatimText: 'We stopped wondering whether someone followed up.',
        source: 'other',
        sourceUrl: 'https://example.com/success-1',
        afterStatePattern: 'follow-up confidence',
      },
      {
        verbatimText: 'The team finally had one clean record of the conversation.',
        source: 'support-thread',
        sourceUrl: 'https://example.com/success-2',
        afterStatePattern: 'handoff clarity',
      },
    ],
  },
};

export const demandIntentArtifactFixture: DemandIntentArtifact = {
  sectionTitle: 'Demand & Intent Signals',
  verdict:
    'Demand shows up in problem searches and operator communities before vendor-specific searches. Capture the problem-aware moment.',
  statusSummary:
    'Commercial search exists, but the richer signal is recurring buyer questions about faster response and automation trust.',
  confidence: 7,
  sources: [
    { title: 'Example keyword data', url: 'https://example.com/keywords' },
    { title: 'Example question thread', url: 'https://example.com/questions' },
    { title: 'Example venue list', url: 'https://example.com/venues' },
  ],
  keywordDemand: {
    prose:
      'Keywords split between CRM replacement and AI follow-up. The most actionable terms combine speed, booking, and lead routing.',
    keywords: [
      {
        keyword: 'AI lead follow up',
        monthlyVolume: '1,900',
        intentType: 'commercial',
        top3RankingDomains: ['example.com', 'crm.example', 'automation.example'],
        sourceTitle: 'Example keyword data',
        sourceUrl: 'https://example.com/keywords-ai-follow-up',
        dateObserved: '2026-05-01',
      },
      {
        keyword: 'how to respond faster to inbound leads',
        monthlyVolume: '850',
        intentType: 'informational',
        top3RankingDomains: ['ops.example', 'crm.example', 'blog.example'],
        sourceTitle: 'Example keyword data',
        sourceUrl: 'https://example.com/keywords-response-speed',
        dateObserved: '2026-05-01',
      },
      {
        keyword: 'CRM automation for small team',
        monthlyVolume: '1,200',
        intentType: 'commercial',
        top3RankingDomains: ['crm.example', 'reviews.example', 'ops.example'],
        sourceTitle: 'Example keyword data',
        sourceUrl: 'https://example.com/keywords-crm-automation',
        dateObserved: '2026-05-01',
      },
    ],
  },
  questionMining: {
    prose:
      'Questions are practical and workflow-shaped. Buyers ask how to respond, route, and trust replies rather than asking for a category name.',
    questions: [
      {
        question: 'How do we stop leads going cold over the weekend?',
        surface: 'reddit',
        sourceUrl: 'https://example.com/questions/weekend',
        frequency: 'recurring',
      },
      {
        question: 'What is the safest way to let AI reply to prospects?',
        surface: 'community',
        sourceUrl: 'https://example.com/questions/ai-reply',
        frequency: 'recurring',
      },
      {
        question: 'Should lead routing live in CRM or scheduling software?',
        surface: 'forum',
        sourceUrl: 'https://example.com/questions/routing',
        frequency: 'occasional',
      },
    ],
  },
  contentGaps: {
    prose:
      'Competitor content answers feature comparisons but rarely shows the operating workflow end-to-end.',
    gaps: [
      {
        topic: 'Weekend lead response playbook',
        evidenceOfDemand: 'Repeated questions around delayed follow-up.',
        weakCompetitorAnswerEvidence: 'Competitors write generic SLA content.',
        opportunity: 'Publish a concrete before/after workflow.',
      },
      {
        topic: 'AI reply quality controls',
        evidenceOfDemand: 'Trust objections appear in communities.',
        weakCompetitorAnswerEvidence: 'Most content says guardrails without showing them.',
        opportunity: 'Show approval logs and voice-training examples.',
      },
    ],
  },
  intentSignals: {
    prose:
      'Hiring, CRM migration, and expansion events are the clearest public signals that the buyer is entering a purchase window.',
    items: [
      {
        signalType: 'job-posting',
        description: 'Hiring intake coordinators or operations assistants.',
        sourceUrl: 'https://example.com/jobs',
        exampleCompany: 'Example Homes',
      },
      {
        signalType: 'news-trigger',
        description: 'Launching a new market with centralized lead handling.',
        sourceUrl: 'https://example.com/launch',
        exampleCompany: 'Northstar Services',
      },
      {
        signalType: 'leadership-change',
        description: 'New operations leader evaluating workflow consolidation.',
        sourceUrl: 'https://example.com/leadership',
      },
    ],
  },
  venueMap: {
    prose:
      'Demand clusters in operator communities and practical newsletters where buyers ask for process recommendations before vendor names.',
    venues: [
      {
        name: 'Operator forum',
        venueType: 'community',
        audienceSize: '18k members',
        sourceUrl: 'https://example.com/operator-forum',
      },
      {
        name: 'Growth ops weekly',
        venueType: 'newsletter',
        audienceSize: '42k subscribers',
        sourceUrl: 'https://example.com/growth-ops',
      },
      {
        name: 'Field services podcast',
        venueType: 'podcast',
        audienceSize: '12k listeners',
        sourceUrl: 'https://example.com/podcast',
      },
    ],
  },
};

export const offerPerformanceArtifactFixture: OfferPerformanceArtifact = {
  sectionTitle: 'Offer & Performance Diagnostic',
  verdict:
    'The offer should sell recovered revenue and operator relief, not a generic AI assistant.',
  statusSummary:
    'The funnel needs proof around response time, setup speed, and message quality before price becomes the main objection.',
  confidence: 7,
  sources: [
    { title: 'Example case study', url: 'https://example.com/case-study' },
    { title: 'Example funnel data', url: 'https://example.com/funnel' },
    { title: 'Example channel data', url: 'https://example.com/channels' },
  ],
  offerMarketFit: {
    prose:
      'Offer-market fit is strongest when the buyer can connect the product to missed appointments or reduced coordination labor.',
    proofPoints: [
      {
        metric: 'Response time',
        value: 'Under 5 minutes',
        reportedBy: 'company-own',
        confidence: 'medium',
        sourceUrl: 'https://example.com/response-time',
      },
      {
        metric: 'Lead recovery',
        value: '12 extra bookings in pilot',
        reportedBy: 'company-own',
        confidence: 'medium',
        sourceUrl: 'https://example.com/recovery',
      },
      {
        metric: 'Setup time',
        value: '3 business days',
        reportedBy: 'external-source',
        confidence: 'low',
        sourceUrl: 'https://example.com/setup',
      },
    ],
  },
  funnelDiagnosis: {
    prose:
      'The funnel breaks at trust and handoff proof. Visitors understand the pain quickly, then look for evidence that the product will not create more cleanup work.',
    breaks: [
      {
        stageName: 'Demo request',
        metric: 'High intent, low proof',
        magnitude: 'Drop after feature overview',
        hypothesis: 'The page does not show enough real workflow evidence.',
        sourceUrl: 'https://example.com/funnel-demo',
      },
      {
        stageName: 'Trial activation',
        metric: 'Setup hesitation',
        magnitude: 'Delayed workspace connection',
        hypothesis: 'Buyers worry about CRM and calendar setup effort.',
        sourceUrl: 'https://example.com/funnel-trial',
      },
    ],
  },
  channelTruth: {
    prose:
      'Problem-aware channels are working better than broad AI channels. The content should meet buyers where they describe operational loss.',
    channels: [
      {
        channelName: 'Search',
        hasWorked: 'yes',
        quantifiedEvidence: 'Commercial terms show steady high-intent demand.',
        sourceUrl: 'https://example.com/channel-search',
      },
      {
        channelName: 'Operator communities',
        hasWorked: 'partial',
        quantifiedEvidence: 'Strong engagement on workflow posts, weaker vendor posts.',
        sourceUrl: 'https://example.com/channel-community',
      },
      {
        channelName: 'Broad paid social',
        hasWorked: 'no',
        quantifiedEvidence: 'Generic AI angles underperform pain-led angles.',
        sourceUrl: 'https://example.com/channel-social',
      },
    ],
  },
  retentionHealth: {
    prose:
      'Retention depends on first-value speed and trust in handoff quality. If the team sees one clean recovered lead, the product becomes habit-forming.',
    signals: [
      {
        signalType: 'first-value-moment',
        metric: 'First recovered lead',
        value: 'Within first week',
        sourceUrl: 'https://example.com/first-value',
      },
      {
        signalType: 'activation',
        metric: 'CRM connected',
        value: 'Day 1-3',
        sourceUrl: 'https://example.com/activation',
      },
      {
        signalType: 'retention',
        metric: 'Weekly handoff review',
        value: 'Repeated operator usage',
        sourceUrl: 'https://example.com/retention',
      },
    ],
  },
  redFlags: {
    prose:
      'The offer has three visible risks: generic AI positioning, insufficient setup proof, and price anchored against existing CRM spend.',
    items: [
      {
        claimedMotion: 'Autonomous AI follow-up',
        actualEvidence: 'Buyer objections repeatedly mention generic AI replies.',
        contradiction: 'Autonomy is attractive only if message quality is visibly controlled.',
        severity: 'high',
      },
      {
        claimedMotion: 'Fast setup',
        actualEvidence: 'Prospects ask how CRM and calendar handoff works.',
        contradiction: 'Fast setup claims need concrete integration proof.',
        severity: 'medium',
      },
      {
        claimedMotion: 'Replaces manual coordination',
        actualEvidence: 'Operators still need escalation and ownership visibility.',
        contradiction: 'The offer must show human handoff, not full black-box automation.',
        severity: 'medium',
      },
    ],
  },
};

export const allTypedArtifactFixtures = [
  marketCategoryArtifactFixture,
  buyerIcpArtifactFixture,
  competitorLandscapeArtifactFixture,
  voiceOfCustomerArtifactFixture,
  demandIntentArtifactFixture,
  offerPerformanceArtifactFixture,
] as const;
