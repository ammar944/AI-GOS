import { describe, expect, it } from 'vitest';

import {
  VoiceOfCustomerArtifactSchema,
  validateVoiceOfCustomerMinimums,
  type VoiceOfCustomerArtifact,
} from '../voc-objection-evidence';

const VOC_FIXTURE: VoiceOfCustomerArtifact = {
  sectionTitle: 'Voice of Customer & Objection Evidence',
  verdict:
    'Buyers value meeting discipline, but objections cluster around switching friction, price, and trust in AI-generated notes.',
  statusSummary:
    'The voice-of-customer pattern is quote-heavy: buyers talk about action items getting lost, meeting notes needing cleanup, and tools becoming another place to maintain. Strong positioning should preserve this language instead of translating it into generic productivity claims.',
  confidence: 8,
  sources: [
    {
      title: 'G2 meeting management reviews',
      url: 'https://www.g2.com/categories/meeting-management',
      whyItMatters: 'Review surface for meeting workflow pain and success language.',
    },
    {
      title: 'Reddit meetings discussion',
      url: 'https://www.reddit.com',
      whyItMatters: 'Community language around meeting notes and follow-up.',
    },
    {
      title: 'Hacker News meeting notes thread',
      url: 'https://news.ycombinator.com',
      whyItMatters: 'Technical buyer skepticism and objection language.',
    },
    {
      title: 'Fellow customer stories',
      url: 'https://fellow.app/customers',
      whyItMatters: 'Success-state language from customer-facing proof.',
    },
    {
      title: 'Support thread on meeting action items',
      url: 'https://support.google.com/docs',
      whyItMatters: 'Status-quo pain language around docs and action items.',
    },
  ],
  painLanguage: {
    prose:
      'Pain language is operational and blunt. Buyers complain that action items disappear after meetings, AI notes still require cleanup, and recurring meetings lack a reliable owner. The strongest phrases are about follow-through rather than abstract productivity.',
    quotes: [
      {
        verbatimText: 'Action items get buried in docs after the meeting.',
        source: 'support-thread',
        sourceUrl: 'https://support.google.com/docs',
        painTheme: 'lost follow-through',
        painIntensity: 'high',
      },
      {
        verbatimText: 'The summaries still need cleanup before I can send them.',
        source: 'g2',
        sourceUrl: 'https://www.g2.com/products/otter-ai/reviews',
        painTheme: 'AI cleanup burden',
        painIntensity: 'medium',
      },
      {
        verbatimText: 'It misses context when people talk over each other.',
        source: 'g2',
        sourceUrl: 'https://www.g2.com/products/otter-ai/reviews',
        painTheme: 'low trust in transcript context',
        painIntensity: 'medium',
      },
      {
        verbatimText: 'We had to build our own meeting template system.',
        source: 'reddit',
        sourceUrl: 'https://www.reddit.com',
        painTheme: 'DIY setup burden',
        painIntensity: 'medium',
      },
      {
        verbatimText: 'Nobody knows who owns the follow-up after the meeting.',
        source: 'sales-call',
        sourceUrl: 'https://fellow.app/customers',
        painTheme: 'unclear ownership',
        painIntensity: 'high',
      },
      {
        verbatimText: 'I do not want another tool just to write notes.',
        source: 'hackernews',
        sourceUrl: 'https://news.ycombinator.com',
        painTheme: 'tool fatigue',
        painIntensity: 'high',
      },
      {
        verbatimText: 'Our one-on-ones turn into random updates with no decisions.',
        source: 'support-thread',
        sourceUrl: 'https://support.google.com/docs',
        painTheme: 'weak meeting structure',
        painIntensity: 'medium',
      },
      {
        verbatimText: 'The CRM never reflects what actually happened in the call.',
        source: 'sales-call',
        sourceUrl: 'https://fellow.app/customers',
        painTheme: 'sales meeting hygiene',
        painIntensity: 'high',
      },
      {
        verbatimText: 'Meeting notes are scattered across Slack, Docs, and memory.',
        source: 'reddit',
        sourceUrl: 'https://www.reddit.com',
        painTheme: 'scattered notes',
        painIntensity: 'medium',
      },
      {
        verbatimText: 'Managers keep reinventing the agenda every week.',
        source: 'other',
        sourceUrl: 'https://fellow.app/blog',
        painTheme: 'repeatable agenda gap',
        painIntensity: 'low',
      },
    ],
  },
  objections: {
    prose:
      'Objections are less about whether meetings are painful and more about whether a new system is worth adopting. Price, trust, switching cost, stakeholder buy-in, and timing all appear in buyer language.',
    items: [
      {
        objectionText: 'We already use Docs for this.',
        category: 'switching-cost',
        frequency: 'recurring',
        howToHandle:
          'Acknowledge the status quo, then show the missing loop from agenda to decision to accountable follow-up.',
        sourceUrl: 'https://support.google.com/docs',
      },
      {
        objectionText: 'The AI notes are not accurate enough for customer calls.',
        category: 'trust',
        frequency: 'recurring',
        howToHandle:
          'Position AI as assistive evidence capture, not the only system of record.',
        sourceUrl: 'https://www.g2.com/products/otter-ai/reviews',
      },
      {
        objectionText: 'This feels expensive for meeting notes.',
        category: 'price',
        frequency: 'occasional',
        howToHandle:
          'Anchor value to manager leverage, CRM hygiene, and reduced meeting rework.',
        sourceUrl: 'https://fellow.app/pricing',
      },
      {
        objectionText: 'Our managers will not change how they run meetings.',
        category: 'stakeholder',
        frequency: 'recurring',
        howToHandle:
          'Lead with manager rituals and templates that reduce setup effort.',
        sourceUrl: 'https://fellow.app/customers',
      },
      {
        objectionText: 'We are not fixing meetings this quarter.',
        category: 'timing',
        frequency: 'one-off',
        howToHandle:
          'Connect buying triggers to leadership changes, planning cycles, and tooling resets.',
        sourceUrl: 'https://fellow.app/blog',
      },
    ],
  },
  switchingStories: {
    prose:
      'Switching stories usually begin with a prior solution failing to create accountability. Buyers leave shared docs, generic AI note takers, or manual manager habits when follow-up and context repeatedly break.',
    stories: [
      {
        priorSolution: 'Google Docs',
        reasonToLeave: 'Action items get buried in docs after the meeting.',
        decisionPath:
          'Team tried shared docs, then looked for a dedicated workflow once recurring meetings created follow-up debt.',
        exampleCompany: 'Fellow customer story',
        sourceUrl: 'https://fellow.app/customers',
      },
      {
        priorSolution: 'Otter.ai',
        reasonToLeave: 'The summaries still need cleanup before I can send them.',
        decisionPath:
          'Team used AI capture, then searched for a system that ties notes to agendas and owners.',
        sourceUrl: 'https://www.g2.com/products/otter-ai/reviews',
      },
      {
        priorSolution: 'DIY Notion workspace',
        reasonToLeave: 'We had to build our own meeting template system.',
        decisionPath:
          'Ops owner built templates, then moved toward purpose-built meeting workflows after maintenance became the bottleneck.',
        sourceUrl: 'https://www.reddit.com',
      },
    ],
  },
  decisionCriteria: {
    prose:
      'Decision criteria emphasize adoption, trust, integrations, accountability, and manager fit. Buyers are not only evaluating note quality; they are asking whether the tool changes meeting behavior without creating extra admin.',
    criteria: [
      {
        criterion: 'Fits existing manager habits',
        statedBy: 'champion',
        evidenceQuote: 'Our managers will not change how they run meetings.',
        sourceUrl: 'https://fellow.app/customers',
      },
      {
        criterion: 'Trustworthy enough for customer-facing calls',
        statedBy: 'blocker',
        evidenceQuote: 'The AI notes are not accurate enough for customer calls.',
        sourceUrl: 'https://www.g2.com/products/otter-ai/reviews',
      },
      {
        criterion: 'Creates accountable follow-up',
        statedBy: 'buyer',
        evidenceQuote: 'Nobody knows who owns the follow-up after the meeting.',
        sourceUrl: 'https://fellow.app/customers',
      },
      {
        criterion: 'Connects to existing documentation and CRM workflows',
        statedBy: 'influencer',
        evidenceQuote: 'Meeting notes are scattered across Slack, Docs, and memory.',
        sourceUrl: 'https://www.reddit.com',
      },
      {
        criterion: 'Worth paying for beyond basic notes',
        statedBy: 'buyer',
        evidenceQuote: 'This feels expensive for meeting notes.',
        sourceUrl: 'https://fellow.app/pricing',
      },
    ],
  },
  successLanguage: {
    prose:
      'Success-state language is about confidence that the meeting produced action. Buyers describe the after-state as clearer ownership, fewer scattered notes, and meetings that compound instead of resetting every week.',
    quotes: [
      {
        verbatimText: 'Everyone leaves knowing what they own.',
        source: 'sales-call',
        sourceUrl: 'https://fellow.app/customers',
        afterStatePattern: 'clear ownership',
      },
      {
        verbatimText: 'We stopped reinventing the agenda every week.',
        source: 'other',
        sourceUrl: 'https://fellow.app/blog',
        afterStatePattern: 'repeatable meeting ritual',
      },
      {
        verbatimText: 'The follow-up is no longer trapped in one person’s notes.',
        source: 'support-thread',
        sourceUrl: 'https://support.google.com/docs',
        afterStatePattern: 'shared accountability',
      },
      {
        verbatimText: 'Customer calls finally show up in the operating rhythm.',
        source: 'sales-call',
        sourceUrl: 'https://fellow.app/customers',
        afterStatePattern: 'sales workflow visibility',
      },
      {
        verbatimText: 'Our one-on-ones have decisions instead of random updates.',
        source: 'reddit',
        sourceUrl: 'https://www.reddit.com',
        afterStatePattern: 'higher-quality recurring meetings',
      },
    ],
  },
};

