/**
 * Source-class labeling — the ONLY anti-fabrication layer on the un-caged GLM
 * agentic path (§4.4). Deterministic, no LLM judge. It maps every cited URL in
 * a section's markdown to the TOOL that produced it, then labels the citation:
 *
 *   - `verbatim`    — a page we DIRECTLY fetched (firecrawl page / reviews body).
 *                     A quote from one of these is reproduced from the real page.
 *   - `reported`    — a URL surfaced by a research aggregator (perplexity) or a
 *                     web_search result snippet. We did NOT fetch the page; the
 *                     quote is a paraphrase/lead and must be read as reported.
 *   - `data-table`  — a keyword/volume data source (SpyFu etc.).
 *   - `ungrounded`  — a URL that appears in the markdown but in NO tool result.
 *
 * This replaces the killed Opus acceptance oracle: instead of an LLM judging
 * whether a quote is real, we deterministically tell the reader the provenance
 * class of every source the section leans on.
 *
 * Reuses the verified provenance primitives (normalizeUrl, extractBodyUrls) and
 * the verified live transcript shapes (see the zz-agentic-glm transcript dumps):
 *   web_search          -> output.results[].url
 *   perplexity_research -> output.citations[].url
 *   reviews             -> output.excerpts[].url, output.attempts[].url
 *   firecrawl (success) -> output.url
 *   keyword_volume      -> output.sourceUrl, output.keywords[].sourceUrl
 */

import {
  extractBodyUrls,
  normalizeUrl,
  type TranscriptRecord,
} from "./provenance-detect";

export type SourceClass = "verbatim" | "reported" | "data-table" | "ungrounded";

const VERBATIM_TOOLS = new Set(["reviews", "firecrawl"]);
const REPORTED_TOOLS = new Set(["web_search", "perplexity_research"]);
const DATA_TOOLS = new Set(["keyword_volume", "keyword_trends"]);

