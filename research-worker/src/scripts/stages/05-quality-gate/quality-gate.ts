// Stage C — Quality Gate (deterministic, mechanical). See ./CONTEXT.md for the contract.

import { loadKillList, getCharLimit, type KillList } from '../../refs/loader';

// --- Types ---

export type ViolationSeverity = 'auto-fixed' | 'warning' | 'fail';

export interface Violation {
  check: string;
  severity: ViolationSeverity;
  detail: string;
  field: string;
  original?: string;
  fixed?: string;
}

export interface QualityReport {
  passed: boolean;
  totalViolations: number;
  autoFixed: number;
  warnings: number;
  failures: number;
  violations: Violation[];
}

export interface QualityGateInput {
  script: Record<string, unknown>;
  platform: string;
  format: string;
}

// --- Individual checkers ---

/**
 * Check 1: Em dash / en dash elimination (HARD GATE)
 * Auto-fixes all dashes. This is the single most visible AI fingerprint.
 */
function checkDashes(text: string, field: string): { fixed: string; violations: Violation[] } {
  const violations: Violation[] = [];
  let result = text;

  // Count before fixing
  const emCount = (text.match(/—/g) || []).length;
  const enCount = (text.match(/–/g) || []).length;

  if (emCount + enCount === 0) return { fixed: result, violations };

  // Spaced em/en dash " — " or " – " → ". " + capitalize
  result = result.replace(/\s[—–]\s/g, '. ');
  result = result.replace(/\. ([a-z])/g, (_, ch) => `. ${ch.toUpperCase()}`);

  // Numeric range "500–5000" → "500 to 5000"
  result = result.replace(/(\d[\d$%KkMmBb.,]*)[—–](\$?\d)/g, '$1 to $2');

  // Unspaced "word—word" → "word, word"
  result = result.replace(/([a-zA-Z])([—–])([a-zA-Z])/g, '$1, $3');

  // Any remaining
  result = result.replace(/[—–]/g, ',');

  violations.push({
    check: 'dash-elimination',
    severity: 'auto-fixed',
    detail: `Removed ${emCount} em dashes and ${enCount} en dashes`,
    field,
    original: text,
    fixed: result,
  });

  return { fixed: result, violations };
}

/**
 * Check 2: Kill list — Tier 1 words (always replace)
 * Auto-fixes by replacing with the suggested alternative.
 */
function checkKillListTier1(text: string, field: string, killList: KillList): { fixed: string; violations: Violation[] } {
  const violations: Violation[] = [];
  let result = text;

  for (const [word, replacement] of Object.entries(killList.tier1_always_replace)) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    const matches = result.match(regex);
    if (matches && matches.length > 0) {
      // Use the first suggested replacement (before the " / ")
      const firstReplacement = replacement.split(' / ')[0].replace(/^\[/, '').replace(/\]$/, '');
      if (!firstReplacement.startsWith('cut') && !firstReplacement.startsWith('say ')) {
        result = result.replace(regex, firstReplacement);
        violations.push({
          check: 'kill-list-tier1',
          severity: 'auto-fixed',
          detail: `Replaced "${word}" with "${firstReplacement}" (${matches.length}x)`,
          field,
        });
      } else {
        violations.push({
          check: 'kill-list-tier1',
          severity: 'warning',
          detail: `Found "${word}" (${matches.length}x) — needs manual replacement: ${replacement}`,
          field,
        });
      }
    }
  }

  return { fixed: result, violations };
}

/**
 * Check 3: Banned phrases
 * Flags but does not auto-fix (removal requires restructuring).
 */
function checkBannedPhrases(text: string, field: string, killList: KillList): Violation[] {
  const violations: Violation[] = [];
  const lower = text.toLowerCase();

  for (const phrase of killList.banned_phrases) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push({
        check: 'banned-phrase',
        severity: 'warning',
        detail: `Contains banned phrase: "${phrase}"`,
        field,
      });
    }
  }

  return violations;
}

/**
 * Check 4: Template openers
 */
