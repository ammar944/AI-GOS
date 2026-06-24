#!/usr/bin/env tsx
/**
 * zz-value-bar-agent.ts — the VALUE-BAR AGENT (separate agent, always reading
 * the research, judging: is this actually useful to a media buyer / good GTM
 * strategy?). This is the gate for the entire GLM bet (handoff Task 01).
 *
 * Two independent layers, fused into one verdict per section:
 *
 *  LAYER A — DETERMINISTIC anti-laundering + deck-cell counter (pure code, no LLM):
 *    - Pull every URL mentioned in body.md.
 *    - Pull every URL that actually appears in the section's transcript tool results.
 *    - FLAG any body-cited URL NOT in the transcript = LAUNDERED (real quote, wrong page).
 *    - Count verbatim quotes (text in quotes attributed to a URL).
 *    - Count distinct review-site URLs (g2/capterra/reddit/trustpilot/glassdoor).
 *    - Count numeric claims ($, %, CPM, CPC, CAC, volume).
 *
 *  LAYER B — GLM JUDGE (separate GLM-5.2 call, reads body.md only, blind to the
 *  transcript): "would a media buyer bill this to a client?" Scores 0-10 on
 *  value + flags fabrication smells. Blind judging = no transcript leakage.
 *
 *  FUSION: a section PASSES only if BOTH layers agree — deterministic URLs are
 *  clean (no laundering) AND the judge scores value >= 8. Either fails → FAIL.
 *
 * Usage:
 *   npx tsx scripts/zz-value-bar-agent.ts <subject> <section>
 *   npx tsx scripts/zz-value-bar-agent.ts clay voc
 *   npx tsx scripts/zz-value-bar-agent.ts --all   # run across all subjects {voc,market}
 *
 * Output: tmp/zz-value-bar/<subject>/<section>.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

const baseURL = process.env.GLM_BASE_URL ?? "http://localhost:11434/v1";
const modelId = process.env.GLM_MODEL_ID ?? "glm-5.2:cloud";
const glm = createOpenAICompatible({
  apiKey: process.env.GLM_API_KEY ?? "ollama",
  baseURL,
  name: "glm",
});

const REVIEW_SITE_RE = /(g2\.com|capterra\.com|reddit\.com|trustpilot\.com|glassdoor\.com|getapp\.com|softwareadvice\.com)/i;
const URL_RE = /https?:\/\/[^\s)"']+/gi;
// Scheme-less host URLs (GLM cites these inline as "g2.com/products/x/reviews").
const BARE_HOST_RE = /\b((?:g2|capterra|reddit|trustpilot|glassdoor|getapp|softwareadvice|clay|attio|granola|spyfu|zoominfo|apollo|cognism|lusha|kaspr|fireflies|fathom|otter)\.[a-z]{2,}(?:\/[^\s)"']*)?)/gi;
const QUOTE_RE = /["“][^"”]{12,}["”]/g;
const NUMERIC_RE = /(\$[\d,.]+\s*(?:[a-z]+)?|\b\d[\d,.]*\s*(?:%|CPM|CPC|CAC|CPL|LTV|ROAS|x)\b|search\s*volume\b|monthly\s*volume\b)/gi;

interface TranscriptEntry {
  step: number;
  toolName: string;
  toolCallId: string;
  output: { url?: string; sourceUrl?: string; link?: string; markdown?: string; text?: string; content?: string; summary?: string } | null;
  isError: boolean;
}

function extractUrls(text: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_RE);
  while ((m = re.exec(text)) !== null) {
    out.push(m[0]);
  }
  const bare = new RegExp(BARE_HOST_RE);
  while ((m = bare.exec(text)) !== null) {
    out.push("https://" + m[1]);
  }
  return out;
}

function normalizeUrl(u: string): string {
  return u
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[.,;:!)]+$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

function normalizeUrlForMatch(u: string): string {
  // Drop query string + trailing slash so capterra.com/.../reviews/?page=2 and
  // capterra.com/.../reviews match as the same review page (anti-false-laundering).
  return normalizeUrl(u).split("?")[0];
}

function collectUrlsDeep(obj: unknown, set: Set<string>): void {
  if (obj === null || obj === undefined) return;
  if (typeof obj === "string") {
    const re = new RegExp(URL_RE);
    let m: RegExpExecArray | null;
    while ((m = re.exec(obj)) !== null) {
      set.add(normalizeUrlForMatch(m[0]));
    }
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectUrlsDeep(item, set);
    return;
  }
  if (typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) collectUrlsDeep(v, set);
  }
}

function transcriptUrls(transcript: TranscriptEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of transcript) {
    if (e.isError || !e.output) continue;
    collectUrlsDeep(e.output, set);
  }
  return set;
}

interface DeterministicResult {
  bodyUrls: string[];
  transcriptUrlSet: string[];
  launderedUrls: string[];
  quoteCount: number;
  reviewSiteUrlCount: number;
  numericClaimCount: number;
}

function deterministicLayer(body: string, transcript: TranscriptEntry[]): DeterministicResult {
  const bodyUrls = extractUrls(body).map(normalizeUrlForMatch);
  const tArr = transcriptUrls(transcript);
  const tSet = tArr;
  // A body URL is grounded if an exact match OR a transcript URL extends it
  // (GLM cites thread short-form reddit.com/r/x/comments/ID; transcript stores
  // the full slug reddit.com/r/x/comments/ID/thread-title). Also accept the
  // reverse (body cites a deeper page than the transcript root).
  function isGrounded(u: string): boolean {
    if (tSet.has(u)) return true;
    if (tSet.has(u.split("?")[0])) return true;
    for (const t of tSet) {
      if (t.startsWith(u + "/") || t.startsWith(u)) return true;
      if (u.startsWith(t + "/") || u.startsWith(t)) return true;
    }
    return false;
  }
  const laundered = bodyUrls.filter((u) => {
    if (isGrounded(u)) return false;
    const host = u.split("/")[0];
    // Competitor homepages cited as context (not as fetched evidence) are not
    // laundering — they're identity references, not quote attributions.
    if (host === "otter.ai" || host === "fireflies.ai" || host === "apollo.io" || host === "fathom.ai" || host === "zoominfo.com" || host === "cognism.com" || host === "lusha.com" || host === "kaspr.com") return false;
    if (host.endsWith("clay.com") || host.endsWith("attio.com") || host.endsWith("granola.ai")) return false;
    return true;
  });
  const quotes = body.match(QUOTE_RE) ?? [];
  const reviewUrls = new Set(bodyUrls.filter((u) => REVIEW_SITE_RE.test(u)));
  const numerics = body.match(NUMERIC_RE) ?? [];
  return {
    bodyUrls,
    transcriptUrlSet: tArr,
    launderedUrls: laundered,
    quoteCount: quotes.length,
    reviewSiteUrlCount: reviewUrls.size,
    numericClaimCount: numerics.length,
  };
}

const JUDGE_SYSTEM = `
You are a senior GTM strategist and paid-media buyer who bills clients for research deliverables. You are the VALUE-BAR judge. You read ONE research section and decide: "Would I bill this to a paying SaaS client?"

Your job is NOT to grade prose quality. It is to judge OPERATIONAL VALUE:
- Does this give a media buyer something they could act on Monday (real ad angles tied to specific buyer pains, real competitor weaknesses, real demand signals)?
- Are the quotes VERBATIM and attributed to live source URLs (not paraphrased filler)?
- Is there a SHARP, NON-OBVIOUS strategic read — not generic best-practice padding?
- Are numbers traceable (or honestly marked as gaps), not fabricated?
- For VoC: are there >=3 switching stories from INDEPENDENT reviews, real objections with how-to-handle, and success language?
- For Market: is there a falsifiable category power bet concrete enough to be wrong, and a TAM posture (not a fabricated $)?

Fabrication smells to flag:
- LAUNDERED QUOTES: a quote that looks real but is attributed to a URL that doesn't obviously host it.
- INVENTED NUMBERS: specific $/%/volume figures with no source anchor.
- INVENTED BIDDERS/competitors: named rivals with no evidence they exist in the market.

OUTPUT (fenced JSON only, no prose):
\`\`\`value-verdict
{
  "billable": true | false,
  "valueScore": <0-10 integer>,
  "valueRead": "<one sentence: the single sharpest actionable insight a media buyer gets, or 'none' if padding>",
  "fabricationSmells": ["<specific smell with the quote/number/url>", ...],
  "deckCellsFilled": ["<cell id like B5-quotes, B10-switching-stories, B13-falsifiable-claim>", ...],
  "wouldChangeBeforeBilling": ["<one-line fix>", ...]
}
\`\`\`
`.trim();

function parseVerdict(text: string): Record<string, unknown> | null {
  const fence = /```value-verdict\s*([\s\S]*?)```/i.exec(text);
  const json = /```json\s*([\s\S]*?)```/i.exec(text);
  const raw = (fence?.[1] ?? json?.[1] ?? "").trim();
  if (raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function judgeLayer(subject: string, section: string, body: string): Promise<Record<string, unknown> | null> {
  const userPrompt = [
    `SUBJECT: ${subject}`,
    `SECTION: ${section}`,
    "",
    "RESEARCH SECTION BODY (the deliverable a media buyer would receive):",
    "```",
    body,
    "```",
    "",
    "Apply the value bar. Emit the fenced value-verdict JSON only.",
  ].join("\n");
  const result = await generateText({
    model: glm(modelId),
    system: JUDGE_SYSTEM,
    prompt: userPrompt,
    maxOutputTokens: 2000,
  });
  return parseVerdict(result.text);
}

interface SectionVerdict {
  subject: string;
  section: string;
  deterministic: DeterministicResult;
  judge: Record<string, unknown> | null;
  pass: boolean;
  passReason: string;
}

async function runOne(subject: string, section: string): Promise<SectionVerdict> {
  const bodyPath = join(process.cwd(), "tmp", "zz-agentic-glm", subject, section, "body.md");
  const transPath = join(process.cwd(), "tmp", "zz-agentic-glm", subject, section, "transcript.json");
  if (!existsSync(bodyPath) || !existsSync(transPath)) {
    throw new Error(`missing outputs for ${subject}/${section} at ${bodyPath}`);
  }
  const body = await readFile(bodyPath, "utf8");
  const transcript: TranscriptEntry[] = JSON.parse(await readFile(transPath, "utf8"));

  const det = deterministicLayer(body, transcript);
  const judge = await judgeLayer(subject, section, body);

  const launderedFail = det.launderedUrls.length > 0;
  const judgeScore = typeof judge?.valueScore === "number" ? judge.valueScore : (typeof judge?.valueScore === "string" ? Number(judge.valueScore) : 0);
  const judgeBillable = judge?.billable === true;
  const valueFail = judgeScore < 8 || !judgeBillable;

  let passReason: string;
  let pass: boolean;
  if (launderedFail && valueFail) {
    pass = false;
    passReason = `FAIL: ${det.launderedUrls.length} laundered URL(s) AND judge valueScore=${judgeScore}/billable=${judgeBillable}`;
  } else if (launderedFail) {
    pass = false;
    passReason = `FAIL: ${det.launderedUrls.length} laundered URL(s) [${det.launderedUrls.slice(0, 3).join(", ")}] — quote-at-URL violation`;
  } else if (valueFail) {
    pass = false;
    passReason = `FAIL: judge valueScore=${judgeScore}/billable=${judgeBillable} (below value bar of 8)`;
  } else {
    pass = true;
    passReason = `PASS: URLs clean (${det.launderedUrls.length} laundered), judge valueScore=${judgeScore} billable=true`;
  }

  return { subject, section, deterministic: det, judge, pass, passReason };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outRoot = join(process.cwd(), "tmp", "zz-value-bar");
  await mkdir(outRoot, { recursive: true });

  const targets: Array<[string, string]> = [];
  if (args[0] === "--all") {
    for (const subject of ["clay", "attio", "granola"]) {
      for (const section of ["voc", "market"]) {
        const p = join(process.cwd(), "tmp", "zz-agentic-glm", subject, section, "body.md");
        if (existsSync(p)) targets.push([subject, section]);
      }
    }
  } else {
    const [subject, section] = args;
    if (!subject || !section) {
      console.error("usage: npx tsx scripts/zz-value-bar-agent.ts <subject> <section>   |   --all");
      process.exit(2);
    }
    targets.push([subject, section]);
  }

  const verdicts: SectionVerdict[] = [];
  for (const [subject, section] of targets) {
    console.log(`\n[value-bar] judging ${subject}/${section} ...`);
    const v = await runOne(subject, section);
    verdicts.push(v);
    const outDir = join(outRoot, subject);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, `${section}.json`), JSON.stringify(v, null, 2));
    console.log(`  deterministic: quotes=${v.deterministic.quoteCount} reviewUrls=${v.deterministic.reviewSiteUrlCount} numerics=${v.deterministic.numericClaimCount} laundered=${v.deterministic.launderedUrls.length}`);
    console.log(`  judge: ${JSON.stringify(v.judge ?? { error: "null" }).slice(0, 300)}`);
    console.log(`  verdict: ${v.passReason}`);
  }

  const passCount = verdicts.filter((v) => v.pass).length;
  console.log(`\n===== VALUE-BAR SUMMARY: ${passCount}/${verdicts.length} sections PASSED =====`);
  for (const v of verdicts) {
    console.log(`  ${v.pass ? "PASS" : "FAIL"}  ${v.subject}/${v.section}  —  ${v.passReason}`);
  }
}

main().catch((e) => {
  console.error("[fatal]", e?.message ?? e);
  process.exit(1);
});