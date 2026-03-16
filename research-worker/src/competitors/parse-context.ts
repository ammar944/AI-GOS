// research-worker/src/competitors/parse-context.ts
// Extracts structured competitor and business data from the context string
// passed by the lead agent when dispatching researchCompetitors.

export interface CompetitorEntry {
  name: string;
  domain: string | null; // null if we can only infer .com
  inferredDomain: boolean;
}

export interface ParsedCompetitorContext {
  competitors: CompetitorEntry[];
  companyName: string | null;
  websiteUrl: string | null;
  businessModel: string | null;
  productDescription: string | null;
  icpDescription: string | null;
  pricingContext: string | null;
  uniqueEdge: string | null;
  goals: string | null;
  rawContext: string;
}

// Domain TLDs we recognize without requiring full URL
const KNOWN_TLDS = ['com', 'io', 'ai', 'co', 'app', 'dev', 'net', 'org', 'so', 'xyz'];
const DOMAIN_PATTERN = /^[a-z0-9][-a-z0-9]*\.[a-z]{2,}$/i;

/**
 * Extract a field value from the context string.
 * Matches patterns like "- Company: Acme CRM" or "Company: Acme CRM"
 */
function extractField(context: string, ...labels: string[]): string | null {
  for (const label of labels) {
    // Try "- Label: value" and "Label: value" patterns
    const pattern = new RegExp(`^\\s*-?\\s*${label}\\s*:\\s*(.+)$`, 'im');
    const match = context.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value.length > 0) return value;
    }
  }
  return null;
}

/**
 * Parse a comma-separated competitor string into individual entries.
 * Handles formats like:
 * - "Salesforce, HubSpot, Pipedrive"
 * - "salesforce.com, hubspot.com"
 * - "Salesforce (salesforce.com), HubSpot"
 */
function parseCompetitorString(raw: string): CompetitorEntry[] {
  const entries: CompetitorEntry[] = [];
  // Split by comma or semicolon
  const parts = raw.split(/[,;]/).map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    // Check for "Name (domain)" pattern
    const parenMatch = part.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (parenMatch) {
      const name = parenMatch[1].trim();
      const domainCandidate = parenMatch[2]
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0];
      entries.push({
        name,
        domain: DOMAIN_PATTERN.test(domainCandidate) ? domainCandidate : null,
        inferredDomain: false,
      });
      continue;
    }

    // Check if the part itself is a domain
    const cleaned = part
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    if (DOMAIN_PATTERN.test(cleaned)) {
      // It's a domain — extract name from the first segment
      const namePart = cleaned.split('.')[0];
      const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      entries.push({ name, domain: cleaned, inferredDomain: false });
      continue;
    }

    // It's just a name — infer domain as name.com
    const name = part.trim();
    if (name.length < 2) continue;

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    entries.push({
      name,
      domain: `${slug}.com`,
      inferredDomain: true,
    });
  }

  return entries;
}

/**
 * Parse the full context string into structured competitor data.
 */
export function parseCompetitorContext(context: string): ParsedCompetitorContext {
  const competitorsRaw = extractField(
    context,
    'Competitors',
    'Top Competitors',
    'Key Competitors',
    'Direct Competitors',
  );

  const competitors = competitorsRaw ? parseCompetitorString(competitorsRaw) : [];

  return {
    competitors,
    companyName: extractField(context, 'Company', 'Company Name', 'Business Name'),
    websiteUrl: extractField(context, 'Website', 'Website URL', 'URL'),
    businessModel: extractField(context, 'Business Model', 'Model'),
    productDescription: extractField(
      context,
      'Product',
      'Product Description',
      'What they sell',
      'Offer',
    ),
    icpDescription: extractField(
      context,
      'ICP',
      'Ideal Customer',
      'Target Customer',
      'Target Audience',
    ),
    pricingContext: extractField(
      context,
      'Pricing',
      'Pricing Tiers',
      'Price',
      'Budget',
      'Monthly Ad Budget',
    ),
    uniqueEdge: extractField(context, 'Unique Edge', 'Differentiator', 'Competitive Advantage'),
    goals: extractField(context, 'Goals', 'Objective', 'Target'),
    rawContext: context,
  };
}

// Re-export KNOWN_TLDS for callers that need to extend the list
export { KNOWN_TLDS };
