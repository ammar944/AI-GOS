// Ad Relevance Scorer
// Assesses how relevant an ad is to the searched company and provides context

import type { AdCreative, AdRelevance, AdRelevanceCategory } from './types';
import { calculateSimilarity, normalizeCompanyName, extractCompanyFromDomain } from './name-matcher';

/**
 * Common lead magnet keywords that indicate educational/value content
 */
const LEAD_MAGNET_KEYWORDS = [
  'free guide',
  'free ebook',
  'free book',
  'download free',
  'get the guide',
  'get your free',
  'webinar',
  'masterclass',
  'workshop',
  'checklist',
  'template',
  'playbook',
  'blueprint',
  'cheat sheet',
  'toolkit',
  'framework',
  'secrets',
  'revealed',
  'discover how',
  'learn how',
];

/**
 * Product-related keywords that should appear in relevant SaaS/marketing ads
 * Used to detect partnership/sponsored ads that promote unrelated products
 */
const PRODUCT_KEYWORDS = [
  'attribution',
  'analytics',
  'dashboard',
  'roi',
  'revenue',
  'marketing',
  'data',
  'tracking',
  'metrics',
  'report',
  'platform',
  'software',
  'tool',
  'solution',
  'automation',
  'insight',
  'performance',
  'conversion',
];

/**
 * Known subsidiary/parent company relationships
 * Maps subsidiary brand → parent company
 */
const KNOWN_SUBSIDIARIES: Record<string, string[]> = {
  salesforce: ['slack', 'tableau', 'mulesoft', 'heroku', 'pardot'],
  microsoft: ['linkedin', 'github', 'azure'],
  google: ['youtube', 'waze', 'fitbit'],
  meta: ['facebook', 'instagram', 'whatsapp', 'oculus'],
  amazon: ['aws', 'twitch', 'audible', 'imdb', 'whole foods'],
  oracle: ['netsuite', 'java'],
  adobe: ['figma', 'magento', 'marketo'],
  hubspot: ['clearbit'],
  intuit: ['mailchimp', 'quickbooks', 'turbotax', 'mint'],
};

/**
 * Reverse lookup: maps parent → subsidiaries for bidirectional matching
 */
function getRelatedBrands(company: string): string[] {
  const normalized = normalizeCompanyName(company);
  const related: string[] = [];

  // Check if company is a parent with subsidiaries
  if (KNOWN_SUBSIDIARIES[normalized]) {
    related.push(...KNOWN_SUBSIDIARIES[normalized]);
  }

  // Check if company is a subsidiary (find its parent and siblings)
  for (const [parent, subsidiaries] of Object.entries(KNOWN_SUBSIDIARIES)) {
    if (subsidiaries.includes(normalized)) {
      related.push(parent);
      related.push(...subsidiaries.filter(s => s !== normalized));
    }
  }

  return related;
}

/**
 * Check if text contains any of the lead magnet keywords
 */
function containsLeadMagnetKeywords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return LEAD_MAGNET_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Check if text contains the company name or related terms
 */
function textContainsCompany(text: string, company: string): boolean {
  if (!text || !company) return false;
  const normalizedText = normalizeCompanyName(text);
  const normalizedCompany = normalizeCompanyName(company);

  // Direct contain check
  if (normalizedText.includes(normalizedCompany)) return true;

  // Word boundary check for short company names
  const words = normalizedText.split(/\s+/);
  return words.some(word => word === normalizedCompany);
}

/**
 * Assess the relevance of an ad to the searched company
 *
 * @param ad - The ad creative to assess
 * @param searchedCompany - The company name that was searched
 * @param searchedDomain - Optional domain that was searched
 * @returns Relevance assessment with score, category, and explanation
 */
