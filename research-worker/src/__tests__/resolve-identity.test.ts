import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the runner module before importing the module under test
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

import { applyV3BusinessModelHardMap, resolveProductIdentity } from '../identity/resolve-identity';

function makeValidIdentityCard() {
  return {
    schemaVersion: 1,
    category: 'AI Whiteboard / Visual Collaboration Tool',
    subcategory: 'AI-powered visual thinking',
    businessModel: 'SaaS subscription',
    coreProduct: 'AI-powered collaborative whiteboard with brainstorming templates',
    coreKeywords: ['ai whiteboard', 'visual collaboration', 'online whiteboard ai'],
    negativeKeywords: ['video generation', 'video editing'],
    buyer: 'Product managers and creative leads at tech-forward teams',
    jobToBeDone: 'Turn raw ideas into structured visual outputs faster without facilitation overhead',
    confidence: 88,
    ambiguityFlags: [],
    evidence: {
      websiteSignals: ['Homepage emphasises "visual thinking" and "AI brainstorming"'],
      onboardingSignals: ['User described as "AI content creation tool"'],
      conflicts: [],
    },
  };
}

function makeAnthropicResponse(card: unknown): {
  content: Array<{ type: string; text: string }>;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(card) }],
  };
}

describe('resolveProductIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmitRunnerProgress.mockResolvedValue(undefined);
    // Default runWithBackoff just executes the fn
    mockRunWithBackoff.mockImplementation((fn: () => unknown) => fn());
  });

  it('returns success with parsed identity card on the happy path', async () => {
    const card = makeValidIdentityCard();
    mockCreate.mockResolvedValue(makeAnthropicResponse(card));
    mockExtractJson.mockReturnValue(card);

    const result = await resolveProductIdentity('Company: Poppy AI\nProduct: AI whiteboard tool');

    expect(result.status).toBe('complete');
    expect(result.section).toBe('identityResolution');
    expect(result.data).toMatchObject({
      category: 'AI Whiteboard / Visual Collaboration Tool',
      coreKeywords: expect.arrayContaining(['ai whiteboard']),
      confidence: 88,
      ambiguityFlags: [],
    });
  });

  it('returns a fallback card with confidence 20 when the model returns malformed JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot classify this product right now.' }],
    });
    mockExtractJson.mockImplementation(() => {
      throw new Error('No parseable JSON found');
    });

    const result = await resolveProductIdentity('Company: Unknown\nProduct: ???');

    // JSON parse failures produce status 'partial' with the 'json-parse-failed' flag
    // (distinct from API/timeout failures which use 'resolver-failed-fallback')
    expect(result.status).toBe('partial');
    expect(result.section).toBe('identityResolution');
    const data = result.data as Record<string, unknown>;
    expect(data.confidence).toBe(20);
    expect(data.ambiguityFlags).toContain('json-parse-failed');
  });

  it('produces a fallback card when the API call times out', async () => {
    // runWithBackoff executes the fn, which internally races the API call against a timer.
    // Simulate timeout by rejecting with a timeout-shaped error.
    mockRunWithBackoff.mockRejectedValue(
      new Error('Identity resolver timed out after 15s'),
    );

    const result = await resolveProductIdentity('Company: SlowCo\nProduct: Something slow');

    expect(result.status).toBe('partial');
    expect(result.section).toBe('identityResolution');
    const data = result.data as Record<string, unknown>;
    expect(data.confidence).toBe(20);
    expect(data.ambiguityFlags).toContain('resolver-failed-fallback');
    expect(result.error).toContain('timed out');
  });

  it('returns a fallback card and does not throw when the Anthropic client throws', async () => {
    mockRunWithBackoff.mockRejectedValue(new Error('Authentication error: invalid API key'));

    await expect(
      resolveProductIdentity('Company: BrokenCo\nProduct: Does not matter'),
    ).resolves.toMatchObject({
      status: 'partial',
      section: 'identityResolution',
    });

    const result = await resolveProductIdentity('Company: BrokenCo\nProduct: Does not matter');
    const data = result.data as Record<string, unknown>;
    expect(data.confidence).toBe(20);
    expect(data.ambiguityFlags).toContain('resolver-failed-fallback');
  });

  it('preserves low confidence and ambiguity flags from the model response', async () => {
    const lowConfidenceCard = {
      ...makeValidIdentityCard(),
      confidence: 45,
      ambiguityFlags: ['product could be content marketing tool or whiteboard tool'],
    };
    mockCreate.mockResolvedValue(makeAnthropicResponse(lowConfidenceCard));
    mockExtractJson.mockReturnValue(lowConfidenceCard);

    const result = await resolveProductIdentity('Company: AmbiguousCo\nProduct: AI visual stuff');

    expect(result.status).toBe('complete');
    const data = result.data as Record<string, unknown>;
    expect(data.confidence).toBe(45);
    expect(data.ambiguityFlags).toContain(
      'product could be content marketing tool or whiteboard tool',
    );
  });
});

describe('applyV3BusinessModelHardMap', () => {
  it('maps salesMotion=product-led to businessModelType=plg (hard override)', () => {
    const coerced: Record<string, unknown> = { businessModelType: 'slg' };
    applyV3BusinessModelHardMap(coerced, '[salesMotion:product-led]\n[conversionPath:free-trial]');
    expect(coerced.businessModelType).toBe('plg');
  });

  it('maps salesMotion=sales-led to businessModelType=slg (hard override)', () => {
    const coerced: Record<string, unknown> = { businessModelType: 'plg' };
    applyV3BusinessModelHardMap(coerced, '[salesMotion:sales-led]\n[conversionPath:demo-required]');
    expect(coerced.businessModelType).toBe('slg');
  });

  it('keeps LLM inference when salesMotion=hybrid (no override)', () => {
    const coerced: Record<string, unknown> = { businessModelType: 'plg' };
    applyV3BusinessModelHardMap(coerced, '[salesMotion:hybrid]\n[conversionPath:free-trial]');
    expect(coerced.businessModelType).toBe('plg');
  });

  it('falls back to conversionPath only when LLM returned unknown', () => {
    const coerced: Record<string, unknown> = { businessModelType: 'unknown' };
    applyV3BusinessModelHardMap(coerced, '[conversionPath:direct-checkout]');
    expect(coerced.businessModelType).toBe('ecommerce');

    const coerced2: Record<string, unknown> = { businessModelType: 'unknown' };
    applyV3BusinessModelHardMap(coerced2, '[conversionPath:demo-required]');
    expect(coerced2.businessModelType).toBe('slg');

    // Does NOT override concrete LLM classifications via conversionPath alone
    const coerced3: Record<string, unknown> = { businessModelType: 'plg' };
    applyV3BusinessModelHardMap(coerced3, '[conversionPath:demo-required]');
    expect(coerced3.businessModelType).toBe('plg');
  });
});
