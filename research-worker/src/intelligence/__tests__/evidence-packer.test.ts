import { describe, expect, it } from 'vitest';
import { buildEvidencePack, formatEvidencePack, matchesTopic } from '../evidence-packer';
import type { WikiEntry } from '../../wiki';

const fixture: WikiEntry[] = [
  {
    topic: 'market_size',
    content: '$12B TAM',
    source_runner: 'industryResearch',
    provenance: 'web_search',
    confidence: 80,
    source_url: 'https://example.com/report',
  },
  {
    topic: 'identity_category',
    content: 'B2B SaaS project management',
    source_runner: 'identityResolution',
    provenance: 'ai_synthesis',
    confidence: 85,
  },
  {
    topic: 'pain_point',
    content: 'Ops teams lose 4hr/wk to status updates',
    source_runner: 'industryResearch',
    provenance: 'web_search',
    confidence: 75,
  },
  {
    topic: 'competitor_name',
    content: 'Asana',
    source_runner: 'competitorIntel',
    provenance: 'tool_output',
    confidence: 95,
  },
  {
    topic: 'pain_point',
    content: 'Enterprise buyers require SOC2',
    source_runner: 'industryResearch',
    provenance: 'web_search',
    confidence: 70,
  },
];

describe('matchesTopic', () => {
  it('matches exact topic', () => {
    expect(matchesTopic('market_size', ['market_size'])).toBe(true);
  });
  it('matches prefix glob', () => {
    expect(matchesTopic('market_size', ['market_*'])).toBe(true);
    expect(matchesTopic('identity_category', ['identity_*'])).toBe(true);
    expect(matchesTopic('competitor_name', ['market_*'])).toBe(false);
  });
  it('wildcard matches all', () => {
    expect(matchesTopic('anything', ['*'])).toBe(true);
  });
});

describe('buildEvidencePack', () => {
  it('filters by card topic filter', () => {
    const pack = buildEvidencePack('opportunity', 'industryMarket', fixture, 'r1', 'u1');
    // opportunity filter: identity_* + market_* + pain_* + trend_*
    // Excludes competitor_name
    const topics = pack.entries.map((e) => e.topic);
    expect(topics).not.toContain('competitor_name');
    expect(topics).toContain('identity_category');
    expect(topics).toContain('market_size');
    expect(topics.filter((t) => t === 'pain_point').length).toBe(2);
  });

  it('includes every entry when card uses wildcard filter', () => {
    const pack = buildEvidencePack('strategic-synthesis', 'crossAnalysis', fixture, 'r1', 'u1');
    expect(pack.entries.length).toBe(fixture.length);
  });

  it('produces deterministic output for same input', () => {
    const a = buildEvidencePack('opportunity', 'industryMarket', fixture, 'r1', 'u1');
    const b = buildEvidencePack('opportunity', 'industryMarket', fixture, 'r1', 'u1');
    expect(a.entries.map((e) => e.content)).toEqual(b.entries.map((e) => e.content));
    expect(a.entryIds).toEqual(b.entryIds);
  });

  it('assigns stable topic#N evidenceIds', () => {
    const pack = buildEvidencePack('opportunity', 'industryMarket', fixture, 'r1', 'u1');
    // Two pain_point entries → pain_point#1 and pain_point#2
    const painIds = pack.entryIds.filter((id) => id.startsWith('pain_point#'));
    expect(painIds).toEqual(expect.arrayContaining(['pain_point#1', 'pain_point#2']));
    // Single market_size entry → market_size#1
    expect(pack.entryIds).toContain('market_size#1');
  });

  it('sorts entries by topic then source_runner then content', () => {
    const pack = buildEvidencePack('strategic-synthesis', 'crossAnalysis', fixture, 'r1', 'u1');
    const topics = pack.entries.map((e) => e.topic);
    expect(topics).toEqual([...topics].sort());
  });

  it('returns empty pack when no entries match', () => {
    const onlyCompetitor: WikiEntry[] = [fixture[3]];
    const pack = buildEvidencePack('opportunity', 'industryMarket', onlyCompetitor, 'r1', 'u1');
    expect(pack.entries).toEqual([]);
    expect(pack.entryIds).toEqual([]);
  });

  it('carries runId, userId, cardName, section through', () => {
    const pack = buildEvidencePack('opportunity', 'industryMarket', fixture, 'run-abc', 'user-xyz');
    expect(pack.runId).toBe('run-abc');
    expect(pack.userId).toBe('user-xyz');
    expect(pack.cardName).toBe('opportunity');
    expect(pack.section).toBe('industryMarket');
  });
});

describe('formatEvidencePack', () => {
  it('returns placeholder for empty pack', () => {
    const empty = buildEvidencePack('opportunity', 'industryMarket', [], 'r', 'u');
    expect(formatEvidencePack(empty)).toMatch(/no evidence/i);
  });

  it('formats each entry with id + content + provenance', () => {
    const pack = buildEvidencePack('opportunity', 'industryMarket', fixture, 'r', 'u');
    const text = formatEvidencePack(pack);
    // Ids are present
    expect(text).toMatch(/\[market_size#1\]/);
    // Content is present
    expect(text).toContain('$12B TAM');
    // Provenance present
    expect(text).toContain('web_search');
    // URLs rendered when available
    expect(text).toContain('https://example.com/report');
  });
});