export function assessAdRelevance(
  ad: AdCreative,
  searchedCompany: string,
  searchedDomain?: string
): AdRelevance {
  const signals: string[] = [];
  let score = 0;

  // Normalize inputs
  // Remove TLD before normalizing for better matching (e.g., "Windsor.ai" → "windsor")
  const searchedWithoutTLD = searchedCompany.replace(/\.(ai|io|com|co|net|org|app|dev|tech)$/i, '');
  const searchedCore = normalizeCompanyName(searchedWithoutTLD);
  const advertiserCore = normalizeCompanyName(ad.advertiser || '');
  const adContent = `${ad.headline || ''} ${ad.body || ''}`.toLowerCase();

  // Calculate similarity using both full name and core name
  const advertiserSimilarity = Math.max(
    calculateSimilarity(ad.advertiser || '', searchedCompany),
    calculateSimilarity(advertiserCore, searchedCore)
  );
  const advertiserScore = Math.round(advertiserSimilarity * 40);
  score += advertiserScore;

  // Check if advertiser contains extra words that indicate a different company
  // e.g., "Windsor Airport Limo" vs "Windsor.ai" - "Airport Limo" indicates different company
  const advertiserWords = advertiserCore.split(/\s+/).filter(w => w.length > 2);
  const searchedWords = searchedCore.split(/\s+/).filter(w => w.length > 2);
  const extraWords = advertiserWords.filter(w => !searchedWords.some(sw => sw.includes(w) || w.includes(sw)));
  const hasSignificantExtraWords = extraWords.length >= 2; // e.g., "Airport Limo" = 2 extra words

  if (advertiserSimilarity >= 0.9) {
    signals.push('Advertiser name closely matches search');
  } else if (advertiserSimilarity >= 0.7) {
    signals.push('Advertiser name partially matches search');
  } else if (advertiserSimilarity < 0.5 || hasSignificantExtraWords) {
    signals.push('Advertiser name differs from search');
    // Penalize if advertiser has significant extra words (likely different company)
    if (hasSignificantExtraWords) {
      score -= 20;
      signals.push(`Different company detected: "${extraWords.join(' ')}"`);
    }
  }

  // 2. Check for subsidiary/parent relationship
  const relatedBrands = getRelatedBrands(searchedCompany);
  const isKnownSubsidiary = relatedBrands.some(brand =>
    calculateSimilarity(advertiserCore, brand) >= 0.8
  );

  if (isKnownSubsidiary) {
    signals.push(`${ad.advertiser} is a known related brand`);
    // Give some credit for subsidiary relationship
    score = Math.max(score, 35); // Ensure at least 35 points
  }

  // 3. Content contains company name (0-30 points)
  const contentContainsCompany = textContainsCompany(adContent, searchedCompany);
  if (contentContainsCompany) {
    score += 30;
    signals.push('Ad content mentions searched company');
  } else {
    signals.push('Ad content does not mention searched company');
  }

  // 4. Domain match (0-20 points)
  if (searchedDomain) {
    const domainCompany = extractCompanyFromDomain(searchedDomain);
    if (domainCompany) {
      // Check if details URL contains the domain
      const detailsUrlMatch = ad.detailsUrl?.toLowerCase().includes(domainCompany.toLowerCase());
      // Check if advertiser matches domain company
      const advertiserMatchesDomain = calculateSimilarity(advertiserCore, domainCompany) >= 0.7;

      if (detailsUrlMatch || advertiserMatchesDomain) {
        score += 20;
        signals.push('Domain association confirmed');
      }
    }
  }

  // 5. Check for lead magnet patterns (-10 to +5 points adjustment)
  const isLeadMagnet = containsLeadMagnetKeywords(adContent);
  if (isLeadMagnet) {
    signals.push('Ad appears to be lead generation content');
    // Lead magnets from matching advertiser are fine, but flag them
    if (advertiserSimilarity >= 0.8) {
      // Score stays same, just categorize differently
    } else {
      // Lead magnet from different advertiser is suspicious
      score -= 10;
      signals.push('Lead magnet from different brand');
    }
  }

  // 6. Product-content alignment check
  // Detect ads where advertiser matches but content is about something else entirely
  // Example: "SegMetrics" running "Get Dan Martell's book" ads (partnership/sponsored content)
  if (advertiserSimilarity >= 0.8 && !contentContainsCompany && !isLeadMagnet) {
    // Check if ad content contains product-related keywords
    const hasProductKeywords = PRODUCT_KEYWORDS.some(kw => adContent.includes(kw));

    if (!hasProductKeywords) {
      // This is likely a partnership/sponsored ad for an unrelated product
      score -= 25;
      signals.push('Ad content appears unrelated to company product (possible partnership/sponsored ad)');
      // Note: Category will be set to 'lead_magnet' in the category determination logic below
    }
  }

  // 7. Determine category based on signals
  let category: AdRelevanceCategory;
  let explanation: string;

  // Check if this is a partnership/sponsored ad (detected in step 6)
  const isPartnershipAd = signals.some(s => s.includes('possible partnership/sponsored ad'));

  if (advertiserSimilarity >= 0.8 && contentContainsCompany) {
    category = 'direct';
    explanation = 'This ad directly promotes the searched company\'s products or services.';
  } else if (advertiserSimilarity >= 0.8 && isLeadMagnet) {
    category = 'lead_magnet';
    explanation = `This appears to be a lead generation ad from ${ad.advertiser}. It may promote educational content (book, guide, webinar) rather than their core product.`;
  } else if (isPartnershipAd) {
    // Partnership/sponsored ads should be categorized as lead_magnet
    category = 'lead_magnet';
    explanation = `This ad is from ${ad.advertiser} but promotes unrelated content (likely a partnership or sponsored ad). The content doesn't mention their product or relevant keywords.`;
  } else if (advertiserSimilarity >= 0.8 && !contentContainsCompany) {
    category = 'brand_awareness';
    explanation = `This ad is from ${ad.advertiser} but doesn't mention their product directly. It may be brand awareness or top-of-funnel content.`;
  } else if (isKnownSubsidiary) {
    category = 'subsidiary';
    explanation = `${ad.advertiser} is a brand related to or owned by ${searchedCompany}. Showing because of known corporate relationship.`;
  } else if (advertiserSimilarity < 0.5) {
    category = 'unclear';
    explanation = `This ad is from ${ad.advertiser}, which doesn't clearly match "${searchedCompany}". It may have appeared due to API matching logic.`;
  } else {
    category = 'unclear';
    explanation = `The relationship between this ad and "${searchedCompany}" is not immediately clear. Manual review recommended.`;
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    category,
    explanation,
    signals,
  };
}

/**
 * Filter ads by minimum relevance score
 */
export function filterByRelevance(
  ads: AdCreative[],
  minScore: number = 40
): AdCreative[] {
  return ads.filter(ad => (ad.relevance?.score ?? 100) >= minScore);
}

/**
 * Sort ads by relevance score (highest first)
 */
export function sortByRelevance(ads: AdCreative[]): AdCreative[] {
  return [...ads].sort((a, b) => {
    const scoreA = a.relevance?.score ?? 50;
    const scoreB = b.relevance?.score ?? 50;
    return scoreB - scoreA;
  });
}
