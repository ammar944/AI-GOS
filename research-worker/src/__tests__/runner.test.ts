import { describe, expect, it } from 'vitest';
import {
  buildArtifactProgressUpdate,
  describeToolUseBlock,
  describeWebSearchResultBlock,
  extractDraftFactMessages,
  sanitizeForJson,
} from '../runner';

describe('describeToolUseBlock', () => {
  it('surfaces the actual web search query', () => {
    expect(
      describeToolUseBlock({
        id: 'tool-1',
        type: 'server_tool_use',
        name: 'web_search',
        input: {
          query: 'b2b saas marketing agency market size demand drivers',
        },
      }),
    ).toBe('searching: "b2b saas marketing agency market size demand drivers"');
  });

  it('falls back to a generic message when no query is present', () => {
    expect(
      describeToolUseBlock({
        id: 'tool-2',
        type: 'server_tool_use',
        name: 'web_search',
        input: {},
      }),
    ).toBe('Searching the web');
  });
});

describe('describeWebSearchResultBlock', () => {
  it('surfaces source titles and domains from returned results', () => {
    expect(
      describeWebSearchResultBlock({
        type: 'web_search_tool_result',
        tool_use_id: 'tool-1',
        content: [
          {
            type: 'web_search_result',
            title: '2025 B2B SaaS Benchmarks Report',
            url: 'https://www.example.com/reports/b2b-saas-benchmarks',
            page_age: null,
            encrypted_content: 'abc',
          },
          {
            type: 'web_search_result',
            title: 'State of SaaS Marketing 2025',
            url: 'https://insights.test/saas-marketing',
            page_age: null,
            encrypted_content: 'def',
          },
        ],
      }),
    ).toEqual([
      'web search returned 2 results',
      'source: 2025 B2B SaaS Benchmarks Report (example.com)',
      'source: State of SaaS Marketing 2025 (insights.test)',
    ]);
  });
});

describe('extractDraftFactMessages', () => {
  it('extracts industry runner draft facts', () => {
    expect(
      extractDraftFactMessages(
        '{"categorySnapshot":{"category":"B2B SaaS Marketing Agency Services","marketSize":"$492.34B (2026)","marketMaturity":"mature","buyingBehavior":"Multi-stakeholder evaluation"}}',
      ),
    ).toEqual([
      'category: B2B SaaS Marketing Agency Services',
      'market size: $492.34B (2026)',
      'maturity: mature',
      'buying behavior: Multi-stakeholder evaluation',
    ]);
  });

  it('extracts ICP runner draft facts', () => {
    expect(
      extractDraftFactMessages(
        '{"validatedPersona":"VP Marketing at B2B SaaS ($5M-$50M ARR)","confidenceScore":8,"audienceSize":"~12,000 decision-makers","finalVerdict":"Strong fit for paid media"}',
      ),
    ).toEqual([
      'persona: VP Marketing at B2B SaaS ($5M-$50M ARR)',
      'audience size: ~12,000 decision-makers',
      'verdict: Strong fit for paid media',
      'confidence: 8',
    ]);
  });

  it('extracts competitor runner draft facts', () => {
    expect(
      extractDraftFactMessages(
        '{"competitors":[{"positioning":"Enterprise scheduling","ourAdvantage":"Self-serve onboarding"}],"overallLandscape":"Fragmented market with 3 major players"}',
      ),
    ).toEqual([
      'positioning: Enterprise scheduling',
      'our advantage: Self-serve onboarding',
      'landscape: Fragmented market with 3 major players',
    ]);
  });

  it('extracts offer runner draft facts', () => {
    expect(
      extractDraftFactMessages(
        '{"offerStrength":{"painRelevance":8,"urgency":6,"differentiation":7},"recommendation":"Strong offer with clear positioning"}',
      ),
    ).toEqual([
      'recommendation: Strong offer with clear positioning',
      'pain relevance: 8',
      'urgency: 6',
      'differentiation: 7',
    ]);
  });
});

describe('buildArtifactProgressUpdate', () => {
  it('builds a typed artifact delta progress row', () => {
    expect(
      buildArtifactProgressUpdate({
        type: 'artifact-delta',
        section: 'deepResearchProgram',
        delta: '## Deep Research\n\nAirtable is positioned as an app platform.',
        title: 'Airtable GTM Research',
      }),
    ).toMatchObject({
      message: '## Deep Research\n\nAirtable is positioned as an app platform.',
      phase: 'artifact',
      meta: {
        eventType: 'artifact-delta',
        section: 'deepResearchProgram',
        title: 'Airtable GTM Research',
      },
    });
  });

  it('builds artifact section state progress rows', () => {
    expect(
      buildArtifactProgressUpdate({
        type: 'artifact-section-state',
        section: 'industryMarket',
        status: 'drafting',
      }),
    ).toMatchObject({
      message: 'drafting',
      phase: 'artifact',
      meta: {
        eventType: 'artifact-section-state',
        section: 'industryMarket',
        status: 'drafting',
      },
    });
  });
});

describe('sanitizeForJson', () => {
  it('passes through normal ASCII text', () => {
    expect(sanitizeForJson('hello world')).toBe('hello world');
  });

  it('passes through valid surrogate pairs (emoji)', () => {
    const emoji = '😀🎉';
    expect(sanitizeForJson(emoji)).toBe(emoji);
  });

  it('replaces a lone high surrogate', () => {
    const withLoneHigh = 'before\uD800after';
    expect(sanitizeForJson(withLoneHigh)).toBe('before\uFFFDafter');
  });

  it('replaces a lone low surrogate', () => {
    const withLoneLow = 'before\uDC00after';
    expect(sanitizeForJson(withLoneLow)).toBe('before\uFFFDafter');
  });

  it('replaces multiple lone surrogates', () => {
    const multiple = '\uD800x\uDC00y\uD83D';
    expect(sanitizeForJson(multiple)).toBe('\uFFFDx\uFFFDy\uFFFD');
  });

  it('keeps valid pair but replaces adjacent lone surrogate', () => {
    // Valid pair \uD83D\uDE00 = 😀, followed by lone \uD800
    const mixed = '\uD83D\uDE00\uD800';
    expect(sanitizeForJson(mixed)).toBe('😀\uFFFD');
  });

  it('produces valid JSON after sanitization', () => {
    const withLoneSurrogate = 'test\uD800value';
    const sanitized = sanitizeForJson(withLoneSurrogate);
    // JSON.stringify should not throw on the sanitized string
    const json = JSON.stringify({ text: sanitized });
    expect(JSON.parse(json).text).toBe('test\uFFFDvalue');
  });

  it('handles empty string', () => {
    expect(sanitizeForJson('')).toBe('');
  });
});