// Stronger provenance wins when a URL is produced by more than one tool: a page
// we actually fetched (verbatim) beats the same URL merely cited by perplexity.
const RANK: Record<Exclude<SourceClass, "ungrounded">, number> = {
  verbatim: 3,
  reported: 2,
  "data-table": 1,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function urlFromEntry(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  const obj = asRecord(entry);
  if (obj !== null && typeof obj.url === "string") return obj.url;
  return null;
}

/** Pull every source URL out of one tool result, per the verified per-tool shape. */
function collectUrlsFromOutput(toolName: string, output: unknown): string[] {
  const obj = asRecord(output);
  if (obj === null) return [];
  const urls: string[] = [];

  switch (toolName) {
    case "web_search": {
      for (const r of asArray(obj.results)) {
        const u = urlFromEntry(r);
        if (u !== null) urls.push(u);
      }
      break;
    }
    case "perplexity_research": {
      for (const c of asArray(obj.citations)) {
        const u = urlFromEntry(c);
        if (u !== null) urls.push(u);
      }
      break;
    }
    case "reviews": {
      // Excerpts only exist for bodies we actually fetched → always verbatim.
      for (const e of asArray(obj.excerpts)) {
        const u = urlFromEntry(e);
        if (u !== null) urls.push(u);
      }
      // Attempts include FAILED fetches. Only a succeeded attempt is a page we
      // truly retrieved; a failed one must NOT be badged verbatim (it would
      // claim a quote was "reproduced from source" for a page we never got).
      for (const a of asArray(obj.attempts)) {
        const ar = asRecord(a);
        if (ar === null || ar.status !== "succeeded") continue;
        const u = urlFromEntry(ar);
        if (u !== null) urls.push(u);
      }
      break;
    }
    case "firecrawl": {
      if (typeof obj.url === "string") urls.push(obj.url);
      break;
    }
    case "keyword_volume":
    case "keyword_trends": {
      if (typeof obj.sourceUrl === "string") urls.push(obj.sourceUrl);
      for (const k of asArray(obj.keywords)) {
        const kr = asRecord(k);
        if (kr !== null && typeof kr.sourceUrl === "string") urls.push(kr.sourceUrl);
      }
      break;
    }
    default:
      break;
  }
  return urls;
}

function classOfTool(toolName: string): Exclude<SourceClass, "ungrounded"> | null {
  if (VERBATIM_TOOLS.has(toolName)) return "verbatim";
  if (DATA_TOOLS.has(toolName)) return "data-table";
  if (REPORTED_TOOLS.has(toolName)) return "reported";
  return null;
}

/**
 * Build a `normalizedUrl -> SourceClass` map from a tool transcript. Skips
 * isError records (a firecrawl failure carries no fetched page).
 */
export function buildTranscriptUrlClassMap(
  transcript: readonly TranscriptRecord[],
): Map<string, Exclude<SourceClass, "ungrounded">> {
  const map = new Map<string, Exclude<SourceClass, "ungrounded">>();
  for (const record of transcript) {
    if (record.isError) continue;
    const cls = classOfTool(record.toolName);
    if (cls === null) continue;
    for (const raw of collectUrlsFromOutput(record.toolName, record.output)) {
      const key = normalizeUrl(raw);
      if (key.length === 0) continue;
      const existing = map.get(key);
      if (existing === undefined || RANK[cls] > RANK[existing]) {
        map.set(key, cls);
      }
    }
  }
  return map;
}

/** Classify a single URL against a transcript class map. */
export function classifyUrl(
  url: string,
  map: ReadonlyMap<string, Exclude<SourceClass, "ungrounded">>,
): SourceClass {
  return map.get(normalizeUrl(url)) ?? "ungrounded";
}

export interface MarkdownCitation {
  url: string;
  sourceClass: SourceClass;
}

/** Classify every URL cited in a markdown body. Deduped by normalized URL. */
export function classifyMarkdownCitations(
  markdown: string,
  map: ReadonlyMap<string, Exclude<SourceClass, "ungrounded">>,
): MarkdownCitation[] {
  const seen = new Set<string>();
  const out: MarkdownCitation[] = [];
  for (const raw of extractBodyUrls(markdown)) {
    const key = normalizeUrl(raw);
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push({ url: key, sourceClass: classifyUrl(raw, map) });
  }
  return out;
}

const CLASS_LABEL: Record<SourceClass, string> = {
  verbatim: "Verbatim — directly fetched page (quote reproduced from source)",
  reported: "Reported — surfaced by a research aggregator (read as paraphrase)",
  "data-table": "Data — keyword/volume estimate",
  ungrounded: "Unverified — cited URL not present in any fetched source",
};

const CLASS_ORDER: SourceClass[] = [
  "verbatim",
  "reported",
  "data-table",
  "ungrounded",
];

/**
 * Append a deterministic "Source provenance" footer to a section's markdown,
 * grouping every cited URL by its source class. This is what the reader sees
 * in place of the killed oracle: an honest ledger of which claims rest on
 * directly-fetched evidence vs aggregator paraphrase. Returns the body
 * unchanged when it cites nothing.
 */
export function annotateSourceProvenance(
  markdown: string,
  transcript: readonly TranscriptRecord[],
): string {
  const map = buildTranscriptUrlClassMap(transcript);
  const citations = classifyMarkdownCitations(markdown, map);
  if (citations.length === 0) return markdown;

  const grouped = new Map<SourceClass, string[]>();
  for (const { url, sourceClass } of citations) {
    const bucket = grouped.get(sourceClass) ?? [];
    bucket.push(url);
    grouped.set(sourceClass, bucket);
  }

  const lines: string[] = ["", "---", "", "### Source provenance", ""];
  for (const cls of CLASS_ORDER) {
    const urls = grouped.get(cls);
    if (urls === undefined || urls.length === 0) continue;
    lines.push(`**${CLASS_LABEL[cls]}**`);
    for (const url of urls) lines.push(`- ${url}`);
    lines.push("");
  }

  return `${markdown}\n${lines.join("\n")}`.replace(/\n+$/, "\n");
}
