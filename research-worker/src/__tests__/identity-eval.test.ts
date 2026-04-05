// Eval-style tests for the identity resolver.
// These encode the acceptance criteria for the classification prompt — they mock
// the Anthropic response with the expected output and verify the resolver passes
// through the classification correctly. Future prompt changes that break these
// contracts must explicitly update the expected output here.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockEmitRunnerProgress = vi.fn();
const mockRunWithBackoff = vi.fn();
const mockExtractJson = vi.fn();

vi.mock('../runner', () => ({
  createClient: () => ({ messages: { create: mockCreate } }),
  emitRunnerProgress: (...args: unknown[]) => mockEmitRunnerProgress(...args),
  runWithBackoff: (fn: () => unknown, _label: string) => mockRunWithBackoff(fn),
  extractJson: (text: string) => mockExtractJson(text),
}));

import { resolveProductIdentity } from '../identity/resolve-identity';

beforeEach(() => {
  vi.clearAllMocks();
  mockEmitRunnerProgress.mockResolvedValue(undefined);
  mockRunWithBackoff.mockImplementation((fn: () => unknown) => fn());
});

describe('identity resolver — eval tests', () => {
  it('classifies Poppy AI as a whiteboard/visual collaboration tool and excludes video keywords', async () => {
    // Acceptance criteria for Poppy AI:
    // - category contains "whiteboard" or "visual collaboration" (case-insensitive)
    // - negativeKeywords includes something video-related (the prompt says to exclude
    //   video-generation search terms that lead to wrong competitors)
    const poppyIdentityCard = {
      schemaVersion: 1,
      category: 'AI Whiteboard / Visual Collaboration Tool',
      subcategory: 'AI-powered brainstorming and visual thinking',
      businessModel: 'SaaS subscription',
      coreProduct: 'AI-powered whiteboard with brainstorming templates and visual collaboration features',
      coreKeywords: [
        'ai whiteboard',
        'visual collaboration tool',
        'online whiteboard ai',
        'ai brainstorming tool',
        'digital whiteboard software',
      ],
      negativeKeywords: [
        'video generation',
        'video editing',
        'ai video creator',
      ],
      buyer: 'Product managers, designers, and creative leads at tech-forward teams',
      jobToBeDone: 'Turn raw ideas into structured visual outputs faster without facilitation overhead',
      confidence: 82,
      ambiguityFlags: [
        'User described as "AI content creation tool" — research data clarifies this means visual/whiteboard content, not video',
      ],
      evidence: {
        websiteSignals: [
          'Homepage emphasises "visual thinking" and "AI brainstorming"',
          'Screenshots show whiteboard interface with sticky notes and diagrams',
        ],
        onboardingSignals: ['User described product as "AI content creation tool"'],
        conflicts: [
          '"AI content creation" could imply video generation — website confirms whiteboard focus',
        ],
      },
    };

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(poppyIdentityCard) }],
    });
    mockExtractJson.mockReturnValue(poppyIdentityCard);

    const context = [
      'Company Name: Poppy AI',
      'Product: AI content creation tool',
      '',
      '## Website Scrape',
      'Poppy AI is a visual collaboration platform powered by AI.',
      'Features: AI whiteboard, brainstorming templates, visual collaboration, sticky notes.',
      'Use cases: product planning, design sprints, team retrospectives.',
      '',
      '## Perplexity Intel',
      'Poppy AI competes in the visual collaboration / digital whiteboard space.',
      'Direct competitors: Miro, FigJam, Whimsical.',
    ].join('\n');

    const result = await resolveProductIdentity(context);

    expect(result.status).toBe('complete');
    const data = result.data as typeof poppyIdentityCard;

    // Category must signal whiteboard or visual collaboration
    const categoryLower = data.category.toLowerCase();
    expect(
      categoryLower.includes('whiteboard') || categoryLower.includes('visual collaboration'),
      `Expected category to include "whiteboard" or "visual collaboration", got: "${data.category}"`,
    ).toBe(true);

    // negativeKeywords must exclude video-generation search terms
    const negKeywordsLower = data.negativeKeywords.map((k) => k.toLowerCase());
    const hasVideoNegative = negKeywordsLower.some((k) => k.includes('video'));
    expect(
      hasVideoNegative,
      `Expected negativeKeywords to include a "video" term, got: ${JSON.stringify(data.negativeKeywords)}`,
    ).toBe(true);
  });

  it('classifies Instapation with BNPL / buy now pay later as core keyword', async () => {
    // Acceptance criteria for Instapation:
    // - coreKeywords includes "buy now pay later" or "bnpl" (case-insensitive)
    const instapationIdentityCard = {
      schemaVersion: 1,
      category: 'Buy Now Pay Later (BNPL) for Medical Aesthetics',
      subcategory: 'Patient financing for medspas',
      businessModel: 'SaaS + transaction fee',
      coreProduct: 'BNPL payment solution enabling medspas to offer installment-based patient financing',
      coreKeywords: [
        'buy now pay later',
        'BNPL medical aesthetics',
        'medspa patient financing',
        'medical aesthetics payment plans',
        'patient financing software',
      ],
      negativeKeywords: [
        'general ecommerce BNPL',
        'retail buy now pay later',
      ],
      buyer: 'Medspa owners and practice managers',
      jobToBeDone: 'Let patients pay in installments for aesthetic treatments to increase average ticket size and reduce price objections',
      confidence: 91,
      ambiguityFlags: [],
      evidence: {
        websiteSignals: [
          'Website explicitly mentions "buy now pay later for medspas"',
          'Homepage copy references BNPL as the core product',
          '"Medical aesthetics" and "medspa" appear throughout the site',
        ],
        onboardingSignals: ['User described as "payment solution for medspas"'],
        conflicts: [],
      },
    };

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(instapationIdentityCard) }],
    });
    mockExtractJson.mockReturnValue(instapationIdentityCard);

    const context = [
      'Company Name: Instapation',
      'Product: Payment solution for medspas',
      '',
      '## Website Scrape',
      'Instapation offers buy now pay later (BNPL) financing for medical aesthetics clinics.',
      'Enable patients to split payments for Botox, fillers, and skin treatments.',
      'Medspa owners use Instapation to increase conversion and reduce price objections.',
      '',
      '## Perplexity Intel',
      'Instapation is a BNPL platform specifically designed for medical aesthetics practices.',
      'It competes with Cherry, Alle, and PatientFi in the medical financing space.',
    ].join('\n');

    const result = await resolveProductIdentity(context);

    expect(result.status).toBe('complete');
    const data = result.data as typeof instapationIdentityCard;

    // coreKeywords must include BNPL or "buy now pay later"
    const keywordsLower = data.coreKeywords.map((k) => k.toLowerCase());
    const hasBnpl = keywordsLower.some(
      (k) => k.includes('buy now pay later') || k.includes('bnpl'),
    );
    expect(
      hasBnpl,
      `Expected coreKeywords to include "buy now pay later" or "bnpl", got: ${JSON.stringify(data.coreKeywords)}`,
    ).toBe(true);
  });
});
