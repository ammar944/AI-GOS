import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISPATCH_PIPELINE_ORDER,
  normalizeWikiEntries,
  summarizeForSynthesis,
} from '../dispatch/route';
import { getJourneyResearchTool } from '@/lib/journey/server/dispatch-research';

// Note: The POST handler in dispatch/route.ts depends on Clerk auth and Supabase,
// which require real credentials in a Next.js server context. We test the two
// extractable behaviors — pipeline order and enrichment content — directly via
// exported helpers, per the testing guidance in the task spec.

describe('DISPATCH_PIPELINE_ORDER', () => {
  it('places identityResolution first and industryMarket second', () => {
    expect(DISPATCH_PIPELINE_ORDER[0]).toBe('identityResolution');
    expect(DISPATCH_PIPELINE_ORDER[1]).toBe('industryMarket');
  });

  it('contains all 8 expected sections in the canonical research order', () => {
    expect(DISPATCH_PIPELINE_ORDER).toEqual([
      'identityResolution',
      'industryMarket',
      'icpValidation',
      'competitors',
      'offerAnalysis',
      'keywordIntel',
      'crossAnalysis',
      'mediaPlan',
    ]);
  });
});

describe('getJourneyResearchTool', () => {
  it('routes the one-pass deep research program through the shared Journey dispatcher', () => {
    expect(getJourneyResearchTool('deepResearchProgram')).toBe('runDeepResearchProgram');
  });
});

describe('summarizeForSynthesis — identityResolution enrichment', () => {
  const identityCard = {
    schemaVersion: 1,
    category: 'AI Whiteboard / Visual Collaboration Tool',
    subcategory: 'AI-powered visual thinking',
    businessModel: 'SaaS subscription',
    coreProduct: 'AI-powered collaborative whiteboard with brainstorming templates',
    coreKeywords: ['ai whiteboard', 'visual collaboration', 'online whiteboard ai'],
    negativeKeywords: ['video generation', 'video editing'],
    buyer: 'Product managers and creative leads at tech-forward teams',
    jobToBeDone: 'Turn raw ideas into structured visual outputs faster',
    confidence: 88,
    ambiguityFlags: [],
    evidence: {
      websiteSignals: ['Homepage emphasises "visual thinking" and "AI brainstorming"'],
      onboardingSignals: ['User described as "AI content creation tool"'],
      conflicts: [],
    },
  };

  it('passes the full identity card through for downstream context enrichment', () => {
    const result = summarizeForSynthesis('identityResolution', identityCard);
    const parsed = JSON.parse(result) as typeof identityCard;

    // Every downstream runner needs category, coreKeywords, negativeKeywords,
    // confidence, and evidence — verify all are preserved
    expect(parsed.category).toBe('AI Whiteboard / Visual Collaboration Tool');
    expect(parsed.coreKeywords).toContain('ai whiteboard');
    expect(parsed.negativeKeywords).toContain('video generation');
    expect(parsed.confidence).toBe(88);
    expect(parsed.evidence.websiteSignals).toHaveLength(1);
  });

  it('produces a non-empty string that can be injected as a ## identityResolution block', () => {
    const result = summarizeForSynthesis('identityResolution', identityCard);

    // The route wraps this in `## ${key}\n${content}` — verify the content is valid
    const enrichedBlock = `## identityResolution\n${result}`;
    expect(enrichedBlock).toContain('## identityResolution');
    expect(enrichedBlock).toContain('AI Whiteboard');
  });

  it('gracefully handles a missing identity card payload without throwing', () => {
    // When research_results is empty ({}) the upstream code skips the section
    // (no value → continue). This test verifies the summarizer itself handles
    // edge-case inputs safely.
    expect(() => summarizeForSynthesis('identityResolution', {})).not.toThrow();
    expect(() => summarizeForSynthesis('identityResolution', null)).not.toThrow();
  });
});

// Regression guard for commit e2a23c34. Two production runs in journey_sessions
// already have stringified entries in research_wiki.entries; the normalizer lets
// the dispatch route tolerate that legacy shape instead of starving runners.
describe('normalizeWikiEntries — legacy-format defense', () => {
  const validEntry = {
    topic: 'industry.segment',
    content: 'Enterprise SaaS',
    source_runner: 'industryMarket',
    provenance: 'inferred',
    confidence: 0.9,
  };

  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('passes native object entries through unchanged', () => {
    const result = normalizeWikiEntries([validEntry]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(validEntry);
  });

  it('parses legacy JSON-string entries back into objects', () => {
    const result = normalizeWikiEntries([JSON.stringify(validEntry)]);
    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe('industry.segment');
    expect(result[0].content).toBe('Enterprise SaaS');
  });

  it('drops malformed strings without throwing', () => {
    const result = normalizeWikiEntries(['not json {{', validEntry]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(validEntry);
  });

  it('drops null / undefined / primitive elements', () => {
    const result = normalizeWikiEntries([null, undefined, 42, validEntry]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(validEntry);
  });

  it('returns [] for non-array input (null, undefined, object, string)', () => {
    expect(normalizeWikiEntries(null)).toEqual([]);
    expect(normalizeWikiEntries(undefined)).toEqual([]);
    expect(normalizeWikiEntries({ entries: [validEntry] })).toEqual([]);
    expect(normalizeWikiEntries('[]')).toEqual([]);
  });

  it('drops parsed objects missing required topic/content fields', () => {
    const result = normalizeWikiEntries([{ source_runner: 'x' }, validEntry]);
    expect(result).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });
});
