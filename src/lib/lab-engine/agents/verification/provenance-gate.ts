// Provenance gate (post-E2E 8081e646 cold-judge fixes): three deterministic
// strips that close the fabrication classes the W6 creative truth gate does
// not reach. Same posture as ADR-0011 — strip or relabel the lie, record it
// in verifierSummary, never hard-fail the section.
//
// 1) stripExemplarEchoes — SKILL.md worked exemplars (fintech receipts/OCR,
//    SOC 2 cost questions) leak verbatim-ish into deployable copy for
//    unrelated subjects (run 8081e646 shipped Ramp's OCR value prop inside
//    Airtable ad hooks). Prompt-side "shape only, never copy" warnings are
//    live and proven insufficient, so the gate is code: a deployable-copy
//    sentence carrying a known exemplar motif is removed unless the motif
//    also appears in the artifact's own evidence-bearing fields (a real
//    fintech subject mentions receipts everywhere; a copy-paste leak mentions
//    them only in the leaked sentence).
// 2) downgradeUnpermalinkedVerbatimQuotes — competitor publicWeaknesses may
//    not present a quote as verbatim when its sourceUrl is an index page,
//    subreddit root, or vendor blog (4 of 5 quotes in run 8081e646). The
//    quote survives as an explicitly paraphrased pattern; only per-review /
//    per-thread permalinks may carry the verbatim label.
// 3) scrubQuoteEmails — personal email addresses inside quote cards are
//    replaced before the artifact can reach a client (run 8081e646 shipped an
//    employee email inside a VoC Trustpilot quote).

export interface StrippedExemplarEcho {
  field: string;
  motif: string;
  removedText: string;
}

export interface DowngradedVerbatimQuote {
  field: string;
  sourceUrl: string;
  reason: string;
}

export interface ScrubbedQuoteEmail {
  field: string;
  count: number;
}

interface ProvenanceGateResult<TRecord> {
  body: Record<string, unknown>;
  stripped: TRecord[];
}

interface ExemplarMotif {
  id: string;
  pattern: RegExp;
}

// Motifs are domain signatures of the worked exemplars inside
// src/lib/lab-engine/skills/*/SKILL.md (fintech account in paid-media,
// SOC 2 compliance vendor in demand-intent). Each motif must stay distinctive
// enough that an unrelated subject would not produce it organically; the
// in-artifact support check handles subjects that genuinely live in these
// domains.
const exemplarMotifs: readonly ExemplarMotif[] = [
  // paid-media SKILL.md hook exemplars: "matches every transaction to its
  // receipt with OCR", "100% receipt capture", "chasing receipts".
  { id: "fintech-receipt-ocr", pattern: /\bocr\b|\breceipts?\b/i },
  // paid-media SKILL.md before/after exemplar: "closing took 10 days",
  // "we close in 3 days", month-end close language.
  {
    id: "fintech-month-end-close",
    pattern: /\bmonth-end\b|\bclos(?:e|es|ing) the month\b|\bclos(?:e|es|ing)(?: \w+)? (?:from \d+ days? to \d+|in \d+ days?)\b/i,
  },
  // demand-intent SKILL.md question exemplar: "how much did your soc 2
  // type 2 actually cost all-in".
  { id: "compliance-soc2", pattern: /\bsoc\s?-?2\b/i },
  // demand-intent SKILL.md intent-signal exemplar: "first security hire" /
  // "GRC lead" job postings.
  {
    id: "compliance-security-hire",
    pattern: /\bfirst security hire\b|\bgrc lead\b/i,
  },
  // paid-media SKILL.md objection exemplar: the named ERP integration stack.
  // Two ERP names in one sentence is the exemplar's signature; a single
  // legitimate integration mention does not trip it.
  {
    id: "fintech-erp-stack",
    pattern: /\b(?:netsuite|quickbooks|xero|sage)\b[^.!?]*\b(?:netsuite|quickbooks|xero|sage)\b/i,
  },
];

