import { describe, expect, it } from 'vitest';
import {
  describeToolUseBlock,
  describeWebSearchResultBlock,
  extractDraftFactMessages,
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
    ).toBe('web search started');
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
  it('extracts complete draft facts from partial JSON snapshots', () => {
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
});
