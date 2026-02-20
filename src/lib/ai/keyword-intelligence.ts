// Keyword Intelligence Enrichment
// Uses SpyFu API to build competitive keyword gap analysis
// Follows the same pattern as competitor-enrichment.ts

import {
  isSpyFuAvailable,
  extractDomain,
  getDomainStats,
  getCompetingSeoKeywords,
  getCompetingPpcKeywords,
  getMostValuableKeywords,
  getRelatedKeywords,
  getKeywordsByBulkSearch,
  type SpyFuDomainStats,
  type SpyFuKeywordResult,
  type SpyFuKombatResult,
} from './spyfu-client';
import { preFilterKeywords } from './keyword-prefilter';
import { classifyKeywordRelevance } from './keyword-classifier';
import type {
  KeywordIntelligence,
  KeywordOpportunity,
  DomainKeywordStats,
  ContentTopicCluster,
  KeywordSource,
  CompetitorSnapshot,
} from '@/lib/strategic-blueprint/output-types';

// =============================================================================
// Types
// =============================================================================

export interface KeywordIntelligenceResult {
  keywordIntelligence: KeywordIntelligence;
  cost: number;
}

export interface KeywordBusinessContext {
  industry: string;        // e.g., "B2B SaaS Marketing Attribution Software"
  productDescription: string; // e.g., "AI-powered marketing attribution platform"
  companyName: string;     // e.g., "FlowMetrics"
  competitorNames: string[]; // e.g., ["Dreamdata", "Windsor.ai", "Funnel"]
}

// =============================================================================
// Helpers
// =============================================================================

/** Convert SpyFuDomainStats to our DomainKeywordStats type */
function toDomainStats(raw: SpyFuDomainStats): DomainKeywordStats {
  return {
    domain: raw.domain,
    organicKeywords: raw.organicKeywords,
    paidKeywords: raw.paidKeywords,
    monthlyOrganicClicks: raw.monthlyOrganicClicks,
    monthlyPaidClicks: raw.monthlyPaidClicks,
    organicClicksValue: raw.organicClicksValue,
    paidClicksValue: raw.paidClicksValue,
  };
}

/** Convert SpyFuKeywordResult to KeywordOpportunity */
function toOpportunity(
  raw: SpyFuKeywordResult,
  source: KeywordSource,
  competitors?: string[],
): KeywordOpportunity {
  return {
    keyword: raw.keyword,
    searchVolume: raw.searchVolume,
    cpc: raw.cpc,
    difficulty: raw.difficulty,
    clicksPerMonth: raw.clicksPerMonth,
    source,
    competitors,
  };
}

/** Deduplicate keywords by keyword string, keeping the one with higher search volume */
function deduplicateKeywords(keywords: KeywordOpportunity[]): KeywordOpportunity[] {
  const map = new Map<string, KeywordOpportunity>();
  for (const kw of keywords) {
    const key = kw.keyword.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing || kw.searchVolume > existing.searchVolume) {
      map.set(key, kw);
    }
  }
  return Array.from(map.values());
}

/** Categorize keywords into quick wins, long-term plays, and high-intent */
function categorizeKeywords(allKeywords: KeywordOpportunity[]): {
  quickWins: KeywordOpportunity[];
  longTermPlays: KeywordOpportunity[];
  highIntentKeywords: KeywordOpportunity[];
} {
  const quickWins = allKeywords
    .filter(kw => kw.difficulty <= 40 && kw.searchVolume >= 100)
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, 20);

  const longTermPlays = allKeywords
    .filter(kw => kw.difficulty > 40 && kw.searchVolume >= 500)
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, 20);

  const highIntentKeywords = allKeywords
    .filter(kw => kw.cpc >= 3.0)
    .sort((a, b) => b.cpc - a.cpc)
    .slice(0, 20);

  return { quickWins, longTermPlays, highIntentKeywords };
}

