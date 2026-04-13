/**
 * Deterministic keyword-based document classifier.
 * Assigns section_tags (which runners should see this doc) and doc_kind
 * based on content keywords and file name heuristics.
 *
 * No LLM call — fast and free. Runs server-side at upload time.
 *
 * Section tags map to DISPATCH_PIPELINE_ORDER in dispatch/route.ts:
 *   identityResolution, industryMarket, icpValidation, competitors,
 *   offerAnalysis, keywordIntel, crossAnalysis, mediaPlan
 */

export type DocKind =
  | 'pitch_deck'
  | 'icp_doc'
  | 'case_study'
  | 'brand_book'
  | 'pricing_sheet'
  | 'competitor_analysis'
  | 'market_research'
  | 'other';

export interface DocumentClassification {
  sectionTags: string[];
  docKind: DocKind;
}

// ── Keyword → section mapping ───────────────────────────────────────

interface SectionRule {
  section: string;
  keywords: string[];
}

const SECTION_RULES: readonly SectionRule[] = [
  {
    section: 'icpValidation',
    keywords: [
      'ideal customer',
      'icp',
      'persona',
      'target audience',
      'demographics',
      'buyer profile',
      'customer segment',
      'firmographics',
    ],
  },
  {
    section: 'competitors',
    keywords: [
      'competitor',
      'competitive landscape',
      'competitive analysis',
      'alternative',
      'market player',
      'head-to-head',
      'vs ',
      'versus',
      'swot',
    ],
  },
  {
    section: 'offerAnalysis',
    keywords: [
      'pricing',
      'price',
      'tier',
      'package',
      'offer',
      'funnel',
      'guarantee',
      'proposal',
      'deliverable',
      'scope of work',
      'retainer',
    ],
  },
  {
    section: 'industryMarket',
    keywords: [
      'market size',
      'market research',
      'industry',
      'trend',
      'tam ',
      'sam ',
      'som ',
      'market analysis',
      'demand driver',
      'market dynamics',
    ],
  },
  {
    section: 'crossAnalysis',
    keywords: [
      'brand',
      'brand voice',
      'positioning',
      'messaging',
      'tone of voice',
      'brand guideline',
      'style guide',
      'mission',
      'vision',
      'value proposition',
    ],
  },
  {
    section: 'keywordIntel',
    keywords: [
      'keyword',
      'seo',
      'search term',
      'ppc',
      'search volume',
      'ad group',
      'google ads',
      'sem',
    ],
  },
];

// Case study / testimonial content is useful for both offer and synthesis
const CASE_STUDY_KEYWORDS = [
  'case study',
  'testimonial',
  'success story',
  'client result',
  'roi',
  'before and after',
  'customer story',
];

// ── File name → doc kind mapping ────────────────────────────────────

const FILE_NAME_PATTERNS: readonly { pattern: RegExp; docKind: DocKind; sections: string[] }[] = [
  { pattern: /pitch[_-]?deck|sales[_-]?deck/i, docKind: 'pitch_deck', sections: ['industryMarket', 'offerAnalysis', 'competitors', 'icpValidation', 'crossAnalysis'] },
  { pattern: /icp|persona|ideal[_-]?customer|buyer[_-]?profile/i, docKind: 'icp_doc', sections: ['icpValidation', 'industryMarket'] },
  { pattern: /case[_-]?stud|testimonial|success[_-]?stor/i, docKind: 'case_study', sections: ['offerAnalysis', 'crossAnalysis'] },
  { pattern: /brand[_-]?(?:guide|book|standard)|style[_-]?guide/i, docKind: 'brand_book', sections: ['crossAnalysis'] },
  { pattern: /pricing|rate[_-]?card|price[_-]?list/i, docKind: 'pricing_sheet', sections: ['offerAnalysis'] },
  { pattern: /competitor|competitive|swot/i, docKind: 'competitor_analysis', sections: ['competitors'] },
  { pattern: /market[_-]?research|industry[_-]?report|market[_-]?analysis/i, docKind: 'market_research', sections: ['industryMarket'] },
];

// ── Classifier ──────────────────────────────────────────────────────

function countKeywordHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    if (text.includes(kw)) hits++;
  }
  return hits;
}

export function classifyDocumentSections(
  text: string,
  fileName: string,
): DocumentClassification {
  const lowerText = text.toLowerCase();
  const lowerName = fileName.toLowerCase();

  // 1. Try file name heuristic first (high signal)
  for (const { pattern, docKind, sections } of FILE_NAME_PATTERNS) {
    if (pattern.test(lowerName)) {
      return { sectionTags: sections, docKind };
    }
  }

  // 2. Keyword-based classification on content
  const matchedSections = new Set<string>();
  let docKind: DocKind = 'other';

  for (const rule of SECTION_RULES) {
    const hits = countKeywordHits(lowerText, rule.keywords);
    // Require at least 2 keyword hits to reduce false positives
    if (hits >= 2) {
      matchedSections.add(rule.section);
    }
  }

  // Case study keywords → both offerAnalysis and crossAnalysis
  if (countKeywordHits(lowerText, CASE_STUDY_KEYWORDS) >= 2) {
    matchedSections.add('offerAnalysis');
    matchedSections.add('crossAnalysis');
    if (docKind === 'other') docKind = 'case_study';
  }

  // Infer docKind from strongest section match
  if (docKind === 'other') {
    if (matchedSections.has('icpValidation') && !matchedSections.has('competitors')) {
      docKind = 'icp_doc';
    } else if (matchedSections.has('competitors') && !matchedSections.has('icpValidation')) {
      docKind = 'competitor_analysis';
    } else if (matchedSections.has('offerAnalysis') && matchedSections.size === 1) {
      docKind = 'pricing_sheet';
    } else if (matchedSections.has('industryMarket') && matchedSections.size === 1) {
      docKind = 'market_research';
    } else if (matchedSections.has('crossAnalysis') && matchedSections.size === 1) {
      docKind = 'brand_book';
    } else if (matchedSections.size >= 3) {
      docKind = 'pitch_deck'; // Covers many topics = likely a deck
    }
  }

  // 3. Default: crossAnalysis always sees everything (synthesis runner)
  if (matchedSections.size === 0) {
    matchedSections.add('crossAnalysis');
  }

  return {
    sectionTags: [...matchedSections],
    docKind,
  };
}
