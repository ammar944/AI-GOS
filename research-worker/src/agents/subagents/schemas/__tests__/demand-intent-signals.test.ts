import { describe, expect, it } from 'vitest';

import {
  DemandIntentArtifactSchema,
  validateDemandIntentMinimums,
  type DemandIntentArtifact,
} from '../demand-intent-signals';

const KEYWORDS = Array.from({ length: 10 }, (_, index) => ({
  keyword: `meeting management software ${index + 1}`,
  monthlyVolume: index % 2 === 0 ? 'not disclosed' : `${100 + index * 10}`,
  intentType: index % 3 === 0 ? 'commercial' : 'informational',
  top3RankingDomains: ['g2.com', 'fellow.app', 'otter.ai'],
  sourceTitle: `Keyword source ${index + 1}`,
  sourceUrl: `https://example.com/keyword-${index + 1}`,
  dateObserved: '2026-05-15',
})) satisfies DemandIntentArtifact['keywordDemand']['keywords'];

const QUESTIONS = Array.from({ length: 10 }, (_, index) => ({
  question:
    index % 2 === 0
      ? `How do teams keep action items from meetings visible ${index + 1}?`
      : `What is the best AI meeting notes workflow ${index + 1}?`,
  surface: index % 2 === 0 ? 'paa' : 'reddit',
  sourceUrl: `https://example.com/question-${index + 1}`,
  frequency: index % 3 === 0 ? 'recurring' : 'occasional',
})) satisfies DemandIntentArtifact['questionMining']['questions'];

const DEMAND_INTENT_FIXTURE: DemandIntentArtifact = {
  sectionTitle: 'Demand & Intent Signals',
  verdict:
    'Demand exists across keyword, question, and trigger surfaces, but the strongest intent clusters around meeting follow-up, AI notes, and recurring team rituals.',
  statusSummary:
    'Buyers search for meeting-management and AI-note alternatives while communities ask practical questions about action items and follow-up. Intent is strongest where teams are hiring RevOps, publishing meeting-process roles, or comparing workflow-heavy alternatives.',
  confidence: 8,
  sources: [
    { title: 'Google keyword results', url: 'https://www.google.com/search?q=meeting+management+software' },
    { title: 'People Also Ask result', url: 'https://www.google.com/search?q=ai+meeting+notes' },
    { title: 'Reddit meetings thread', url: 'https://www.reddit.com' },
    { title: 'LinkedIn jobs', url: 'https://www.linkedin.com/jobs' },
    { title: 'G2 meeting management category', url: 'https://www.g2.com/categories/meeting-management' },
  ],
  keywordDemand: {
    prose:
      'Keyword demand is split between category queries, AI-meeting-note comparisons, and operational follow-up language. The strongest commercial intent appears when buyers compare meeting-management software and AI meeting assistant alternatives.',
    keywords: KEYWORDS,
  },
  questionMining: {
    prose:
      'Question mining shows buyers asking how to keep action items visible, whether AI notes are trustworthy, and how to connect meeting records to existing workflows. The questions are practical rather than abstract.',
    questions: QUESTIONS,
  },
  contentGaps: {
    prose:
      'Content gaps appear where buyers have active questions but competitors answer with generic productivity copy. Fellow can own workflow-specific answers around recurring rituals, follow-up accountability, and CRM-connected meeting hygiene.',
    gaps: [
      {
        topic: 'Meeting action item accountability',
        evidenceOfDemand: 'Recurring PAA and Reddit questions ask how to track action items after meetings.',
        weakCompetitorAnswerEvidence: 'Competitor pages emphasize notes and summaries more than accountability loops.',
        opportunity: 'Publish workflow content that connects agenda, decision, owner, and follow-up.',
      },
      {
        topic: 'AI notes plus manager rituals',
        evidenceOfDemand: 'Search results cluster around AI meeting notes and meeting management software.',
        weakCompetitorAnswerEvidence: 'AI note takers rarely explain manager adoption and recurring ritual design.',
        opportunity: 'Position AI as part of a manager operating cadence, not a standalone note feature.',
      },
      {
        topic: 'CRM meeting hygiene',
        evidenceOfDemand: 'Sales and RevOps job posts mention CRM hygiene and meeting follow-up.',
        weakCompetitorAnswerEvidence: 'Generic meeting software content does not map to pipeline inspection.',
        opportunity: 'Create RevOps-specific content for meeting notes, CRM updates, and forecast hygiene.',
      },
    ],
  },
  intentSignals: {
    prose:
      'Intent signals show up in hiring, tooling comparisons, funding-triggered GTM scaling, and workflow reset moments. These are more useful than broad traffic because they imply operational urgency.',
    items: [
      {
        signalType: 'job-posting',
        description: 'RevOps roles mention meeting cadence, CRM hygiene, and forecast process ownership.',
        sourceUrl: 'https://www.linkedin.com/jobs',
        exampleCompany: 'Example SaaS',
      },
      {
        signalType: 'rfp',
        description: 'Public procurement language asks for meeting minutes and action tracking.',
        sourceUrl: 'https://example.com/rfp',
      },
      {
        signalType: 'news-trigger',
        description: 'Leadership changes create operating-cadence reset moments.',
        sourceUrl: 'https://example.com/news',
      },
      {
        signalType: 'funding',
        description: 'Funded teams hire GTM operations roles and reset meeting systems.',
        sourceUrl: 'https://example.com/funding',
      },
      {
        signalType: 'leadership-change',
        description: 'New CROs review recurring meeting rhythms and pipeline inspection.',
        sourceUrl: 'https://example.com/leadership',
      },
    ],
  },
  venueMap: {
    prose:
      'Demand venues include operator communities, events, newsletters, and podcasts where teams discuss meeting discipline and GTM operating cadence. These surfaces are useful because they carry questions before buyers search branded terms.',
    venues: [
      {
        name: 'RevOps Co-op',
        venueType: 'community',
        audienceSize: '15,000+ members',
        sourceUrl: 'https://revopscoop.com',
      },
      {
        name: 'SaaStr Annual',
        venueType: 'event',
        audienceSize: 'not disclosed',
        sourceUrl: 'https://www.saastrannual.com',
      },
      {
        name: 'The Revenue Letter',
        venueType: 'newsletter',
        audienceSize: 'not disclosed',
        sourceUrl: 'https://www.therevenueletter.com',
      },
      {
        name: 'Operations podcast',
        venueType: 'podcast',
        audienceSize: 'not disclosed',
        sourceUrl: 'https://example.com/podcast',
      },
    ],
  },
};