/** Build content topic clusters from keyword list */
function buildContentClusters(keywords: KeywordOpportunity[]): ContentTopicCluster[] {
  // Group keywords by first significant word(s) to form clusters
  const clusterMap = new Map<string, KeywordOpportunity[]>();

  for (const kw of keywords) {
    const words = kw.keyword.toLowerCase().split(/\s+/);
    // Use first 1-2 meaningful words as cluster key
    const key = words.slice(0, Math.min(2, words.length)).join(' ');
    if (!clusterMap.has(key)) {
      clusterMap.set(key, []);
    }
    clusterMap.get(key)!.push(kw);
  }

  // Only keep clusters with 3+ keywords
  const clusters: ContentTopicCluster[] = [];
  for (const [theme, clusterKeywords] of clusterMap.entries()) {
    if (clusterKeywords.length < 3) continue;

    const totalVolume = clusterKeywords.reduce((sum, kw) => sum + kw.searchVolume, 0);
    const avgDifficulty = clusterKeywords.reduce((sum, kw) => sum + kw.difficulty, 0) / clusterKeywords.length;
    const avgCpc = clusterKeywords.reduce((sum, kw) => sum + kw.cpc, 0) / clusterKeywords.length;

    // Determine recommended format based on intent signals
    let format = 'blog';
    if (avgCpc >= 5) format = 'landing page';
    else if (theme.includes('vs') || theme.includes('compare') || theme.includes('alternative')) format = 'comparison';
    else if (theme.includes('how') || theme.includes('guide') || theme.includes('tutorial')) format = 'guide';
    else if (avgDifficulty > 60) format = 'pillar page';

    clusters.push({
      theme: theme.charAt(0).toUpperCase() + theme.slice(1),
      keywords: clusterKeywords.map(kw => kw.keyword).slice(0, 10),
      searchVolumeTotal: totalVolume,
      recommendedFormat: format,
    });
  }

  // Sort by total volume, return top 10
  return clusters
    .sort((a, b) => b.searchVolumeTotal - a.searchVolumeTotal)
    .slice(0, 10);
}

// =============================================================================
// Relevance Filtering
// =============================================================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'may', 'might', 'can', 'could', 'must', 'that', 'this', 'these', 'those',
  'it', 'its', 'from', 'as', 'not', 'no', 'nor', 'so', 'if', 'then', 'than',
  'too', 'very', 'just', 'about', 'above', 'after', 'again', 'all', 'also',
  'am', 'any', 'because', 'before', 'between', 'both', 'each', 'few',
  'further', 'here', 'how', 'into', 'more', 'most', 'much', 'no', 'only',
  'other', 'our', 'out', 'over', 'own', 'same', 'she', 'some', 'such',
  'their', 'them', 'there', 'they', 'through', 'under', 'until', 'up',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'new',
  'your', 'you', 'we', 'my', 'me',
]);

/** Extract relevance filter terms from business context */
function generateRelevanceTerms(context: KeywordBusinessContext): Set<string> {
  const terms = new Set<string>();

  const allText = [
    context.industry,
    context.productDescription,
  ].join(' ').toLowerCase();

  // Extract meaningful words (3+ chars, not stop words)
  const words = allText.split(/[\s,.\-\/()]+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  words.forEach(w => terms.add(w));

  // Also add common industry-related compound terms
  // e.g., "marketing attribution" -> add both words + the phrase
  const phrases = [context.industry.toLowerCase(), context.productDescription.toLowerCase()];
  for (const phrase of phrases) {
    // Add 2-word combinations
    const phraseWords = phrase.split(/[\s,.\-\/()]+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w));
    for (let i = 0; i < phraseWords.length - 1; i++) {
      terms.add(phraseWords[i]);
    }
  }

  return terms;
}

// Maximum word count for a valid keyword (rejects full sentences / homework questions)
const MAX_KEYWORD_WORDS = 6;

// Consumer-navigational detection — keywords with massive volume but near-zero
// CPC are brand-navigational queries (e.g., "chick fil a menu" at 203K/mo, $0.15 CPC).
// Unlike a hard volume cap, this preserves legitimate B2B head terms like
// "email marketing" (60K/mo, $5+ CPC) that have real commercial intent.
const NAVIGATIONAL_VOLUME_FLOOR = 50_000;
const NAVIGATIONAL_CPC_CEILING = 1.00;

function isConsumerNavigational(kw: SpyFuKeywordResult): boolean {
  return kw.searchVolume > NAVIGATIONAL_VOLUME_FLOOR && kw.cpc < NAVIGATIONAL_CPC_CEILING;
}

// Default noise terms — consumer/lifestyle terms unlikely relevant in B2B contexts.
// Terms that appear in the business context (industry/productDescription) are automatically
// excluded at runtime, so e.g. an Instagram analytics tool won't block "instagram".
const DEFAULT_NOISE_TERMS = new Set([
  'icon', 'icons', 'logo', 'logos', 'wallpaper', 'wallpapers', 'clipart',
  'meme', 'memes', 'recipe', 'recipes', 'game', 'games', 'movie', 'movies',
  'song', 'songs', 'tattoo', 'tattoos', 'hairstyle', 'hairstyles',
  'outfit', 'outfits', 'anime', 'manga',
  'affiliate', 'instagram', 'tiktok', 'pinterest', 'snapchat',
  'facebook', 'twitter', 'reddit', 'youtube', 'twitch',
]);

/** Category of non-buyer intent terms with context-aware override */
interface IntentExclusionCategory {
  name: string;
  terms: Set<string>;
  contextOverrideTerms: string[];
}