interface ExemplarEchoSurfaceConfig {
  // Deployable copy: sentence-level strip, no mercy.
  sentenceFields: ReadonlySet<string>;
  // Mined single utterances (questions): whole-field gap relabel.
  replaceFields: ReadonlySet<string>;
  // Analyst narrative: sentence-level strip, but honest negations ("zero SOC 2
  // questions observed") are kept — only assertive echo sentences go.
  guardedSentenceFields: ReadonlySet<string>;
  // Grounding cells: a grounding that narrates an unsupported motif is itself
  // fabricated provenance — replace wholesale with the honest self-flag.
  unverifiedFields: ReadonlySet<string>;
}

// Surfaces where exemplar echoes shipped in run 8081e646: structured creative
// copy (audienceTypes[].detail, creativeFramework[].hook), question mining,
// prose narration (questionMining.prose narrated the exemplar SOC 2 question
// as a real finding), and a creativeFramework[].grounding cell claiming the
// leaked mechanism was "product capability from the subject's documentation".
const exemplarEchoSurfaces: Record<string, ExemplarEchoSurfaceConfig> = {
  positioningDemandIntent: {
    guardedSentenceFields: new Set(["prose"]),
    replaceFields: new Set(["question"]),
    sentenceFields: new Set<string>(),
    unverifiedFields: new Set<string>(),
  },
  positioningPaidMediaPlan: {
    guardedSentenceFields: new Set(["prose"]),
    replaceFields: new Set<string>(),
    sentenceFields: new Set([
      "hook",
      "description",
      "complaint",
      "howWeLeverage",
      "detail",
    ]),
    unverifiedFields: new Set(["grounding"]),
  },
};

// Model-authored narrative may not vouch for a motif's domain support — the
// run-8081e646 leak repeated itself across prose/grounding and would have
// self-vouched. Support must come from structured evidence-bearing fields
// (keywords, quotes, titles, venue names).
const narrativeFieldNames: ReadonlySet<string> = new Set([
  "prose",
  "grounding",
]);

// Honest-negation guard for narrative fields: "zero SOC 2 questions were
// observed" must survive; "buyers ask how much SOC 2 cost" must not. The
// negation must sit NEAR the motif (run 8081e646's leaked sentence ended
// "...recurring Reddit threads, not support tickets" — a distant, unrelated
// "not" may not shield an assertive echo).
const negationGuardPattern =
  /\b(?:no|not|never|none|absent|zero|without|lacks?|lacking|missing|gap)\b/i;

const negationWindowBefore = 50;

const negationWindowAfter = 30;

function negationGovernsMotif({
  motif,
  sentence,
}: {
  motif: ExemplarMotif;
  sentence: string;
}): boolean {
  const match = motif.pattern.exec(sentence);

  if (match === null) {
    return false;
  }

  const start = Math.max(0, match.index - negationWindowBefore);
  const end = Math.min(
    sentence.length,
    match.index + match[0].length + negationWindowAfter,
  );

  return negationGuardPattern.test(sentence.slice(start, end));
}

const removedExemplarEchoGapLine =
  "evidence gap: copy removed — exemplar-derived content could not be traced to this subject's research evidence";

const removedExemplarQuestionGapLine =
  "evidence gap: question removed — exemplar-derived question, not observed for this subject";

// Quote-card fields where verbatim buyer/customer language ships (mirrors the
// W6 creative-truth-gate surface list).
const quoteCardFieldNames: ReadonlySet<string> = new Set([
  "verbatimText",
  "verbatimQuote",
  "quote",
  "evidenceQuote",
  "objectionText",
  "reasonToLeave",
]);

// A URL that can carry a verbatim quote: a per-review or per-thread permalink.
// Index pages (G2 /products/<x>/reviews), subreddit roots, and vendor blogs
// cannot — text "quoted" from them is retrieval-snippet paraphrase at best.
const verbatimCapableUrlPatterns: readonly RegExp[] = [
  /g2\.com\/products\/[^/]+\/reviews\/[^/]+-review-\d+/i,
  /g2\.com\/survey_responses\//i,
  /capterra\.[a-z.]+\/p\/\d+\/[^/]+\/reviews\/\d+/i,
  /trustpilot\.com\/reviews\/[0-9a-f]{16,}/i,
  /reddit\.com\/r\/[^/]+\/comments\/[a-z0-9]+/i,
  /news\.ycombinator\.com\/item\?id=\d+/i,
];

