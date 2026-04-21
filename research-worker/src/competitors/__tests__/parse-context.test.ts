import { describe, it, expect } from 'vitest';
import { parseCompetitorContext } from '../parse-context';

const sampleIdentity = {
  category: 'AI Meeting Assistant',
  subcategory: 'Meeting Intelligence',
  coreProduct: 'AI meeting notes',
  coreKeywords: ['ai notes', 'meeting assistant', 'zoom transcription'],
  negativeKeywords: [],
  buyer: 'Operations',
  confidence: 0.85,
  ambiguityFlags: [],
  evidence: { websiteSignals: [], onboardingSignals: [], conflicts: [] },
};

describe('extractIdentityCard (via parseCompetitorContext)', () => {
  it('parses single-line JSON injected at top of context (dispatch route path)', () => {
    const enriched =
      `[businessModelType:b2b-saas]\n[awarenessLevel:problem-aware]\n\n` +
      `## identityResolution\n${JSON.stringify(sampleIdentity)}\n\n` +
      `Company: Fathom\nWebsite: fathom.video\n\n# Research Knowledge Base\n\n- [identity_category] AI notes`;

    const parsed = parseCompetitorContext(enriched);
    expect(parsed.identityCard).not.toBeNull();
    expect(parsed.identityCard?.category).toBe('AI Meeting Assistant');
    expect(parsed.identityCard?.coreKeywords).toEqual(['ai notes', 'meeting assistant', 'zoom transcription']);
  });

  it('parses multi-line pretty-printed JSON (legacy prior-research path)', () => {
    const enriched =
      `Company: Fathom\n\n# Prior Research Results\n\n` +
      `## identityResolution\n${JSON.stringify(sampleIdentity, null, 1)}\n\n` +
      `## marketIndustry\n${JSON.stringify({ tam: 5e9 }, null, 1)}`;

    const parsed = parseCompetitorContext(enriched);
    expect(parsed.identityCard).not.toBeNull();
    expect(parsed.identityCard?.category).toBe('AI Meeting Assistant');
    expect(parsed.identityCard?.coreKeywords).toHaveLength(3);
  });

  it('returns null when no identity block is present (wiki-only path)', () => {
    const wikiOnly =
      `Company: Foo\nWebsite: foo.com\n\n# Research Knowledge Base\n\n- [identity_category] SaaS CRM\n- [market_size] $5B`;
    const parsed = parseCompetitorContext(wikiOnly);
    expect(parsed.identityCard).toBeNull();
  });

  it('returns null when identity JSON is malformed', () => {
    const bad = `## identityResolution\n{not valid json}\n\nCompany: Foo`;
    const parsed = parseCompetitorContext(bad);
    expect(parsed.identityCard).toBeNull();
  });

  it('requires category AND coreKeywords to accept the identity card', () => {
    const partial = `## identityResolution\n${JSON.stringify({ category: 'CRM' })}\n\nrest`;
    const parsed = parseCompetitorContext(partial);
    expect(parsed.identityCard).toBeNull();
  });
});
