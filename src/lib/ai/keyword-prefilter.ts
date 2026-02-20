// Keyword Pre-Filter
// Deterministic rules to remove obviously irrelevant keywords before LLM classification.
// Runs between existing relevance filtering (Step 2.5) and LLM classifier (Step 3.5).

import type { KeywordOpportunity } from '@/lib/strategic-blueprint/output-types';
import { hasDoubleEncodedMarkers, repairDoubleEncodedUTF8 } from './spyfu-client';

// =============================================================================
// Types
// =============================================================================

export interface PreFilterConfig {
  /** Client's business category (e.g., "B2B SaaS Marketing Attribution Software") */
  clientCategory: string;
  /** Client's company name (excluded from business name detection) */
  clientCompanyName?: string;
}

export interface PreFilterResult {
  kept: KeywordOpportunity[];
  removed: { keyword: KeywordOpportunity; reason: string }[];
}

// =============================================================================
// Rule Constants
// =============================================================================

/** Venue-type words that signal a business name when combined with location/action */
const VENUE_WORDS = new Set([
  'restaurant', 'bar', 'bistro', 'cafe', 'café', 'grill', 'kitchen',
  'dining', 'pub', 'tavern', 'salon', 'spa', 'bakery', 'pizzeria',
  'trattoria', 'brasserie', 'steakhouse', 'diner', 'eatery',
]);

/** Location markers that signal a local business query */
const LOCATION_MARKERS = new Set([
  'nyc', 'sf', 'la', 'dc', 'chicago', 'miami', 'boston', 'seattle',
  'denver', 'austin', 'portland', 'atlanta', 'dallas', 'houston',
  'philadelphia', 'phoenix', 'detroit', 'minneapolis', 'nashville',
  'san francisco', 'los angeles', 'new york', 'las vegas', 'san diego',
  'brooklyn', 'manhattan', 'queens', 'soho', 'midtown', 'downtown',
]);

/** Action terms that signal a consumer business query */
const ACTION_TERMS = new Set([
  'menu', 'reservation', 'reservations', 'hours', 'delivery',
  'order', 'takeout', 'pickup', 'booking', 'table',
]);

/** Platform/aggregator names — keywords mentioning these are consumer queries */
const PLATFORM_NAMES = new Set([
  'yelp', 'doordash', 'grubhub', 'ubereats', 'uber eats',
  'opentable', 'tripadvisor', 'resy', 'menulog', 'seamless',
  'postmates', 'caviar', 'instacart', 'deliveroo',
]);

/** Menu/event search terms — irrelevant unless client IS in food/hospitality */
const MENU_EVENT_TERMS = [
  'menu pdf', 'brunch menu', 'happy hour', 'prix fixe',
  'tasting menu', 'wine list', 'dinner menu', 'lunch menu',
];

/** Industries where menu/event terms are relevant */
const FOOD_HOSPITALITY_KEYWORDS = [
  'restaurant', 'food', 'hospitality', 'catering', 'dining',
  'culinary', 'chef', 'foodservice', 'food service', 'meal',
];

/** Industries where historical date references are relevant */
const TIME_RELEVANT_INDUSTRIES = [
  'history', 'archive', 'vintage', 'anniversary', 'news',
  'finance', 'investment', 'insurance', 'legal', 'compliance',
];

// =============================================================================
// Rule Functions
// =============================================================================

function isBusinessNameQuery(kwLower: string, config: PreFilterConfig): string | null {
  const words = kwLower.split(/\s+/);

  // Skip if this matches the client's own company name
  if (config.clientCompanyName) {
    const clientLower = config.clientCompanyName.toLowerCase();
    if (kwLower.includes(clientLower)) return null;
  }

  // Check for venue word presence
  const hasVenueWord = words.some(w => VENUE_WORDS.has(w));
  if (!hasVenueWord) return null;

  // Check for location markers (single words or 2-word combinations)
  const hasLocation = words.some(w => LOCATION_MARKERS.has(w)) ||
    (() => {
      for (let i = 0; i < words.length - 1; i++) {
        if (LOCATION_MARKERS.has(`${words[i]} ${words[i + 1]}`)) return true;
      }
      return false;
    })();

  // Check for possessive pattern (e.g., "joe's kitchen")
  const hasPossessive = /'s\b/.test(kwLower);

  // Check for action terms
  const hasAction = words.some(w => ACTION_TERMS.has(w));

  if (hasLocation || hasPossessive || hasAction) {
    return 'business_name_query';
  }

  return null;
}

function isPlatformQuery(kwLower: string): string | null {
  const words = kwLower.split(/\s+/);

  // Check single words
  if (words.some(w => PLATFORM_NAMES.has(w))) {
    return 'platform_aggregator_query';
  }

  // Check 2-word combinations (e.g., "uber eats")
  for (let i = 0; i < words.length - 1; i++) {
    if (PLATFORM_NAMES.has(`${words[i]} ${words[i + 1]}`)) {
      return 'platform_aggregator_query';
    }
  }

  return null;
}

function hasMojibake(keyword: string): string | null {
  if (hasDoubleEncodedMarkers(keyword)) {
    const repaired = repairDoubleEncodedUTF8(keyword);
    // If repair succeeded, the keyword is fine (was fixed upstream).
    // If repair didn't change it, these are genuinely garbled characters — remove.
    if (repaired === keyword) {
      return 'mojibake_artifacts';
    }
  }
  return null;
}

function hasStaleDate(kwLower: string, config: PreFilterConfig): string | null {
  const staleYearMatch = kwLower.match(/\b(201[89]|202[012])\b/);
  if (!staleYearMatch) return null;

  // Check if client is in a time-relevant industry
  const categoryLower = config.clientCategory.toLowerCase();
  const isTimeRelevant = TIME_RELEVANT_INDUSTRIES.some(t => categoryLower.includes(t));
  if (isTimeRelevant) return null;

  return `stale_date_reference_${staleYearMatch[1]}`;
}

function isMenuEventSearch(kwLower: string, config: PreFilterConfig): string | null {
  const matchesTerm = MENU_EVENT_TERMS.some(term => kwLower.includes(term));
  if (!matchesTerm) return null;

  // Allow if client IS in food/hospitality
  const categoryLower = config.clientCategory.toLowerCase();
  const isFoodIndustry = FOOD_HOSPITALITY_KEYWORDS.some(t => categoryLower.includes(t));
  if (isFoodIndustry) return null;

  return 'menu_event_search';
}

// =============================================================================
// Main Pre-Filter Function
// =============================================================================

/**
 * Apply deterministic rules to remove obviously irrelevant keywords.
 * Each removal includes a reason string for auditability.
 */
export function preFilterKeywords(
  keywords: KeywordOpportunity[],
  config: PreFilterConfig,
): PreFilterResult {
  const kept: KeywordOpportunity[] = [];
  const removed: { keyword: KeywordOpportunity; reason: string }[] = [];

  for (const kw of keywords) {
    const kwLower = kw.keyword.toLowerCase().trim();

    // Apply rules in order (first match removes)
    const reason =
      isBusinessNameQuery(kwLower, config) ??
      isPlatformQuery(kwLower) ??
      hasMojibake(kw.keyword) ?? // Use original case for mojibake detection
      hasStaleDate(kwLower, config) ??
      isMenuEventSearch(kwLower, config);

    if (reason) {
      removed.push({ keyword: kw, reason });
    } else {
      kept.push(kw);
    }
  }

  return { kept, removed };
}