/** Non-buyer intent categories — skipped when contextOverrideTerms match business context */
const NON_BUYER_INTENT_CATEGORIES: IntentExclusionCategory[] = [
  {
    name: 'job_career',
    terms: new Set([
      'jobs', 'job', 'careers', 'career', 'hiring', 'salary', 'salaries',
      'internship', 'internships', 'resume', 'resumes', 'employment',
      'recruiting', 'recruitment', 'recruiter', 'vacancy', 'vacancies',
      'staffing', 'apprenticeship',
    ]),
    contextOverrideTerms: ['recruitment', 'recruiting', 'hiring', 'staffing', 'talent', 'applicant', 'hr'],
  },
  {
    name: 'educational',
    terms: new Set([
      'course', 'courses', 'certification', 'certifications', 'tutorial',
      'tutorials', 'degree', 'degrees', 'curriculum', 'syllabus', 'textbook',
      'homework', 'college', 'university', 'student', 'students',
    ]),
    contextOverrideTerms: ['education', 'learning', 'course', 'training', 'certification', 'tutorial', 'edtech', 'lms'],
  },
  {
    name: 'free_diy',
    terms: new Set([
      'freeware', 'printable', 'diy', 'homemade', 'cheap', 'cheapest',
      'coupon', 'coupons',
    ]),
    contextOverrideTerms: ['free', 'freemium', 'marketplace', 'download'],
  },
  {
    name: 'service_provider',
    terms: new Set([
      'agency', 'agencies', 'consultant', 'consultants', 'consulting',
      'contractor', 'contractors',
    ]),
    contextOverrideTerms: ['agency', 'consultant', 'consulting', 'freelance', 'contractor'],
  },
];

/** Non-buyer intent phrases — rejected if found anywhere in the keyword */
const NON_BUYER_INTENT_PHRASES: string[] = [
  'near me', 'nearby', 'in my area', 'entry level', 'part time',
  'full time', 'work from home',
];

/** Non-buyer intent prefixes — rejected if keyword starts with these */
const NON_BUYER_INTENT_PREFIXES: string[] = [
  'what is ', 'what are ', 'define ', 'meaning of ',
  'how to become ', 'how to learn ', 'how to start ',
];

// Generic terms excluded from core terms — too broad to indicate specific relevance
const GENERIC_TERMS = new Set([
  'software', 'platform', 'tool', 'tools', 'solution', 'solutions',
  'service', 'services', 'system', 'systems', 'product', 'products',
  'powered', 'based', 'driven', 'enabled', 'integrated', 'automated',
  'provides', 'helps', 'offers', 'delivers', 'enables', 'using',
  'company', 'business', 'enterprise', 'startup', 'online', 'digital',
  'best', 'free', 'easy', 'fast', 'simple', 'advanced', 'modern',
  'custom', 'real', 'time', 'smart', 'intelligent', 'complete',
]);

/** Bundled filter state built once per enrichment run from business context */
interface RelevanceFilterConfig {
  relevanceTerms: Set<string>;  // All terms from industry + productDescription
  coreTerms: Set<string>;       // Specific terms from productDescription (strict filter bypass)
  noiseTerms: Set<string>;      // Default noise minus business context terms
  competitorNames: string[];
  intentExclusionTerms: Set<string>;  // Flattened active exclusion terms
  intentExclusionPhrases: string[];   // Active phrase patterns
  intentExclusionPrefixes: string[];  // Active prefix patterns
}

/** Build filter config from business context. Noise/core terms adapt to the business. */
function buildRelevanceFilter(context: KeywordBusinessContext): RelevanceFilterConfig {
  const relevanceTerms = generateRelevanceTerms(context);

  // Core terms: product-description-specific words (not generic, not stop words).
  // These bypass the 2-match requirement in strict mode — any keyword containing
  // a core term is likely relevant (e.g. "attribution" for a marketing attribution tool).
  const productWords = context.productDescription.toLowerCase()
    .split(/[\s,.\-\/()]+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !GENERIC_TERMS.has(w));
  const coreTerms = new Set(productWords);

  // Effective noise: default list minus any terms the business actually uses.
  // An Instagram analytics tool mentions "instagram" → it won't be blocked.
  const contextWords = new Set(
    [context.industry, context.productDescription]
      .join(' ').toLowerCase()
      .split(/[\s,.\-\/()]+/)
  );
  const noiseTerms = new Set(DEFAULT_NOISE_TERMS);
  for (const term of noiseTerms) {
    if (contextWords.has(term)) noiseTerms.delete(term);
  }

  // Compute active intent exclusion terms — skip categories whose override terms
  // appear in the business context (e.g. a recruiting tool keeps "hiring" keywords).
  const intentExclusionTerms = new Set<string>();
  for (const category of NON_BUYER_INTENT_CATEGORIES) {
    const overridden = category.contextOverrideTerms.some(t => contextWords.has(t));
    if (!overridden) {
      for (const term of category.terms) {
        intentExclusionTerms.add(term);
      }
    }
  }

  const intentExclusionPhrases = NON_BUYER_INTENT_PHRASES;
  const intentExclusionPrefixes = NON_BUYER_INTENT_PREFIXES;

  return {
    relevanceTerms, coreTerms, noiseTerms, competitorNames: context.competitorNames,
    intentExclusionTerms, intentExclusionPhrases, intentExclusionPrefixes,
  };
}

