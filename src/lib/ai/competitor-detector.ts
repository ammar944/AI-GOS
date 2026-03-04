// Competitor Detector
// Deterministic extraction of competitor mentions from user message text.
// Used in route.ts to inject a Stage 2 trigger instruction when a competitor
// is detected — before the competitorFastHits tool call.
//
// Design decisions:
// - URL detection takes priority over phrase detection
// - Phrase detection infers domain by lowercasing the company name + ".com"
//   (covers ~80% of SaaS companies — good enough for a fast-path trigger)
// - Returns first match only — route calls competitorFastHits for one competitor
//   per request to avoid blocking the response with multiple serial sub-agent calls
// - Email addresses are excluded to avoid false positives

export interface CompetitorDetection {
  /** Normalised domain ready to pass to competitorFastHits (e.g., "hubspot.com") */
  domain: string;
  /** The raw string that triggered detection */
  rawMention: string;
  /** True when domain was inferred from a company name rather than an explicit URL */
  inferredDomain: boolean;
}

// Phrases that signal the user is naming a competitor
// Deliberately conservative: only strong explicit signals
const COMPETITOR_PHRASE_PATTERNS = [
  /(?:my|our|main|top|biggest|primary|direct)\s+competitor(?:s)?\s+(?:is|are)\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
  /(?:we\s+)?compete\s+(?:with|against)\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
  /(?:my|our)\s+(?:\w+\s+)?rival(?:s)?\s+(?:is|are)\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
  /competing\s+against\s+([A-Z][a-zA-Z0-9\s]{1,30}?)(?:\s+and\s+|,|\.|$)/gi,
];

// Patterns that indicate the user does NOT know competitors — skip Stage 2
const NO_COMPETITOR_SIGNALS = [
  /don'?t\s+know/i,
  /no\s+(?:direct\s+)?competitors/i,
  /not\s+sure\s+who/i,
  /no\s+idea/i,
];

// Supported TLDs for bare domain detection (no protocol)
const DOMAIN_TLDS = ['com', 'io', 'ai', 'co', 'app', 'dev', 'net', 'org', 'xyz'];

// Bare domain pattern — must NOT be preceded by @ (to exclude email addresses)
// Uses a negative lookbehind for @
const BARE_DOMAIN_RE = new RegExp(
  `(?<!@)\\b([a-zA-Z0-9][a-zA-Z0-9-]{1,30})\\.(?:${DOMAIN_TLDS.join('|')})\\b`,
  'gi',
);

// Generic "compete in the X market" pattern — no named company, should NOT match
// We use this to distinguish named-company captures from generic business phrases
const GENERIC_COMPETE_RE = /compete\s+in\s+the\b/i;

const HTTPS_URL_RE = /https?:\/\/(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9.-]{1,60})/gi;

// Email pattern to exclude false positives like "hello@example.com"
const EMAIL_RE = /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi;

/**
 * Infer a .com domain from a company name by lowercasing and removing spaces.
 * e.g. "HubSpot" → "hubspot.com", "Pager Duty" → "pagerduty.com"
 */
function inferDomain(companyName: string): string {
  return companyName.trim().toLowerCase().replace(/\s+/g, '') + '.com';
}

/**
 * Strip email addresses from the text before scanning for domains to
 * prevent "user@hubspot.com" matching as a competitor.
 */
function stripEmails(text: string): string {
  EMAIL_RE.lastIndex = 0;
  return text.replace(EMAIL_RE, '');
}

/**
 * Extract the first competitor mention from a user message.
 *
 * Priority order:
 * 1. Explicit HTTPS/HTTP URL → highest confidence
 * 2. Bare domain with known TLD (e.g., "hubspot.com")
 * 3. Competitor phrase patterns → lowest confidence, domain inferred
 *
 * Returns null when:
 * - No competitor signal found
 * - "no competitors" / "don't know" signals present
 * - Input is empty
 */
export function detectCompetitorMentions(
  userMessage: string,
): CompetitorDetection | null {
  if (!userMessage.trim()) return null;

  // Bail early if user explicitly says they don't know competitors
  if (NO_COMPETITOR_SIGNALS.some((re) => re.test(userMessage))) {
    return null;
  }

  // Bail early on generic "compete in the market" phrases (no named company)
  if (GENERIC_COMPETE_RE.test(userMessage)) {
    return null;
  }

  const cleaned = stripEmails(userMessage);

  // 1. Explicit URL detection (highest confidence)
  HTTPS_URL_RE.lastIndex = 0;
  const urlMatch = HTTPS_URL_RE.exec(cleaned);
  if (urlMatch) {
    const rawDomain = urlMatch[1].toLowerCase();
    // Strip trailing path segments — take only host part
    const host = rawDomain.split('/')[0];
    // Strip www. prefix
    const domain = host.startsWith('www.') ? host.slice(4) : host;
    return {
      domain,
      rawMention: urlMatch[0],
      inferredDomain: false,
    };
  }

  // 2. Bare domain with known TLD (e.g., "datadog.com", "linear.io")
  BARE_DOMAIN_RE.lastIndex = 0;
  const domainMatch = BARE_DOMAIN_RE.exec(cleaned);
  if (domainMatch) {
    const fullMatch = domainMatch[0].toLowerCase();
    return {
      domain: fullMatch,
      rawMention: domainMatch[0],
      inferredDomain: false,
    };
  }

  // 3. Competitor phrase patterns — infer domain from company name
  for (const pattern of COMPETITOR_PHRASE_PATTERNS) {
    pattern.lastIndex = 0;
    const phraseMatch = pattern.exec(userMessage);
    if (phraseMatch?.[1]) {
      const companyName = phraseMatch[1].trim();
      // Sanity check: skip if "captured group" looks like a generic word
      if (companyName.length < 3 || /^(the|a|an|our|my|this|that)$/i.test(companyName)) {
        continue;
      }
      return {
        domain: inferDomain(companyName),
        rawMention: phraseMatch[0].trim(),
        inferredDomain: true,
      };
    }
  }

  return null;
}
