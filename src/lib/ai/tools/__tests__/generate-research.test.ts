import { describe, expect, it } from 'vitest';
import {
  assertRevisionChainAllowsSection,
  normalizeGeneratedResearchResult,
} from '../generate-research';

describe('assertRevisionChainAllowsSection', () => {
  it('allows normal generation when no revision chain is active', () => {
    expect(() =>
      assertRevisionChainAllowsSection('industryResearch', {
        invalidatedResearchSections: [],
      }),
    ).not.toThrow();
  });

  it('allows reruns for sections inside the active revision chain', () => {
    expect(() =>
      assertRevisionChainAllowsSection('strategicSynthesis', {
        invalidatedResearchSections: ['icpValidation', 'strategicSynthesis', 'keywordIntel'],
      }),
    ).not.toThrow();
  });

  it('rejects reruns for sections outside the active revision chain', () => {
    expect(() =>
      assertRevisionChainAllowsSection('industryResearch', {
        invalidatedResearchSections: ['icpValidation', 'strategicSynthesis', 'keywordIntel'],
      }),
    ).toThrow(/outside the active revision chain/i);
  });
});

describe('normalizeGeneratedResearchResult', () => {
  it('attaches typed wave 1 data from a journey-data block while preserving shared metadata', () => {
    const result = normalizeGeneratedResearchResult(
      'offerAnalysis',
      `Offer analysis summary with benchmark context [1].

\`\`\`journey-data
{"data":{
  "offerClarity":{
    "clearlyArticulated":true,
    "solvesRealPain":true,
    "benefitsEasyToUnderstand":true,
    "transformationMeasurable":true,
    "valuePropositionObvious":true
  },
  "offerStrength":{
    "painRelevance":8,
    "urgency":7,
    "differentiation":6,
    "tangibility":8,
    "proof":5,
    "pricingLogic":7,
    "overallScore":7
  },
  "marketOfferFit":{
    "marketWantsNow":true,
    "competitorsOfferSimilar":true,
    "priceMatchesExpectations":true,
    "proofStrongForColdTraffic":false,
    "transformationBelievable":true
  },
  "redFlags":["weak_or_no_proof"],
  "recommendation":{
    "status":"adjust_messaging",
    "reasoning":"The offer is credible but needs stronger proof.",
    "actionItems":["Rewrite proof above the fold"]
  }
}}
\`\`\`

[1]: https://example.com/report Industry report`,
      ['file-typed'],
    );

    expect(result.content).toContain('Offer analysis summary');
    expect(result.content).not.toContain('```journey-data');
    expect(result.citations).toEqual([
      {
        number: 1,
        url: 'https://example.com/report',
        title: 'Industry report',
      },
    ]);
    expect(result.fileIds).toEqual(['file-typed']);
    expect(result.data).toEqual(
      expect.objectContaining({
        recommendation: expect.objectContaining({
          status: 'adjust_messaging',
        }),
      }),
    );
  });

  it('omits typed data when the journey-data block fails validation', () => {
    const result = normalizeGeneratedResearchResult(
      'strategicSynthesis',
      `Strategic synthesis summary without structured success [1].

\`\`\`journey-data
{"data":{
  "keyInsights":[{"insight":"Crowded market"}]
}}
\`\`\`

[1]: https://example.com/strategy Strategy memo`,
      ['file-invalid'],
    );

    expect(result.content).toContain('Strategic synthesis summary');
    expect(result.content).not.toContain('```journey-data');
    expect(result.data).toBeUndefined();
    expect(result.citations).toEqual([
      {
        number: 1,
        url: 'https://example.com/strategy',
        title: 'Strategy memo',
      },
    ]);
  });

  it('still returns a valid result when only content and citations exist', () => {
    const result = normalizeGeneratedResearchResult(
      'strategicSynthesis',
      'Narrative-only summary [1].\n\n[1]: https://example.com/source Source',
      ['file-fallback'],
    );

    expect(result.content).toContain('Narrative-only summary');
    expect(result.data).toBeUndefined();
    expect(result.citations).toHaveLength(1);
  });

  it('returns a structured claims payload with sourced quantitative claims', () => {
    const result = normalizeGeneratedResearchResult(
      'industryResearch',
      'The market is growing 18% year over year [1].\n\n[1]: https://example.com/report Industry report',
      ['file-1'],
    );

    expect(result.content).toContain('18% year over year');
    expect(result.citations).toEqual([
      {
        number: 1,
        url: 'https://example.com/report',
        title: 'Industry report',
      },
    ]);
    expect(result.claims).toEqual([
      expect.objectContaining({
        kind: 'quantitative',
        citationNumbers: [1],
        support: 'sourced',
      }),
    ]);
    expect(result.provenance.status).toBe('sourced');
    expect(result.missingData).toEqual([]);
  });

  it('flags unsupported quantitative claims when no citation is present', () => {
    const result = normalizeGeneratedResearchResult(
      'industryResearch',
      'The market is growing 18% year over year.',
      [],
    );

    expect(result.claims).toEqual([
      expect.objectContaining({
        kind: 'quantitative',
        support: 'missing',
      }),
    ]);
    expect(result.provenance.status).toBe('missing');
    expect(result.missingData).toContain(
      'Quantitative or benchmark claims require at least one citation.',
    );
  });
});