/** Common checks shared by both relevance filters */
function baseRelevanceCheck(keyword: string, config: RelevanceFilterConfig): { pass: boolean; kwWords: string[] } | false {
  const kwLower = keyword.toLowerCase();
  const kwWords = kwLower.split(/\s+/);

  // Reject full sentences (homework questions, long-tail noise)
  if (kwWords.length > MAX_KEYWORD_WORDS) return false;

  // Reject keywords containing noise terms (adapted to business context)
  if (kwWords.some(w => config.noiseTerms.has(w))) return false;

  // Reject keywords with non-buyer intent terms (adapted to business context)
  if (kwWords.some(w => config.intentExclusionTerms.has(w))) return false;

  // Reject multi-word intent phrases (e.g., "near me")
  if (config.intentExclusionPhrases.some(phrase => kwLower.includes(phrase))) return false;

  // Reject definitional/educational prefix patterns
  if (config.intentExclusionPrefixes.some(prefix => kwLower.startsWith(prefix))) return false;

  // Exclude competitor brand names used as generic terms
  const competitorBrands = config.competitorNames.map(n => n.toLowerCase().split(/[\s.]+/)[0]);
  const isCompetitorBrand = competitorBrands.some(brand =>
    kwLower.startsWith(brand + ' ') && !kwWords.slice(1).some(w => w.length >= 3)
  );
  if (isCompetitorBrand) return false;

  return { pass: true, kwWords };
}

/** Standard relevance check — 1 relevance term match is sufficient */
function isKeywordRelevant(keyword: string, config: RelevanceFilterConfig): boolean {
  const base = baseRelevanceCheck(keyword, config);
  if (!base) return false;

  return base.kwWords.some(word => config.relevanceTerms.has(word));
}

/**
 * Stricter relevance check for related keyword expansions.
 * Multi-word keywords must match 2+ relevance terms OR contain a core term
 * (derived from product description). Single-word keywords still need just 1 match.
 */
function isKeywordRelevantStrict(keyword: string, config: RelevanceFilterConfig): boolean {
  const base = baseRelevanceCheck(keyword, config);
  if (!base) return false;

  const matchCount = base.kwWords.filter(word => config.relevanceTerms.has(word)).length;

  // Single-word keywords: 1 match is sufficient
  if (base.kwWords.length === 1) return matchCount >= 1;

  // If any word is a core product term, 1 match is enough
  if (base.kwWords.some(w => config.coreTerms.has(w))) return matchCount >= 1;

  // Multi-word keywords: require 2+ relevance term matches
  return matchCount >= 2;
}

// Rough cost estimate: ~$0.005 per row
const COST_PER_ROW = 0.005;

// =============================================================================
// Main Enrichment Function
// =============================================================================

/**
 * Enrich keyword intelligence from SpyFu API.
 *
 * @param clientDomain - Client's website URL or domain
 * @param competitors - Competitor snapshots from Phase 1
 * @param onProgress - Progress callback
 * @param businessContext - Business context for relevance filtering
 * @returns KeywordIntelligenceResult or null if unavailable
 */
