import { describe, it, expect } from 'vitest';
import { diffSection, diffCard, evaluateUrl } from '../diff';

describe('diffSection', () => {
  it('reports 100% recall when fields match', () => {
    const d = diffSection(
      'industryMarket',
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 20, c: 30 },
    );
    expect(d.recall).toBe(1);
    expect(d.missingFields).toEqual([]);
  });

  it('reports partial recall when live omits a field', () => {
    const d = diffSection(
      'industryMarket',
      { a: 1, b: 2, c: 3, d: 4 },
      { a: 10, b: 20 },
    );
    expect(d.recall).toBe(0.5);
    expect(d.missingFields.sort()).toEqual(['c', 'd']);
  });

  it('detects extra fields that appear in live but not golden', () => {
    const d = diffSection('x', { a: 1 }, { a: 1, b: 2 });
    expect(d.extraFields).toEqual(['b']);
    expect(d.recall).toBe(1); // recall measures golden coverage, not extras
  });

  it('flags status regression complete → error', () => {
    const d = diffSection(
      'x',
      { status: 'complete', data: {} },
      { status: 'error', data: {} },
    );
    expect(d.statusChange).toEqual({ goldenStatus: 'complete', liveStatus: 'error' });
  });

  it('returns recall=1 for empty golden', () => {
    expect(diffSection('x', {}, { a: 1 }).recall).toBe(1);
  });
});

describe('diffCard', () => {
  it('counts _provenance array entries as citations', () => {
    const card = { _provenance: [{ field: 'a', source: 'web_search' }, { field: 'b', source: 'tool_output' }] };
    const d = diffCard('opportunityIntel', card);
    expect(d.citationCount).toBe(2);
    expect(d.fabricationMatches).toHaveLength(0);
  });

  it('counts evidence strings on array items', () => {
    const card = {
      opportunities: [
        { opportunity: 'A', evidence: 'https://example.com/a' },
        { opportunity: 'B', evidence: 'https://example.com/b' },
        { opportunity: 'C', evidence: 'https://example.com/c' },
      ],
    };
    expect(diffCard('opportunityIntel', card).citationCount).toBe(3);
  });

  it('surfaces fabrication matches', () => {
    const card = {
      opportunities: [{ opportunity: 'A', size: 'Expect 45% YoY growth in cold outbound' }],
    };
    const d = diffCard('opportunityIntel', card);
    expect(d.fabricationMatches.length).toBeGreaterThan(0);
    expect(d.fabricationMatches[0]?.pattern).toBe('yoy_growth');
  });

  it('returns zero for empty card', () => {
    const d = diffCard('opportunityIntel', {});
    expect(d.citationCount).toBe(0);
    expect(d.fabricationMatches).toHaveLength(0);
  });
});

describe('evaluateUrl', () => {
  const targets = {
    fieldRecall: 0.9,
    minCitationsPerCard: 3,
    maxFabricationMatches: 0,
  };

  it('passes when sections align and cards meet targets', () => {
    const r = evaluateUrl({
      slug: 'test',
      goldenSections: {
        industryMarket: { status: 'complete', data: { a: 1, b: 2 } },
      },
      liveSections: {
        industryMarket: { status: 'complete', data: { a: 1, b: 2 } },
      },
      liveCards: {
        opportunityIntel: {
          opportunities: [
            { evidence: 'a' },
            { evidence: 'b' },
            { evidence: 'c' },
          ],
        },
      },
      targets,
    });
    expect(r.pass).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it('fails on insufficient citations', () => {
    const r = evaluateUrl({
      slug: 'test',
      goldenSections: {},
      liveSections: {},
      liveCards: {
        opportunityIntel: { opportunities: [{ evidence: 'only-one' }] },
      },
      targets,
    });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.includes('citations'))).toBe(true);
  });

  it('fails on detected fabrication', () => {
    const r = evaluateUrl({
      slug: 'test',
      goldenSections: {},
      liveSections: {},
      liveCards: {
        opportunityIntel: {
          opportunities: [
            { evidence: 'a', size: 'reach $50M ARR fast' },
            { evidence: 'b' },
            { evidence: 'c' },
          ],
        },
      },
      targets,
    });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.includes('fabrication'))).toBe(true);
  });

  it('fails on status regression', () => {
    const r = evaluateUrl({
      slug: 'test',
      goldenSections: {
        industryMarket: { status: 'complete', data: { a: 1 } },
      },
      liveSections: {
        industryMarket: { status: 'error', data: {} },
      },
      liveCards: {},
      targets,
    });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.includes('regressed from complete'))).toBe(true);
  });

  it('fails on missing live section', () => {
    const r = evaluateUrl({
      slug: 'test',
      goldenSections: { industryMarket: { status: 'complete', data: { a: 1 } } },
      liveSections: {},
      liveCards: {},
      targets,
    });
    expect(r.pass).toBe(false);
    expect(r.failures.some((f) => f.includes('missing in live run'))).toBe(true);
  });
});
