import { describe, expect, it } from 'vitest';
import { preFilterKeywords, type PreFilterConfig } from '../keyword-prefilter';
import type { KeywordOpportunity } from '@/lib/strategic-blueprint/output-types';

// Helper to create a KeywordOpportunity
function kw(keyword: string, overrides?: Partial<KeywordOpportunity>): KeywordOpportunity {
  return {
    keyword,
    searchVolume: 500,
    cpc: 2.5,
    difficulty: 35,
    source: 'gap_organic',
    ...overrides,
  };
}

const defaultConfig: PreFilterConfig = {
  clientCategory: 'B2B SaaS AI-Powered Restaurant Management Software',
};

const nonFoodConfig: PreFilterConfig = {
  clientCategory: 'B2B SaaS Marketing Attribution Software',
};

describe('preFilterKeywords', () => {
  // =========================================================================
  // User-specified test cases
  // =========================================================================

  it('PASS: "ai restaurant marketing" — relevant industry term', () => {
    const result = preFilterKeywords([kw('ai restaurant marketing')], defaultConfig);
    expect(result.kept).toHaveLength(1);
    expect(result.removed).toHaveLength(0);
  });

  it('FAIL: "Ai Bistro NYC" — venue word + location', () => {
    const result = preFilterKeywords([kw('Ai Bistro NYC')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].reason).toBe('business_name_query');
  });

  it('PASS: "Ai Fiori NYC" — proper noun without venue word (caught by LLM classifier)', () => {
    // "Fiori" is not a venue word, so deterministic rules can't detect it.
    // The LLM classifier will handle this case.
    const result = preFilterKeywords([kw('Ai Fiori NYC')], nonFoodConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('PASS: "ai restaurant technology" — relevant industry term', () => {
    const result = preFilterKeywords([kw('ai restaurant technology')], defaultConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('FAIL: "Ai Japanese Restaurant menu" — business name + menu action', () => {
    const result = preFilterKeywords([kw('Ai Japanese Restaurant menu')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].reason).toBe('business_name_query');
  });

  it('FAIL: "restaurant français yelp" — platform query', () => {
    const result = preFilterKeywords([kw('restaurant français yelp')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed[0].reason).toBe('platform_aggregator_query');
  });

  it('PASS: "artificial intelligence restaurant industry" — relevant industry term', () => {
    const result = preFilterKeywords([kw('artificial intelligence restaurant industry')], defaultConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('FAIL: "best ai tools for restaurants 2019" — stale date', () => {
    const result = preFilterKeywords([kw('best ai tools for restaurants 2019')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed[0].reason).toMatch(/stale_date_reference/);
  });

  it('PASS: "ai powered restaurant management" — relevant industry term', () => {
    const result = preFilterKeywords([kw('ai powered restaurant management')], defaultConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('FAIL: "opentable ai fiori reservation" — platform query', () => {
    const result = preFilterKeywords([kw('opentable ai fiori reservation')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed[0].reason).toBe('platform_aggregator_query');
  });

  it('PASS: "ai chatbot for restaurant ordering" — relevant industry term', () => {
    const result = preFilterKeywords([kw('ai chatbot for restaurant ordering')], defaultConfig);
    expect(result.kept).toHaveLength(1);
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('PASS: "AI Kitchen" — product name (no location/action marker)', () => {
    const result = preFilterKeywords([kw('AI Kitchen')], nonFoodConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('FAIL: "Ai Kitchen NYC restaurant" — business name + location', () => {
    const result = preFilterKeywords([kw('Ai Kitchen NYC restaurant')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed[0].reason).toBe('business_name_query');
  });

  it('handles empty keyword list', () => {
    const result = preFilterKeywords([], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it('handles all keywords filtered out gracefully', () => {
    const allBad = [
      kw('best restaurant bar NYC'),
      kw('opentable reservation'),
      kw('yelp restaurant review'),
    ];
    const result = preFilterKeywords(allBad, nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed).toHaveLength(3);
  });

  // =========================================================================
  // Mojibake detection
  // =========================================================================

  it('FAIL: mojibake keyword "franÃ§ais restaurant" — mojibake artifacts', () => {
    const result = preFilterKeywords([kw('franÃ§ais restaurant')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed[0].reason).toBe('mojibake_artifacts');
  });

  // =========================================================================
  // Stale date edge cases
  // =========================================================================

  it('PASS: stale date in time-relevant industry (finance)', () => {
    const financeConfig: PreFilterConfig = {
      clientCategory: 'Financial Investment Advisory Platform',
    };
    const result = preFilterKeywords([kw('best investment strategies 2020')], financeConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('PASS: current year is not stale', () => {
    const result = preFilterKeywords([kw('best ai tools 2026')], nonFoodConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('FAIL: year 2021 in non-time industry', () => {
    const result = preFilterKeywords([kw('marketing automation trends 2021')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed[0].reason).toMatch(/stale_date_reference_2021/);
  });

  // =========================================================================
  // Menu/event in food industry (should PASS)
  // =========================================================================

  it('PASS: "happy hour" in food/hospitality category', () => {
    const foodConfig: PreFilterConfig = {
      clientCategory: 'Restaurant Technology and Hospitality Management',
    };
    const result = preFilterKeywords([kw('best happy hour deals app')], foodConfig);
    expect(result.kept).toHaveLength(1);
  });

  it('FAIL: "happy hour" in non-food category', () => {
    const result = preFilterKeywords([kw('best happy hour deals')], nonFoodConfig);
    expect(result.kept).toHaveLength(0);
    expect(result.removed[0].reason).toBe('menu_event_search');
  });

  // =========================================================================
  // Client company name exclusion
  // =========================================================================

  it('PASS: keyword matches client company name (should not filter)', () => {
    const configWithName: PreFilterConfig = {
      clientCategory: 'B2B SaaS',
      clientCompanyName: 'AI Kitchen',
    };
    const result = preFilterKeywords([kw('AI Kitchen NYC restaurant')], configWithName);
    // Should pass because "AI Kitchen" is the client's own name
    expect(result.kept).toHaveLength(1);
  });

  // =========================================================================
  // Multiple rules — first match wins
  // =========================================================================

  it('platform rule fires before stale date rule', () => {
    const result = preFilterKeywords([kw('yelp restaurant reviews 2019')], nonFoodConfig);
    expect(result.removed[0].reason).toBe('platform_aggregator_query');
  });

  // =========================================================================
  // Mixed batch — some pass, some fail
  // =========================================================================

  it('correctly splits a mixed batch', () => {
    const batch = [
      kw('ai marketing attribution'),       // PASS
      kw('best restaurant bar downtown'),    // FAIL: business name (venue + location)
      kw('marketing analytics platform'),    // PASS
      kw('opentable reservation nyc'),       // FAIL: platform
      kw('ai powered crm tools'),            // PASS
    ];
    const result = preFilterKeywords(batch, nonFoodConfig);
    expect(result.kept).toHaveLength(3);
    expect(result.removed).toHaveLength(2);
    expect(result.kept.map(k => k.keyword)).toEqual([
      'ai marketing attribution',
      'marketing analytics platform',
      'ai powered crm tools',
    ]);
  });
});
