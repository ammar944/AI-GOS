// Buyer ICP segment-evidence miner (the segment-first primitive).
//
// An ICP is a buyer SEGMENT/ROLE, not a named-person list. The case-study miner
// (buyer-persona-case-study-mining.ts) hunts named champions and ships empty
// when none are public. This miner is the deterministic, I/O-free complement: it
// extracts role/segment phrases ("finance leaders", "CFOs and controllers",
// "modern finance teams", "VP of Finance at mid-market SaaS") from the prepared
// corpus excerpts — about-us, "who uses", analyst research, review title
// distributions, case-study role lines — and hands them to the model as
// ready-to-author `segmentLabel` personas with their sourceUrls.
//
// Pure: operates on already-fetched corpus text. No Firecrawl, no Perplexity,
// no network. The phrase is grounded on its sourceUrl page by construction
// (it was extracted from that page's text), so a persona carrying it as
// `segmentLabel` clears the source-liveness strict-containment gate.
//
// The model still decides which segments to promote and writes the full persona
// record (role/seniority/company/evidence). This miner surfaces the grounding
// material; it never fabricates a persona.

import type { CorpusExcerpt } from "../artifacts/artifact-envelope";
import {
  SEGMENT_EVIDENCE_VENUE,
  type BuyerPersonaCandidate,
} from "./buyer-persona-acquisition";

// Role/segment phrase patterns. Each matches a buyer-role or segment phrase a
// finance/ops SaaS corpus typically exposes. Phrases are matched
// case-insensitively on the excerpt text; the matched substring (trimmed,
// collapsed) becomes the segmentLabel. Keep patterns conservative — a phrase
// that matches generic marketing copy ("ambitious companies") is not a buyer
// role. The patterns anchor on role/function vocabulary.
const SEGMENT_PATTERNS: readonly RegExp[] = [
  // "finance leaders (such as CFOs and controllers)" / "finance leaders"
  /finance leaders(?:\s*\([^)]*\))?/gi,
  // "CFOs and controllers" / "CFO or VP of Finance"
  /\b(?:CFO|VP of Finance|Controller|Head of Finance|Finance Manager|Accounting Manager|Finance Operations)[s]?\s*(?:and|or)\s*(?:CFOs?|Controllers?|VP of Finance|Finance Managers?|Accounting Managers?)?/gi,
  // "modern finance teams" / "finance teams"
  /\b(?:modern\s+)?finance teams?/gi,
  // "Controllers at <...> firms" / "<role> at <segment> companies"
  /\b(?:Controllers?|Finance Managers?|Accounting Managers?|VPs? of Finance|CFOs?)\s+at\s+[A-Za-z][^.]{0,60}?(?:firms|companies|businesses|enterprises|organizations)/gi,
  // "buyers ... finance" / "buyers are finance leaders"
  /\b(?:primary )?buyers?\s+(?:are|include|are mostly)\s+[A-Za-z][^.]{0,60}/gi,
];

// Phrases that look like a buyer role but are generic marketing and must NOT be
// promoted as segment evidence. Substring match, case-insensitive.
const GENERIC_PHRASE_REJECTS = [
  "ambitious companies",
  "businesses of all sizes",
  "companies of all sizes",
  "world's most ambitious",
  "fast-growing startups",
  "established enterprises",
];

const MIN_SEGMENT_LABEL_LENGTH = 4;
const MAX_SEGMENTS_PER_EXCERPT = 1;
const MAX_SEGMENT_CANDIDATES = 4;
// Cap distinct segments per source domain so one rich page (e.g. Contrary
// Research) doesn't flood the lead pack with overlapping phrasings of the same
// role. Overlapping options confuse the model into inaction.
const MAX_SEGMENTS_PER_DOMAIN = 2;

function normalizePhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");
}

function isRejectedGeneric(phrase: string): boolean {
  const lower = phrase.toLowerCase();
  return GENERIC_PHRASE_REJECTS.some((reject) =>
    lower.includes(reject.toLowerCase()),
  );
}