const paraphrasedQuotePrefix = "Paraphrased pattern (no per-review permalink): ";

const indexSourceSuffix = " — page-level source; not verifiable as verbatim";

const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const emailReplacement = "[email removed]";

const sentenceSplitPattern = /(?<=[.!?])\s+/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectSupportText({
  surfaceFields,
  value,
}: {
  surfaceFields: ReadonlySet<string>;
  value: unknown;
}): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => collectSupportText({ surfaceFields, value: item }))
      .join("\n");
  }

  if (!isRecord(value)) {
    return "";
  }

  return Object.entries(value)
    .filter(([key]) => !surfaceFields.has(key))
    .map(([, childValue]) =>
      collectSupportText({ surfaceFields, value: childValue }),
    )
    .join("\n");
}

function stripEchoSentences({
  field,
  keepNegations,
  motifs,
  stripped,
  value,
}: {
  field: string;
  keepNegations: boolean;
  motifs: readonly ExemplarMotif[];
  stripped: StrippedExemplarEcho[];
  value: string;
}): string {
  const sentences = value.split(sentenceSplitPattern);
  const kept: string[] = [];

  for (const sentence of sentences) {
    const matched = motifs.find((motif) => motif.pattern.test(sentence));

    if (
      matched !== undefined &&
      !(keepNegations && negationGovernsMotif({ motif: matched, sentence }))
    ) {
      stripped.push({
        field,
        motif: matched.id,
        removedText: sentence,
      });
      continue;
    }

    kept.push(sentence);
  }

  const next = kept.join(" ").trim();

  return next.length === 0 ? removedExemplarEchoGapLine : next;
}

function walkForExemplarEchoes({
  motifs,
  path,
  stripped,
  surfaces,
  value,
}: {
  motifs: readonly ExemplarMotif[];
  path: string;
  stripped: StrippedExemplarEcho[];
  surfaces: ExemplarEchoSurfaceConfig;
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkForExemplarEchoes({
        motifs,
        path: `${path}[${index}]`,
        stripped,
        surfaces,
        value: item,
      });
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  let touchedField = false;

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (typeof childValue !== "string") {
      walkForExemplarEchoes({
        motifs,
        path: childPath,
        stripped,
        surfaces,
        value: childValue,
      });
      continue;
    }

    const isSentenceField = surfaces.sentenceFields.has(key);
    const isGuardedField = surfaces.guardedSentenceFields.has(key);

    if (isSentenceField || isGuardedField) {
      const next = stripEchoSentences({
        field: childPath,
        keepNegations: isGuardedField,
        motifs,
        stripped,
        value: childValue,
      });

      if (next !== childValue) {
        value[key] = next;
        touchedField = true;
      }

      continue;
    }

    if (surfaces.replaceFields.has(key)) {
      const matched = motifs.find((motif) => motif.pattern.test(childValue));

      if (matched !== undefined) {
        stripped.push({
          field: childPath,
          motif: matched.id,
          removedText: childValue,
        });
        value[key] = removedExemplarQuestionGapLine;
        touchedField = true;
      }

      continue;
    }

    if (surfaces.unverifiedFields.has(key)) {
      const matched = motifs.find((motif) => motif.pattern.test(childValue));

      if (matched !== undefined) {
        stripped.push({
          field: childPath,
          motif: matched.id,
          removedText: childValue,
        });
        value[key] = "UNVERIFIED";
        touchedField = true;
      }

      continue;
    }
  }

  if (touchedField && typeof value.grounding === "string" && value.grounding !== "UNVERIFIED") {
    value.grounding = "UNVERIFIED";
  }
}

