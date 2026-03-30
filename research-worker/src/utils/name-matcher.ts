// Name Matching Utility for Ad Library — Worker Copy
// Ported from src/lib/ad-library/name-matcher.ts
// If updating this file, check if the source also needs the same change.

/**
 * Normalize company name for comparison:
 * - Lowercase
 * - Remove common suffixes (Inc, LLC, Corp, Ltd, etc.)
 * - Remove punctuation and extra whitespace
 * - Trim
 */
export function normalizeCompanyName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  let normalized = name.toLowerCase().trim();

  // Remove common company suffixes
  const suffixes = [
    /\s+inc\.?$/i,
    /\s+llc\.?$/i,
    /\s+corp\.?$/i,
    /\s+corporation$/i,
    /\s+ltd\.?$/i,
    /\s+limited$/i,
    /\s+co\.?$/i,
    /\s+company$/i,
    /\s+group$/i,
    /\s+international$/i,
    /\s+intl\.?$/i,
  ];

  for (const suffix of suffixes) {
    normalized = normalized.replace(suffix, '');
  }

  // Remove common TLD suffixes (e.g., "Salesforce.com" → "salesforce", "Windsor.ai" → "windsor")
  normalized = normalized.replace(/\.(com|io|ai|co|net|org|app|dev|tech|us|me|xyz)$/i, '');

  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate what fraction of the longer string's words overlap with the shorter string.
 */
function calculateWordOverlapRatio(shorter: string, longer: string): number {
  const shortWords = shorter.split(/\s+/).filter(w => w.length > 0);
  const longWords = longer.split(/\s+/).filter(w => w.length > 0);
  if (longWords.length === 0) return 0;

  const matchedCount = longWords.filter(lw =>
    shortWords.some(sw => sw === lw || sw.includes(lw) || lw.includes(sw))
  ).length;

  return matchedCount / longWords.length;
}

/**
 * Calculate Jaro-Winkler similarity between two strings.
 * Returns a score from 0 (completely different) to 1 (identical).
 *
 * Jaro-Winkler is designed for short strings like company names
 * and gives higher scores to strings with matching prefixes.
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const s1 = normalizeCompanyName(str1);
  const s2 = normalizeCompanyName(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // For short queries (5 chars or less), require exact word match or starts-with
  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;

  if (shorter.length <= 5) {
    if (longer === shorter) return 1.0;
    if (longer.startsWith(shorter + ' ')) {
      const extraPart = longer.substring(shorter.length + 1).trim();
      const extraWordCount = extraPart.split(/\s+/).filter(w => w.length > 0).length;
      return extraWordCount <= 1 ? 0.85 : 0.75;
    }
    const words = longer.split(' ');
    if (words.some(word => word === shorter)) return 0.80;
    if (s1.substring(0, 2) !== s2.substring(0, 2)) return 0.3;
  }

  // Check if one string contains the other (substring match)
  if (s1.includes(s2)) {
    const wordBoundaryMatch = s1.startsWith(s2 + ' ') || s1.endsWith(' ' + s2) ||
                              s1.includes(' ' + s2 + ' ') || s1 === s2;
    if (!wordBoundaryMatch) return 0.5;
    const overlapRatio = calculateWordOverlapRatio(s2, s1);
    return Math.min(0.95, 0.55 + 0.40 * overlapRatio);
  }
  if (s2.includes(s1)) {
    const wordBoundaryMatch = s2.startsWith(s1 + ' ') || s2.endsWith(' ' + s1) ||
                              s2.includes(' ' + s1 + ' ') || s2 === s1;
    if (!wordBoundaryMatch) return 0.5;
    const overlapRatio = calculateWordOverlapRatio(s1, s2);
    return Math.min(0.95, 0.55 + 0.40 * overlapRatio);
  }

  // Calculate Jaro similarity
  const matchWindow = Math.max(s1.length, s2.length) / 2 - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3;

  const prefixLength = Math.min(4, Math.min(s1.length, s2.length));
  let prefix = 0;
  for (let i = 0; i < prefixLength; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  const jaroWinkler = jaro + prefix * 0.1 * (1 - jaro);
  return Math.min(jaroWinkler, 1);
}

/**
 * Check if an advertiser name matches the searched company.
 * Uses fuzzy matching with a configurable threshold.
 */
export function isAdvertiserMatch(
  advertiser: string | undefined,
  searchedCompany: string,
  threshold: number = 0.8
): boolean {
  if (!advertiser || !searchedCompany) return false;

  const normalizedAdvertiser = normalizeCompanyName(advertiser);
  const normalizedSearched = normalizeCompanyName(searchedCompany);

  if (normalizedAdvertiser === normalizedSearched) return true;

  const similarity = calculateSimilarity(advertiser, searchedCompany);
  return similarity >= threshold;
}

/**
 * Extract company name from domain.
 * Examples: "tesla.com" → "tesla", "www.amazon.com" → "amazon"
 */
export function extractCompanyFromDomain(domain: string): string | undefined {
  if (!domain) return undefined;

  try {
    let cleaned = domain.replace(/^https?:\/\//, '');
    cleaned = cleaned.replace(/^www\./, '');
    cleaned = cleaned.split('/')[0].split('?')[0];

    const parts = cleaned.split('.');
    if (parts.length >= 2) {
      if (parts.length >= 3 && ['co', 'com', 'org', 'net'].includes(parts[parts.length - 2])) {
        return parts[parts.length - 3];
      }
      return parts[parts.length - 2];
    }
    return undefined;
  } catch {
    return undefined;
  }
}
