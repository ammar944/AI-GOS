// Search Blueprint Tool
// In-memory search — no Supabase/embedding dependency
// Searches blueprint data using keyword matching + fuzzy Levenshtein distance

import { z } from 'zod';
import { tool } from 'ai';

const SECTION_LABELS: Record<string, string> = {
  industryMarketOverview: 'Industry & Market',
  icpAnalysisValidation: 'ICP Analysis',
  offerAnalysisViability: 'Offer Analysis',
  competitorAnalysis: 'Competitors',
  crossAnalysisSynthesis: 'Synthesis',
};

interface SearchHit {
  section: string;
  fieldPath: string;
  content: string;
  relevance: number;
  snippet?: string;
}

/**
 * Recursively flatten a blueprint object into searchable text entries.
 */
function flattenToEntries(
  obj: unknown,
  section: string,
  prefix: string,
  entries: SearchHit[]
): void {
  if (obj === null || obj === undefined) return;

  if (typeof obj === 'string') {
    if (obj.length > 10) {
      entries.push({ section, fieldPath: prefix, content: obj, relevance: 0 });
    }
    return;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    entries.push({ section, fieldPath: prefix, content: String(obj), relevance: 0 });
    return;
  }

  if (Array.isArray(obj)) {
    // For arrays of strings, join them as a single entry
    if (obj.length > 0 && obj.every(item => typeof item === 'string')) {
      entries.push({
        section,
        fieldPath: prefix,
        content: obj.join('; '),
        relevance: 0,
      });
      return;
    }
    // For arrays of objects, recurse into each
    for (let i = 0; i < obj.length; i++) {
      flattenToEntries(obj[i], section, `${prefix}[${i}]`, entries);
    }
    return;
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      flattenToEntries(value, section, path, entries);
    }
  }
}

/**
 * Levenshtein distance between two strings.
 * Uses rolling-row DP with O(min(a,b)) memory.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure b is shorter for O(min(a,b)) memory
  if (a.length < b.length) {
    [a, b] = [b, a];
  }

  const bLen = b.length;
  let prev = new Array(bLen + 1);
  let curr = new Array(bLen + 1);

  for (let j = 0; j <= bLen; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[bLen];
}

/**
 * Check if queryWord fuzzy-matches any word in the target string.
 * Returns true if any target word is within maxDistance edits.
 */
function fuzzyMatch(queryWord: string, target: string, maxDistance: number = 2): boolean {
  const words = target.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (levenshteinDistance(queryWord, word) <= maxDistance) {
      return true;
    }
  }
  return false;
}

/**
 * Extract a snippet around the first occurrence of a term in content.
 */
function extractSnippet(content: string, term: string, radius: number = 50): string | undefined {
  const idx = content.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return undefined;

  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + term.length + radius);
  let snippet = content.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Multi-tier keyword relevance scoring with fuzzy matching.
 *
 * Three tiers:
 * - Exact substring match: 3x weight
 * - Prefix match (word starts with query term): 2x weight
 * - Fuzzy Levenshtein ≤ 2: 1x weight
 *
 * Field path matches get +0.5 bonus.
 */
function scoreRelevance(entry: SearchHit, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;

  const contentLower = entry.content.toLowerCase();
  const fieldLower = entry.fieldPath.toLowerCase();
  const searchText = `${fieldLower} ${contentLower}`;
  let totalWeight = 0;
  let matchCount = 0;
  let bestSnippet: string | undefined;

  for (const term of queryTerms) {
    const termLower = term.toLowerCase();
    let termWeight = 0;

    // Tier 1: Exact substring match (3x)
    if (searchText.includes(termLower)) {
      termWeight = 3;
      if (!bestSnippet) {
        bestSnippet = extractSnippet(entry.content, termLower);
      }
    }
    // Tier 2: Prefix match — any word in content starts with term (2x)
    else if (searchText.split(/\s+/).some(w => w.startsWith(termLower))) {
      termWeight = 2;
    }
    // Tier 3: Fuzzy Levenshtein ≤ 2 (1x)
    else if (fuzzyMatch(termLower, searchText)) {
      termWeight = 1;
    }

    if (termWeight > 0) {
      matchCount++;
      // Bonus for field path match (more specific)
      if (fieldLower.includes(termLower)) {
        termWeight += 0.5;
      }
      totalWeight += termWeight;
    }
  }

  if (matchCount === 0) return 0;

  // Assign snippet
  if (bestSnippet) {
    entry.snippet = bestSnippet;
  }

  // Score: proportion matched * weighted score normalized
  const proportionMatched = matchCount / queryTerms.length;
  const maxPossibleWeight = queryTerms.length * 3.5; // 3x + 0.5 field bonus
  const normalizedWeight = totalWeight / maxPossibleWeight;

  return proportionMatched * 0.4 + normalizedWeight * 0.6;
}

