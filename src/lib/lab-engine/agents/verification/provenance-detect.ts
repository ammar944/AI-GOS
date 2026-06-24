/**
 * provenance-detect.ts — IN-MEMORY port of the Phase B deterministic provenance
 * DETECTOR (proven script-side at `scripts/provenance/gate.ts`, recall 100% / FP 0%).
 *
 * Catches the GLM fabrication patterns the Phase A cross-subject verdict identified
 * as the wall:
 *   1. url_not_in_transcript        — body cites a URL no tool ever returned
 *   2. quote/number_not_in_transcript — body quotes/cites a sourced fact not in any tool output
 *   3. invented_customer / invented_bidder / invented_volume_cpc — names a customer/advertiser,
 *      or cites vol/CPC, no tool supports
 *   4. arithmetic_error             — asserted arithmetic that does not compute
 *   5. synthesized_evidence         — VoC/buyer/competitor ships customer proof with zero customer-voice evidence
 *
 * Ground truth = the run transcript. A claim is grounded iff its URL / quote /
 * number appears in some tool output (or input) for that run.
 *
 * This is a FAITHFUL, behavior-identical port of `scripts/provenance/gate.ts`. The only
 * difference is the public API: instead of reading the body + transcript from disk, the
 * caller passes the already-parsed body string and transcript records. NO file I/O, NO
 * `fs`/`path`/`process`, NO CLI. It is purely importable by the app.
 *
 * This is a DIFFERENT family from `provenance-gate.ts` (URL/quote hygiene strip functions):
 * this module is transcript-grounding. The two are additive, not overlapping.
 */

import { isQuoteContainedInLiveText } from "./source-liveness";

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------
export interface TranscriptRecord {
  step: number;
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: unknown;
  isError: boolean;
}

export type ProvenanceCheckName =
  | "url_not_in_transcript"
  | "quote_not_in_transcript"
  | "number_not_in_transcript"
  | "invented_customer"
  | "invented_bidder"
  | "invented_volume_cpc"
  | "arithmetic_error"
  | "synthesized_evidence";

export type ProvenanceSeverity = "laundered" | "invented";

export interface ProvenanceViolation {
  check: ProvenanceCheckName;
  severity: ProvenanceSeverity;
  /** finalScore ceiling this violation class imposes (min across all wins). */
  ceiling: number;
  /** the offending text span from the body (trimmed). */
  span: string;
  /** human-readable why-this-fired + what the transcript actually supports. */
  reason: string;
}

export interface ProvenanceStats {
  section: string;
  subject: string;
  toolsUsed: string[];
  hasVolumeCpcTool: boolean;
  hasAdvertiserField: boolean;
  hasCustomerVoiceEvidence: boolean;
  citedUrls: number;
  citedQuotes: number;
  sourcedNumbers: number;
  transcriptUrlCount: number;
  transcriptChars: number;
}

export interface DetectProvenanceArgs {
  /** The already-parsed section markdown body. */
  body: string;
  /** The already-parsed transcript records (caller parses JSON / builds them). */
  transcript: TranscriptRecord[];
  section: string;
  subject: string;
  /**
   * Parsed SIBLING-section transcript record arrays (same subject). Only used for
   * the `paidmedia` synthesis section: paidmedia reads the other 6 sections' bodies
   * and legitimately carries forward their numbers/URLs/quotes, but its OWN transcript
   * only ad-probes. Folding sibling transcripts into the grounding index lets carried-
   * forward facts clear Check 1/2 while still catching numbers invented in NO section.
   */
  siblingTranscripts?: TranscriptRecord[][];
  /**
   * Raw text of the OTHER 6 sibling section bodies (same subject). Only used for
   * the `paidmedia` synthesis section: paidmedia legitimately carries forward upstream
   * section PROSE (a gap disclosure, a break-point heading) verbatim. Folding sibling
   * BODIES into the URL/quote grounding corpus lets those carry-forwards clear Check 1/2.
   *
   * Scope is deliberately narrow: sibling bodies feed ONLY url_not_in_transcript /
   * quote_not_in_transcript. invented_* and arithmetic_error stay anchored to THIS section
   * transcript + body, so one section can never launder a sibling fabrication.
   */
  siblingBodies?: string[];
}

export interface DetectProvenanceResult {
  violations: ProvenanceViolation[];
  ceiling: number;
  stats: ProvenanceStats;
}

// ceiling per severity class (spec §1 "Severity → ceiling")
const CEIL_LAUNDERED = 7;
const CEIL_INVENTED = 4;

// ---------------------------------------------------------------------------
// Normalization (spec §1)
// ---------------------------------------------------------------------------
/** lowercase, collapse whitespace, decode %20, strip thousands separators, unify quotes. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/[“”„‟″]/g, '"') // curly/smart double quotes -> "
    .replace(/[‘’‚‛′]/g, "'") // curly single quotes -> '
    .replace(/(\d),(?=\d{3}\b)/g, "$1") // 1,600 -> 1600 (thousands separators)
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a URL to host+path+query (drop scheme / www. / trailing slash). */
export function normalizeUrl(raw: string): string {
  let u = raw.trim().toLowerCase();
  u = u.replace(/%20/g, " ");
  u = u.replace(/^https?:\/\//, "");
  u = u.replace(/^www\./, "");
  // strip trailing punctuation that markdown/prose tends to glue on
  u = u.replace(/[).,;:'"\]]+$/g, "");
  u = u.replace(/\/+$/g, ""); // trailing slash(es)
  return u;
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------
const BARE_URL_RE = /https?:\/\/[^\s)\]]+/gi;
// markdown link target:  [text](url)
const MD_LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
// parenthetical bare-domain citation:  (g2.com/products/intercom/reviews) or (techcrunch.com)
const PAREN_DOMAIN_RE =
  /\(((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^)\s]*)?(?:[;,]\s*(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^)\s]*)?)*)\)/gi;

const DOMAIN_TLDS =
  /\.(com|io|co|org|net|ai|dev|app|video|so|xyz|us|uk|gov|edu|info|tech)\b/i;

/** Extract every URL cited in the body (markdown targets + bare + paren bare-domain). */
export function extractBodyUrls(body: string): string[] {
  const found = new Set<string>();

  let m: RegExpExecArray | null;

  // markdown link targets
  MD_LINK_RE.lastIndex = 0;
  while ((m = MD_LINK_RE.exec(body))) {
    const target = m[1].trim();
    // a markdown target may itself be a bare url or a bare domain
    if (target) found.add(target);
  }

  // bare https urls
  BARE_URL_RE.lastIndex = 0;
  while ((m = BARE_URL_RE.exec(body))) {
    found.add(m[0]);
  }

  // parenthetical bare-domain citations: split on ; and , inside the parens
  PAREN_DOMAIN_RE.lastIndex = 0;
  while ((m = PAREN_DOMAIN_RE.exec(body))) {
    const inner = m[1];
    for (const part of inner.split(/[;,]/)) {
      const p = part.trim();
      if (p && DOMAIN_TLDS.test(p)) found.add(p);
    }
  }

  return Array.from(found);
}

/** Extract URLs from a raw (un-normalized) transcript JSON string. */
function extractTranscriptUrls(rawTranscript: string): Set<string> {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  BARE_URL_RE.lastIndex = 0;
  while ((m = BARE_URL_RE.exec(rawTranscript))) {
    // JSON-escaped strings can glue a trailing \" — normalizeUrl strips quotes/brackets
    set.add(normalizeUrl(m[0].replace(/\\+$/g, "")));
  }
  return set;
}

