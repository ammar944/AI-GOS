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
// 4) stripPlaceholderSourceUrls — fabricated placeholder URLs (example.com,
//    short-digit LinkedIn group ids, sequential-digit ids, Reddit
//    pseudo-permalinks whose "id" segment is a topic slug) are relabeled to an
//    explicit evidence-gap marker URL so a made-up link can never ship as
//    provenance. The row and its claim stay; only the fake URL goes.

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

export interface StrippedPlaceholderUrl {
  field: string;
  sourceUrl: string;
  reason: string;
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
  // The id segment must END at a path boundary: a pseudo-permalink topic slug
  // ("/comments/people-hate-pricing/") would otherwise prefix-match.
  /reddit\.com\/r\/[^/]+\/comments\/[a-z0-9]+(?:[/?#]|$)/i,
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

interface VerbatimQuoteSurface {
  blockKey: string;
  itemsKey: string;
  quoteField: string;
  // CompetitorLandscape `source` is a free string and takes the page-level
  // suffix; VoC `source` is a closed enum (vocSourceTypes) where any append
  // would fail schema re-parse at persistence.
  appendSourceSuffix: boolean;
}

const unpermalinkedDowngradeReason =
  "sourceUrl is an index/page-level URL, not a per-review or per-thread permalink";

function downgradeQuoteSurface({
  body,
  cloned,
  stripped,
  surface,
}: {
  body: Record<string, unknown>;
  cloned: Record<string, unknown>;
  stripped: DowngradedVerbatimQuote[];
  surface: VerbatimQuoteSurface;
}): void {
  const block = body[surface.blockKey];

  if (!isRecord(block) || !Array.isArray(block[surface.itemsKey])) {
    return;
  }

  const items = block[surface.itemsKey] as unknown[];
  const clonedBlock = cloned[surface.blockKey];

  if (!isRecord(clonedBlock) || !Array.isArray(clonedBlock[surface.itemsKey])) {
    return;
  }

  const clonedItems = clonedBlock[surface.itemsKey] as unknown[];

  items.forEach((item, index) => {
    if (!isRecord(item)) {
      return;
    }

    const quote = item[surface.quoteField];

    if (
      typeof quote !== "string" ||
      typeof item.sourceUrl !== "string" ||
      quote.startsWith(paraphrasedQuotePrefix) ||
      isVerbatimCapableUrl(item.sourceUrl)
    ) {
      return;
    }

    const clonedItem = clonedItems[index];

    if (!isRecord(clonedItem) || typeof clonedItem[surface.quoteField] !== "string") {
      return;
    }

    clonedItem[surface.quoteField] = `${paraphrasedQuotePrefix}${quote}`;

    if (
      surface.appendSourceSuffix &&
      typeof clonedItem.source === "string" &&
      !clonedItem.source.endsWith(indexSourceSuffix)
    ) {
      clonedItem.source = `${clonedItem.source}${indexSourceSuffix}`;
    }

    stripped.push({
      field: `body.${surface.blockKey}.${surface.itemsKey}[${index}].${surface.quoteField}`,
      reason: unpermalinkedDowngradeReason,
      sourceUrl: item.sourceUrl,
    });
  });
}

function downgradeUnpermalinkedQuoteSurfaces({
  body,
  surfaces,
}: {
  body: Record<string, unknown>;
  surfaces: readonly VerbatimQuoteSurface[];
}): ProvenanceGateResult<DowngradedVerbatimQuote> {
  const cloned = structuredClone(body);
  const stripped: DowngradedVerbatimQuote[] = [];

  for (const surface of surfaces) {
    downgradeQuoteSurface({ body, cloned, stripped, surface });
  }

  return stripped.length === 0 ? { body, stripped: [] } : { body: cloned, stripped };
}

export function downgradeUnpermalinkedVerbatimQuotes({
  body,
}: {
  body: Record<string, unknown>;
}): ProvenanceGateResult<DowngradedVerbatimQuote> {
  return downgradeUnpermalinkedQuoteSurfaces({
    body,
    surfaces: [
      {
        appendSourceSuffix: true,
        blockKey: "publicWeaknesses",
        itemsKey: "items",
        quoteField: "verbatimQuote",
      },
    ],
  });
}

// VoC mirror of the competitor downgrade (was competitor-only; run d838ed4e
// shipped VoC "verbatimText" cited to review-site index pages): index-page
// sourceUrls relabel the quote as an explicit paraphrased pattern. The closed
// `source` enum is never touched.
export function downgradeUnpermalinkedVocQuotes({
  body,
}: {
  body: Record<string, unknown>;
}): ProvenanceGateResult<DowngradedVerbatimQuote> {
  return downgradeUnpermalinkedQuoteSurfaces({
    body,
    surfaces: [
      {
        appendSourceSuffix: false,
        blockKey: "painLanguage",
        itemsKey: "quotes",
        quoteField: "verbatimText",
      },
      {
        appendSourceSuffix: false,
        blockKey: "successLanguage",
        itemsKey: "quotes",
        quoteField: "verbatimText",
      },
      {
        appendSourceSuffix: false,
        blockKey: "decisionCriteria",
        itemsKey: "criteria",
        quoteField: "evidenceQuote",
      },
    ],
  });
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

// LinkedIn group ids fabricated by the model are short digit runs; real group
// URLs carry longer ids plus a slug. Anchored to the end of the path.
const linkedInShortGroupIdPattern = /linkedin\.com\/groups\/\d{1,7}\/?$/i;

const examplePlaceholderHostPattern =
  /^https?:\/\/(?:[\w-]+\.)*example\.(?:com|org)(?:[/?#]|$)/i;

const redditCommentsIdSegmentPattern =
  /reddit\.com\/r\/[^/]+\/comments\/([^/?#]+)/i;

// A real Reddit comments id is a short lowercase base36 token; a fabricated
// pseudo-permalink puts the topic slug where the id belongs.
const redditBase36IdPattern = /^[a-z0-9]{4,10}$/;

// Schema-legal null-equivalent: section schemas pin sourceUrl as a non-empty
// string (several as a URL), and assertSectionArtifactPersistable re-parses
// the annotated body before persistence — so the honest relabel must itself
// be a parseable URL. `.invalid` is RFC 2606 reserved and never resolves.
export const placeholderSourceUrlRelabel =
  "https://evidence-gap.invalid/placeholder-source-removed";

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function urlHost(url: string): string | null {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

// Fixture/offline harnesses legitimately live on example.com (subject site,
// corpus excerpts, source refs) — a host vouched for by the runner-owned
// ResearchInput is not a fabrication signal. Real corpora never cite
// example.com, so production stays fail-closed. Only the example-host shape
// consults this set; the structural shapes (short LinkedIn group ids, Reddit
// pseudo-permalinks, sequential digits) are placeholder-shaped regardless of
// host trust.
export function buildPlaceholderTrustedHosts(input?: {
  company?: { websiteUrl?: string | null };
  corpus?: { excerpts?: ReadonlyArray<{ sourceUrl?: string | null }> };
  sources?: ReadonlyArray<{ url?: string | null }>;
}): ReadonlySet<string> {
  const hosts = new Set<string>();
  const addHost = (value: string | null | undefined): void => {
    if (typeof value !== "string" || value.length === 0) {
      return;
    }

    const host = urlHost(value);

    if (host !== null) {
      hosts.add(host);
    }
  };

  addHost(input?.company?.websiteUrl);

  for (const excerpt of input?.corpus?.excerpts ?? []) {
    addHost(excerpt.sourceUrl);
  }

  for (const source of input?.sources ?? []) {
    addHost(source.url);
  }

  return hosts;
}

function isTrustedHost({
  trustedHosts,
  url,
}: {
  trustedHosts: ReadonlySet<string>;
  url: string;
}): boolean {
  const host = urlHost(url);

  return host !== null && trustedHosts.has(host);
}

function hasSequentialDigitRun(url: string): boolean {
  for (const match of url.matchAll(/\d{6,}/g)) {
    const digits = match[0];
    let sequential = true;

    for (let index = 1; index < digits.length; index += 1) {
      if (digits.charCodeAt(index) !== digits.charCodeAt(index - 1) + 1) {
        sequential = false;
        break;
      }
    }

    if (sequential) {
      return true;
    }
  }

  return false;
}

function placeholderUrlReason({
  trustedHosts,
  url,
}: {
  trustedHosts: ReadonlySet<string>;
  url: string;
}): string | null {
  if (
    examplePlaceholderHostPattern.test(url) &&
    !isTrustedHost({ trustedHosts, url })
  ) {
    return "example.com/example.org placeholder host";
  }

  if (linkedInShortGroupIdPattern.test(url)) {
    return "LinkedIn group URL with a short placeholder numeric id";
  }

  const redditSegment = redditCommentsIdSegmentPattern.exec(url);

  if (
    redditSegment !== null &&
    !redditBase36IdPattern.test(redditSegment[1] ?? "")
  ) {
    return "Reddit pseudo-permalink: topic slug where the base36 post id belongs";
  }

  if (hasSequentialDigitRun(url)) {
    return "sequential-digit placeholder id (e.g. 1234567)";
  }

  return null;
}

function walkForPlaceholderUrls({
  path,
  stripped,
  trustedHosts,
  value,
}: {
  path: string;
  stripped: StrippedPlaceholderUrl[];
  trustedHosts: ReadonlySet<string>;
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkForPlaceholderUrls({
        path: `${path}[${index}]`,
        stripped,
        trustedHosts,
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

    if (key === "sourceUrl" && typeof childValue === "string") {
      const reason = placeholderUrlReason({ trustedHosts, url: childValue });

      if (reason !== null) {
        value[key] = placeholderSourceUrlRelabel;
        stripped.push({ field: childPath, reason, sourceUrl: childValue });
      }

      continue;
    }

    walkForPlaceholderUrls({
      path: childPath,
      stripped,
      trustedHosts,
      value: childValue,
    });
  }
}

// Deterministic placeholder-URL strike (ADR-0011 posture: strip the lie,
// record it in verifierSummary, never hard-fail). A sourceUrl matching an
// obvious placeholder shape is relabeled to the explicit evidence-gap marker
// URL and recorded as strippedPlaceholderUrls. The row and its claim survive;
// only the fabricated provenance goes.
export function stripPlaceholderSourceUrls({
  body,
  trustedHosts = new Set<string>(),
}: {
  body: Record<string, unknown>;
  trustedHosts?: ReadonlySet<string>;
}): ProvenanceGateResult<StrippedPlaceholderUrl> {
  const cloned = structuredClone(body);
  const stripped: StrippedPlaceholderUrl[] = [];

  walkForPlaceholderUrls({ path: "body", stripped, trustedHosts, value: cloned });

  return stripped.length === 0
    ? { body, stripped: [] }
    : { body: cloned, stripped };
}

const unverifiedSourceUrlReason =
  "model-authored URL graded unsupported by the claim verifier: no research tool ever observed it";

function rowCarriesQuoteCardField(row: Record<string, unknown>): boolean {
  return Object.entries(row).some(
    ([key, value]) => quoteCardFieldNames.has(key) && typeof value === "string",
  );
}

function walkForUnverifiedSourceUrls({
  path,
  stripped,
  unsupportedUrls,
  value,
}: {
  path: string;
  stripped: StrippedPlaceholderUrl[];
  unsupportedUrls: ReadonlySet<string>;
  value: unknown;
}): void {
  if (Array.isArray(value)) {
    // Differential guard: the fabrication signal is one row's URL being
    // unsupported while a SIBLING row's URL was tool-observed (run d838ed4e:
    // capterra /p/146652 verified, /p/147768 no_match). When EVERY row's URL
    // is unsupported the likelier cause is a verifier blind spot (acquisition
    // steps not visible to the claim verifier), and relabeling the whole
    // array would collapse distinct-source persistence minimums into a hard
    // fail — so the array is left alone.
    const sourceUrlRows = value.filter(
      (item): item is Record<string, unknown> =>
        isRecord(item) && typeof item.sourceUrl === "string",
    );
    // A row already relabeled to the evidence-gap marker (placeholder strip)
    // is not a tool-observed sibling — it must not unlock relabeling here.
    const hasToolObservedSibling = sourceUrlRows.some(
      (row) =>
        row.sourceUrl !== placeholderSourceUrlRelabel &&
        !unsupportedUrls.has(row.sourceUrl as string),
    );

    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;

      if (
        hasToolObservedSibling &&
        isRecord(item) &&
        typeof item.sourceUrl === "string" &&
        unsupportedUrls.has(item.sourceUrl) &&
        rowCarriesQuoteCardField(item)
      ) {
        stripped.push({
          field: `${itemPath}.sourceUrl`,
          reason: unverifiedSourceUrlReason,
          sourceUrl: item.sourceUrl,
        });
        item.sourceUrl = placeholderSourceUrlRelabel;
      }

      walkForUnverifiedSourceUrls({
        path: itemPath,
        stripped,
        unsupportedUrls,
        value: item,
      });
    });
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    if (key === "sourceUrl") {
      continue;
    }

    walkForUnverifiedSourceUrls({
      path: `${path}.${key}`,
      stripped,
      unsupportedUrls,
      value: childValue,
    });
  }
}

// Acts on a signal the structural verifier already computed: a quote/
// objection/story row whose sourceUrl was extracted as a url-claim and graded
// unsupported (no_match) is a model-authored link no tool ever saw — e.g. the
// second Capterra product id in run d838ed4e. The row and its text survive;
// the fabricated link is relabeled to the same evidence-gap marker convention
// as stripPlaceholderSourceUrls. Only rows inside arrays with at least one
// tool-observed sibling are struck (see the differential guard in the walk).
export function stripUnverifiedSourceUrls({
  body,
  unsupportedUrls,
}: {
  body: Record<string, unknown>;
  unsupportedUrls: ReadonlySet<string>;
}): ProvenanceGateResult<StrippedPlaceholderUrl> {
  if (unsupportedUrls.size === 0) {
    return { body, stripped: [] };
  }

  const cloned = structuredClone(body);
  const stripped: StrippedPlaceholderUrl[] = [];

  walkForUnverifiedSourceUrls({
    path: "body",
    stripped,
    unsupportedUrls,
    value: cloned,
  });

  return stripped.length === 0
    ? { body, stripped: [] }
    : { body: cloned, stripped };
}