/**
 * Extract meaningful query terms, filtering out stop words.
 */
function extractQueryTerms(query: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'of', 'in', 'to', 'for',
    'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into', 'through',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'me', 'him',
    'it', 'we', 'they', 'them', 'how', 'why', 'when', 'where',
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term));
}

export function createSearchBlueprintTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Search the strategic blueprint for relevant information to answer a question. ' +
      'Use this when the user asks questions about their blueprint data, pain points, ' +
      'competitors, ICP, offer analysis, or strategic recommendations.',
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant blueprint sections'),
      sectionFilter: z
        .enum([
          'industryMarketOverview',
          'icpAnalysisValidation',
          'offerAnalysisViability',
          'competitorAnalysis',
          'crossAnalysisSynthesis',
        ])
        .optional()
        .describe('Optional: filter results to a specific blueprint section'),
    }),
    execute: async ({ query, sectionFilter }) => {
      // Flatten blueprint into searchable entries
      const entries: SearchHit[] = [];
      const sectionsToSearch = sectionFilter
        ? { [sectionFilter]: blueprint[sectionFilter] }
        : blueprint;

      for (const [section, data] of Object.entries(sectionsToSearch)) {
        // Only search known blueprint sections
        if (!SECTION_LABELS[section]) continue;
        if (!data || typeof data !== 'object') continue;
        flattenToEntries(data, section, '', entries);
      }

      // Score each entry
      const queryTerms = extractQueryTerms(query);
      for (const entry of entries) {
        entry.relevance = scoreRelevance(entry, queryTerms);
      }

      // Filter entries with any relevance, sort by score
      const relevant = entries
        .filter(e => e.relevance > 0.1)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 20);

      // If keyword search found nothing, fall back to returning the filtered section(s)
      if (relevant.length === 0 && sectionFilter) {
        const sectionData = blueprint[sectionFilter];
        return {
          context: JSON.stringify(sectionData, null, 2).substring(0, 4000),
          confidence: 'medium' as const,
          sources: [{ section: sectionFilter, fieldPath: '', similarity: 0.5 }],
        };
      }

      if (relevant.length === 0) {
        return {
          context: 'No relevant content found for this query in the blueprint.',
          confidence: 'low' as const,
          sources: [],
        };
      }

      // Build context string
      const context = relevant
        .map((r, i) => {
          const label = SECTION_LABELS[r.section] || r.section;
          // Use snippet if available, otherwise truncate full content
          const display = r.snippet
            ? r.snippet
            : r.content.length > 500
            ? r.content.substring(0, 497) + '...'
            : r.content;
          return `[${i + 1}] ${label} > ${r.fieldPath}:\n${display}`;
        })
        .join('\n\n');

      const avgRelevance = relevant.reduce((sum, r) => sum + r.relevance, 0) / relevant.length;
      const confidence =
        avgRelevance > 0.6 ? ('high' as const) :
        avgRelevance > 0.3 ? ('medium' as const) :
        ('low' as const);

      return {
        context,
        confidence,
        sources: relevant.map(r => ({
          section: r.section,
          fieldPath: r.fieldPath,
          similarity: Math.round(r.relevance * 100) / 100,
        })),
      };
    },
  });
}