export async function enrichKeywordIntelligence(
  clientDomain: string,
  competitors: CompetitorSnapshot[],
  onProgress?: (message: string) => void,
  businessContext?: KeywordBusinessContext,
): Promise<KeywordIntelligenceResult | null> {
  if (!isSpyFuAvailable()) {
    console.warn('[Keyword Intelligence] SPYFU_API_KEY not configured - skipping');
    return null;
  }

  if (!clientDomain?.trim()) {
    console.warn('[Keyword Intelligence] No client domain provided - skipping');
    return null;
  }

  const cleanClientDomain = extractDomain(clientDomain);
  let totalRows = 0;

  onProgress?.('Starting keyword intelligence analysis...');

  // Extract competitor domains (only those with websites)
  const competitorDomains = competitors
    .filter(c => c.website?.trim())
    .map(c => ({
      name: c.name,
      domain: extractDomain(c.website!),
    }));

  if (competitorDomains.length === 0) {
    console.warn('[Keyword Intelligence] No competitor domains available');
  }

  // =========================================================================
  // Step 1: Parallel batch — Domain stats + Kombat
  // =========================================================================

  onProgress?.('Fetching domain stats and keyword gaps...');

  const [
    clientStatsResult,
    ...competitorStatsResults
  ] = await Promise.allSettled([
    // Client domain stats
    getDomainStats(cleanClientDomain).then(stats => {
      totalRows += 1;
      return stats;
    }),
    // Competitor domain stats (parallel)
    ...competitorDomains.map(c =>
      getDomainStats(c.domain).then(stats => {
        totalRows += 1;
        return { name: c.name, domain: c.domain, stats };
      })
    ),
  ]);

  const clientStats = clientStatsResult.status === 'fulfilled' ? clientStatsResult.value : null;
  const competitorStats = competitorStatsResults
    .filter((r): r is PromiseFulfilledResult<{ name: string; domain: string; stats: SpyFuDomainStats }> =>
      r.status === 'fulfilled'
    )
    .map(r => r.value);

  if (clientStats) {
    onProgress?.(`Client domain: ${clientStats.organicKeywords} organic, ${clientStats.paidKeywords} paid keywords`);
  }

  // =========================================================================
  // Step 2: Kombat gap analysis + top competitor keywords (parallel)
  // =========================================================================

  const competitorDomainList = competitorDomains.map(c => c.domain);

  const [
    organicGapsResult,
    paidGapsResult,
    ...competitorTopResults
  ] = await Promise.allSettled([
    // Organic keyword gaps
    competitorDomainList.length > 0
      ? getCompetingSeoKeywords(cleanClientDomain, competitorDomainList, 50).then(r => {
          totalRows += 50;
          return r;
        })
      : Promise.resolve({ weaknesses: [], shared: [], strengths: [] } as SpyFuKombatResult),
    // Paid keyword gaps
    competitorDomainList.length > 0
      ? getCompetingPpcKeywords(cleanClientDomain, competitorDomainList, 50).then(r => {
          totalRows += 50;
          return r;
        })
      : Promise.resolve({ weaknesses: [], shared: [], strengths: [] } as SpyFuKombatResult),
    // Top keywords per competitor
    ...competitorDomains.map(c =>
      getMostValuableKeywords(c.domain, 15).then(keywords => {
        totalRows += 15;
        return { name: c.name, domain: c.domain, keywords };
      })
    ),
  ]);

  const organicGaps = organicGapsResult.status === 'fulfilled' ? organicGapsResult.value : null;
  const paidGaps = paidGapsResult.status === 'fulfilled' ? paidGapsResult.value : null;
  const competitorTopKeywords = competitorTopResults
    .filter((r): r is PromiseFulfilledResult<{ name: string; domain: string; keywords: SpyFuKeywordResult[] }> =>
      r.status === 'fulfilled'
    )
    .map(r => r.value);

  onProgress?.(`Found ${organicGaps?.weaknesses.length ?? 0} organic gaps, ${paidGaps?.weaknesses.length ?? 0} paid gaps`);

  // =========================================================================
  // Step 2.5: Relevance filtering (removes irrelevant keywords from Kombat)
  // =========================================================================

  const filterConfig = businessContext ? buildRelevanceFilter(businessContext) : null;

  // Filter function — navigational detection runs unconditionally, relevance filter only with business context
  let navigationalFilteredCount = 0;
  const filterRelevant = (keywords: SpyFuKeywordResult[]): SpyFuKeywordResult[] => {
    const navFiltered = keywords.filter(kw => {
      if (isConsumerNavigational(kw)) {
        navigationalFilteredCount++;
        return false;
      }
      return true;
    });
    if (!filterConfig) return navFiltered;
    return navFiltered.filter(kw => isKeywordRelevant(kw.keyword, filterConfig));
  };

  // Apply relevance filtering to all keyword gap lists
  const filteredOrganicWeaknesses = filterRelevant(organicGaps?.weaknesses ?? []);
  const filteredPaidWeaknesses = filterRelevant(paidGaps?.weaknesses ?? []);
  const filteredShared = filterRelevant(organicGaps?.shared ?? []);

  if (businessContext) {
    onProgress?.(`Filtered keywords: ${filteredOrganicWeaknesses.length}/${organicGaps?.weaknesses.length ?? 0} organic, ${filteredPaidWeaknesses.length}/${paidGaps?.weaknesses.length ?? 0} paid relevant to ${businessContext.industry}`);
  }

  // Capture client strengths from Kombat (keywords only client ranks for)
  const clientStrengthKeywords = [
    ...(organicGaps?.strengths ?? []),
    ...(paidGaps?.strengths ?? []),
  ].filter(kw => !isConsumerNavigational(kw));

  // Convert competitor top keywords to opportunities (NOT relevance-filtered —
  // these represent what the competitor ranks for, not what must match the client's industry)
  const competitorTopKeywordEntries = competitorTopKeywords.map(c => {
    const opportunities = c.keywords.map(kw => toOpportunity(kw, 'competitor_top', [c.name]));

    // Data gap detection: log if competitor has organic presence but empty top keywords
    if (opportunities.length === 0 && c.keywords.length === 0) {
      console.log(`[Data Gap] Competitor "${c.name}" (${c.domain}) returned 0 top keywords from SpyFu`);
    }

    return {
      competitorName: c.name,
      domain: c.domain,
      keywords: opportunities,
    };
  });

  // Flatten competitor top keywords for inclusion in overall analysis
  const allCompetitorTopOpportunities = competitorTopKeywordEntries.flatMap(c => c.keywords);

  // =========================================================================
  // Step 3: Related keyword expansion from top seed keywords
  // =========================================================================

  // Use FILTERED keywords for seed selection (avoids picking irrelevant seeds like "funnel", "windsor")
  const seedKeywords = [
    ...filteredOrganicWeaknesses,
    ...filteredPaidWeaknesses,
  ]
    .sort((a, b) => b.searchVolume - a.searchVolume)
    .slice(0, 3)  // Top 3 seeds for cost efficiency
    .map(kw => kw.keyword);

  let relatedKeywords: SpyFuKeywordResult[] = [];

  if (seedKeywords.length > 0) {
    onProgress?.(`Expanding related keywords from ${seedKeywords.length} seeds: ${seedKeywords.join(', ')}...`);
    const relatedResults = await Promise.allSettled(
      seedKeywords.map(seed => getRelatedKeywords(seed, 20).then(r => {
        totalRows += 20;
        return r;
      }))
    );

    relatedKeywords = relatedResults
      .filter((r): r is PromiseFulfilledResult<SpyFuKeywordResult[]> => r.status === 'fulfilled')
      .flatMap(r => r.value);
  }

  // Filter related keywords with navigational detection + STRICT relevance (2+ term match or core term bypass)
  // Related expansions are inherently noisier than gap keywords
  const filteredRelated = relatedKeywords.filter(kw => {
    if (isConsumerNavigational(kw)) {
      navigationalFilteredCount++;
      return false;
    }
    return filterConfig ? isKeywordRelevantStrict(kw.keyword, filterConfig) : true;
  });

  if (navigationalFilteredCount > 0) {
    onProgress?.(`Navigational filter: ${navigationalFilteredCount} high-volume/low-CPC keywords removed (likely consumer brand queries)`);
  }

  // =========================================================================
  // Step 3.5: Relevance filtering pipeline (pre-filter + LLM classifier)
  // =========================================================================

  // Collect all filtered keywords into a unified list for the relevance pipeline
  const allFilteredOpportunities: KeywordOpportunity[] = [
    ...filteredOrganicWeaknesses.map(kw => toOpportunity(kw, 'gap_organic', competitorDomains.map(c => c.name))),
    ...filteredPaidWeaknesses.map(kw => toOpportunity(kw, 'gap_paid', competitorDomains.map(c => c.name))),
    ...filteredShared.map(kw => toOpportunity(kw, 'shared')),
    ...filteredRelated.map(kw => toOpportunity(kw, 'related')),
  ];

  const postExistingFilterCount = allFilteredOpportunities.length;
  let postPrefilterCount = postExistingFilterCount;
  let postClassifierCount = postExistingFilterCount;
  let classifierCost = 0;

  // Relevance-classified keyword lists — start as raw SpyFu results, replaced if filtering runs
  let classifiedOrganicWeaknesses = filteredOrganicWeaknesses;
  let classifiedPaidWeaknesses = filteredPaidWeaknesses;
  let classifiedShared = filteredShared;
  let classifiedRelated = filteredRelated;

  if (businessContext && allFilteredOpportunities.length > 0) {
    // --- Phase A: Deterministic pre-filter ---
    onProgress?.('Running keyword relevance pre-filter...');
    const preFilterResult = preFilterKeywords(allFilteredOpportunities, {
      clientCategory: businessContext.industry,
      clientCompanyName: businessContext.companyName,
    });

    postPrefilterCount = preFilterResult.kept.length;

    if (preFilterResult.removed.length > 0) {
      onProgress?.(`Pre-filter removed ${preFilterResult.removed.length} keywords (${preFilterResult.removed.slice(0, 3).map(r => `"${r.keyword.keyword}": ${r.reason}`).join(', ')}${preFilterResult.removed.length > 3 ? '...' : ''})`);
    }

    // --- Phase B: LLM classifier ---
    if (preFilterResult.kept.length > 0) {
      onProgress?.(`Classifying ${preFilterResult.kept.length} keywords with AI relevance scorer...`);
      const classifierResult = await classifyKeywordRelevance(preFilterResult.kept, businessContext);
      classifierCost = classifierResult.cost;
      postClassifierCount = classifierResult.relevant.length;

      if (classifierResult.discarded.length > 0) {
        onProgress?.(`Classifier discarded ${classifierResult.discarded.length} keywords (${classifierResult.discarded.slice(0, 3).map(d => `"${d.keyword.keyword}": ${d.score}/10`).join(', ')}${classifierResult.discarded.length > 3 ? '...' : ''})`);
      }

      // Rebuild per-source lists from classifier output using kw.source
      const relevantSet = new Set(classifierResult.relevant.map(kw => kw.keyword.toLowerCase().trim()));

      classifiedOrganicWeaknesses = filteredOrganicWeaknesses.filter(kw =>
        relevantSet.has(kw.keyword.toLowerCase().trim())
      );
      classifiedPaidWeaknesses = filteredPaidWeaknesses.filter(kw =>
        relevantSet.has(kw.keyword.toLowerCase().trim())
      );
      classifiedShared = filteredShared.filter(kw =>
        relevantSet.has(kw.keyword.toLowerCase().trim())
      );
      classifiedRelated = filteredRelated.filter(kw =>
        relevantSet.has(kw.keyword.toLowerCase().trim())
      );
    } else {
      postClassifierCount = 0;
    }

    console.log(`[Keyword Intelligence] Relevance funnel: ${postExistingFilterCount} post-existing-filter → ${postPrefilterCount} post-prefilter → ${postClassifierCount} post-classifier`);
    onProgress?.(`Relevance funnel: ${postExistingFilterCount} → ${postPrefilterCount} → ${postClassifierCount} keywords`);
  }

  // =========================================================================
  // Step 4: Bulk enrich top opportunities with full metrics
  // =========================================================================

  // Collect all unique keywords for bulk lookup (using classified lists)
  const allKeywordStrings = new Set<string>();
  for (const kw of [
    ...classifiedOrganicWeaknesses,
    ...classifiedPaidWeaknesses,
    ...classifiedShared,
    ...classifiedRelated,
  ]) {
    allKeywordStrings.add(kw.keyword.toLowerCase().trim());
  }

  const topKeywordStrings = Array.from(allKeywordStrings).slice(0, 50);
  let bulkEnriched: SpyFuKeywordResult[] = [];

  if (topKeywordStrings.length > 0) {
    onProgress?.(`Enriching ${topKeywordStrings.length} keywords with full metrics...`);
    try {
      bulkEnriched = await getKeywordsByBulkSearch(topKeywordStrings);
      totalRows += topKeywordStrings.length;
    } catch (error) {
      console.error('[Keyword Intelligence] Bulk search failed:', error);
    }
  }

  // Create a map for quick lookup of enriched metrics
  const enrichedMap = new Map<string, SpyFuKeywordResult>();
  for (const kw of bulkEnriched) {
    enrichedMap.set(kw.keyword.toLowerCase().trim(), kw);
  }

  // =========================================================================
  // Step 5: Build final result
  // =========================================================================

  onProgress?.('Building keyword intelligence report...');

  // Helper to enrich a keyword with bulk data if available
  const enrichKeyword = (kw: SpyFuKeywordResult, source: KeywordSource, competitors?: string[]): KeywordOpportunity => {
    const enriched = enrichedMap.get(kw.keyword.toLowerCase().trim());
    return toOpportunity(enriched ?? kw, source, competitors);
  };

  // Use CLASSIFIED lists for all opportunity building (post-prefilter + LLM classifier)
  const organicGapOpportunities = classifiedOrganicWeaknesses.map(kw =>
    enrichKeyword(kw, 'gap_organic', competitorDomains.map(c => c.name))
  );
  const paidGapOpportunities = classifiedPaidWeaknesses.map(kw =>
    enrichKeyword(kw, 'gap_paid', competitorDomains.map(c => c.name))
  );
  const sharedKeywordOpportunities = classifiedShared.map(kw =>
    enrichKeyword(kw, 'shared')
  );
  const relatedOpportunities = classifiedRelated.map(kw =>
    enrichKeyword(kw, 'related')
  );

  const clientStrengthOpportunities = clientStrengthKeywords.map(kw =>
    enrichKeyword(kw, 'shared') // Use 'shared' source since these are client-only keywords
  );

  // Deduplicate all keyword lists (including competitor top keywords for categorization)
  const allKeywords = deduplicateKeywords([
    ...organicGapOpportunities,
    ...paidGapOpportunities,
    ...sharedKeywordOpportunities,
    ...relatedOpportunities,
    ...allCompetitorTopOpportunities,
  ]);

  // Categorize
  const { quickWins, longTermPlays, highIntentKeywords } = categorizeKeywords(allKeywords);

  // Build content clusters
  const contentTopicClusters = buildContentClusters(allKeywords);

  // Estimated cost
  const estimatedCost = totalRows * COST_PER_ROW;

  // Build strategic recommendations (data-driven, not LLM)
  const topOrganicGaps = organicGapOpportunities.slice(0, 5);
  const topPaidGaps = paidGapOpportunities.slice(0, 5);

  const strategicRecommendations = {
    organicStrategy: [
      `${organicGapOpportunities.length} organic keyword gaps identified — competitors rank for these but you don't`,
      quickWins.length > 0
        ? `${quickWins.length} quick-win keywords (difficulty <40, volume >100) — prioritize these for immediate SEO content`
        : 'No easy quick-win keywords found — focus on building domain authority first',
      topOrganicGaps.length > 0
        ? `Top organic gaps: ${topOrganicGaps.map(k => `"${k.keyword}" (${k.searchVolume}/mo)`).join(', ')}`
        : 'Focus on related keyword expansion for organic opportunities',
    ],
    paidSearchStrategy: [
      `${paidGapOpportunities.length} paid keyword gaps — competitors bid on these, you don't`,
      highIntentKeywords.length > 0
        ? `${highIntentKeywords.length} high-intent keywords (CPC >$3) — these indicate strong commercial intent`
        : 'No high-CPC keywords found — market may have low PPC competition',
      topPaidGaps.length > 0
        ? `Top paid gaps: ${topPaidGaps.map(k => `"${k.keyword}" ($${k.cpc.toFixed(2)} CPC)`).join(', ')}`
        : 'Consider expanding PPC targeting with related keyword themes',
    ],
    competitivePositioning: [
      `Analyzed ${competitorStats.length} competitor domains for keyword overlap`,
      sharedKeywordOpportunities.length > 0
        ? `${sharedKeywordOpportunities.length} shared keywords where you compete head-to-head with competitors`
        : 'Minimal keyword overlap with competitors — opportunity for differentiated positioning',
      clientStrengthOpportunities.length > 0
        ? `${clientStrengthOpportunities.length} keywords where you rank but competitors don't — defend these strengths`
        : 'No unique keyword advantages found — build organic authority on differentiating topics',
      ...(competitorTopKeywords.length > 0
        ? [`Competitors' most valuable keywords span ${competitorTopKeywords.reduce((sum, c) => sum + c.keywords.length, 0)} terms`]
        : []),
    ],
    quickWinActions: quickWins.slice(0, 5).map(kw =>
      `Target "${kw.keyword}" (${kw.searchVolume}/mo, difficulty ${kw.difficulty}) — create a ${kw.cpc >= 3 ? 'landing page' : 'blog post'}`
    ),
  };

  const keywordIntelligence: KeywordIntelligence = {
    clientDomain: clientStats ? toDomainStats(clientStats) : null,
    competitorDomains: competitorStats.map(c => toDomainStats(c.stats)),
    organicGaps: deduplicateKeywords(organicGapOpportunities).slice(0, 50),
    paidGaps: deduplicateKeywords(paidGapOpportunities).slice(0, 50),
    sharedKeywords: deduplicateKeywords(sharedKeywordOpportunities).slice(0, 30),
    relatedExpansions: deduplicateKeywords(relatedOpportunities).slice(0, 30),
    clientStrengths: deduplicateKeywords(clientStrengthOpportunities).slice(0, 30),
    competitorTopKeywords: competitorTopKeywordEntries.map(c => ({
      ...c,
      keywords: c.keywords.slice(0, 15),
    })),
    quickWins,
    longTermPlays,
    highIntentKeywords,
    contentTopicClusters,
    strategicRecommendations,
    metadata: {
      clientDomain: cleanClientDomain,
      competitorDomainsAnalyzed: competitorStats.map(c => c.domain),
      totalKeywordsAnalyzed: allKeywords.length,
      spyfuCost: estimatedCost,
      collectedAt: new Date().toISOString(),
      ...(navigationalFilteredCount > 0 && { volumeCappedKeywords: navigationalFilteredCount }),
      ...(classifierCost > 0 && { classifierCost }),
      ...(businessContext && {
        relevanceFunnel: {
          postExistingFilter: postExistingFilterCount,
          postPrefilter: postPrefilterCount,
          postClassifier: postClassifierCount,
        },
      }),
    },
  };

  onProgress?.(`Keyword intelligence complete: ${allKeywords.length} keywords analyzed, ${quickWins.length} quick wins found`);

  return {
    keywordIntelligence,
    cost: estimatedCost + classifierCost,
  };
}