// ---------------------------------------------------------------------------
// Ground-truth index
// ---------------------------------------------------------------------------
interface GroundTruth {
  transcriptText: string; // normalized concat of all output+input (own + folded sibling TRANSCRIPTS)
  transcriptUrls: Set<string>; // normalized host+path+query (own + folded sibling TRANSCRIPTS)
  // grounding corpus for the URL/quote checks ONLY. Equals transcriptText/Urls PLUS sibling
  // section BODIES (paidmedia carry-forward). Kept separate so invented_*/arithmetic never read
  // sibling-body prose (a section must not launder another's fabrication).
  groundingText: string;
  groundingUrls: Set<string>;
  rawTranscript: string;
  records: TranscriptRecord[];
  toolsUsed: Set<string>; // non-error tool names — OWN transcript only
  hasVolumeCpcTool: boolean; // OWN transcript only (Check 3 invented_volume_cpc basis)
  hasAdvertiserField: boolean; // always false — no tool returns one
  hasCustomerVoiceEvidence: boolean; // OWN transcript only
}

const CUSTOMER_VOICE_TOOLS = new Set([
  "reviews",
  "firecrawl",
  "web_search",
  "perplexity_research",
  "adlibrary",
]);

/** A sentence-length snippet (not a nav label/title) counts as quotable customer voice. */
function looksLikeCustomerVoice(output: unknown): boolean {
  const json = safeStringify(output);
  // reviews carry reviewText/snippet; treat any >=40-char sentence-ish string as voice.
  // Heuristic: presence of a quoted or sentence-length fragment ending in punctuation,
  // OR an explicit reviewText / review_body field with >=40 chars.
  const reviewTextMatch = json.match(/"review[_a-z]*"\s*:\s*"([^"]{40,})"/i);
  if (reviewTextMatch) return true;
  const snippetMatch = json.match(/"snippet"\s*:\s*"([^"]{60,})"/i);
  if (snippetMatch && /[.!?]/.test(snippetMatch[1])) return true;
  return false;
}

/**
 * Build the ground-truth grounding index from in-memory records.
 *
 * `rawTranscript` is the JSON serialization of `records` — used for the URL-extraction
 * pass (which scans the literal serialized form to catch JSON-escaped URLs). In the
 * script version this was the file bytes; here we serialize the parsed records so the
 * extraction behaves identically. Sibling transcripts are likewise serialized.
 */
export function buildGroundTruth(
  records: TranscriptRecord[],
  rawTranscript: string,
  siblingTranscriptStrings: string[] = [],
  siblingBodies: string[] = [],
): GroundTruth {
  const parts: string[] = [];
  const toolsUsed = new Set<string>();
  let hasVolumeCpcTool = false;
  let hasCustomerVoiceEvidence = false;

  for (const r of records) {
    parts.push(safeStringify(r.output));
    parts.push(safeStringify(r.input));
    if (r.isError) continue;
    // A tool counts as "used" only when its output carries USABLE content. A non-error
    // record whose output is null / {} / a ToolGap / an empty result envelope ({results:[]},
    // {excerpts:[]}, empty markdown) ran but returned nothing groundable. Counting it would,
    // e.g., let an empty web_search set usedFreeText in detectInventedBidder and SILENCE the
    // bidder-fabrication check without any evidence (the P2-3 inherited weakness). Stricter
    // than the original script — intentionally, since it tightens anti-fabrication.
    if (!hasUsableOutput(r.output)) continue;
    toolsUsed.add(r.toolName);

    if (r.toolName === "keyword_volume" || r.toolName === "keyword_discovery") {
      const out = r.output as { keywords?: Array<{ searchVolume?: unknown; cpc?: unknown }> };
      if (
        Array.isArray(out?.keywords) &&
        out.keywords.some(
          (k) =>
            (k?.searchVolume !== undefined && k?.searchVolume !== null) ||
            (k?.cpc !== undefined && k?.cpc !== null),
        )
      ) {
        hasVolumeCpcTool = true;
      }
    }

    if (CUSTOMER_VOICE_TOOLS.has(r.toolName) && looksLikeCustomerVoice(r.output)) {
      hasCustomerVoiceEvidence = true;
    }
  }

  // Fold sibling-section TRANSCRIPTS into the transcript index (text + URLs).
  // toolsUsed / hasVolumeCpcTool / hasCustomerVoiceEvidence stay OWN-transcript-only so
  // Check 3 (invented_volume_cpc) and Check 5 (synth) still reason about THIS section's run.
  for (const sib of siblingTranscriptStrings) parts.push(sib);
  const transcriptUrls = new Set<string>();
  for (const src of [rawTranscript, ...siblingTranscriptStrings]) {
    for (const u of extractTranscriptUrls(src)) transcriptUrls.add(u);
  }
  const transcriptText = normalizeText(parts.join("  "));

  // The URL/quote grounding corpus additionally folds sibling section BODIES
  // (paidmedia carry-forward). This NEVER touches transcriptText/transcriptUrls above, so
  // invented_*/number/arithmetic checks remain transcript-anchored.
  const groundingUrls = new Set<string>(transcriptUrls);
  let groundingText = transcriptText;
  if (siblingBodies.length > 0) {
    for (const body of siblingBodies) {
      for (const u of extractBodyUrls(body)) groundingUrls.add(normalizeUrl(u));
    }
    groundingText = normalizeText([transcriptText, ...siblingBodies].join("  "));
  }

  return {
    transcriptText,
    transcriptUrls,
    groundingText,
    groundingUrls,
    rawTranscript,
    records,
    toolsUsed,
    hasVolumeCpcTool,
    hasAdvertiserField: false, // no tool in the catalog returns an advertiser field
    hasCustomerVoiceEvidence,
  };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? "";
  } catch {
    return String(v ?? "");
  }
}

/**
 * True iff a tool output carries USABLE (groundable) content. Used to decide whether a
 * non-error record marks its tool as "used". Rejects:
 *   - null / undefined,
 *   - a ToolGap shape ({ type: 'gap' } or a bare { reason } / { message } with no content),
 *   - an empty result envelope: every well-known content array empty ({results:[]},
 *     {excerpts:[]}, {keywords:[]}, {top_organic:[]}) AND no markdown/snippet/url text,
 *   - an object with no own keys ({}).
 * Anything carrying a non-empty array, a markdown/snippet/url string, or a numeric metric
 * (organic_count/ad_count etc.) counts as usable. Conservative: when in doubt, usable.
 */
