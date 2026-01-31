// Pricing Relevance Scorer
// Assesses how relevant a pricing tier is to the searched competitor's core product

import type { ExtractedPricingTier } from './types';

/**
 * Categories for pricing tier relevance
 */
export type PricingRelevanceCategory =
  | 'core_product'      // Main product tiers (high relevance)
  | 'add_on'            // Add-on features/modules (medium relevance)
  | 'different_product' // Different product from same company (low relevance)
  | 'unclear';          // Can't determine

/**
 * Result of pricing relevance assessment
 */
export interface PricingRelevance {
  /** Overall relevance score (0-100) */
  score: number;
  /** Relevance category */
  category: PricingRelevanceCategory;
  /** Human-readable explanation */
  explanation: string;
  /** Signals that contributed to the score */
  signals: string[];
}

/**
 * Options for scoring pricing relevance
 */
export interface PricingRelevanceOptions {
  /** Competitor company name */
  competitorName: string;
  /** Specific product name (optional - e.g., "Figma Design" vs just "Figma") */
  productName?: string;
  /** Competitor URL (for domain extraction) */
  competitorUrl?: string;
}

/**
 * Options for filtering pricing tiers
 */
export interface FilterPricingOptions extends PricingRelevanceOptions {
  /** Minimum score to include (default: 50) */
  minScore?: number;
  /** Include add-ons (default: false) */
  includeAddOns?: boolean;
}

/**
 * Extended pricing tier with relevance info
 */
