// Name Matching Utility for Ad Library
// Fuzzy matching to validate ads belong to the searched company

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

  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\w\s]/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 * Returns a score from 0 (completely different) to 1 (identical)
 *
 * Jaro-Winkler is specifically designed for short strings like names
 * and gives higher scores to strings with matching prefixes
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  // Normalize both strings first
  const s1 = normalizeCompanyName(str1);
  const s2 = normalizeCompanyName(str2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // For short queries (5 chars or less), require exact word match or starts-with
  // This prevents "huel" matching "hula hoop" via Jaro-Winkler
  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;

  if (shorter.length <= 5) {
    // Check if longer string starts with shorter (e.g., "huel" matches "huel nutrition")
    if (longer.startsWith(shorter + ' ') || longer === shorter) {
      return 0.95;
    }
    // Check if shorter is an exact word within longer (e.g., "huel" in "the huel company")
    const words = longer.split(' ');
    if (words.some(word => word === shorter)) {
      return 0.9;
    }
    // For short queries, reject if first 2 chars don't match (prevents "huel" matching "hula")
    if (s1.substring(0, 2) !== s2.substring(0, 2)) {
      return 0.3; // Low score for different prefixes on short strings
    }
  }

  // Check if one string contains the other (substring match)
  // Only allow if the shorter string is a complete word/prefix in the longer
  if (s1.includes(s2)) {
    // Check if s2 is a word boundary match (not a random substring)
    const wordBoundaryMatch = s1.startsWith(s2 + ' ') || s1.endsWith(' ' + s2) ||
                              s1.includes(' ' + s2 + ' ') || s1 === s2;
    return wordBoundaryMatch ? 0.85 : 0.5;
  }
  if (s2.includes(s1)) {
    const wordBoundaryMatch = s2.startsWith(s1 + ' ') || s2.endsWith(' ' + s1) ||
                              s2.includes(' ' + s1 + ' ') || s2 === s1;
    return wordBoundaryMatch ? 0.85 : 0.5;
  }

  // Calculate Jaro similarity
  const matchWindow = Math.max(s1.length, s2.length) / 2 - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  // Find matches
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

  // Count transpositions
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

  // Jaro-Winkler: boost score for common prefix
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
 * Check if an advertiser name matches the searched company
 * Uses fuzzy matching with a configurable threshold
 *
 * @param advertiser - Advertiser name from ad data
 * @param searchedCompany - Company name that was searched
 * @param threshold - Minimum similarity score (0-1) to consider a match (default: 0.7)
 * @returns true if the advertiser is likely the same as the searched company
 */
export function isAdvertiserMatch(
  advertiser: string,
  searchedCompany: string,
  threshold: number = 0.7
): boolean {
  if (!advertiser || !searchedCompany) return false;

  // Exact match after normalization
  const normalizedAdvertiser = normalizeCompanyName(advertiser);
  const normalizedSearched = normalizeCompanyName(searchedCompany);

  if (normalizedAdvertiser === normalizedSearched) {
    return true;
  }

  // Fuzzy match with threshold
  const similarity = calculateSimilarity(advertiser, searchedCompany);
  return similarity >= threshold;
}

/**
 * Generate common aliases for a company name
 * Useful for providing alternative search terms
 *
 * Examples:
 * - "Tesla Inc" → ["Tesla", "Tesla Inc", "Tesla, Inc."]
 * - "Amazon.com" → ["Amazon", "Amazon.com", "Amazon com"]
 */
export function generateCompanyAliases(name: string): string[] {
  if (!name) return [];

  const aliases = new Set<string>();
  aliases.add(name); // Original name

  // Add normalized version
  const normalized = normalizeCompanyName(name);
  if (normalized && normalized !== name.toLowerCase()) {
    aliases.add(normalized);
  }

  // Add version with common suffixes
  const withInc = `${normalized} inc`;
  const withLLC = `${normalized} llc`;
  const withCorp = `${normalized} corp`;
  aliases.add(withInc);
  aliases.add(withLLC);
  aliases.add(withCorp);

  // Add capitalized versions
  const capitalized = normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  aliases.add(capitalized);

  // Remove empty strings
  return Array.from(aliases).filter(a => a.length > 0);
}

/**
 * Extract company name from domain
 * Used to cross-validate advertiser names against known domains
 *
 * Examples:
 * - "tesla.com" → "tesla"
 * - "www.amazon.com" → "amazon"
 * - "shop.nike.co.uk" → "nike"
 */
export function extractCompanyFromDomain(domain: string): string | undefined {
  if (!domain) return undefined;

  try {
    // Remove protocol
    let cleaned = domain.replace(/^https?:\/\//, '');

    // Remove www prefix
    cleaned = cleaned.replace(/^www\./, '');

    // Remove path and query string
    cleaned = cleaned.split('/')[0].split('?')[0];

    // Split by dots and get the main domain part
    const parts = cleaned.split('.');

    // For standard TLDs (com, org, net), take the part before the TLD
    // For country TLDs (co.uk, com.au), take the part before that
    if (parts.length >= 2) {
      // If we have country code TLD (e.g., co.uk), take second-to-last
      if (parts.length >= 3 && ['co', 'com', 'org', 'net'].includes(parts[parts.length - 2])) {
        return parts[parts.length - 3];
      }
      // Otherwise take the second-to-last part (domain name)
      return parts[parts.length - 2];
    }

    return undefined;
  } catch {
    return undefined;
  }
}