function deriveRoleLabel(segmentLabel: string): string {
  // Derive a short name for the persona from the segment phrase. "modern
  // finance teams" -> "Finance team buyer"; "CFOs and controllers" ->
  // "CFO/Controller buyer". Falls back to a capped slice of the phrase.
  const lower = segmentLabel.toLowerCase();
  if (lower.includes("cfo")) return "CFO buyer";
  if (lower.includes("controller")) return "Controller champion";
  if (lower.includes("vp of finance")) return "VP Finance buyer";
  if (lower.includes("finance manager")) return "Finance Manager champion";
  if (lower.includes("accounting manager")) return "Accounting Manager champion";
  if (lower.includes("finance team")) return "Finance team buyer";
  if (lower.includes("finance leader")) return "Finance leader buyer";
  return segmentLabel.slice(0, 40);
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Extract role/segment phrase candidates from corpus excerpts. Pure: no I/O.
 * Each returned candidate carries the verbatim segment phrase (the grounding
 * carrier) and the excerpt's sourceUrl (the page the phrase was mined from, so
 * a persona authored from it clears source-liveness strict-containment).
 *
 * Dedupes by normalized phrase AND by phrase-overlap (a phrase that is a
 * substring of an already-accepted phrase, or vice-versa, is dropped so the
 * model sees distinct options instead of overlapping phrasings of the same
 * role). Caps distinct segments per source domain so one rich page doesn't
 * flood the lead pack. Never throws — a malformed excerpt yields no candidates.
 */
export function mineSegmentEvidenceCandidates(
  excerpts: readonly CorpusExcerpt[],
): BuyerPersonaCandidate[] {
  const accepted: { phrase: string; lower: string }[] = [];
  const perDomainCount = new Map<string, number>();
  const candidates: BuyerPersonaCandidate[] = [];

  for (const excerpt of excerpts) {
    if (candidates.length >= MAX_SEGMENT_CANDIDATES) {
      break;
    }
    if (!excerpt || typeof excerpt.text !== "string" || excerpt.text.length === 0) {
      continue;
    }
    if (!excerpt.sourceUrl || !/^https?:\/\//i.test(excerpt.sourceUrl)) {
      continue;
    }

    const domain = domainOf(excerpt.sourceUrl);
    let perExcerpt = 0;
    for (const pattern of SEGMENT_PATTERNS) {
      if (perExcerpt >= MAX_SEGMENTS_PER_EXCERPT) {
        break;
      }
      if ((perDomainCount.get(domain) ?? 0) >= MAX_SEGMENTS_PER_DOMAIN) {
        break;
      }
      pattern.lastIndex = 0;
      const match = pattern.exec(excerpt.text);
      if (match === null) {
        continue;
      }
      const phrase = normalizePhrase(match[0]);
      if (
        phrase.length < MIN_SEGMENT_LABEL_LENGTH ||
        isRejectedGeneric(phrase)
      ) {
        continue;
      }
      const lower = phrase.toLowerCase();
      // Phrase-overlap dedup: if a new phrase overlaps an already-accepted one
      // (one is a substring of the other), keep the MORE SPECIFIC (longer)
      // phrase. Replace the accepted one if the new phrase is longer and from
      // a distinct-enough source; otherwise drop the new one. This keeps
      // "modern finance teams" (ramp.com/about-us) over "finance teams"
      // (wikipedia) when both surface, collapsing overlapping phrasings to a
      // single, more-informative lead.
      let dropped = false;
      for (let i = 0; i < accepted.length; i++) {
        const a = accepted[i];
        if (a.lower === lower) {
          dropped = true;
          break;
        }
        if (a.lower.includes(lower) || lower.includes(a.lower)) {
          if (lower.length > a.lower.length) {
            // Replace the accepted shorter phrase with the longer one, and
            // update the matching candidate's segmentLabel/url.
            accepted[i] = { phrase, lower };
            const idx = candidates.findIndex(
              (c) => c.segmentLabel === a.phrase,
            );
            if (idx >= 0) {
              candidates[idx] = {
                company: "",
                name: deriveRoleLabel(phrase),
                title: "",
                url: excerpt.sourceUrl,
                venue: SEGMENT_EVIDENCE_VENUE,
                segmentLabel: phrase,
              };
            }
          }
          dropped = true;
          break;
        }
      }
      if (dropped) {
        continue;
      }
      accepted.push({ phrase, lower });
      perDomainCount.set(domain, (perDomainCount.get(domain) ?? 0) + 1);
      perExcerpt += 1;
      candidates.push({
        company: "",
        name: deriveRoleLabel(phrase),
        title: "",
        url: excerpt.sourceUrl,
        venue: SEGMENT_EVIDENCE_VENUE,
        segmentLabel: phrase,
      });
    }
  }

  return candidates;
}