export interface ScoredPricingTier extends ExtractedPricingTier {
  relevance?: PricingRelevance;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Standard SaaS tier names that indicate core product pricing
 */
const CORE_TIER_NAMES = [
  'free',
  'starter',
  'basic',
  'hobby',
  'personal',
  'individual',
  'solo',
  'pro',
  'professional',
  'plus',
  'premium',
  'team',
  'teams',
  'business',
  'organization',
  'enterprise',
  'scale',
  'growth',
  'unlimited',
];

/**
 * Keywords that indicate add-on/supplementary pricing
 */
const ADD_ON_KEYWORDS = [
  'add-on',
  'addon',
  'add on',
  'module',
  'extra',
  'additional',
  'upgrade',
  'boost',
  'credits',
  'storage',
  'seats',
  'users',
  'compute',
  'bandwidth',
  'sso',
  'sla',
  'support',
  'dedicated',
  'priority',
  'micro',
  'small',
  'medium',
  'large',
  'xl',
  'xxl',
  '2xl',
  '4xl',
  '8xl',
  '16xl',
];

/**
 * Known multi-product companies and their product lines
 * Maps company → array of distinct product names
 */
const KNOWN_PRODUCT_LINES: Record<string, string[]> = {
  figma: ['design', 'figjam', 'slides', 'dev mode'],
  adobe: ['photoshop', 'illustrator', 'premiere', 'after effects', 'xd', 'lightroom', 'indesign', 'acrobat'],
  microsoft: ['office', '365', 'teams', 'azure', 'dynamics', 'power bi'],
  google: ['workspace', 'cloud', 'analytics', 'ads', 'maps'],
  atlassian: ['jira', 'confluence', 'trello', 'bitbucket'],
  salesforce: ['sales cloud', 'service cloud', 'marketing cloud', 'commerce cloud'],
  notion: ['notion', 'calendar'],
  slack: ['slack', 'huddles', 'canvas'],
  zoom: ['meetings', 'phone', 'rooms', 'webinars', 'events'],
  hubspot: ['marketing hub', 'sales hub', 'service hub', 'cms hub', 'operations hub'],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize text for comparison
 */
function normalize(text: string): string {
  if (!text) return '';
  return text.toLowerCase().trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Extract words from text
 */
function extractWords(text: string): string[] {
  return normalize(text).split(' ').filter(w => w.length > 1);
}

/**
 * Check if text contains any of the keywords
 */
function containsAny(text: string, keywords: string[]): boolean {
  const normalized = normalize(text);
  return keywords.some(kw => normalized.includes(kw));
}

/**
 * Calculate word overlap score between two strings
 */
function wordOverlap(str1: string, str2: string): number {
  const words1 = new Set(extractWords(str1));
  const words2 = new Set(extractWords(str2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  
  // Jaccard-like similarity
  return overlap / Math.min(words1.size, words2.size);
}

/**
 * Check if tier name matches standard SaaS tier structure
 */
function isStandardTierName(tierName: string): boolean {
  const normalized = normalize(tierName);
  return CORE_TIER_NAMES.some(name => 
    normalized === name || 
    normalized.startsWith(name + ' ') || 
    normalized.endsWith(' ' + name)
  );
}

/**
 * Check if tier appears to be an add-on
 */
function looksLikeAddOn(tier: ExtractedPricingTier): boolean {
  const text = `${tier.tier} ${tier.description || ''}`;
  return containsAny(text, ADD_ON_KEYWORDS);
}

/**
 * Get known product lines for a company
 */
function getProductLines(companyName: string): string[] {
  const normalized = normalize(companyName).split(' ')[0]; // Get first word
  return KNOWN_PRODUCT_LINES[normalized] || [];
}

/**
 * Check if tier is for a different product from the same company
 */
function isDifferentProduct(
  tier: ExtractedPricingTier,
  competitorName: string,
  productName?: string
): { isDifferent: boolean; detectedProduct?: string } {
  const productLines = getProductLines(competitorName);
  if (productLines.length === 0) {
    return { isDifferent: false };
  }
  
  const tierText = normalize(`${tier.tier} ${tier.description || ''}`);
  const targetProduct = productName ? normalize(productName) : null;
  
  // Find which product line this tier belongs to
  for (const product of productLines) {
    if (tierText.includes(product)) {
      // If we have a target product, check if this matches
      if (targetProduct && !targetProduct.includes(product)) {
        return { isDifferent: true, detectedProduct: product };
      }
    }
  }
  
  return { isDifferent: false };
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Score a pricing tier's relevance to the competitor being researched
 * 
 * @param tier - The pricing tier to assess
 * @param options - Scoring options including competitor info
 * @returns Relevance assessment with score, category, and explanation
 */
export function scorePricingRelevance(
  tier: ExtractedPricingTier,
  options: PricingRelevanceOptions
): PricingRelevance {
  const { competitorName, productName } = options;
  const signals: string[] = [];
  let score = 0;
  
  const tierName = tier.tier || '';
  const tierDesc = tier.description || '';
  const tierText = `${tierName} ${tierDesc}`;
  
  // -------------------------------------------------------------------------
  // Signal 1: Product Name Match (0-40 points)
  // -------------------------------------------------------------------------
  const targetName = productName || competitorName;
  const nameOverlap = wordOverlap(tierText, targetName);
  
  if (nameOverlap >= 0.5) {
    score += 40;
    signals.push(`Tier matches product name "${targetName}"`);
  } else if (nameOverlap > 0) {
    const partialScore = Math.round(nameOverlap * 40);
    score += partialScore;
    signals.push(`Partial product name match (${Math.round(nameOverlap * 100)}%)`);
  }
  
  // Check for different product from same company
  const diffProduct = isDifferentProduct(tier, competitorName, productName);
  if (diffProduct.isDifferent && diffProduct.detectedProduct) {
    score -= 30;
    signals.push(`Different product detected: ${diffProduct.detectedProduct}`);
  }
  
  // -------------------------------------------------------------------------
  // Signal 2: Core Product Indicators (0-30 points)
  // -------------------------------------------------------------------------
  const isStandard = isStandardTierName(tierName);
  const isAddOn = looksLikeAddOn(tier);
  
  if (isStandard && !isAddOn) {
    score += 30;
    signals.push('Standard SaaS tier structure');
  } else if (isStandard && isAddOn) {
    score += 15;
    signals.push('Standard tier name but has add-on characteristics');
  } else if (isAddOn) {
    score += 5;
    signals.push('Appears to be an add-on or supplementary pricing');
  } else {
    // Unknown tier structure - give partial credit
    score += 10;
    signals.push('Non-standard tier naming');
  }
  
  // -------------------------------------------------------------------------
  // Signal 3: Tier Structure Match (0-20 points)
  // -------------------------------------------------------------------------
  // Check if price format suggests main product vs add-on
  const priceStr = tier.price?.toLowerCase() || '';
  
  if (priceStr.includes('free') || priceStr.includes('$0')) {
    score += 20;
    signals.push('Free tier (common for main product)');
  } else if (priceStr.includes('/mo') || priceStr.includes('/month') || 
             priceStr.includes('/yr') || priceStr.includes('/year') ||
             priceStr.includes('/user')) {
    score += 15;
    signals.push('Subscription pricing pattern');
  } else if (priceStr.includes('contact') || priceStr.includes('custom') ||
             priceStr.includes('sales')) {
    score += 10;
    signals.push('Enterprise/custom pricing');
  } else if (priceStr.includes('/gb') || priceStr.includes('/hour') ||
             priceStr.includes('/credit') || priceStr.includes('usage')) {
    score += 5;
    signals.push('Usage-based pricing (likely add-on)');
  }
  
  // -------------------------------------------------------------------------
  // Signal 4: Description Relevance (0-10 points)
  // -------------------------------------------------------------------------
  if (tierDesc) {
    // Check for core product keywords in description
    const coreKeywords = ['everything', 'all features', 'full access', 'complete', 
                          'unlimited', 'core', 'essential', 'standard'];
    const addOnDescKeywords = ['additional', 'extra', 'more', 'upgrade', 'boost'];
    
    if (containsAny(tierDesc, coreKeywords)) {
      score += 10;
      signals.push('Description suggests core product');
    } else if (containsAny(tierDesc, addOnDescKeywords)) {
      score += 3;
      signals.push('Description suggests add-on/upgrade');
    } else {
      score += 5;
      signals.push('Neutral description');
    }
  }
  
  // -------------------------------------------------------------------------
  // Determine Category
  // -------------------------------------------------------------------------
  let category: PricingRelevanceCategory;
  let explanation: string;
  
  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));
  
  if (diffProduct.isDifferent) {
    category = 'different_product';
    explanation = `This tier appears to be for ${diffProduct.detectedProduct}, a different product from ${competitorName}.`;
  } else if (isAddOn && score < 50) {
    category = 'add_on';
    explanation = `This appears to be add-on or supplementary pricing, not the main product tiers.`;
  } else if (score >= 60) {
    category = 'core_product';
    explanation = `This tier appears to be part of ${competitorName}'s main product pricing.`;
  } else if (score >= 40) {
    category = isAddOn ? 'add_on' : 'unclear';
    explanation = isAddOn 
      ? `This may be an add-on or optional feature pricing.`
      : `Could not confidently determine if this is core product pricing.`;
  } else {
    category = 'unclear';
    explanation = `Low confidence match - may not be relevant to ${competitorName}'s core offering.`;
  }
  
  return {
    score,
    category,
    explanation,
    signals,
  };
}

// ============================================================================
// Filtering Functions
// ============================================================================

/**
 * Filter pricing tiers by relevance to the competitor
 * 
 * @param tiers - Array of pricing tiers to filter
 * @param options - Filter options including competitor info and thresholds
 * @returns Array of relevant tiers with relevance scores attached
 */
export function filterRelevantPricing(
  tiers: ExtractedPricingTier[],
  options: FilterPricingOptions
): ScoredPricingTier[] {
  const { minScore = 50, includeAddOns = false, ...relevanceOptions } = options;
  
  return tiers
    .map(tier => {
      const relevance = scorePricingRelevance(tier, relevanceOptions);
      return { ...tier, relevance } as ScoredPricingTier;
    })
    .filter(tier => {
      const rel = tier.relevance!;
      
      // Always include if score meets threshold
      if (rel.score >= minScore) return true;
      
      // Optionally include add-ons even if below threshold
      if (includeAddOns && rel.category === 'add_on') return true;
      
      return false;
    })
    .sort((a, b) => (b.relevance?.score ?? 0) - (a.relevance?.score ?? 0));
}

/**
 * Group pricing tiers by relevance category
 * 
 * @param tiers - Array of scored pricing tiers
 * @returns Object with tiers grouped by category
 */
export function groupByRelevanceCategory(
  tiers: ScoredPricingTier[]
): Record<PricingRelevanceCategory, ScoredPricingTier[]> {
  const grouped: Record<PricingRelevanceCategory, ScoredPricingTier[]> = {
    core_product: [],
    add_on: [],
    different_product: [],
    unclear: [],
  };
  
  for (const tier of tiers) {
    const category = tier.relevance?.category ?? 'unclear';
    grouped[category].push(tier);
  }
  
  return grouped;
}

/**
 * Get only core product tiers (highest relevance)
 * 
 * @param tiers - Array of pricing tiers
 * @param options - Relevance options
 * @returns Array of core product tiers only
 */
export function getCoreProductTiers(
  tiers: ExtractedPricingTier[],
  options: PricingRelevanceOptions
): ScoredPricingTier[] {
  return filterRelevantPricing(tiers, { ...options, minScore: 60 })
    .filter(tier => tier.relevance?.category === 'core_product');
}