function checkTemplateOpeners(text: string, field: string, killList: KillList): Violation[] {
  const violations: Violation[] = [];
  const lower = text.toLowerCase();

  for (const pattern of killList.template_openers) {
    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lower)) {
        violations.push({
          check: 'template-opener',
          severity: 'warning',
          detail: `Opens with AI template pattern: "${pattern}"`,
          field,
        });
      }
    } catch {
      // If regex is invalid, do simple includes
      if (lower.startsWith(pattern.toLowerCase())) {
        violations.push({
          check: 'template-opener',
          severity: 'warning',
          detail: `Opens with template phrase: "${pattern}"`,
          field,
        });
      }
    }
  }

  return violations;
}

/**
 * Check 5: Character limit enforcement per platform
 */
function checkCharLimits(script: Record<string, unknown>, platform: string): Violation[] {
  const violations: Violation[] = [];

  const fieldMap: Record<string, Record<string, string>> = {
    meta: { headline: 'headline', body: 'primaryText', description: 'description' },
    google: { headline: 'rsaHeadline', body: 'rsaDescription' },
    linkedin: { headline: 'headline', body: 'introText' },
  };

  const platformFields = fieldMap[platform];
  if (!platformFields) return violations;

  for (const [scriptField, limitField] of Object.entries(platformFields)) {
    const value = script[scriptField];
    if (typeof value !== 'string') continue;
    const limit = getCharLimit(platform, limitField);
    if (!limit) continue;

    if (value.length > limit.max) {
      violations.push({
        check: 'char-limit',
        severity: 'fail',
        detail: `${scriptField} is ${value.length} chars, max ${limit.max} for ${platform}`,
        field: scriptField,
      });
    } else if (limit.optimal && value.length > limit.optimal * 1.2) {
      violations.push({
        check: 'char-limit',
        severity: 'warning',
        detail: `${scriptField} is ${value.length} chars, optimal ${limit.optimal} for ${platform}`,
        field: scriptField,
      });
    }
  }

  return violations;
}

/**
 * Check 6: Sentence rhythm analysis
 * Flags if all sentences are within ±5 words of each other (flat/robotic).
 */
function checkSentenceRhythm(text: string, field: string): Violation[] {
  const violations: Violation[] = [];
  // Split on sentence-ending punctuation
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (sentences.length < 3) return violations;

  const wordCounts = sentences.map((s) => s.split(/\s+/).length);
  const min = Math.min(...wordCounts);
  const max = Math.max(...wordCounts);

  // Check if range is too narrow (all sentences similar length)
  if (max - min <= 5) {
    violations.push({
      check: 'sentence-rhythm',
      severity: 'warning',
      detail: `All ${sentences.length} sentences are ${min}-${max} words. Needs variation (mix short punches with longer builds).`,
      field,
    });
  }

  // Check: no sentence under 5 words
  const hasShort = wordCounts.some((c) => c <= 5);
  if (!hasShort && sentences.length >= 4) {
    violations.push({
      check: 'sentence-rhythm-short',
      severity: 'warning',
      detail: `No short-punch sentence (under 5 words) found. Add rhythmic variation.`,
      field,
    });
  }

  return violations;
}

/**
 * Check 7: Rule of three detection
 */
function checkRuleOfThree(text: string, field: string): Violation[] {
  const violations: Violation[] = [];
  // Pattern: "word, word, and word" or "word, word, & word"
  const ruleOfThreeRegex = /\b\w+,\s+\w+,\s+(?:and|&)\s+\w+\b/gi;
  const matches = text.match(ruleOfThreeRegex);

  if (matches && matches.length > 0) {
    for (const match of matches) {
      violations.push({
        check: 'rule-of-three',
        severity: 'warning',
        detail: `Rule of three detected: "${match}". Pick the strongest and say it once.`,
        field,
      });
    }
  }

  return violations;
}

/**
 * Check 8: Transition clustering
 */
function checkTransitions(text: string, field: string): Violation[] {
  const violations: Violation[] = [];
  const transitions = [
    'furthermore', 'moreover', 'additionally', 'in addition',
    'however', 'nevertheless', 'consequently', 'therefore',
    'subsequently', 'meanwhile', 'alternatively',
  ];

  const paragraphs = text.split(/\n\n+/);
  for (const para of paragraphs) {
    const lower = para.toLowerCase();
    const found = transitions.filter((t) => lower.includes(t));
    if (found.length >= 2) {
      violations.push({
        check: 'transition-clustering',
        severity: 'warning',
        detail: `Paragraph has ${found.length} transitional words: ${found.join(', ')}. Max 1 per paragraph.`,
        field,
      });
    }
  }

  return violations;
}

