const TRUST_MARKER_PATTERN = /\[(?:unverified|verified[^\]]*)\]/gi;
const PIPELINE_TEXT_PATTERN =
  /evidence gap:|validator|budget exhausted|exemplar-derived|agentic review unavailable|verifiedCount|quarantinedCount|identity-unverified/i;
const TOOL_NAME_PATTERN =
  /\b(searchapi|serpapi|firecrawl|perplexity|brave search|spyfu|answer-tool|lab engine)\b/i;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\([^)]+\)/g;

const SECTION_ENUM_LABELS: Record<string, string> = {
  positioningMarketCategory: 'Market & Category',
  positioningBuyerICP: 'Buyer & ICP',
  positioningCompetitorLandscape: 'Competitor Landscape',
  positioningVoiceOfCustomer: 'Voice of Customer',
  positioningDemandIntent: 'Demand & Intent',
  positioningOfferDiagnostic: 'Offer Diagnostic',
  positioningPaidMediaPlan: 'Paid Media Plan',
  deepResearchProgram: 'Research Corpus',
};
const SECTION_ENUM_PATTERN = new RegExp(
  `\\b(${Object.keys(SECTION_ENUM_LABELS).join('|')})\\b`,
  'g',
);

function collapseWhitespace(value: string): string {
  return value.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function scrubReaderText(value: string): string {
  return collapseWhitespace(
    value
      .replace(TRUST_MARKER_PATTERN, '')
      .replace(SECTION_ENUM_PATTERN, (token) => SECTION_ENUM_LABELS[token] ?? token)
      .replace(/\s+([,.;:])/g, '$1'),
  );
}

export function isReaderPipelineChrome(value: string): boolean {
  return PIPELINE_TEXT_PATTERN.test(value) || TOOL_NAME_PATTERN.test(value);
}

export function isInvalidReaderUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  return (
    trimmed.length === 0 ||
    trimmed.endsWith('.invalid') ||
    trimmed.includes('placeholder') ||
    trimmed === '#'
  );
}

export function clampReaderText(value: string, maxChars = 500): string {
  const scrubbed = scrubReaderText(value);
  if (scrubbed.length <= maxChars) return scrubbed;
  return `${scrubbed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function looksLikeNavMenuGarbage(value: string): boolean {
  const linkMatches = value.match(MARKDOWN_LINK_PATTERN) ?? [];
  return value.length > 1000 || linkMatches.length >= 3;
}

export function clientGapSentence(value: string, subject = 'this point'): string {
  const scrubbed = scrubReaderText(value)
    .replace(/^evidence gap:\s*/i, '')
    .replace(/^data gap:\s*/i, '')
    .replace(/^validator requires\s*/i, '')
    .replace(/^section budget exhausted.*$/i, '')
    .trim();

  const topic =
    scrubbed.length > 0 && !isReaderPipelineChrome(scrubbed)
      ? scrubbed
      : subject;

  return `Not enough public evidence was found for ${topic}.`;
}

export function textOrGap(value: string, subject: string): {
  kind: 'text' | 'gap';
  value: string;
} {
  if (looksLikeNavMenuGarbage(value)) {
    return { kind: 'gap', value: clientGapSentence('', subject) };
  }
  if (isReaderPipelineChrome(value)) {
    return { kind: 'gap', value: clientGapSentence(value, subject) };
  }
  return { kind: 'text', value: scrubReaderText(value) };
}