describe('VoiceOfCustomerArtifactSchema', () => {
  it('accepts a full fixture with the five canonical Section 04 sub-sections populated', () => {
    const result = VoiceOfCustomerArtifactSchema.safeParse(VOC_FIXTURE);
    expect(result.success).toBe(true);
  });

  it('rejects when painLanguage.quotes is missing', () => {
    const result = VoiceOfCustomerArtifactSchema.safeParse({
      ...VOC_FIXTURE,
      painLanguage: {
        prose: VOC_FIXTURE.painLanguage.prose,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-enum objection category', () => {
    const [first, ...rest] = VOC_FIXTURE.objections.items;
    const result = VoiceOfCustomerArtifactSchema.safeParse({
      ...VOC_FIXTURE,
      objections: {
        ...VOC_FIXTURE.objections,
        items: [{ ...first, category: 'quality' }, ...rest],
      },
    });
    expect(result.success).toBe(false);
  });

  it('passes validateVoiceOfCustomerMinimums on the full fixture', () => {
    expect(validateVoiceOfCustomerMinimums(VOC_FIXTURE)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('fails validateVoiceOfCustomerMinimums when pain quotes are too thin', () => {
    const artifact: VoiceOfCustomerArtifact = {
      ...VOC_FIXTURE,
      painLanguage: {
        ...VOC_FIXTURE.painLanguage,
        quotes: VOC_FIXTURE.painLanguage.quotes.slice(0, 9),
      },
    };

    const result = validateVoiceOfCustomerMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'painLanguage.quotes: have 9, need >=10 verbatim pain quotes.',
    );
  });

  it('fails validateVoiceOfCustomerMinimums when pain quotes do not span three sources', () => {
    const artifact: VoiceOfCustomerArtifact = {
      ...VOC_FIXTURE,
      painLanguage: {
        ...VOC_FIXTURE.painLanguage,
        quotes: VOC_FIXTURE.painLanguage.quotes.map((quote) => ({
          ...quote,
          source: 'g2',
          sourceUrl: 'https://www.g2.com/products/fellow/reviews',
        })),
      },
    };

    const result = validateVoiceOfCustomerMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'painLanguage.quotes: need >=3 sources, have 1.',
    );
  });

  it('fails validateVoiceOfCustomerMinimums when objection categories are too narrow', () => {
    const artifact: VoiceOfCustomerArtifact = {
      ...VOC_FIXTURE,
      objections: {
        ...VOC_FIXTURE.objections,
        items: VOC_FIXTURE.objections.items.map((item) => ({
          ...item,
          category: 'price',
        })),
      },
    };

    const result = validateVoiceOfCustomerMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'objections.items: need objections across >=3 categories, have 1.',
    );
  });

  it('fails validateVoiceOfCustomerMinimums when switching stories use fewer than two prior solutions', () => {
    const artifact: VoiceOfCustomerArtifact = {
      ...VOC_FIXTURE,
      switchingStories: {
        ...VOC_FIXTURE.switchingStories,
        stories: VOC_FIXTURE.switchingStories.stories.map((story) => ({
          ...story,
          priorSolution: 'Google Docs',
        })),
      },
    };

    const result = validateVoiceOfCustomerMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'switchingStories.stories: need >=2 prior solutions, have 1.',
    );
  });

  it('fails validateVoiceOfCustomerMinimums when confidence is outside 0-10', () => {
    const artifact: VoiceOfCustomerArtifact = {
      ...VOC_FIXTURE,
      confidence: -1,
    };

    const result = validateVoiceOfCustomerMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('confidence: expected 0-10, got -1.');
  });
});