function hasUsableOutput(output: unknown): boolean {
  if (output === null || output === undefined) return false;
  if (typeof output !== "object") {
    // a primitive (string/number) output is usable iff it is non-empty
    return String(output).trim().length > 0;
  }
  if (Array.isArray(output)) return output.length > 0;

  const obj = output as Record<string, unknown>;
  // Explicit ToolGap envelope.
  if (obj.type === "gap") return false;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;

  // A bare gap/status object with ONLY a reason/message/error and no content payload.
  const META_ONLY = new Set(["reason", "message", "error", "status", "type"]);
  if (keys.every((k) => META_ONLY.has(k))) return false;

  // Any non-empty array field, any number field, or any non-empty string field = usable.
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      if (value.length > 0) return true;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      return true;
    } else if (typeof value === "string") {
      if (value.trim().length > 0) return true;
    } else if (value !== null && typeof value === "object") {
      // a nested non-empty object (e.g. a single record) counts as content
      if (Object.keys(value as Record<string, unknown>).length > 0) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Grounding helpers
// ---------------------------------------------------------------------------
function urlGrounded(citedUrl: string, gt: GroundTruth): boolean {
  const n = normalizeUrl(citedUrl);
  if (!n) return true; // empty -> not a real citation
  // grounding corpus = transcript (+ sibling bodies for paidmedia carry-forward).
  if (gt.groundingUrls.has(n)) return true;
  // substring match against the set members (handles query-param / sub-path drift)
  for (const u of gt.groundingUrls) {
    if (u.includes(n) || n.includes(u)) return true;
  }
  // last resort: substring against normalized grounding text
  return gt.groundingText.includes(n);
}

/**
 * True iff a CONTIGUOUS run of ≥4 quote tokens (hyphen-normalized) is a verbatim substring of
 * the corpus. A genuine (possibly drifted) quote shares a long contiguous run with its source;
 * a quote assembled from scattered words does not. Hyphen-normalized so "paradigm-before-proof"
 * matches "paradigm before proof".
 */
function hasContiguousFragment(nq: string, corpus: string): boolean {
  const hn = (s: string) => s.replace(/[^\w ]/g, " ").replace(/\s+/g, " ").trim();
  const corpusHN = hn(corpus);
  const tokens = hn(nq).split(" ").filter(Boolean);
  const MIN_TOKENS = 4;
  if (tokens.length < MIN_TOKENS) return false;
  for (let i = 0; i + MIN_TOKENS <= tokens.length; i++) {
    // grow the window from this start as long as it stays contiguous in the corpus
    for (let j = tokens.length; j >= i + MIN_TOKENS; j--) {
      const frag = tokens.slice(i, j).join(" ");
      if (frag.length >= 18 && corpusHN.includes(frag)) return true;
    }
  }
  return false;
}

/** ≥90% token-overlap window match to tolerate punctuation/whitespace drift. */
function quoteGrounded(quote: string, gt: GroundTruth): boolean {
  // strip editorial insertions the writer adds inside a real quote: "[are superior]", "[…]"
  const cleaned = quote.replace(/\[[^\]]*\]/g, " ").replace(/\.\.\.|…/g, " ");
  const nq = normalizeText(cleaned).replace(/["']/g, "");
  if (nq.length < 15) return true; // too short to judge — skip
  // grounding corpus = transcript (+ sibling bodies for paidmedia carry-forward).
  const corpus = gt.groundingText;
  if (corpus.includes(nq)) return true;
  // tolerate terminal/internal punctuation drift: strip non-word chars and retry substring
  const stripped = nq.replace(/[^\w ]/g, "").replace(/\s+/g, " ").trim();
  if (stripped && corpus.replace(/[^\w ]/g, "").includes(stripped)) return true;
  // contiguity path (spec §1 "window match"): clear when a substantial CONTIGUOUS fragment of
  // the quote (≥4 tokens, hyphen-normalized) appears verbatim in the corpus. This grounds a
  // carry-forward whose distinctive coined phrase is verbatim in a sibling body ("paradigm-
  // before-proof on the landing page" — "paradigm before proof on the" is contiguous in the
  // Offer body) while a writer-ASSEMBLED quote (scattered words, no long contiguous run)
  // still fails. Discriminates exactly where token-bag overlap cannot.
  if (hasContiguousFragment(nq, corpus)) return true;
  // fuzzy: token-overlap of the quote against the grounding text (word-char tokens only).
  // ≥0.85 tolerates a few author-inserted connective words while still catching a fabricated
  // quote (which shares few content tokens with the corpus).
  const qTokens = stripped.split(" ").filter((t) => t.length > 2);
  if (qTokens.length === 0) return true;
  let hit = 0;
  for (const t of qTokens) {
    if (corpus.includes(t)) hit++;
  }
  return hit / qTokens.length >= 0.85;
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
// attribution markers that mark a quoted span as a CITED source quote (vs author rhetoric):
// a dash lead-in to a source ("— G2 reviewer"), a review-site word, "per", "via", or a citation URL.
const QUOTE_ATTRIB_RE =
  /[—–-]\s*[A-Za-z(]|\b(g2|capterra|trustpilot|reddit|review(?:er|s)?|customer|per\s|via\b|cited|source)\b|\([a-z0-9-]+\.[a-z]{2,}|https?:\/\//i;

/**
 * Quoted spans presented as CITED EVIDENCE (not author rhetoric/labels/hooks), ≥15 chars.
 *
 * The writer presents retrieved source evidence as either:
 *   (a) markdown BLOCKQUOTES (`> *"..."*`), or
 *   (b) an attributed quoted span — `*"..."* — Source (url)` / a quote on a line that
 *       also carries a source attribution (dash + source, review-site word, or citation URL).
 *
 * Inline straight-quoted fragments with NO source attribution are paraphrase, objection
 * LABELS ("We're already invested — switching is too painful"), theme statements, or ad
 * HOOKS the author wrote. Those are not claimed as citations and legitimately are not
 * verbatim in the transcript — flagging them = false positives on clean cells. Skipped.
 */
function extractEvidenceQuotes(body: string): string[] {
  const quotes: string[] = [];
  const seen = new Set<string>();
  const push = (text: string) => {
    const t = text.trim().replace(/^\*+|\*+$/g, "").trim(); // drop markdown emphasis wrappers
    if (t.length < 15) return;
    if (/^https?:\/\//.test(t)) return;
    // Author META-SUMMARY of reviews (3rd-person aggregate), not a verbatim citation:
    // "Some/Several/Many reviewers report/mention…", "Critical feedback mentions…",
    // "Users often…". These are paraphrase, not laundered quotes — skip to avoid FPs.
    if (
      /^(some|several|many|most|a few|critical feedback|users|reviewers|customers|negative|positive|recent)\b/i.test(
        t,
      ) &&
      /\b(reviewers?|reviews?|feedback|users?|customers?|mention|report|complain|note|say|express)\b/i.test(
        t,
      )
    ) {
      return;
    }
    if (seen.has(t)) return;
    seen.add(t);
    quotes.push(t);
  };

  const lines = body.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Markdown headings are never evidence quotes (spec: "not a heading").
    if (/^\s*#{1,6}\s/.test(line)) continue;
    const isBlockquote = /^\s*>/.test(line);
    const re = /[“"]([^”"]{15,})[”"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const text = m[1].trim();
      const beforeOpen = line.slice(Math.max(0, m.index - 2), m.index);
      const afterClose = line.slice(m.index + m[0].length, m.index + m[0].length + 2);
      // The writer marks retrieved review evidence with SINGLE-`*` italic emphasis:
      //   `- *"review text"* — Source (url)`.
      // Objection LABELS / theme statements use DOUBLE-`*` bold (`**"..."**`) — author
      // rhetoric, not citations. Distinguish: italic-wrapped (exactly one `*` on each side).
      const italicWrapped =
        /(^|[^*])\*$/.test(beforeOpen) && /^\*([^*]|$)/.test(afterClose);
      // Attribution sitting IMMEDIATELY after the closing quote (within a short window).
      const tail = line.slice(m.index + m[0].length, m.index + m[0].length + 45);
      const attributedNow =
        /^\s*\*?\s*[—–-]\s*[A-Za-z(]|^\s*\*?\s*\(/.test(tail) ||
        (italicWrapped && QUOTE_ATTRIB_RE.test(tail));
      if (isBlockquote || attributedNow) push(text);
    }
  }
  return quotes;
}

// units/context that mark a number as a (potentially) sourced fact
const UNIT_RE =
  /\$|%|\/mo\b|\/yr\b|\bsearches\b|\bsearch(?:es)?\/mo\b|\bseats?\b|\busers?\b|\breviews?\b|\bmo\b|\bcpc\b/i;
// attribution markers near a sourced number
const ATTRIB_RE =
  /spyfu|per\s|\bg2\b|capterra|trustpilot|source|\bvia\b|estimated|searches\/mo|https?:\/\/|\([a-z0-9-]+\.[a-z]{2,}/i;

interface SourcedNumber {
  value: number;
  raw: string;
  span: string;
}

// markers that mean a number is DERIVED / APPROXIMATE / HYPOTHETICAL, not a sourced fact.
// (spec: "Do NOT flag derived/rhetorical numbers — those are Check 4's job.")
const DERIVED_MARKER_RE =
  /~|≈|≅|±|\bapprox|\broughly\b|\babout\b|\bcombined\b|\bcombining\b|\bsums?\s+to\b|\btotals?\b|\bup\s+to\b|\bestimate(?:d)?\s+(?:total|spend|budget)|\bassume|\bif\b|\bhypothetical|\bexample\b|\bsay\b|\bwould\b|\bbudget\b|\bspend\b|\ba\s+\$\d/i;

/** Numbers presented as sourced facts: carry a unit/context AND an attribution nearby. */
function extractSourcedNumbers(body: string): SourcedNumber[] {
  const out: SourcedNumber[] = [];
  const lines = body.split(/\n/);
  for (const line of lines) {
    if (!ATTRIB_RE.test(line)) continue; // conservative: only attributed lines
    // match numeric tokens optionally with $ prefix and unit-ish suffix context
    const numRe = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s?(\/mo|\/yr|%|searches\/mo|searches|seats?|users?|reviews?|mo|cpc|k)?/gi;
    let m: RegExpExecArray | null;
    while ((m = numRe.exec(line))) {
      const rawNum = m[1];
      const numeric = Number(rawNum.replace(/,/g, ""));
      if (!Number.isFinite(numeric)) continue;
      // require this token to sit in unit/context — check a window around the match
      const start = Math.max(0, m.index - 16);
      const end = Math.min(line.length, m.index + m[0].length + 16);
      const window = line.slice(start, end);
      const hasUnit = !!m[2] || UNIT_RE.test(window);
      if (!hasUnit) continue;
      // skip tiny ordinal-ish numbers without strong unit (e.g. "3 clusters")
      if (numeric < 10 && !m[2] && !/\$|%/.test(window)) continue;
      // skip DERIVED / APPROXIMATE / HYPOTHETICAL numbers (author math, not a sourced fact)
      const wideStart = Math.max(0, m.index - 24);
      const wide = line.slice(wideStart, end);
      if (DERIVED_MARKER_RE.test(wide)) continue;
      // skip a number that is one endpoint of a range ("47–52", "47-52", "47 to 52")
      const before = line.slice(Math.max(0, m.index - 3), m.index);
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 3);
      if (/[–—-]\s*$/.test(before) || /^\s*[–—-]\s*\$?\d/.test(after) || /^\s*to\s+\$?\d/.test(after)) {
        continue;
      }
      out.push({ value: numeric, raw: rawNum, span: line.trim().slice(0, 200) });
    }
  }
  return out;
}

function numberGrounded(n: SourcedNumber, gt: GroundTruth): boolean {
  const bare = String(n.value).replace(/,/g, "");
  if (gt.transcriptText.includes(bare)) return true;
  // also try the raw form with comma stripped
  const rawBare = n.raw.replace(/,/g, "");
  return gt.transcriptText.includes(rawBare);
}

// ---------------------------------------------------------------------------
// Check 3 — invented bidder
// ---------------------------------------------------------------------------
// "X bids on", "X will outbid", "competitors like X are bidding on", "X is buying this term"
// Named company = a Capitalized proper noun (1-3 tokens) immediately tied to a bid verb.
const KEYWORD_ONLY_TOOLS = new Set(["keyword_ad_probe", "keyword_volume", "keyword_discovery"]);

// Subjects/objects of bid verbs that are NOT a named-company attribution (allowed hedges).
const HEDGE_SUBJECT_RE =
  /\b(enterprise|competitors?|rivals?|incumbents?|vendors?|players?|advertisers?|everyone|nobody|someone|others?|brands?|companies|teams?|buyers?|you|we|they|it|this|these|those|the)\b/i;

// Capitalized proper-noun company name (1 token, length>=3), NOT a hedge-class suffix
// ("Gong-class", "Gong-level"), NOT the subject itself, NOT a stopword.
const COMPANY_TOKEN = "[A-Z][A-Za-z0-9.&'-]{2,}";
const STOP_NAMES = new Set([
  "The", "This", "These", "Those", "That", "Where", "When", "Their", "Its", "Each",
  "Most", "Every", "Some", "But", "And", "For", "Fathom", "Attio", "Plain", "CRM",
  "CPC", "SpyFu", "Broad", "Use", "Bid", "Read", "Set", "Run", "Target", "Avoid",
  "Buy", "Start", "Test", "Focus", "Add", "Cut", "Keep", "Monitor", "Match",
]);

/**
 * A NAMED company asserted as a bidder/advertiser. Conservative: the company must be the
 * explicit grammatical subject DIRECTLY before a bid verb ("Gong bids on", "Salesforce
 * will outbid"), or the object of "outbid by <Name>". Excludes:
 *   - generic/hedged subjects ("enterprise vendors", "competitors", "you/we/they"),
 *   - hedge-CLASS phrasing ("Gong-class players", "Gong-level pricing"),
 *   - imperative recommendations to the subject ("Bid on 'fireflies.ai'"),
 *   - the subject's own name reasoning about being outbid ("Plain will be outbid by …" —
 *     that names the OBJECT, handled by the reverse pattern only when a real company follows).
 *
 * Fires only when keyword evidence is exclusively keyword/ad-probe tools (none carry an
 * advertiser field) — if a free-text tool ran, the name could be grounded and we defer to
 * the URL/quote checks.
 */
function detectInventedBidder(body: string, gt: GroundTruth): ProvenanceViolation[] {
  const out: ProvenanceViolation[] = [];
  // GUARD (a) — no advertiser-returning / free-text tool ran. adlibrary is the only tool
  // that can legitimately supply an advertiser name; web_search/firecrawl/perplexity can
  // surface a real bidder in free text. If any ran, defer to the URL/quote checks.
  const usedFreeText = ["web_search", "perplexity_research", "firecrawl", "adlibrary"].some((t) =>
    gt.toolsUsed.has(t),
  );
  const usedKeywordTool = Array.from(gt.toolsUsed).some((t) => KEYWORD_ONLY_TOOLS.has(t));
  if (!usedKeywordTool || usedFreeText) return out;

  const seen = new Set<string>();
  const consider = (name: string, sentence: string, formTag: string) => {
    const clean = name.replace(/[.,;:]+$/, "");
    if (STOP_NAMES.has(clean)) return;
    if (HEDGE_SUBJECT_RE.test(clean)) return;
    if (clean.replace(/[^A-Za-z0-9]/g, "").length < 3) return;
    // GUARD (b) — the named company must be ABSENT from the transcript. If a keyword tool
    // surfaced the name in a display string / volume row, the attribution could be grounded
    // (this is what keeps plain/demand's "outbid by Zendesk/Freshdesk/Intercom" — all three
    // present in the transcript — from false-firing).
    if (gt.transcriptText.includes(normalizeText(clean))) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      check: "invented_bidder",
      severity: "invented",
      ceiling: CEIL_INVENTED,
      span: sentence.trim().slice(0, 200),
      reason: `Attributes auction/CPC/bid pressure to "${clean}" (${formTag}), but the only keyword evidence is ad-probe/volume/discovery tools — none return an advertiser field — and "${clean}" appears nowhere in the transcript. Attribution is invented.`,
    });
  };

  // Forms that attribute paid-auction pressure to a NAMED company:
  //  1. forward subject-verb:  "<Name> (will|is|'s|...) (out)?bid(s|ding)?"
  const fwd = new RegExp(
    `(${COMPANY_TOKEN})\\s+(?:will|is|are|'s|can|could|has|have|already)?\\s*(?:out)?bid(?:s|ding)?\\b`,
    "g",
  );
  //  2. adjectival / class:  "<Name>-class/-level/-grade ... players ... bid/auction/cpc"
  const adjClass = new RegExp(`(${COMPANY_TOKEN})-(?:class|level|style|grade|type|tier|ecosystem)`, "g");
  //  3. possessive:  "<Name>'s bids/auction/cpc"
  const possessive = new RegExp(`(${COMPANY_TOKEN})'s\\s+(?:bids?|auction|cpc|spend)`, "gi");
  //  4. slash territory:  "<Name>/<Name> ... (enterprise )?(territory|bids|auction)"
  const slashTerritory = new RegExp(
    `(${COMPANY_TOKEN})\\s*/\\s*(${COMPANY_TOKEN})\\b[^|.]*?\\b(?:territory|bids?|auction|enterprise)`,
    "g",
  );

  // bid/auction-pressure context a sentence must carry for the adjectival/slash forms to
  // count (so "Gong-class UX" — a non-auction adjective — never fires).
  const AUCTION_CTX_RE = /\b(bid|bids|bidding|bid up|outbid|auction|cpc|paid search|advertis)/i;

  const sentences = body.split(/(?<=[.!?])\s+|\n+/);
  for (const s of sentences) {
    let m: RegExpExecArray | null;

    fwd.lastIndex = 0;
    while ((m = fwd.exec(s))) consider(m[1], s, "names it bidding");

    // The adjectival ("Gong-class players bid up") and possessive ("Gong's bids") forms only
    // count when the sentence also carries auction/CPC/bid context — otherwise "Gong-class
    // UX" (a non-auction adjective) would fire. The slash/territory form is self-gating (its
    // own regex requires territory|bids|auction|enterprise) so it does not need this guard.
    if (AUCTION_CTX_RE.test(s)) {
      adjClass.lastIndex = 0;
      while ((m = adjClass.exec(s))) consider(m[1], s, "X-class/-ecosystem players bidding");

      possessive.lastIndex = 0;
      while ((m = possessive.exec(s))) consider(m[1], s, "possessive bid attribution");
    }

    slashTerritory.lastIndex = 0;
    while ((m = slashTerritory.exec(s))) {
      consider(m[1], s, "slash/territory bid attribution");
      consider(m[2], s, "slash/territory bid attribution");
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 3 — invented volume/CPC
// ---------------------------------------------------------------------------
// body cites a searchVolume or CPC as "per SpyFu"/sourced in a section whose
// transcript has keyword_ad_probe but NO keyword_volume/keyword_discovery carrying it.
function detectInventedVolumeCpc(body: string, gt: GroundTruth): ProvenanceViolation[] {
  const out: ProvenanceViolation[] = [];
  const usedAdProbe = gt.toolsUsed.has("keyword_ad_probe");
  if (!usedAdProbe || gt.hasVolumeCpcTool) return out;

  const lines = body.split(/\n/);
  const volRe =
    /(\d[\d,]*)\s*(?:searches\/mo|\/mo\s*searches|searches per month|search(?:es)? volume)|cpc\s*\$?(\d[\d,]*(?:\.\d+)?)|\$(\d[\d,]*(?:\.\d+)?)\s*cpc/i;
  for (const line of lines) {
    if (!/spyfu|per\s|sourced|estimated|searches\/mo|cpc/i.test(line)) continue;
    const m = line.match(volRe);
    if (!m) continue;
    const num = (m[1] ?? m[2] ?? m[3] ?? "").replace(/,/g, "");
    if (!num) continue;
    // only fire if that number is NOT anywhere in the transcript (no tool produced it)
    if (gt.transcriptText.includes(num)) continue;
    out.push({
      check: "invented_volume_cpc",
      severity: "invented",
      ceiling: CEIL_INVENTED,
      span: line.trim().slice(0, 200),
      reason: `Cites a search-volume/CPC as sourced ("${num}") but the transcript only ad-probed (keyword_ad_probe returns ad_count/organic_count, never volume or CPC). No keyword_volume/keyword_discovery produced this number.`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Check 4 — arithmetic coherence
// ---------------------------------------------------------------------------
const TOLERANCE = 0.02;

function numFrom(s: string): number {
  return Number(s.replace(/[,$]/g, ""));
}

function detectArithmetic(body: string): ProvenanceViolation[] {
  const out: ProvenanceViolation[] = [];
  const text = body.replace(/\n/g, " ");

  // Pattern A: $A/mo x 12 = $B/yr   (or generic A x 12 = B with /mo .. /yr context)
  const perMoYr =
    /\$?\s?([\d,]+(?:\.\d+)?)\s*\/?\s*mo[^=]*?[x×*]\s*12\s*=\s*\$?\s?([\d,]+(?:\.\d+)?)\s*\/?\s*yr/gi;
  let m: RegExpExecArray | null;
  while ((m = perMoYr.exec(text))) {
    const a = numFrom(m[1]);
    const b = numFrom(m[2]);
    const expected = a * 12;
    if (!approx(expected, b)) {
      out.push(arithViolation(m[0], `$${a}/mo × 12 = $${expected}/yr, but body asserts $${b}/yr.`));
    }
  }

  // Pattern B: $A/seat/month ... N-seat ... $B/year
  // e.g. "$29/seat/month ... for a 5-seat team: $4,140/year"
  const perSeat =
    /\$?\s?([\d,]+(?:\.\d+)?)\s*\/?\s*seat\s*\/?\s*(?:month|mo)[\s\S]{0,80}?(\d+)\s*-?\s*seat[\s\S]{0,40}?\$?\s?([\d,]+(?:\.\d+)?)\s*\/?\s*(?:year|yr)/gi;
  while ((m = perSeat.exec(text))) {
    const perSeatMo = numFrom(m[1]);
    const seats = numFrom(m[2]);
    const asserted = numFrom(m[3]);
    const expected = perSeatMo * seats * 12;
    if (!approx(expected, asserted)) {
      out.push(
        arithViolation(
          m[0].slice(0, 200),
          `$${perSeatMo}/seat/mo × ${seats} seats × 12 = $${expected}/yr, but body asserts $${asserted}/yr.`,
        ),
      );
    }
  }

  // Pattern C: A x N = B   (plain multiplication, no per-mo/yr units)
  const mult = /(?<![\d.])([\d,]+(?:\.\d+)?)\s*[x×*]\s*([\d,]+(?:\.\d+)?)\s*=\s*([\d,]+(?:\.\d+)?)/gi;
  while ((m = mult.exec(text))) {
    // skip the "x 12 =" case already handled by Pattern A (avoid double-fire on /mo..=/yr)
    const window = text.slice(Math.max(0, m.index - 6), m.index + m[0].length + 6);
    if (/\/?\s?mo[\s\S]{0,30}\/?\s?yr/i.test(window)) continue;
    const a = numFrom(m[1]);
    const b = numFrom(m[2]);
    const c = numFrom(m[3]);
    const expected = a * b;
    if (!approx(expected, c)) {
      out.push(arithViolation(m[0], `${a} × ${b} = ${expected}, but body asserts ${c}.`));
    }
  }

  // seat-math. Two forms, both checked PER LINE (a line is the natural unit for one
  // pricing claim; cross-line noise — onboarding fees, year totals — stays out).
  out.push(...detectSeatMath(body));

  return out;
}

// A per-seat MONTHLY rate established for a named vendor-tier, e.g. "HubSpot Professional
// costs $90/seat/month" or "Attio Plus ($29/seat/month annual)". Captures the vendor-tier
// phrase preceding the rate so a later headcount-total assertion for the SAME vendor can be
// reconciled (the Phase A attio/competitor "$450/month for a 10-person HubSpot Professional"
// understatement — $90 × 10 = $900 ≠ $450 — is not self-contained on its own line).
const SEAT_RATE_RE =
  /([A-Z][A-Za-z0-9.&'-]*(?:\s+[A-Z][A-Za-z0-9.&'-]*){0,2})[^.$]{0,40}?\$\s?([\d,]+(?:\.\d+)?)\s*\/?\s*(?:seat|user|member)\s*\/?\s*(?:month|mo)\b/g;
// component matchers (order-independent — a line is decomposed into its parts)
const PER_SEAT_RATE_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*\/?\s*(?:seat|user|member)\s*\/?\s*(?:month|mo)\b/gi;
const HEADCOUNT_RE = /(\d+)\s*-?\s*(?:seat|person|people|user|member)\b/gi;
const MONTHLY_TOTAL_RE = /\$\s?([\d,]+(?:\.\d+)?)\s*\/\s*(?:month|mo)\b/gi;

/** A monthly figure that is NOT a per-seat rate (i.e. a plausible team total). */
function monthlyTotalsOnLine(line: string): number[] {
  const totals: number[] = [];
  let m: RegExpExecArray | null;
  MONTHLY_TOTAL_RE.lastIndex = 0;
  while ((m = MONTHLY_TOTAL_RE.exec(line))) {
    // exclude a /seat /month rate (those carry seat|user|member immediately before /month)
    const pre = line.slice(Math.max(0, m.index - 14), m.index);
    if (/(?:seat|user|member)\s*$/i.test(pre)) continue;
    totals.push(numFrom(m[1]));
  }
  return totals;
}

function detectSeatMath(body: string): ProvenanceViolation[] {
  const out: ProvenanceViolation[] = [];
  const seen = new Set<string>();

  // Build a vendor-tier -> per-seat-monthly rate index from the whole body.
  // The vendor phrase must be a real brand/tier, NOT a generic section label ("Pricing:",
  // "Starter at …") or a URL fragment — those produce reconciliation false-positives
  // (e.g. capturing the bold "Pricing:" label, then matching the "plain.com/pricing" URL).
  const VENDOR_LABEL_BLOCKLIST = new Set([
    "pricing", "starter", "professional", "premium", "standard", "growth", "free", "pro",
    "plus", "lite", "ultimate", "enterprise", "foundation", "horizon", "team", "tier",
    "plan", "plans", "cost", "costs", "price", "prices", "the", "at", "from", "both",
  ]);
  const rateByVendor = new Map<string, number>();
  let r: RegExpExecArray | null;
  SEAT_RATE_RE.lastIndex = 0;
  while ((r = SEAT_RATE_RE.exec(body))) {
    const vendor = r[1].trim().toLowerCase();
    const rate = numFrom(r[2]);
    // require a real vendor token: not a lone generic label word.
    const firstTok = vendor.split(/\s+/)[0];
    if (VENDOR_LABEL_BLOCKLIST.has(firstTok)) continue;
    if (Number.isFinite(rate) && rate > 0) rateByVendor.set(vendor, rate);
  }

  const lines = body.split(/\n/);
  for (const line of lines) {
    // NB: we do NOT skip lines mentioning year/onboarding wholesale — a line can carry BOTH
    // a monthly seat total (checkable) AND a year/onboarding figure (e.g. the attio L121
    // "$450/month ... = $6,900 year one"). monthlyTotalsOnLine() already grabs only $T/month
    // figures, so year totals ($6,900 year one) and onboarding ($1,500) never enter the check.

    // decompose the line into seat counts, per-seat rates, and monthly totals
    const seatCounts: number[] = [];
    let mm: RegExpExecArray | null;
    HEADCOUNT_RE.lastIndex = 0;
    while ((mm = HEADCOUNT_RE.exec(line))) seatCounts.push(numFrom(mm[1]));
    const rates: number[] = [];
    PER_SEAT_RATE_RE.lastIndex = 0;
    while ((mm = PER_SEAT_RATE_RE.exec(line))) rates.push(numFrom(mm[1]));
    const totals = monthlyTotalsOnLine(line);

    if (seatCounts.length === 0 || totals.length === 0) continue;

    const seats = seatCounts[0];

    // (1) Self-contained: a per-seat rate ON the line × seats should equal a monthly total.
    // Fire only when NO ordering of (rate × seats) matches ANY stated monthly total (so a
    // correct claim with extra figures on the line never trips).
    if (rates.length > 0) {
      const anyMatch = rates.some((rate) =>
        totals.some((t) => approx(rate * seats, t)),
      );
      if (!anyMatch) {
        const rate = rates[0];
        const total = totals[0];
        const key = `self::${line.trim()}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(
            arithViolation(
              line.trim().slice(0, 200),
              `$${rate}/seat/month × ${seats} seats = $${rate * seats}/month, but body asserts $${total}/month.`,
            ),
          );
        }
      }
      continue; // a line with an on-line rate is self-contained; don't also vendor-reconcile
    }

    // (2) Vendor-reconciled: the line states a headcount + a monthly total but NO on-line
    // per-seat rate; reconcile against a vendor-tier rate established elsewhere in the body.
    // Require a "team pays/costs $T" assertion (not a bare pricing-table row, where "$35/mo
    // (1 seat)" is the vendor's OWN correct tier price, not a headcount-total claim).
    const lower = line.toLowerCase();
    if (!/\b(pays?|paying|costs?|spend(?:s|ing)?|bill(?:s|ed)?)\b/.test(lower)) continue;
    let matchedRate: number | null = null;
    let matchedVendor = "";
    for (const [vendor, rate] of rateByVendor) {
      if (lower.includes(vendor)) {
        matchedRate = rate;
        matchedVendor = vendor;
        break;
      }
    }
    if (matchedRate == null) continue;
    const expected = matchedRate * seats;
    if (!totals.some((t) => approx(expected, t))) {
      const total = totals[0];
      const key = `vendor::${matchedVendor}::${line.trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(
          arithViolation(
            line.trim().slice(0, 200),
            `${matchedVendor} is $${matchedRate}/seat/month; × ${seats} seats = $${expected}/month, but body asserts $${total}/month.`,
          ),
        );
      }
    }
  }
  return out;
}

function approx(expected: number, asserted: number): boolean {
  if (expected === 0) return asserted === 0;
  return Math.abs(expected - asserted) / Math.abs(expected) <= TOLERANCE;
}

function arithViolation(span: string, reason: string): ProvenanceViolation {
  return {
    check: "arithmetic_error",
    severity: "invented",
    ceiling: CEIL_INVENTED,
    span: span.trim().slice(0, 200),
    reason,
  };
}

// ---------------------------------------------------------------------------
// Check 5 — synthesized evidence
// ---------------------------------------------------------------------------
const SYNTH_SECTIONS = new Set(["voc", "buyer", "competitor"]);

function detectSynthesizedEvidence(
  section: string,
  subject: string,
  gt: GroundTruth,
  ungroundedQuotes: string[],
): ProvenanceViolation[] {
  if (!SYNTH_SECTIONS.has(section)) return [];
  // If real customer-voice evidence was retrieved, the section had material to ground on.
  if (gt.hasCustomerVoiceEvidence) return [];
  // Synthesized evidence = the section ships customer/source PROOF QUOTES that are NOT in
  // the transcript (manufactured), with no customer-voice evidence retrieved at all.
  // Requiring UNGROUNDED quotes (not just the word "customer") avoids false-positives on
  // sections that legitimately discuss customers using grounded research (e.g. a BuyerICP
  // built from firecrawl/perplexity pages whose quotes ARE in the transcript).
  if (ungroundedQuotes.length === 0) return [];
  return [
    {
      check: "synthesized_evidence",
      severity: "invented",
      ceiling: CEIL_INVENTED,
      span: ungroundedQuotes[0].trim().slice(0, 200),
      reason: `Section "${section}" for "${subject}" ships customer/source proof quotes that are NOT in the transcript, and NO customer-voice evidence was retrieved (reviews/firecrawl/web_search/perplexity/adlibrary returned no quotable customer voice). Proof is synthesized.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// invented_customer
// ---------------------------------------------------------------------------
// The body asserts that a SPECIFIC fetched page NAMES/SHOWS/LISTS named entities
// (customers, logos), citing a URL whose CONTENT is in the transcript — but one or more
// of the named entities is ABSENT from that page's content AND the whole transcript.
// The fabrication pattern from Phase A: "Attio's customers page also names Coca-Cola,
// Superhuman, Unmind, and Ryanair" (page fetched; those 4 names = 0 in transcript) and
// "The homepage shows Coca-Cola and Ryanair logos" (same minted enterprise logos).
//
// Conservative — three preconditions must ALL hold before flagging a name:
//   (a) the sentence names a customer/logo SOURCE (customers/logos/clients), so it is a
//       proof-by-named-customer claim, not generic feature prose;
//   (b) a URL cited in that sentence is grounded (the page WAS fetched) — only then is a
//       name's absence meaningful (a never-fetched page proves nothing);
//   (c) the named entity is ABSENT from transcriptText (transcript-anchored, NOT grounding
//       text — a logo minted across sibling bodies must not self-launder).
const CUSTOMER_NAMING_VERB_RE = /\b(names?|lists?|shows?|displays?|features?|includes?)\b/i;
const CUSTOMER_SOURCE_ANCHOR_RE =
  /\b(customers?|logos?|clients?|case stud(?:y|ies)|customer(?:'s)? page|customers? page|homepage|landing page|home page)\b/i;
// Capitalized brand-ish tokens. Allow hyphen/&/. inside ("Coca-Cola", "AT&T", "Fly.io").
const PROPER_NOUN_RE = /\b([A-Z][A-Za-z0-9.&]*(?:[-' ][A-Z][A-Za-z0-9.&]*)*)\b/g;
// Tokens that are NOT customer names even when capitalized (features/products/section words).
const NOT_A_CUSTOMER = new Set([
  "The", "This", "That", "These", "Those", "Their", "Its", "Our", "Your", "His", "Her",
  "And", "But", "For", "Yet", "Nor", "Also", "Plus", "With", "From", "Into", "Over",
  "API", "APIs", "SLA", "SLAs", "CRM", "CRMs", "AI", "UI", "UX", "SaaS", "B2B", "MCP",
  "Microsoft Teams", "Teams", "Slack", "Help Center", "CTA", "PLG", "ACV", "ARR",
  "Enterprise", "Professional", "Starter", "Premium", "Standard", "Growth", "Free",
  "Pro", "Plus", "Lite", "Ultimate", "Series", "VP", "CEO", "CTO", "CFO",
  "G2", "Capterra", "Trustpilot", "Reddit", "TechCrunch", "Gartner", "LinkedIn",
  "Web Services", "Agentforce", "Marketing Hub", "Sales Hub",
]);

/** Pull the comma/and-separated proper-noun list that DIRECTLY follows a naming verb. */
function namedEntitiesAfterVerb(sentence: string): string[] {
  const out: string[] = [];
  const verb = CUSTOMER_NAMING_VERB_RE.exec(sentence);
  if (!verb) return out;
  // The object list runs from just after the verb to the first sentence-ending punctuation,
  // citation, or clause break ("suggesting", "because", ";", "(").
  const afterIdx = verb.index + verb[0].length;
  let tail = sentence.slice(afterIdx);
  // cut at the first citation / parenthetical / strong clause break
  tail = tail.split(/[.(;]|\bsuggesting\b|\bbecause\b|\bwhich\b|\bwhile\b|\byet\b/i)[0];
  // drop markdown emphasis and leading filler ("also", "and", "logos"-trailing handled below)
  tail = tail.replace(/\*+/g, " ");
  let m: RegExpExecArray | null;
  PROPER_NOUN_RE.lastIndex = 0;
  while ((m = PROPER_NOUN_RE.exec(tail))) {
    const name = m[1].trim();
    if (NOT_A_CUSTOMER.has(name)) continue;
    // require a real brand-ish length and that it is not a lone single-letter/2-char token
    if (name.replace(/[^A-Za-z0-9]/g, "").length < 3) continue;
    out.push(name);
  }
  return out;
}

function detectInventedCustomer(body: string, gt: GroundTruth): ProvenanceViolation[] {
  const out: ProvenanceViolation[] = [];
  const seen = new Set<string>();
  const sentences = body.split(/(?<=[.!?])\s+|\n+/);
  for (const s of sentences) {
    if (!CUSTOMER_NAMING_VERB_RE.test(s)) continue;
    if (!CUSTOMER_SOURCE_ANCHOR_RE.test(s)) continue;
    // (b) require a grounded cited URL in the sentence (page actually fetched).
    const sentenceUrls = extractBodyUrls(s);
    const hasGroundedCite = sentenceUrls.some((u) => urlGroundedInTranscript(u, gt));
    if (!hasGroundedCite) continue;
    // (a)+(c): each named entity directly after the naming verb that is ABSENT from the
    // transcript was laundered onto the (real) fetched page.
    for (const name of namedEntitiesAfterVerb(s)) {
      const nn = normalizeText(name);
      if (!nn) continue;
      if (gt.transcriptText.includes(nn)) continue; // genuinely present — not invented
      if (seen.has(nn)) continue;
      seen.add(nn);
      out.push({
        check: "invented_customer",
        severity: "invented",
        ceiling: CEIL_INVENTED,
        span: name,
        reason: `Body asserts a cited (fetched) page names/shows "${name}" as a customer/logo, but "${name}" does not appear anywhere in that page's content or the whole transcript. The named customer was laundered onto a real fetched page.`,
      });
    }
  }
  return out;
}

/** Like urlGrounded but transcript-only (no sibling-body fold) — used by invented_customer
 *  so the precondition "the page was actually fetched" can never be satisfied by prose. */
function urlGroundedInTranscript(citedUrl: string, gt: GroundTruth): boolean {
  const n = normalizeUrl(citedUrl);
  if (!n) return false;
  if (gt.transcriptUrls.has(n)) return true;
  for (const u of gt.transcriptUrls) {
    if (u.includes(n) || n.includes(u)) return true;
  }
  return gt.transcriptText.includes(n);
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Per-record quote-at-URL grounding (P2 bugfix)
//
// Check 2 grounds a quote against the WHOLE transcript blob, which lets a
// laundered quote pass: a real quote retrieved from URL-A, but attributed in the
// body to a DIFFERENT URL-B (also fetched, page text does not contain it). These
// helpers bind each quote to the text of ITS attributed URL. The at-URL check
// fires ONLY when the attributed URL WAS fetched (has text in the per-URL map) —
// an unfetched URL is left to Check 1 / the network-unavailable carve-out
// (mirrors commit 7afc84fc's at-URL containment contract).
// ---------------------------------------------------------------------------

/**
 * Map each normalized URL seen in a transcript record to the normalized text of
 * EVERY record whose serialized output/input mentions that URL. A single tool
 * output blob can carry several URLs + snippets; binding the whole record text
 * to each of its URLs is the honest, conservative association (it can only make
 * the at-URL check MORE forgiving, never invent a false drop).
 */
function buildPerUrlText(records: TranscriptRecord[]): Map<string, string> {
  const perUrl = new Map<string, string>();
  for (const r of records) {
    if (r.isError) continue;
    const serialized = safeStringify(r.output) + "  " + safeStringify(r.input);
    const recordUrls = extractTranscriptUrls(serialized);
    if (recordUrls.size === 0) continue;
    const recordText = normalizeText(serialized);
    for (const u of recordUrls) {
      const prior = perUrl.get(u);
      perUrl.set(u, prior === undefined ? recordText : `${prior}  ${recordText}`);
    }
  }
  return perUrl;
}

/**
 * Return the per-URL text for a body-cited URL, tolerating sub-path / query
 * drift between the body citation and the transcript URL (same matching policy
 * as urlGrounded). Returns null when no fetched record carries the URL.
 */
function lookupPerUrlText(
  perUrl: Map<string, string>,
  citedUrl: string,
): string | null {
  const n = normalizeUrl(citedUrl);
  if (!n) return null;
  const direct = perUrl.get(n);
  if (direct !== undefined) return direct;
  for (const [u, text] of perUrl) {
    if (u.includes(n) || n.includes(u)) return text;
  }
  return null;
}

/**
 * Extract `{ quote, url }` pairs from the body: an evidence quote whose line ALSO
 * carries a cited URL (markdown target, bare https, or parenthetical bare domain
 * with a TLD). Only attributed-URL quotes are returned — the blob-level Check 2
 * already handles quotes with no URL attribution. Mirrors extractEvidenceQuotes'
 * blockquote / italic-attributed acceptance so the two stay aligned.
 */
function extractAttributedQuotePairs(
  body: string,
): Array<{ quote: string; url: string }> {
  const pairs: Array<{ quote: string; url: string }> = [];
  const lines = body.split(/\n/);
  for (const line of lines) {
    if (/^\s*#{1,6}\s/.test(line)) continue;
    const urls = extractBodyUrls(line);
    if (urls.length === 0) continue;
    const re = /[“"]([^”"]{15,})[”"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const text = m[1].trim();
      if (text.length < 15) continue;
      // bind the quote to the FIRST cited URL on the line (the attribution target)
      pairs.push({ quote: text, url: urls[0] });
    }
  }
  return pairs;
}

/**
 * In-memory detector entry point. Same logic as the script's `detect()` but the body and
 * transcript records are passed in (already parsed) rather than read from disk.
 */
export function detectProvenanceViolations(args: DetectProvenanceArgs): DetectProvenanceResult {
  const {
    body,
    transcript,
    section,
    subject,
    siblingTranscripts = [],
    siblingBodies = [],
  } = args;

  const records: TranscriptRecord[] = Array.isArray(transcript) ? transcript : [];
  // The script's URL-extraction pass scans the raw transcript JSON string. Here we serialize
  // the parsed records to reproduce that exactly (catches JSON-escaped URLs in tool output).
  const rawTranscript = safeStringify(records);
  const siblingTranscriptStrings = siblingTranscripts.map((sib) =>
    safeStringify(Array.isArray(sib) ? sib : []),
  );

  const gt = buildGroundTruth(records, rawTranscript, siblingTranscriptStrings, siblingBodies);
  const violations: ProvenanceViolation[] = [];

  // Check 1 — URL grounding
  const citedUrls = extractBodyUrls(body);
  for (const url of citedUrls) {
    if (!urlGrounded(url, gt)) {
      violations.push({
        check: "url_not_in_transcript",
        severity: "laundered",
        ceiling: CEIL_LAUNDERED,
        span: normalizeUrl(url),
        reason: `Cited URL "${normalizeUrl(url)}" does not appear in any tool output/input for this run.`,
      });
    }
  }

  // Check 2 — quote grounding
  const quotes = extractEvidenceQuotes(body);
  const ungroundedQuotes: string[] = [];
  for (const q of quotes) {
    if (!quoteGrounded(q, gt)) {
      ungroundedQuotes.push(q);
      violations.push({
        check: "quote_not_in_transcript",
        severity: "laundered",
        ceiling: CEIL_LAUNDERED,
        span: q.slice(0, 200),
        reason: `Quoted span (≥15 chars) is not found in the transcript (substring + ≥90% token-overlap both miss).`,
      });
    }
  }

  // Check 2b — quote-at-URL laundering (per-record). A quote attributed to a
  // SPECIFIC fetched URL must appear in THAT URL's page text, not merely somewhere
  // in the transcript blob. Fires only when the attributed URL was fetched (has
  // text) and the quote is absent there — the missing-page carve-out leaves
  // unfetched URLs to Check 1. De-duped against the blob-level Check 2 above so a
  // quote is never double-counted.
  const perUrlText = buildPerUrlText(records);
  for (const { quote, url } of extractAttributedQuotePairs(body)) {
    if (ungroundedQuotes.includes(quote)) continue; // already flagged by Check 2
    const urlText = lookupPerUrlText(perUrlText, url);
    if (urlText === null) continue; // attributed URL never fetched -> Check 1's job
    if (!isQuoteContainedInLiveText(urlText, quote)) {
      ungroundedQuotes.push(quote);
      violations.push({
        check: "quote_not_in_transcript",
        severity: "laundered",
        ceiling: CEIL_LAUNDERED,
        span: quote.slice(0, 200),
        reason: `Quoted span (≥15 chars) is attributed to "${normalizeUrl(url)}" but is not present in that source's fetched page text (quote laundered onto the wrong URL).`,
      });
    }
  }

  // Check 2 — number grounding (conservative: only clearly-sourced facts)
  const sourcedNumbers = extractSourcedNumbers(body);
  for (const n of sourcedNumbers) {
    if (!numberGrounded(n, gt)) {
      violations.push({
        check: "number_not_in_transcript",
        severity: "laundered",
        ceiling: CEIL_LAUNDERED,
        span: n.span,
        reason: `Sourced number "${n.raw}" (presented as a cited fact) does not appear in the transcript.`,
      });
    }
  }

  // Check 3 — invented customer + invented bidder + invented volume/cpc
  violations.push(...detectInventedCustomer(body, gt));
  violations.push(...detectInventedBidder(body, gt));
  violations.push(...detectInventedVolumeCpc(body, gt));

  // Check 4 — arithmetic
  violations.push(...detectArithmetic(body));

  // Check 5 — synthesized evidence (fires only when proof quotes are themselves ungrounded)
  violations.push(...detectSynthesizedEvidence(section, subject, gt, ungroundedQuotes));

  const stats: ProvenanceStats = {
    section,
    subject,
    toolsUsed: Array.from(gt.toolsUsed).sort(),
    hasVolumeCpcTool: gt.hasVolumeCpcTool,
    hasAdvertiserField: gt.hasAdvertiserField,
    hasCustomerVoiceEvidence: gt.hasCustomerVoiceEvidence,
    citedUrls: citedUrls.length,
    citedQuotes: quotes.length,
    sourcedNumbers: sourcedNumbers.length,
    transcriptUrlCount: gt.transcriptUrls.size,
    transcriptChars: gt.transcriptText.length,
  };

  return { violations, ceiling: ceilingFor(violations), stats };
}

/** The lowest finalScore ceiling imposed by a set of violations (none → 10). */
export function ceilingFor(violations: ProvenanceViolation[]): number {
  if (violations.length === 0) return 10;
  return Math.min(...violations.map((v) => v.ceiling));
}
