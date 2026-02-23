// Search Media Plan Tool
// In-memory keyword search across all 10 media plan sections
// Adapted from search-blueprint.ts for the media plan data structure

import { z } from 'zod';
import { tool } from 'ai';
import { MEDIA_PLAN_SECTION_LABELS } from '@/lib/media-plan/section-constants';
import type { MediaPlanSectionKey } from '@/lib/media-plan/section-constants';

interface SearchHit {
  section: string;
  fieldPath: string;
  content: string;
  relevance: number;
}

/**
 * Recursively flatten a media plan object into searchable text entries.
 */
function flattenToEntries(
  obj: unknown,
  section: string,
  prefix: string,
  entries: SearchHit[],
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
    if (obj.length > 0 && obj.every((item) => typeof item === 'string')) {
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
 * Simple keyword relevance scoring.
 * Returns 0-1 based on how many query terms appear in the content + field path.
 */
function scoreRelevance(entry: SearchHit, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;

  const searchText = `${entry.fieldPath} ${entry.content}`.toLowerCase();
  let matchCount = 0;
  let totalWeight = 0;

  for (const term of queryTerms) {
    const termLower = term.toLowerCase();
    if (searchText.includes(termLower)) {
      matchCount++;
      // Bonus for field path match (more specific)
      if (entry.fieldPath.toLowerCase().includes(termLower)) {
        totalWeight += 1.5;
      } else {
        totalWeight += 1;
      }
    }
  }

  // Base score: proportion of terms matched, weighted
  const proportionMatched = matchCount / queryTerms.length;
  const weightedScore = totalWeight / (queryTerms.length * 1.5);

  return proportionMatched * 0.4 + weightedScore * 0.6;
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
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

const SECTION_KEYS: [MediaPlanSectionKey, ...MediaPlanSectionKey[]] = [
  'executiveSummary',
  'platformStrategy',
  'icpTargeting',
  'campaignStructure',
  'creativeStrategy',
  'budgetAllocation',
  'campaignPhases',
  'kpiTargets',
  'performanceModel',
  'riskMonitoring',
];

export function createSearchMediaPlanTool(mediaPlan: Record<string, unknown>) {
  return tool({
    description:
      'Search the media plan for relevant information to answer a question. ' +
      'Use this when the user asks about budget allocation, platform strategy, KPIs, ' +
      'campaign structure, creative strategy, CAC model, or any media plan content.',
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant media plan sections'),
      sectionFilter: z
        .enum(SECTION_KEYS)
        .optional()
        .describe('Optional: filter results to a specific media plan section'),
    }),
    execute: async ({ query, sectionFilter }) => {
      // Flatten media plan into searchable entries
      const entries: SearchHit[] = [];
      const sectionsToSearch = sectionFilter
        ? { [sectionFilter]: mediaPlan[sectionFilter] }
        : mediaPlan;

      for (const [section, data] of Object.entries(sectionsToSearch)) {
        // Only search known media plan sections
        if (!(section in MEDIA_PLAN_SECTION_LABELS)) continue;
        if (!data || (typeof data !== 'object' && !Array.isArray(data))) continue;
        flattenToEntries(data, section, '', entries);
      }

      // Score each entry
      const queryTerms = extractQueryTerms(query);
      for (const entry of entries) {
        entry.relevance = scoreRelevance(entry, queryTerms);
      }

      // Filter entries with any relevance, sort by score — 12 hits for media plan (more sections)
      const relevant = entries
        .filter((e) => e.relevance > 0.1)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 12);

      // If keyword search found nothing, fall back to returning the filtered section(s)
      if (relevant.length === 0 && sectionFilter) {
        const sectionData = mediaPlan[sectionFilter];
        return {
          context: JSON.stringify(sectionData, null, 2).substring(0, 4000),
          confidence: 'medium' as const,
          sources: [{ section: sectionFilter, fieldPath: '', similarity: 0.5 }],
        };
      }

      if (relevant.length === 0) {
        return {
          context: 'No relevant content found for this query in the media plan.',
          confidence: 'low' as const,
          sources: [],
        };
      }

      // Build context string
      const context = relevant
        .map((r, i) => {
          const label =
            MEDIA_PLAN_SECTION_LABELS[r.section as MediaPlanSectionKey] || r.section;
          const truncatedContent =
            r.content.length > 500 ? r.content.substring(0, 497) + '...' : r.content;
          return `[${i + 1}] ${label} > ${r.fieldPath}:\n${truncatedContent}`;
        })
        .join('\n\n');

      const avgRelevance =
        relevant.reduce((sum, r) => sum + r.relevance, 0) / relevant.length;
      const confidence =
        avgRelevance > 0.6
          ? ('high' as const)
          : avgRelevance > 0.3
            ? ('medium' as const)
            : ('low' as const);

      return {
        context,
        confidence,
        sources: relevant.map((r) => ({
          section: r.section,
          fieldPath: r.fieldPath,
          similarity: Math.round(r.relevance * 100) / 100,
        })),
      };
    },
  });
}
