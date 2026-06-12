const TRUST_MARKER_PATTERN = /\[(?:unverified|verified[^\]]*)\]/gi;
// Aggregate verifier footnotes spliced into committed bodies, e.g.
// "[3 figures in this field are unverified — see section badge]".
const AGGREGATE_FOOTNOTE_PATTERN =
  /\[\d+ figures? in this field (?:are|is) unverified[^\]]*\]/gi;
const PIPELINE_TEXT_PATTERN =
  /evidence gap:|validator|budget exhausted|exemplar-derived|agentic review unavailable|displayable|verifiedCount|quarantine|quarantined|quarantinedCount|identity-unverified/i;
const OPERATOR_VOCAB_CLAUSE_PATTERN =
  /(?:^|[.;]\s*)[^.;]*(?:displayable|verifiedCount|quarantine|quarantined|quarantinedCount)[^.;]*(?=$|[.;])/gi;
const TOOL_NAME_PATTERN =
  /\b(searchapi|serpapi|firecrawl|perplexity|brave search|spyfu|answer-tool|lab engine|keyword_volume|keyword_trends|adlibrary|google_ads|meta_ads|linkedin_ads|web_search)\b/i;
const MARKDOWN_LINK_PATTERN = /\[[^\]]+\]\([^)]+\)/g;
// Image links carry no readable label — drop them outright.
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]*\)/g;
// Plain links keep the label, lose the URL syntax.
const MARKDOWN_LINK_LABEL_PATTERN = /\[([^\]]*)\]\([^)]*\)/g;
// Trailing money-provenance parentheticals on display strings, e.g.
// "$3,000 (user-supplied)" -> "$3,000".
const MONEY_PROVENANCE_SUFFIX_PATTERN =
  /\s*\((?:user-supplied|operator-supplied|tool-measured|source-reported|model-estimated|unknown)\)\s*$/i;

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

function removeOperatorVocabularyClauses(value: string): string {
  return value
    .replace(OPERATOR_VOCAB_CLAUSE_PATTERN, '')
    .replace(/\s*;\s*;/g, '; ')
    .replace(/^\s*[;,.:-]\s*/, '')
    .replace(/\s*[;,:-]\s*$/g, '');
}

export function scrubReaderText(value: string): string {
  return collapseWhitespace(
    value
      .replace(AGGREGATE_FOOTNOTE_PATTERN, '')
      .replace(TRUST_MARKER_PATTERN, '')
      .replace(OPERATOR_VOCAB_CLAUSE_PATTERN, '')
      .replace(MARKDOWN_IMAGE_PATTERN, '')
      .replace(MARKDOWN_LINK_LABEL_PATTERN, '$1')
      .replace(SECTION_ENUM_PATTERN, (token) => SECTION_ENUM_LABELS[token] ?? token)
      .replace(/\s+([,.;:])/g, '$1'),
  );
}

/**
 * Removes a trailing money-provenance parenthetical from a display string
 * ("$3,000 (user-supplied)" -> "$3,000"). Provenance belongs in the deck's
 * single assumptions panel, never inline beside the number.
 */
export function stripMoneyProvenanceSuffix(value: string): string {
  return value.replace(MONEY_PROVENANCE_SUFFIX_PATTERN, '').trim();
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
  const scrubbed = removeOperatorVocabularyClauses(scrubReaderText(value))
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