export function stripExemplarEchoes({
  body,
  sectionId,
}: {
  body: Record<string, unknown>;
  sectionId: string;
}): ProvenanceGateResult<StrippedExemplarEcho> {
  const surfaces = exemplarEchoSurfaces[sectionId];

  if (surfaces === undefined) {
    return { body, stripped: [] };
  }

  const surfaceFields = new Set([
    ...surfaces.sentenceFields,
    ...surfaces.replaceFields,
    ...surfaces.guardedSentenceFields,
    ...surfaces.unverifiedFields,
    ...narrativeFieldNames,
  ]);
  const supportText = collectSupportText({ surfaceFields, value: body });
  // A motif supported by the artifact's own evidence-bearing fields is
  // in-domain for this subject — leave it alone everywhere.
  const unsupportedMotifs = exemplarMotifs.filter(
    (motif) => !motif.pattern.test(supportText),
  );

  if (unsupportedMotifs.length === 0) {
    return { body, stripped: [] };
  }

  const cloned = structuredClone(body);
  const stripped: StrippedExemplarEcho[] = [];

  walkForExemplarEchoes({
    motifs: unsupportedMotifs,
    path: "body",
    stripped,
    surfaces,
    value: cloned,
  });

  return stripped.length === 0 ? { body, stripped: [] } : { body: cloned, stripped };
}

function isVerbatimCapableUrl(url: string): boolean {
  return verbatimCapableUrlPatterns.some((pattern) => pattern.test(url));
}

export function downgradeUnpermalinkedVerbatimQuotes({
  body,
}: {
  body: Record<string, unknown>;
}): ProvenanceGateResult<DowngradedVerbatimQuote> {
  const publicWeaknesses = body.publicWeaknesses;

  if (!isRecord(publicWeaknesses) || !Array.isArray(publicWeaknesses.items)) {
    return { body, stripped: [] };
  }

  const downgradeTargets = publicWeaknesses.items
    .map((item, index) => ({ index, item }))
    .filter(({ item }) => {
      if (!isRecord(item)) {
        return false;
      }

      return (
        typeof item.verbatimQuote === "string" &&
        typeof item.sourceUrl === "string" &&
        !item.verbatimQuote.startsWith(paraphrasedQuotePrefix) &&
        !isVerbatimCapableUrl(item.sourceUrl)
      );
    });

  if (downgradeTargets.length === 0) {
    return { body, stripped: [] };
  }

  const cloned = structuredClone(body);
  const clonedWeaknesses = cloned.publicWeaknesses as Record<string, unknown>;
  const clonedItems = clonedWeaknesses.items as unknown[];
  const stripped: DowngradedVerbatimQuote[] = [];

  for (const { index } of downgradeTargets) {
    const item = clonedItems[index];

    if (!isRecord(item) || typeof item.verbatimQuote !== "string") {
      continue;
    }

    const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl : "";

    item.verbatimQuote = `${paraphrasedQuotePrefix}${item.verbatimQuote}`;

    if (
      typeof item.source === "string" &&
      !item.source.endsWith(indexSourceSuffix)
    ) {
      item.source = `${item.source}${indexSourceSuffix}`;
    }

    stripped.push({
      field: `body.publicWeaknesses.items[${index}].verbatimQuote`,
      reason:
        "sourceUrl is an index/page-level URL, not a per-review or per-thread permalink",
      sourceUrl,
    });
  }

  return { body: cloned, stripped };
}

function walkForQuoteEmails({
  path,
  scrubbed,
  value,
}: {
  path: string;
  scrubbed: ScrubbedQuoteEmail[];
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkForQuoteEmails({
        path: `${path}[${index}]`,
        scrubbed,
        value: item,
      });
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childPath = `${path}.${key}`;

    if (typeof childValue === "string" && quoteCardFieldNames.has(key)) {
      const matches = childValue.match(emailPattern);

      if (matches !== null && matches.length > 0) {
        value[key] = childValue.replace(emailPattern, emailReplacement);
        // Record the field and count only — never the address itself.
        scrubbed.push({ count: matches.length, field: childPath });
      }

      continue;
    }

    walkForQuoteEmails({ path: childPath, scrubbed, value: childValue });
  }
}

export function scrubQuoteEmails({
  body,
}: {
  body: Record<string, unknown>;
}): ProvenanceGateResult<ScrubbedQuoteEmail> {
  const cloned = structuredClone(body);
  const scrubbed: ScrubbedQuoteEmail[] = [];

  walkForQuoteEmails({ path: "body", scrubbed, value: cloned });

  return scrubbed.length === 0
    ? { body, stripped: [] }
    : { body: cloned, stripped: scrubbed };
}