describe('DemandIntentArtifactSchema', () => {
  it('accepts a full fixture with the five canonical Section 05 sub-sections populated', () => {
    const result = DemandIntentArtifactSchema.safeParse(DEMAND_INTENT_FIXTURE);
    expect(result.success).toBe(true);
  });

  it('rejects when keywordDemand.keywords is missing', () => {
    const result = DemandIntentArtifactSchema.safeParse({
      ...DEMAND_INTENT_FIXTURE,
      keywordDemand: { prose: DEMAND_INTENT_FIXTURE.keywordDemand.prose },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-enum intentType', () => {
    const [first, ...rest] = DEMAND_INTENT_FIXTURE.keywordDemand.keywords;
    const result = DemandIntentArtifactSchema.safeParse({
      ...DEMAND_INTENT_FIXTURE,
      keywordDemand: {
        ...DEMAND_INTENT_FIXTURE.keywordDemand,
        keywords: [{ ...first, intentType: 'curious' }, ...rest],
      },
    });
    expect(result.success).toBe(false);
  });

  it('passes validateDemandIntentMinimums on the full fixture', () => {
    expect(validateDemandIntentMinimums(DEMAND_INTENT_FIXTURE)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('fails validateDemandIntentMinimums when keyword demand is too thin', () => {
    const artifact: DemandIntentArtifact = {
      ...DEMAND_INTENT_FIXTURE,
      keywordDemand: {
        ...DEMAND_INTENT_FIXTURE.keywordDemand,
        keywords: DEMAND_INTENT_FIXTURE.keywordDemand.keywords.slice(0, 9),
      },
    };

    const result = validateDemandIntentMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'keywordDemand.keywords: have 9, need >=10 keyword signals.',
    );
  });

  it('fails validateDemandIntentMinimums when questions do not span two surfaces', () => {
    const artifact: DemandIntentArtifact = {
      ...DEMAND_INTENT_FIXTURE,
      questionMining: {
        ...DEMAND_INTENT_FIXTURE.questionMining,
        questions: DEMAND_INTENT_FIXTURE.questionMining.questions.map((question) => ({
          ...question,
          surface: 'paa',
        })),
      },
    };

    const result = validateDemandIntentMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'questionMining.questions: need >=2 surface types, have 1.',
    );
  });

  it('fails validateDemandIntentMinimums when intent signals do not span two signal types', () => {
    const artifact: DemandIntentArtifact = {
      ...DEMAND_INTENT_FIXTURE,
      intentSignals: {
        ...DEMAND_INTENT_FIXTURE.intentSignals,
        items: DEMAND_INTENT_FIXTURE.intentSignals.items.map((item) => ({
          ...item,
          signalType: 'job-posting',
        })),
      },
    };

    const result = validateDemandIntentMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'intentSignals.items: need >=2 signalTypes, have 1.',
    );
  });

  it('fails validateDemandIntentMinimums when venue map does not span two venue types', () => {
    const artifact: DemandIntentArtifact = {
      ...DEMAND_INTENT_FIXTURE,
      venueMap: {
        ...DEMAND_INTENT_FIXTURE.venueMap,
        venues: DEMAND_INTENT_FIXTURE.venueMap.venues.map((venue) => ({
          ...venue,
          venueType: 'community',
        })),
      },
    };

    const result = validateDemandIntentMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('venueMap.venues: need >=2 venueTypes, have 1.');
  });

  it('fails validateDemandIntentMinimums when confidence is outside 0-10', () => {
    const artifact: DemandIntentArtifact = {
      ...DEMAND_INTENT_FIXTURE,
      confidence: 12,
    };

    const result = validateDemandIntentMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('confidence: expected 0-10, got 12.');
  });
});