/**
 * Check 9: Hyphenated corporate buzzwords
 */
function checkHyphenatedCorporate(text: string, field: string, killList: KillList): Violation[] {
  const violations: Violation[] = [];
  const lower = text.toLowerCase();

  for (const phrase of killList.hyphenated_corporate) {
    if (lower.includes(phrase)) {
      violations.push({
        check: 'hyphenated-corporate',
        severity: 'warning',
        detail: `Contains corporate buzzword: "${phrase}". Describe the actual thing.`,
        field,
      });
    }
  }

  return violations;
}

/**
 * Check 10: Chatbot closers and sycophantic affirmations
 */
function checkChatbotPatterns(text: string, field: string, killList: KillList): Violation[] {
  const violations: Violation[] = [];
  const lower = text.toLowerCase();

  for (const closer of killList.chatbot_closers) {
    if (lower.includes(closer)) {
      violations.push({
        check: 'chatbot-closer',
        severity: 'warning',
        detail: `Contains chatbot closer: "${closer}". Delete it.`,
        field,
      });
    }
  }

  // Only check affirmations at sentence start
  for (const affirm of killList.sycophantic_affirmations) {
    const regex = new RegExp(`(?:^|[.!?]\\s+)${escapeRegex(affirm)}[.!,]`, 'gi');
    if (regex.test(text)) {
      violations.push({
        check: 'sycophantic-affirmation',
        severity: 'warning',
        detail: `Contains sycophantic affirmation: "${affirm}". Cut it.`,
        field,
      });
    }
  }

  return violations;
}

// --- Utility ---

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Main Quality Gate ---

/**
 * Run all deterministic quality checks on a script.
 * Returns a QualityReport with auto-fixes applied to the script object.
 */
export function runQualityGate(input: QualityGateInput): { script: Record<string, unknown>; report: QualityReport } {
  const killList = loadKillList();
  const script = { ...input.script };
  const allViolations: Violation[] = [];

  // Process all string fields
  const stringFields = Object.entries(script).filter(
    ([, v]) => typeof v === 'string',
  ) as [string, string][];

  for (const [field, value] of stringFields) {
    let current = value;

    // Auto-fix checks (modify the text)
    const dashResult = checkDashes(current, field);
    current = dashResult.fixed;
    allViolations.push(...dashResult.violations);

    const tier1Result = checkKillListTier1(current, field, killList);
    current = tier1Result.fixed;
    allViolations.push(...tier1Result.violations);

    // Update the script with fixes
    script[field] = current;

    // Warning/fail checks (don't modify text)
    allViolations.push(...checkBannedPhrases(current, field, killList));
    allViolations.push(...checkTemplateOpeners(current, field, killList));
    allViolations.push(...checkSentenceRhythm(current, field));
    allViolations.push(...checkRuleOfThree(current, field));
    allViolations.push(...checkTransitions(current, field));
    allViolations.push(...checkHyphenatedCorporate(current, field, killList));
    allViolations.push(...checkChatbotPatterns(current, field, killList));
  }

  // Process string arrays (hookVariants)
  for (const [field, value] of Object.entries(script)) {
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      script[field] = (value as string[]).map((v) => {
        let current = v;
        const dashResult = checkDashes(current, field);
        current = dashResult.fixed;
        allViolations.push(...dashResult.violations);
        const tier1Result = checkKillListTier1(current, field, killList);
        current = tier1Result.fixed;
        allViolations.push(...tier1Result.violations);
        return current;
      });
    }
  }

  // Platform char limit checks
  allViolations.push(...checkCharLimits(script, input.platform));

  // Compute summary
  const autoFixed = allViolations.filter((v) => v.severity === 'auto-fixed').length;
  const warnings = allViolations.filter((v) => v.severity === 'warning').length;
  const failures = allViolations.filter((v) => v.severity === 'fail').length;

  return {
    script,
    report: {
      passed: failures === 0,
      totalViolations: allViolations.length,
      autoFixed,
      warnings,
      failures,
      violations: allViolations,
    },
  };
}
