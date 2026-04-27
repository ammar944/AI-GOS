/**
 * Deterministic document classifier for ingest-docs.
 */
import type { DocumentKindHint, GtmStageTag } from "../schemas/input.ts";

export interface DocumentClassification {
  docKind: DocumentKindHint;
  gtmStageTags: GtmStageTag[];
}

interface StageRule {
  stage: GtmStageTag;
  keywords: string[];
}

const STAGE_RULES: readonly StageRule[] = [
  {
    stage: "research-buyer-icp",
    keywords: [
      "ideal customer",
      "icp",
      "persona",
      "target audience",
      "demographics",
      "buyer profile",
      "customer segment",
      "firmographics",
    ],
  },
  {
    stage: "research-competitor",
    keywords: [
      "competitor",
      "competitive landscape",
      "competitive analysis",
      "alternative",
      "market player",
      "head-to-head",
      "versus",
      "swot",
    ],
  },
  {
    stage: "research-offer",
    keywords: [
      "pricing",
      "price",
      "tier",
      "package",
      "offer",
      "funnel",
      "guarantee",
      "proposal",
      "deliverable",
      "scope of work",
      "retainer",
    ],
  },
  {
    stage: "research-market-category",
    keywords: [
      "market size",
      "market research",
      "industry",
      "trend",
      "tam ",
      "sam ",
      "som ",
      "market analysis",
      "demand driver",
      "market dynamics",
    ],
  },
  {
    stage: "synthesize-positioning",
    keywords: [
      "brand",
      "brand voice",
      "positioning",
      "messaging",
      "tone of voice",
      "brand guideline",
      "style guide",
      "mission",
      "vision",
      "value proposition",
    ],
  },
  {
    stage: "research-keywords",
    keywords: [
      "keyword",
      "seo",
      "search term",
      "ppc",
      "search volume",
      "ad group",
      "google ads",
      "sem",
    ],
  },
  {
    stage: "synthesize-media-plan",
    keywords: [
      "monthly ad budget",
      "daily budget",
      "campaign duration",
      "target cpl",
      "target cac",
      "demos per month",
      "sqls per month",
    ],
  },
];

const CASE_STUDY_KEYWORDS = [
  "case study",
  "testimonial",
  "success story",
  "client result",
  "roi",
  "before and after",
  "customer story",
];

const FILE_NAME_PATTERNS: readonly {
  pattern: RegExp;
  docKind: DocumentKindHint;
  stages: GtmStageTag[];
}[] = [
  {
    pattern: /pitch[_-]?deck|sales[_-]?deck|growth[_-]?brief|business[_-]?brief/i,
    docKind: "pitch_deck",
    stages: [
      "ingest-identity",
      "research-market-category",
      "research-offer",
      "research-competitor",
      "research-buyer-icp",
      "synthesize-positioning",
    ],
  },
  {
    pattern: /icp|persona|ideal[_-]?customer|buyer[_-]?profile/i,
    docKind: "icp_doc",
    stages: ["research-buyer-icp", "research-market-category"],
  },
  {
    pattern: /case[_-]?stud|testimonial|success[_-]?stor/i,
    docKind: "case_study",
    stages: ["research-offer", "synthesize-positioning"],
  },
  {
    pattern: /brand[_-]?(?:guide|book|standard)|style[_-]?guide/i,
    docKind: "brand_book",
    stages: ["synthesize-positioning"],
  },
  {
    pattern: /pricing|rate[_-]?card|price[_-]?list/i,
    docKind: "pricing_sheet",
    stages: ["research-offer", "synthesize-media-plan"],
  },
  {
    pattern: /competitor|competitive|swot/i,
    docKind: "competitor_analysis",
    stages: ["research-competitor"],
  },
  {
    pattern: /market[_-]?research|industry[_-]?report|market[_-]?analysis/i,
    docKind: "market_research",
    stages: ["research-market-category"],
  },
  {
    pattern: /transcript|fathom|meeting|call[_-]?notes/i,
    docKind: "meeting_transcript",
    stages: ["research-buyer-icp", "research-offer", "synthesize-positioning"],
  },
];

function countKeywordHits(text: string, keywords: readonly string[]): number {
  return keywords.reduce((hits, keyword) => (text.includes(keyword) ? hits + 1 : hits), 0);
}

export function classifyDocument(text: string, fileName: string): DocumentClassification {
  const lowerText = text.toLowerCase();
  const lowerName = fileName.toLowerCase();

  for (const { pattern, docKind, stages } of FILE_NAME_PATTERNS) {
    if (pattern.test(lowerName)) {
      return { docKind, gtmStageTags: [...stages] };
    }
  }

  const matchedStages = new Set<GtmStageTag>();
  let docKind: DocumentKindHint = "other";

  for (const rule of STAGE_RULES) {
    if (countKeywordHits(lowerText, rule.keywords) >= 2) {
      matchedStages.add(rule.stage);
    }
  }

  if (countKeywordHits(lowerText, CASE_STUDY_KEYWORDS) >= 2) {
    matchedStages.add("research-offer");
    matchedStages.add("synthesize-positioning");
    docKind = "case_study";
  }

  if (docKind === "other") {
    if (matchedStages.has("research-buyer-icp") && !matchedStages.has("research-competitor")) {
      docKind = "icp_doc";
    } else if (
      matchedStages.has("research-competitor") &&
      !matchedStages.has("research-buyer-icp")
    ) {
      docKind = "competitor_analysis";
    } else if (matchedStages.has("research-offer") && matchedStages.size === 1) {
      docKind = "pricing_sheet";
    } else if (matchedStages.has("research-market-category") && matchedStages.size === 1) {
      docKind = "market_research";
    } else if (matchedStages.has("synthesize-positioning") && matchedStages.size === 1) {
      docKind = "brand_book";
    } else if (matchedStages.size >= 3) {
      docKind = "pitch_deck";
    }
  }

  if (matchedStages.size === 0) {
    matchedStages.add("synthesize-positioning");
  }

  return {
    docKind,
    gtmStageTags: [...matchedStages],
  };
}
