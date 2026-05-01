// skills/landing-page-studio/scripts/quality-gates.ts
// Vendored from src/lib/ai/landing-page/quality-gates.ts — do not import from source.
// This file is a self-contained copy to preserve skill portability (CLAUDE.md skill-first constraint).
// If the source gates change, update this file manually.
// Last synced: 2026-05-01
// Source: src/lib/ai/landing-page/quality-gates.ts (182 lines as of sync date)

export interface LandingPageQualityGateOptions {
  sourceFacts?: string[];
}

export interface LandingPageQaReport {
  details: Record<string, string[]>;
  failed_gates: string[];
  passed: boolean;
  signals: string[];
}

const GENERIC_COPY_PATTERNS: RegExp[] = [
  /\ball-in-one\b/i,
  /\bsingle source of truth\b/i,
  /\bevery tool you need\b/i,
  /\bunlock\b/i,
  /\belevate\b/i,
  /\bseamless\b/i,
  /\bsupercharge\b/i,
  /\brevolutionize\b/i,
];

const PLACEHOLDER_PATTERNS: RegExp[] = [
  />\s*(Dashboard|Product mockup|Mockup|Placeholder)\s*</i,
  /\bclean placeholder\b/i,
  /\blorem ipsum\b/i,
  /\bimage placeholder\b/i,
];

const FAMOUS_LOGO_PROOF_PATTERN =
  /trusted by[\s\S]{0,300}(Google|Apple|Microsoft|Meta|Stripe|Airbnb|RE\/MAX|Sotheby|CENTURY 21|Coldwell Banker)/i;

const PRODUCT_DETAIL_TERMS: string[] = [
  "aps",
  "bra",
  "fintrac",
  "trust ledger",
  "commission split",
  "broker-of-record",
  "broker of record",
  "conveyancing",
  "mls",
  "audit",
  "trade file",
  "trade-file",
  "deposit receipt",
  "payout",
  "approval",
  "document status",
];

export function runLandingPageQualityGates(
  html: string,
  options: LandingPageQualityGateOptions = {}
): LandingPageQaReport {
  const failed = new Set<string>();
  const signals = new Set<string>();
  const details: Record<string, string[]> = {};

  addSemanticSignals(html, failed, signals);
  addCssSignals(html, failed, signals);
  addCopySignals(html, failed, signals);
  addProofSignals(html, options, failed, signals);
  addProductArtifactSignals(html, failed, signals, details);

  return {
    passed: failed.size === 0,
    failed_gates: Array.from(failed),
    signals: Array.from(signals),
    details,
  };
}

function addSemanticSignals(html: string, failed: Set<string>, signals: Set<string>): void {
  const hasHeader = /<header\b/i.test(html);
  const hasNav = /<nav\b/i.test(html);
  const hasMain = /<main\b/i.test(html);
  const hasFooter = /<footer\b/i.test(html);

  if (hasHeader && hasNav && hasMain && hasFooter) {
    signals.add("semantic_html");
    return;
  }

  failed.add("missing_semantic_html");
}

function addCssSignals(html: string, failed: Set<string>, signals: Set<string>): void {
  if (/oklch\(/i.test(html)) {
    signals.add("oklch_colors");
  } else {
    failed.add("missing_oklch_colors");
  }

  if (/text-wrap\s*:\s*pretty/i.test(html)) {
    signals.add("text_wrap_pretty");
  }

  if (/:focus-visible|:focus\b/i.test(html)) {
    signals.add("focus_states");
  } else {
    failed.add("missing_focus_states");
  }

  if (/prefers-reduced-motion/i.test(html)) {
    signals.add("reduced_motion");
  } else if (/@keyframes|animation\s*:|transition\s*:/i.test(html)) {
    failed.add("missing_reduced_motion");
  }

  if (/@media/i.test(html)) {
    signals.add("responsive_css");
  } else {
    failed.add("missing_responsive_css");
  }

  if (/min-(height|width)\s*:\s*44px/i.test(html)) {
    signals.add("touch_targets");
  } else {
    failed.add("missing_touch_targets");
  }

  if (/font-family\s*:\s*Inter\b|fonts\.googleapis\.com[^"']*Inter/i.test(html)) {
    failed.add("inter_as_display_or_global_font");
  }

  if (/\.nav-links[\s\S]{0,240}overflow-x\s*:\s*auto/i.test(html)) {
    failed.add("mobile_nav_overflow_risk");
  }
}

function addCopySignals(html: string, failed: Set<string>, signals: Set<string>): void {
  if (GENERIC_COPY_PATTERNS.some((pattern) => pattern.test(html))) {
    failed.add("generic_saas_copy");
  } else {
    signals.add("specific_copy");
  }

  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(html))) {
    failed.add("placeholder_product_artifact");
  }
}

function addProofSignals(
  html: string,
  options: LandingPageQualityGateOptions,
  failed: Set<string>,
  signals: Set<string>
): void {
  const hasProofClaims = /\b(trusted by|testimonial|rated|review shown|customers|logos?)\b/i.test(html);
  const hasSourceFacts = (options.sourceFacts ?? []).length > 0;

  if (FAMOUS_LOGO_PROOF_PATTERN.test(html) || (hasProofClaims && !hasSourceFacts)) {
    failed.add("fake_or_unverified_proof");
    return;
  }

  if (hasProofClaims && hasSourceFacts) {
    signals.add("sourced_proof");
  }
}

function addProductArtifactSignals(
  html: string,
  failed: Set<string>,
  signals: Set<string>,
  details: Record<string, string[]>
): void {
  const lowerHtml = html.toLowerCase();
  const matchedTerms = PRODUCT_DETAIL_TERMS.filter((term) => lowerHtml.includes(term));
  const hasArtifactContainer = /product-artifact|product-card|trade-file|command center|review queue/i.test(html);
  const hasArtifactStructure = /<table\b|<article\b|role="table"|aria-label="[^"]*(product|trade|queue)/i.test(html);

  details.product_terms = matchedTerms;

  if (hasArtifactContainer && hasArtifactStructure && matchedTerms.length >= 8) {
    signals.add("product_artifact");
    return;
  }

  failed.add("missing_product_artifact");
}
