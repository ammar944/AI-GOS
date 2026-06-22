#!/usr/bin/env tsx
/**
 * zz-agentic-section.ts — PROOF HARNESS (throwaway).
 *
 * Runs GLM-5.2 (via the user's Ollama) in an AGENTIC tool-loop to write ONE GTM
 * positioning section for Ramp as FREE PROSE (markdown), grounding every
 * load-bearing number / quote / URL in a real tool result or a real corpus
 * excerpt. The whole point of the test: the frozen corpus has review-site
 * SUMMARIES but NO verbatim quotes and ZERO CPC/search-volume numbers — so VoC
 * must live-fetch real quotes and Demand must call the keyword tools for every
 * numeric, or honestly declare a gap. Fabrication is the cardinal sin.
 *
 * Usage:
 *   npx tsx scripts/zz-agentic-section.ts voc
 *   npx tsx scripts/zz-agentic-section.ts demand
 *
 * Outputs (per run) → tmp/zz-agentic-glm/<section>/
 *   - body.md         GLM's final section prose
 *   - transcript.json full tool trail for the downstream floor audit
 *   - meta.json       run metadata (model, finishReason, steps, usage, timing)
 *
 * Provider wiring is copied verbatim from tmp/zz-glm-ollama-tool-probe.ts
 * (proven 2026-06-22). Tools are imported straight from the app catalog — they
 * are plain AI SDK Tool objects, no runId/factStore needed. Import style is
 * relative (../src/...) to mirror scripts/zz-build-ramp-research-input.ts, which
 * runs under plain `npx tsx`.
 *
 * Live endpoint may return 403 (Ollama Cloud auth lapsed). That is the PASS
 * condition for offline build verification: it proves wiring + imports + corpus
 * load all work and only auth is missing. The moment auth is green, the SAME
 * command does a real run and writes the 3 files — no code change needed.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd()); // pulls OLLAMA_API_KEY etc. from .env.local; never read directly

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, stepCountIs } from "ai";

import { TOOL_CATALOG } from "../src/lib/lab-engine/agents/tools/index";

// ---------------------------------------------------------------------------
// Provider (verbatim from the proven probe)
// ---------------------------------------------------------------------------
const baseURL = process.env.DEEPSEEK_OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const modelId = process.env.DEEPSEEK_OLLAMA_MODEL_ID ?? "glm-5.2:cloud";
const ollama = createOpenAICompatible({
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama", // localhost proxies cloud via CLI auth
  baseURL,
  name: "ollama",
});

const CORPUS_PATH = "tmp/zz-section-out/ramp-research-input.json";
const OUT_ROOT = "tmp/zz-agentic-glm";
const MAX_STEPS = 14; // bounded; do not raise above ~16

type Section = "voc" | "demand";

interface Excerpt {
  id: string;
  sourceUrl: string;
  title: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Grounding law — shared across both sections (the thin floor, stated up front)
// ---------------------------------------------------------------------------
const GROUNDING_LAW = `
GROUNDING LAW (read this first — it is non-negotiable):
- Every load-bearing NUMBER, customer QUOTE, and competitor/URL CLAIM you state as fact MUST trace to a tool result you actually received in this session, or to a corpus excerpt you were given below. If you did not fetch it, you may NOT state it as fact.
- Inline-attribute every load-bearing claim with its source URL, e.g. "(g2.com/products/ramp/reviews)".
- A tool that returns { "type": "gap", ... } means NO DATA is available for that call (missing credential, rate limit, content unavailable, etc.). Do NOT invent the answer. Either try a different query/tool, or write that point as an explicit honest gap: "Not available from sources searched: <what>."
- Honest gaps are GOOD. Fabrication — inventing a quote, a number, a reviewer name, a CPC, or a URL you did not actually retrieve — is the CARDINAL SIN. This drives a real ad budget; a confident wrong number costs the user money.
- Research FREELY with the tools before you write. Prefer real, sourced evidence over generic best-practice filler.
- Write the FINAL section as clean, readable PROSE / markdown for a media buyer: a sharp lead insight first, then the supporting analysis they could act on Monday. No JSON, no schema fields, no apology framing, no meta-commentary about your process.
`.trim();

// ---------------------------------------------------------------------------
// Section configs: tool subset + system prompt + section-specific goal
// ---------------------------------------------------------------------------
function toolsFor(section: Section) {
  if (section === "voc") {
    return {
      web_search: TOOL_CATALOG.web_search,
      firecrawl: TOOL_CATALOG.firecrawl,
      reviews: TOOL_CATALOG.reviews,
      perplexity_research: TOOL_CATALOG.perplexity_research,
    };
  }
  return {
    web_search: TOOL_CATALOG.web_search,
    perplexity_research: TOOL_CATALOG.perplexity_research,
    keyword_discovery: TOOL_CATALOG.keyword_discovery,
    keyword_volume: TOOL_CATALOG.keyword_volume,
  };
}

function systemPromptFor(section: Section): string {
  const role = `You are a world-class GTM strategist and direct-response media buyer. You are writing ONE positioning section about Ramp (https://ramp.com/ — corporate cards + spend-management software) for an audience of a media buyer who is about to build paid campaigns aimed at Ramp's finance buyer (CFO / controller / AP manager).`;

  if (section === "voc") {
    return [
      role,
      GROUNDING_LAW,
      `
SECTION: Voice of the Customer.
Your job: synthesize the REAL voice of Ramp's customers — the actual pains, switching triggers, objections, and success language they express in THEIR OWN WORDS — and turn it into ad-angle guidance a buyer can use.

How to research:
- The corpus excerpts below are review-site SUMMARIES, not verbatim quotes. They are useful for orientation, but they are NOT a substitute for real customer language. You MUST go fetch actual verbatim quotes.
- Use the "reviews" tool with mode:"bodies" to pull verbatim review text: reviews({ brand: "Ramp", mode: "bodies", max_results: 8, max_body_pages: 3 }). mode:"snippets" only gives short SERP snippets; mode:"bodies" gives the real review prose.
- Use "perplexity_research" for verbatim buyer pain/success quotes from sites that block scraping (G2, Capterra, Reddit). Always disambiguate: ask about "Ramp (ramp.com), the corporate card and spend-management platform" — never a bare brand name. Ask explicitly for verbatim quotes WITH their source URLs and the reviewer's role.
- Use "web_search" / "firecrawl" to find and read specific review pages or comparison threads.

What to deliver (prose):
1. Lead insight: the single sharpest thing the voice-of-customer data reveals about why finance teams choose / leave / love / distrust Ramp.
2. The real pains in customers' words (attributed quotes), the switching triggers (what made them leave their old tool), the live objections, and the success language they use once it works.
3. Translate that into 3-5 concrete ad angles / hooks a media buyer could test, each tied to the specific quote or pain it exploits.
Attribute every quote to a real source URL you fetched. If you cannot find verbatim quotes, say so honestly rather than paraphrasing the summaries as if they were quotes.
`.trim(),
    ].join("\n\n");
  }

  // demand
  return [
    role,
    GROUNDING_LAW,
    `
SECTION: Demand & Intent.
Your job: map the REAL search demand and buying intent around Ramp — the actual keywords its buyers search, with REAL monthly search volume and CPC, the intent tiers, and what that means for paid strategy.

How to research:
- The corpus excerpts below contain ZERO search-volume and ZERO CPC numbers. Every numeric in your section MUST come from a tool call. Do not estimate volumes or CPCs from memory.
- Use "keyword_discovery" to FIND the queries Ramp's buyers actually search: keyword_discovery({ domain: "ramp.com" }) to surface what ramp.com ranks/bids on, and/or keyword_discovery({ seed: "corporate card" }) to expand a seed. You must pass domain OR seed.
- Use "keyword_volume" to put a falsifiable number on a known list: keyword_volume({ keywords: ["corporate card", "expense management software", ...] }). It returns rows with searchVolume, cpc (NULLABLE — render a null cpc as "n/a", NEVER as $0 or "cheap"), difficulty, and a per-keyword sourceUrl (a spyfu.com/keyword/overview permalink). Cite each row with its OWN sourceUrl and copy the row's display formatting. Values are SpyFu ESTIMATES — label them as such.
- Use "perplexity_research" / "web_search" for qualitative intent context (e.g. what triggers a "corporate card" search), but ALL volume/CPC figures must come from the keyword tools.

What to deliver (prose):
1. Lead insight: the single sharpest thing the demand data reveals about where Ramp's paid budget should go.
2. The keyword landscape grouped by intent tier (high-intent / category / competitor / problem-aware), each keyword with its REAL SpyFu volume + CPC + the spyfu permalink, n/a where SpyFu has no CPC.
3. What that means for paid strategy: where the cheap-and-high-intent pockets are, where CPCs are punishing, and the 3-5 keyword clusters a buyer should fund first.
Every number must be traceable to a keyword tool call. If a tool returns a gap, name the gap — do not fill it with a guessed number.
`.trim(),
  ].join("\n\n");
}

// ---------------------------------------------------------------------------
// Corpus grounding text injected into the user prompt
// ---------------------------------------------------------------------------
function buildGroundingText(corpus: any, excerpts: Excerpt[]): string {
  const c = corpus.company ?? {};
  const o = corpus.onboarding ?? {};
  const fmt = (v: unknown) =>
    v === undefined || v === null
      ? "(not provided)"
      : Array.isArray(v)
        ? v.join("; ")
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);

  const companyBlock = [
    `Name: ${fmt(c.name)}`,
    `Website: ${fmt(c.websiteUrl)}`,
    `Category: ${fmt(c.category)}`,
    `Stage: ${fmt(c.stage)}`,
    `Target customer: ${fmt(c.targetCustomer)}`,
    `Description: ${fmt(c.description)}`,
  ].join("\n");

  const onboardingBlock = [
    `Primary goal: ${fmt(o.primaryGoal)}`,
    `Target segments: ${fmt(o.targetSegments)}`,
    `Key offers: ${fmt(o.keyOffers)}`,
    `Distribution channels: ${fmt(o.distributionChannels)}`,
    `GTM motion: ${fmt(o.gtmMotion)}`,
    `Economics: ${fmt(o.economics)}`,
  ].join("\n");

  const excerptBlock = excerpts
    .map(
      (e, i) =>
        `[${i + 1}] (${e.sourceUrl})\n${e.title ? e.title + " — " : ""}${(e.text ?? "").trim()}`,
    )
    .join("\n\n");

  return [
    "## COMPANY (from corpus)",
    companyBlock,
    "",
    "## ONBOARDING BRIEF (operator-confirmed)",
    onboardingBlock,
    "",
    `## PRE-ROUTED CORPUS EXCERPTS for this section (${excerpts.length}). These are background/orientation. Cite their sourceUrl when you use a fact from them; they are NOT verbatim customer quotes and contain NO live volume/CPC numbers — fetch those with the tools.`,
    excerptBlock,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Transcript capture — join tool calls to their results by toolCallId
// ---------------------------------------------------------------------------
function buildTranscript(steps: any[]) {
  const out: Array<{
    step: number;
    toolName: string;
    toolCallId: string;
    input: unknown;
    output: unknown;
    isError: boolean;
  }> = [];
  steps.forEach((step, stepIdx) => {
    const calls = step.toolCalls ?? [];
    const results = step.toolResults ?? [];
    const resultById = new Map<string, any>();
    for (const r of results) resultById.set(r.toolCallId, r);
    for (const call of calls) {
      const r = resultById.get(call.toolCallId);
      out.push({
        step: stepIdx,
        toolName: call.toolName,
        toolCallId: call.toolCallId,
        input: call.input,
        output: r ? (r.type === "tool-error" ? { error: String(r.error) } : r.output) : null,
        isError: r ? r.type === "tool-error" : false,
      });
    }
  });
  return out;
}

function countByName(transcript: ReturnType<typeof buildTranscript>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of transcript) counts[t.toolName] = (counts[t.toolName] ?? 0) + 1;
  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const arg = (process.argv[2] ?? "").toLowerCase();
  if (arg !== "voc" && arg !== "demand") {
    console.error("usage: npx tsx scripts/zz-agentic-section.ts <voc|demand>");
    process.exit(2);
  }
  const section = arg as Section;

  // Load + assemble grounding (this validates corpus load + prompt assembly
  // even when the live model call 403s).
  const corpus = JSON.parse(await readFile(CORPUS_PATH, "utf8"));
  const excerptKey =
    section === "voc" ? "positioningVoiceOfCustomer" : "positioningDemandIntent";
  const excerpts: Excerpt[] = corpus?.corpus?.sectionExcerpts?.[excerptKey] ?? [];

  const tools = toolsFor(section);
  const system = systemPromptFor(section);
  const grounding = buildGroundingText(corpus, excerpts);
  const prompt = [
    `Write the ${section === "voc" ? "Voice of the Customer" : "Demand & Intent"} section for Ramp.`,
    "Research first with the tools, then write. Here is your grounding context:",
    "",
    grounding,
  ].join("\n");

  console.log(
    `[setup] section=${section} model=${modelId} baseURL=${baseURL} tools=${Object.keys(tools).join(",")} excerpts=${excerpts.length} promptChars=${prompt.length}`,
  );

  const outDir = `${OUT_ROOT}/${section}`;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: ollama(modelId),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      system,
      prompt,
    });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const status = e?.statusCode ?? e?.status ?? (msg.match(/\b(40\d|429|5\d\d)\b/)?.[1] ?? "");
    if (/403|forbidden/i.test(msg) || status === "403") {
      console.log(
        `[build-ok] wiring reaches Ollama; got ${status || "403"} Forbidden — awaiting auth refresh for live run.`,
      );
      console.log(
        `[build-ok] section=${section} assembled tools=${Object.keys(tools).join(",")} excerpts=${excerpts.length} promptChars=${prompt.length} — corpus load + prompt assembly OK.`,
      );
      process.exit(0);
    }
    // Any other failure (incl. localhost-down / 401) — surface, but still exit
    // nonzero so it is not mistaken for a clean live run.
    console.error(`[error] generateText failed: status=${status || "?"} msg=${msg}`);
    if (/api key|unauthor|401|connect|ECONN|fetch failed/i.test(msg)) {
      console.error(
        "[hint] auth/connection: ensure the Ollama daemon is running and signed in (glm-5.2:cloud pulled), or set OLLAMA_API_KEY in .env.local for the hosted endpoint.",
      );
    }
    process.exit(1);
  }

  // ---- Live run succeeded: write the three outputs ----
  const durationMs = Date.now() - t0;
  const steps = result.steps ?? [];
  const transcript = buildTranscript(steps as any[]);
  const totalToolCalls = countByName(transcript);
  const toolCallCount = transcript.length;

  const meta = {
    section,
    model: modelId,
    baseURL,
    finishReason: result.finishReason,
    steps: steps.length,
    toolCallCount,
    totalToolCalls,
    usage: result.usage,
    startedAt,
    durationMs,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/body.md`, result.text ?? "");
  await writeFile(`${outDir}/transcript.json`, JSON.stringify(transcript, null, 2));
  await writeFile(`${outDir}/meta.json`, JSON.stringify(meta, null, 2));

  console.log("\n========== LIVE RUN COMPLETE ==========");
  console.log(`section:       ${section}`);
  console.log(`model:         ${modelId}`);
  console.log(`finishReason:  ${result.finishReason}`);
  console.log(`steps:         ${steps.length}`);
  console.log(`tool calls:    ${toolCallCount}  ${JSON.stringify(totalToolCalls)}`);
  console.log(`usage:         ${JSON.stringify(result.usage)}`);
  console.log(`duration:      ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`body chars:    ${(result.text ?? "").length}`);
  console.log(`outputs ->     ${outDir}/{body.md,transcript.json,meta.json}`);
}

main().catch((e) => {
  console.error("[fatal]", e?.message ?? e);
  process.exit(1);
});
