#!/usr/bin/env tsx
/**
 * zz-agentic-section.ts — PROOF HARNESS (throwaway), GENERALIZED to all 7 sections.
 *
 * Runs GLM-5.2 (via the user's Ollama) in an AGENTIC tool-loop to write ONE GTM
 * positioning section for ANY subject as FREE PROSE (markdown), grounding every
 * load-bearing number / quote / URL in a real tool result or a real corpus
 * excerpt. The whole point of the test: the frozen corpus has review-site
 * SUMMARIES but NO verbatim quotes and ZERO CPC/search-volume numbers — so VoC
 * must live-fetch real quotes and Demand must call the keyword tools for every
 * numeric, or honestly declare a gap. Fabrication is the cardinal sin.
 *
 * Sections supported (short name → positioning id):
 *   voc        → positioningVoiceOfCustomer
 *   demand     → positioningDemandIntent
 *   market     → positioningMarketCategory
 *   buyer      → positioningBuyerICP
 *   competitor → positioningCompetitorLandscape
 *   offer      → positioningOfferDiagnostic
 *   paidmedia  → positioningPaidMediaPlan   (synthesis: reads the other 6 body.md)
 *
 * Usage:
 *   npx tsx scripts/zz-agentic-section.ts voc
 *   npx tsx scripts/zz-agentic-section.ts demand --dry
 *   npx tsx scripts/zz-agentic-section.ts market --corpus tmp/zz-section-out/acme-research-input.json
 *   npx tsx scripts/zz-agentic-section.ts paidmedia --subject acme
 *
 * Flags:
 *   --dry              Load corpus + assemble (system, prompt, tools), print a
 *                      summary, then EXIT 0 BEFORE any generateText() call. Costs $0.
 *   --corpus <path>    Point at any subject's research-input JSON.
 *                      Default: tmp/zz-section-out/ramp-research-input.json
 *   --subject <slug>   Explicit output-dir slug override (else derived from corpus).
 *
 * Outputs (per run) → tmp/zz-agentic-glm/<subjectSlug>/<section>/
 *   (Ramp-default corpus with no --subject stays at the legacy tmp/zz-agentic-glm/<section>/)
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
import { dirname } from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd()); // pulls OLLAMA_API_KEY etc. from .env.local; never read directly

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, stepCountIs } from "ai";

import { TOOL_CATALOG } from "../src/lib/lab-engine/agents/tools/index";
import { getAgenticGLMModel } from "../src/lib/lab-engine/ai/models";

// ---------------------------------------------------------------------------
// Provider (verbatim from the proven probe)
// ---------------------------------------------------------------------------
// FAITHFUL OpenRouter path: use the APP's real model resolver
// (getAgenticGLMModel → createGLMSelection → @ai-sdk/openai-compatible against
// GLM_BASE_URL/GLM_MODEL_ID/GLM_API_KEY = OpenRouter z-ai/glm-5.2 in prod).
// NOT the localhost Ollama shortcut — this exercises the same wiring the app uses.
const baseURL = process.env.GLM_BASE_URL ?? "http://localhost:11434/v1";
const modelId = process.env.GLM_MODEL_ID ?? "glm-5.2:cloud";
const sectionModel = getAgenticGLMModel(process.env);

const DEFAULT_CORPUS_PATH = "tmp/zz-section-out/ramp-research-input.json";
const OUT_ROOT = "tmp/zz-agentic-glm";
const MAX_STEPS = 16; // bounded; do not raise above ~16

// ---------------------------------------------------------------------------
// Section identity: short name <-> positioning id, excerpt key, title, label.
// ---------------------------------------------------------------------------
type Section =
  | "voc"
  | "demand"
  | "market"
  | "buyer"
  | "competitor"
  | "offer"
  | "paidmedia";

interface SectionMeta {
  positioningId: string; // section-registry id
  excerptKey: string; // corpus.corpus.sectionExcerpts key
  title: string; // human title for the prompt header
}

const SECTION_META: Record<Section, SectionMeta> = {
  voc: {
    positioningId: "positioningVoiceOfCustomer",
    excerptKey: "positioningVoiceOfCustomer",
    title: "Voice of the Customer",
  },
  demand: {
    positioningId: "positioningDemandIntent",
    excerptKey: "positioningDemandIntent",
    title: "Demand & Intent",
  },
  market: {
    positioningId: "positioningMarketCategory",
    excerptKey: "positioningMarketCategory",
    title: "Market & Category Intelligence",
  },
  buyer: {
    positioningId: "positioningBuyerICP",
    excerptKey: "positioningBuyerICP",
    title: "Buyer & ICP Validation",
  },
  competitor: {
    positioningId: "positioningCompetitorLandscape",
    excerptKey: "positioningCompetitorLandscape",
    title: "Competitor Landscape & Positioning",
  },
  offer: {
    positioningId: "positioningOfferDiagnostic",
    excerptKey: "positioningOfferDiagnostic",
    title: "Offer & Performance Diagnostic",
  },
  paidmedia: {
    positioningId: "positioningPaidMediaPlan",
    excerptKey: "positioningPaidMediaPlan",
    title: "Paid Media Plan",
  },
};

const SECTION_ALIASES: Record<string, Section> = {
  voc: "voc",
  demand: "demand",
  market: "market",
  buyer: "buyer",
  competitor: "competitor",
  offer: "offer",
  paidmedia: "paidmedia",
};

// Short name of each section, used to read upstream body.md for paidmedia.
const UPSTREAM_SECTIONS: Section[] = [
  "market",
  "buyer",
  "competitor",
  "voc",
  "demand",
  "offer",
];

interface Excerpt {
  id: string;
  sourceUrl: string;
  title: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Grounding law — shared across ALL sections (the thin floor, stated up front)
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

// A shared anti-leakage warning. Each section appends its own concrete motifs.
function antiLeakClause(motifs: string[]): string {
  return [
    `ANTI-LEAKAGE: Do NOT copy any domain content from worked examples, templates, or other subjects into THIS subject's output. The following are framework VOCABULARY/PLACEHOLDERS, not facts about this subject — never assert them as if they were researched here unless THIS run's evidence supports them:`,
    ...motifs.map((m) => `  - ${m}`),
    `Any named mechanism, competitor, axis label, pricing tier, persona role, complaint theme, or numeric anchor must be earned from THIS run's tools or corpus excerpts, never imported.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Section configs: tool subset (MUST be a subset of section-registry allowedTools)
// ---------------------------------------------------------------------------
//
// section-registry allowedTools (authoritative):
//   positioningMarketCategory:     web_search, firecrawl, keyword_volume, perplexity_research
//   positioningCompetitorLandscape: web_search, firecrawl, adlibrary, google_ads, meta_ads, linkedin_ads, reviews
//   positioningBuyerICP:           web_search, firecrawl, perplexity_research
//   positioningVoiceOfCustomer:    web_search, reviews, firecrawl, perplexity_research
//   positioningDemandIntent:       web_search, keyword_ad_probe, keyword_volume, keyword_trends, keyword_discovery, firecrawl, perplexity_research
//   positioningOfferDiagnostic:    web_search, firecrawl, pagespeed
//   positioningPaidMediaPlan:      keyword_ad_probe
function toolsFor(section: Section) {
  switch (section) {
    case "voc":
      return {
        web_search: TOOL_CATALOG.web_search,
        firecrawl: TOOL_CATALOG.firecrawl,
        reviews: TOOL_CATALOG.reviews,
        perplexity_research: TOOL_CATALOG.perplexity_research,
      };
    case "demand":
      return {
        web_search: TOOL_CATALOG.web_search,
        perplexity_research: TOOL_CATALOG.perplexity_research,
        keyword_discovery: TOOL_CATALOG.keyword_discovery,
        keyword_volume: TOOL_CATALOG.keyword_volume,
      };
    case "market":
      // subset of [web_search, firecrawl, keyword_volume, perplexity_research]
      return {
        web_search: TOOL_CATALOG.web_search,
        firecrawl: TOOL_CATALOG.firecrawl,
        keyword_volume: TOOL_CATALOG.keyword_volume,
        perplexity_research: TOOL_CATALOG.perplexity_research,
      };
    case "buyer":
      // subset of [web_search, firecrawl, perplexity_research]
      return {
        web_search: TOOL_CATALOG.web_search,
        firecrawl: TOOL_CATALOG.firecrawl,
        perplexity_research: TOOL_CATALOG.perplexity_research,
      };
    case "competitor":
      // subset of [web_search, firecrawl, adlibrary, google_ads, meta_ads, linkedin_ads, reviews]
      return {
        web_search: TOOL_CATALOG.web_search,
        firecrawl: TOOL_CATALOG.firecrawl,
        reviews: TOOL_CATALOG.reviews,
        adlibrary: TOOL_CATALOG.adlibrary,
      };
    case "offer":
      // subset of [web_search, firecrawl, pagespeed]
      return {
        web_search: TOOL_CATALOG.web_search,
        firecrawl: TOOL_CATALOG.firecrawl,
        pagespeed: TOOL_CATALOG.pagespeed,
      };
    case "paidmedia":
      // subset of [keyword_ad_probe] — synthesis mode
      return {
        keyword_ad_probe: TOOL_CATALOG.keyword_ad_probe,
      };
  }
}

// ---------------------------------------------------------------------------
// System prompts — each carries the section's SKILL framework lens + what to
// deliver + the SAME GROUNDING_LAW + a section-specific anti-leakage clause.
// ---------------------------------------------------------------------------
function roleLine(companyName: string, companyDesc: string, websiteUrl: string): string {
  const subject = websiteUrl ? `${companyName} (${websiteUrl}${companyDesc ? ` — ${companyDesc}` : ""})` : companyName;
  return `You are a world-class GTM strategist and direct-response media buyer. You are writing ONE positioning section about ${subject} for an audience of a media buyer who is about to build paid campaigns aimed at the subject's core buyer.`;
}

function systemPromptFor(
  section: Section,
  ctx: { companyName: string; companyDesc: string; websiteUrl: string; upstreamNote?: string },
): string {
  const role = roleLine(ctx.companyName, ctx.companyDesc, ctx.websiteUrl);
  const C = ctx.companyName || "the subject";

  switch (section) {
    // ---- VoC: CATEGORY-VOICE PRIMARY (competitors' customers + category buyer discussion); subject-own folded in as a labeled bonus layer ----
    case "voc":
      return [
        role,
        GROUNDING_LAW,
        `
SECTION: Voice of the Customer.
Your PRIMARY job: synthesize the REAL voice of customers IN THIS CATEGORY — the actual pains, switching triggers, objections, and success language buyers express in THEIR OWN WORDS — sourced PRIMARILY from ${C}'s named COMPETITORS' customer reviews and from category buyer discussion. ${C} may be EARLY-STAGE with few or NO customers of its own — that is EXPECTED, not a failure. The durable, actionable insight for a founder with zero customers is what buyers IN THE CATEGORY say about the tools they already use. Then turn it into ad-angle guidance a buyer for ${C} can act on Monday.

How to research:
- IDENTIFY THE COMPETITORS FIRST. Pull candidate competitor brands from the corpus excerpts below (look for any competitorSeeds / named rivals / "alternatives to" mentions). Expand the set with "web_search" / "perplexity_research" (e.g. "alternatives to ${C}", "best <category> tools"). DISAMBIGUATE every brand to the exact company before you cite it — never a bare ambiguous token. Write it as name + domain + one-line category, e.g. "Plain (plain.com), the API-first B2B support tool", not just "Plain".
- MINE COMPETITORS' CUSTOMER REVIEWS (the primary source). For EACH named competitor, call the "reviews" tool with mode:"bodies" to pull verbatim review text: reviews({ brand: "<competitor name + disambiguator>", mode: "bodies", max_results: 8, max_body_pages: 3 }). mode:"snippets" only gives short SERP snippets; mode:"bodies" gives the real review prose.
- MINE CATEGORY BUYER DISCUSSION. Use "perplexity_research" for verbatim category buyer pains / switching stories / objections on scrape-blocked sites (G2, Capterra, Reddit). Always disambiguate: ask about the EXACT product/category (name + website + one-line category) — never a bare brand name. Ask explicitly for verbatim quotes WITH their source URLs and the reviewer's role.
- FOLD IN SUBJECT-OWN VOICE IF IT EXISTS (a labeled bonus layer, not the spine). If ${C} actually has its own customer reviews/testimonials, mine them too — reviews({ brand: "${C}", mode: "bodies", ... }) and web_search / firecrawl on its case-study / testimonial pages — and present them as a SEPARATE, clearly labeled layer. If ${C} has no admissible own customer voice, say so plainly and lean entirely on category/competitor voice; that is the normal pre-launch case.
- Use "web_search" / "firecrawl" to find and read specific review pages or comparison threads.

ATTRIBUTION (mandatory): every quote and every pain MUST be labeled with WHOSE customer it is — "competitor-<name>", "subject's own", or "category discussion" — AND carry its source URL. A media buyer must be able to see at a glance whether a pain comes from a rival's user base or from ${C}'s own users. Keep the GROUNDING LAW intact: no fabricated quotes, reviewer names, or URLs; honest gaps beat invented quotes.

What to deliver (prose):
1. Lead insight: the single sharpest thing the category's voice-of-customer data reveals about why buyers in this category choose / leave / love / distrust the tools they use — and the opening it creates for ${C}.
2. The real pains in category buyers' words (attributed quotes, each tagged with whose customer it is + source URL), the switching triggers (what made them leave their old tool), the live objections, and the success language they use once it works. Where ${C} has its own customer voice, present it as a clearly labeled bonus layer alongside the category voice.
3. Translate that into 3-5 concrete ad angles / hooks a media buyer for ${C} could test, each tied to the SPECIFIC competitor-customer pain (or category pain) it exploits — name the pain and the competitor whose customers expressed it. The output must be insight a pre-launch founder can act on with zero customers of their own.
Attribute every quote to a real source URL you fetched, tagged with whose customer it is. If you cannot find verbatim quotes, say so honestly rather than paraphrasing summaries as if they were quotes.
`.trim(),
      ].join("\n\n");

    // ---- Demand: PRESERVED EXACTLY (templatized only the brand name) ----
    case "demand":
      return [
        role,
        GROUNDING_LAW,
        `
SECTION: Demand & Intent.
Your job: map the REAL search demand and buying intent around ${C} — the actual keywords its buyers search, with REAL monthly search volume and CPC, the intent tiers, and what that means for paid strategy.

How to research:
- The corpus excerpts below contain ZERO search-volume and ZERO CPC numbers. Every numeric in your section MUST come from a tool call. Do not estimate volumes or CPCs from memory.
- Use "keyword_discovery" to FIND the queries ${C}'s buyers actually search: keyword_discovery({ domain: "${ctx.websiteUrl ? ctx.websiteUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : "example.com"}" }) to surface what the domain ranks/bids on, and/or keyword_discovery({ seed: "<category seed>" }) to expand a seed. You must pass domain OR seed.
- Use "keyword_volume" to put a falsifiable number on a known list: keyword_volume({ keywords: ["<keyword 1>", "<keyword 2>", ...] }). It returns rows with searchVolume, cpc (NULLABLE — render a null cpc as "n/a", NEVER as $0 or "cheap"), difficulty, and a per-keyword sourceUrl (a spyfu.com/keyword/overview permalink). Cite each row with its OWN sourceUrl and copy the row's display formatting. Values are SpyFu ESTIMATES — label them as such.
- Use "perplexity_research" / "web_search" for qualitative intent context (e.g. what triggers a category search), but ALL volume/CPC figures must come from the keyword tools.

What to deliver (prose):
1. Lead insight: the single sharpest thing the demand data reveals about where ${C}'s paid budget should go.
2. The keyword landscape grouped by intent tier (high-intent / category / competitor / problem-aware), each keyword with its REAL SpyFu volume + CPC + the spyfu permalink, n/a where SpyFu has no CPC.
3. What that means for paid strategy: where the cheap-and-high-intent pockets are, where CPCs are punishing, and the 3-5 keyword clusters a buyer should fund first.
Every number must be traceable to a keyword tool call. If a tool returns a gap, name the gap — do not fill it with a guessed number.
`.trim(),
      ].join("\n\n");

    // ---- Market & Category Intelligence ----
    case "market":
      return [
        role,
        GROUNDING_LAW,
        antiLeakClause([
          "Analyst keywords: 'TAM', 'serviceable addressable market', 'market maturity', 'competitive intensity' — frame vocabulary, not facts about this subject.",
          "Coined phrases: 'structural shift', 'category power bet', 'white-space opening', 'shelves', 'reframe' — positioning vocabulary; earn the specific claim, do not import the phrase as if proven.",
          "Numeric anchors like '3-5 year growth trajectory' or named 'category maturity stages' — never copy a number/phase from another market as a template.",
          "Buyer role labels (e.g. 'Chief Technology Officer' vs 'Head of Platform Engineering') are domain-specific — use the exact roles THIS subject's buyers hold, not a genericized title.",
        ]),
        `
SECTION: Market & Category Intelligence.
Your job (April Dunford derivation order): name the category frame ${C} should ENTER or DEFEND, show the derivation chain (alternatives first → unique attributes → value → buyer segment → category frame), and price the cost of that call.

Framework lens:
- Lead with the ASYMMETRY: open with the single non-obvious strategic read about this market — the structural shift, the "why now" a smart operator would not already know. If you have no non-obvious read, say what missing signal would unlock one rather than padding with an obvious description.
- Adjacent confusion must be MINED from evidence (buyer-language search results, review/forum phrasing, the subject's own positioning pages), never asserted.
- Compete-vs-create: derive the call from root truths and pressure-test it against what would make the chosen shelf WRONG.
- Bottom-up TAM is a posture, not a single figure: monthly keyword volume × 12 × commercial-intent-share × conversion × ACV. Use keyword_volume to ground the demand inputs when relevant; where any input is missing, state the gap.
- Structural-force / maturity read: explain the buying timing ("why now / why not now") from a SOURCED shift (regulation, platform, buyer behavior, maturity stage).

What to deliver (prose):
1. One strategic VERDICT: the committed category frame ${C} should enter or defend, tied to the actual alternatives buyers consider (not the broadest analyst TAM).
2. One named TENSION: the tradeoff, which side the recommendation takes, and the cost of taking that side.
3. Market-size signals from sourced trajectory: disclosed valuations/funding rounds are FUNDING-FLOW signals with a source URL — NEVER relabel a valuation as TAM. Express the TAM gap posture (top-down analyst anchor vs bottom-up build, and the gap between them) qualitatively when no source-verifiable figure exists, with a confidence basis.
4. A category power bet (the bet, why now, the risk accepted) and the mined adjacent-category confusion.

Grounding discipline: do not invent market data, category labels, maturity, buyer alternatives, or TAM inputs. Do not present the subject's internal metrics (CAC, LTV, spend) as researched fact — tag operator-reported and speak directionally. Live search-volume numbers are fragile: carry only with tool attribution and a "as of this pull" caveat. Strategic-moat / durability claims are HYPOTHESES — frame as "moat IF [mechanism] holds; test is [what would confirm]". Name buyers with exact role labels, never vague "decision makers".
`.trim(),
      ].join("\n\n");

    // ---- Buyer & ICP Validation ----
    case "buyer":
      return [
        role,
        GROUNDING_LAW,
        antiLeakClause([
          "Named people, roles, account counts, audience sizes, trigger events — never invent; a department label is not a person.",
          "Firmographic bands (e.g. '10-2,000 employees') — never interpolate a numeric from qualitative language; a band carries a number ONLY when that exact number appears verbatim on the cited source page.",
          "Decision-bias labels (status-quo bias, loss aversion, anchoring) — useful INTERNAL reasoning only; never print the bias label into the prose.",
          "Persona/segment labels from other subjects — every persona must trace to a real cited customer signal for THIS subject.",
        ]),
        `
SECTION: Buyer & ICP Reality.
Your job: pin down the validated ICP boundary, the personas inside it, the jobs-to-be-done, the buying triggers, and the reachable venues — a usable boundary, not a persona poster.

Framework lens (five moves):
- Move 1 — Five-layer ICP WITH the anti-ICP. Build from firmographic, technographic, psychographic, trigger-event, and disqualifier evidence. The anti-ICP (who is NOT the buyer — wrong size, wrong motion, wrong maturity) is load-bearing: a sharp out-of-bounds is often more useful than the in-bounds restatement. Ground it in evidence the same way; never invent a disqualifier to look rigorous.
- Keep ICP (the best-fit ACCOUNT — a firmographic company boundary) and PERSONA (the INDIVIDUALS inside who buy/use/block/influence) as DISTINCT artifacts. Author the ICP first (which companies), then the personas (which people inside).
- Move 2 — Persona reality framed by the JOB-TO-BE-DONE: tie each persona's role to the OUTCOME they are accountable for and what "done" looks like, not a demographic list. Prefer 2-3 grounded segment-label personas (e.g. "Finance team champion") over thin named humans; a named champion is a BONUS only when an exact case-study page names the person AND employer. Derive the job from cited case-study/role/review language — never assert a job the evidence does not show.
- Move 4 — Buying triggers as a balance of forces: the PUSH of current pain, the PULL of the new solution, the ANXIETY of adopting, the INERTIA of the status quo. A credible trigger names the specific event/condition that tips that balance. Describe the observed behavior; do NOT name the cognitive model.
- Move 5 — Reachable clusters: name venues (communities, newsletters, conferences, podcasts, slack groups) ONLY when they exist and the evidenced persona actually frequents them; otherwise state the gap.

How to research: use perplexity_research / web_search for BOUNDED source discovery (candidate named buyers + reachable venues to verify); use firecrawl to fetch a case-study page and confirm a named person's name and employer BOTH appear in the fetched HTML before quoting them. A discovery answer is a LEAD, never a citation by itself.

What to deliver (prose):
1. The crisp ICP boundary: who qualifies and who does NOT (name the anti-ICP).
2. 2-3 grounded personas, each tied to the job they are hired to do, with a real sourceUrl.
3. The buying triggers (the events that tip a buyer off the status quo) and the reachable venues — or honest gaps where thin.

Grounding discipline: never invent named people, roles, venues, audience sizes, account counts, or trigger events. NEVER interpolate a firmographic numeric band from qualitative homepage language. Sparse acquisition must produce honest gaps, never a padded persona to fill the count.
`.trim(),
      ].join("\n\n");

    // ---- Competitor Landscape & Positioning ----
    case "competitor":
      return [
        role,
        GROUNDING_LAW,
        antiLeakClause([
          "Positioning axes like 'Ease vs Power', 'Speed vs Accuracy', 'Simplicity vs Enterprise' — real axes are market-specific; do not reuse as template axes.",
          "Pricing-tier names ('Starter / Professional / Enterprise') and tier boundaries — never copy across categories; cite the fetched pricing page.",
          "Review complaint themes ('API documentation gaps', 'onboarding friction', 'lack of mobile support') — domain-specific weaknesses; never import a complaint theme into an unrelated subject.",
          "Narrative frames ('incumbent plays it safe, we move fast', 'legacy locked-in vs born-cloud') — archetypal stories; only assert one when the competitor's OWN live narrative or ads show it.",
        ]),
        `
SECTION: Competitor Landscape & Positioning.
Your job (April Dunford alternatives-first): map 3-7 competitors by the ACTUAL buyer frame — direct, status-quo, DIY, and indirect — then say where ${C} can credibly attack vs must concede.

Framework lens:
- Competitor TYPE is an evidence claim (direct / status-quo / DIY / indirect each need different support). Uniqueness exists only RELATIVE to a named alternative — every differentiation claim must be stated against the specific alternative it beats.
- Depth over surface: explain why a difference matters to the buyer for which use case, not checkbox presence. Who-it's-for / who-it's-NOT-for per option (the segment a rival serves best vs structurally under-serves).
- Know / Say / Show: know what rivals claim, say the wedge ${C} credibly owns, show the proof.
- Pricing = packaging × value-metric × price-point: each tier with what it bundles, what it charges FOR, and the PUBLISHED price from a fetched sourceUrl — never a single number from memory.
- Review-mining for RECURRING complaint themes (with verbatimQuote + source), not isolated gripes. Narrative arcs (villain/hero/transformation) only from a competitor's OWN live narrative, traced to a sourceUrl, never inferred.
- Ad presence: use adlibrary for live creative; if it returns no live evidence, state the GAP — do NOT turn ad silence into "no ads".
- Honesty is a trust lever: state a competitor's GENUINE strength where evidence shows it. Misrepresenting a rival is fabrication risk.

How to research: web_search + firecrawl to find and read competitor positioning + pricing pages; reviews (mode:"bodies") to mine recurring weakness themes with verbatim quotes; adlibrary({ advertiser: "<competitor>", domain: "<competitor-domain>" }) for live ad creative.

What to deliver (prose):
1. The competitor set spanning the real frame (direct / status-quo / DIY / indirect), each type evidence-supported.
2. A positioning read (the axes that matter, each tied to a buyer consequence and what ${C} can credibly own), pricing reality with sourced data points, and recurring public weaknesses with verbatim quotes.
3. Where to ATTACK (an exploitable, evidenced weakness) vs where to CONCEDE (a genuine incumbent strength), against named alternatives, with rationale tracing to evidence.

Grounding discipline: do not invent competitors, pricing, spend, ad presence, reviews, or weaknesses. Every numeric or quote must trace to a sourceUrl fetched THIS run, not a bare homepage. Use an explicit gap instead of inventing axes, pricing, share-of-voice, weaknesses, narratives, or ad evidence.
`.trim(),
      ].join("\n\n");

    // ---- Offer & Performance Diagnostic ----
    case "offer":
      return [
        role,
        GROUNDING_LAW,
        antiLeakClause([
          "Diagnostic-lens model names (job-to-be-done, single binding constraint, behavior-at-moment-of-action, activation energy, buyer-stall biases, value band, switching costs) — reasoning tools ONLY; never print a model name as a label in the prose.",
          "Funnel-break metrics and benchmark bands — never assert a bare conversion cutoff without a sourced benchmark; never restate an unsourced number (e.g. 'conversion is ~12%').",
          "Internal/private metrics (CAC, LTV, budget, spend, conversion rates) — these come ONLY from the operator brief, tagged 'operator-reported'; never present them as researched fact.",
          "Pricing numbers — only cite price points sourced to a live URL/tool or the operator brief; reason about the value band without inventing the numbers inside it.",
        ]),
        `
SECTION: Offer & Performance Diagnostic.
Your job: identify the SINGLE binding constraint in the offer — what proof exists, what the funnel/channel evidence says, and what would make the recommendation wrong. Write for a founder deciding what to FIX before scaling spend. Do not make a weak offer look investable by filling tables.

Framework lens (apply only where evidence permits — skipping a thin move is correct):
- Move 1 — Command-of-the-message: does the offer show a negative consequence, a positive business outcome, the required capabilities, and proof? Anchor the read to the JOB the buyer hires the offer to do, not the feature list. Uniqueness exists only relative to real alternatives — say what a differentiator is differentiated AGAINST or downgrade it to an assumed proof point.
- Move 2 — Proof classification: Defensible (source-backed) / Comparative (depends on named alternatives) / Assumed (needs client confirmation). A proof GAP beats fake proof.
- Move 3 — Funnel diagnosis: identify where the buyer journey loses trust/intent. For each break generate a behavior hypothesis (motivation / ability-effort / a missing prompt at the moment of action) — a hypothesis to test, NEVER an asserted cause. Contextualize any threshold with the published benchmark band + source. A funnel break about in-product/trial behavior must NOT cite a pricing/marketing URL as proof.
- Move 4 — Channel truth: separate worked / partial / failed / unknown. Do NOT infer performance from a channel's existence. Distinguish DEMAND evidence (publicly acquirable — search volume, CPC, intent mix) from PERFORMANCE evidence (operator-only — CAC, CPL). Never assert "zero non-branded demand"; if demand evidence is absent, say the read is unknown.
- Move 5 — Retention & red flags: name activation/retention/first-value signals where present, and contradictions that would waste spend.

How to research: web_search + firecrawl to read the subject's offer/pricing/funnel pages and find public proof + retention signals; pagespeed to check page-performance evidence where it affects funnel diagnosis.

What to deliver (prose):
1. 3-5 offer truths up front (keyFindings), then the ONE binding constraint — not blame distributed evenly.
2. The offer-market-fit read framed around the buyer's job and real alternatives, with proof classified Defensible/Comparative/Assumed.
3. The funnel break(s) with grounded behavior hypotheses, the channel truth (worked/partial/failed/unknown with a per-channel demand read), and the red flags.

Grounding discipline: do not invent proof points, retention signals, funnel metrics, channel results, or red flags. Causal/root-cause claims are testable HYPOTHESES unless fetched evidence supports them. Never restate an unsourced number even when naming a gap. Cite only sourced prices.
`.trim(),
      ].join("\n\n");

    // ---- Paid Media Plan (synthesis) ----
    case "paidmedia":
      return [
        role,
        GROUNDING_LAW,
        antiLeakClause([
          "Methodology figures (budget split percentages, retargeting windows, frequency caps, day-counts, target CAC) — never present a methodology number as if it were THIS subject's data; concrete figures must come from operator input.",
          "Angle-structure vocabulary (problem→agitate→resolve, before→after→bridge, proof-led) — generic persuasion STRUCTURE only; the CONTENT of each hook must come from this subject's VoC pain language, competitor weakness, or offer proof.",
          "Channel names chosen by popularity — every channel must be matched to the buyer's demonstrated intent stage from the upstream evidence, never by platform reputation.",
        ]),
        `
SECTION: Paid Media Plan (SYNTHESIS).
Your job: translate the six committed positioning artifacts into ONE launchable plan — who to target, what to say, what to test, what to measure, and what evidence would change the plan. This section SYNTHESIZES the upstream sections; the upstream bodies are provided below as "UPSTREAM SECTION BODIES".

${ctx.upstreamNote ?? ""}

Framework lens (apply only where the upstream evidence permits):
- Move 1 — Resolve the cross-section TENSION first: a tension between two or more upstream sections, with its implication for the plan, the client blind spot, the second-order risk. A tension with no spend consequence is a note, not a plan driver.
- Move 2 — Express ONE spend thesis: why this channel, this audience, this phase order, this KPI are the right FIRST test. Anchor "why this channel" in channel-to-intent reasoning, not platform reputation.
- Move 3 — Audience & angle fit: audiences trace to the Buyer/ICP section; angles trace to VoC pain language, competitor weakness, or offer proof. Name the funnel position for each audience (upper = education, mid = proof/comparison, lower = urgency/objection-handling). The angle STRUCTURE is generic vocabulary; the CONTENT must be this subject's evidence.
- Move 4 — Funnel & sales readiness: what each funnel path is built to prove; if no sales asset was supplied, emit ONE honest gap, never a fabricated link.
- Move 5 — Channel & KPI accountability: match each channel to the buyer's demonstrated intent stage (high-intent search = buyers already searching; demand-gen visual = buyers to be made aware; professional-identity = role/firmographic targeting). Each KPI names the decision it drives and its funnel objective. Surface any CAC gap honestly — the diagnostic value is the gap, not a number engineered to match a target.
- Move 6 — Phasing & learning discipline: learn → consolidate → scale, expressed as reasoning, not fixed percentages or day-counts.

Use keyword_ad_probe to check paid-search ad surfaces when the plan needs search-ad context (organic/ad result counts for a key query).

What to deliver (prose):
1. The cross-section insight (the tension) and the one spend thesis with its constraint.
2. The audiences (with funnel position), the angles to test (each tied to subject evidence), the creative framework, the funnel ideation, and the sales-process readiness (or one honest gap).
3. The channel suggestions matched to buyer-intent stage with a verdict each, and the KPIs each tied to a decision.

Grounding discipline: no filler rows. Every hook/audience/channel ties to an upstream section or explicit operator input. NEVER launder a confident audience/angle/channel off a missing or insufficient upstream section — emit an honest gap instead. If upstream bodies are MISSING below, note the gap and plan only from what IS present; do not invent the missing section's content.
`.trim(),
      ].join("\n\n");
  }
}

// ---------------------------------------------------------------------------
// Corpus grounding text injected into the user prompt (section-agnostic)
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
// Upstream-body assembly for the paidmedia synthesis section.
// Reads each upstream section's body.md from the SAME subject's output dir.
// ---------------------------------------------------------------------------
async function readUpstreamBodies(
  subjectDir: string,
): Promise<{ text: string; present: Section[]; missing: Section[] }> {
  const present: Section[] = [];
  const missing: Section[] = [];
  const blocks: string[] = [];
  for (const s of UPSTREAM_SECTIONS) {
    const path = `${subjectDir}/${s}/body.md`;
    try {
      const body = await readFile(path, "utf8");
      if (body.trim().length > 0) {
        present.push(s);
        blocks.push(
          `### UPSTREAM: ${SECTION_META[s].title} (${SECTION_META[s].positioningId})\n${body.trim()}`,
        );
        continue;
      }
      missing.push(s);
    } catch {
      missing.push(s);
    }
  }
  const header =
    blocks.length > 0
      ? `## UPSTREAM SECTION BODIES (synthesize ONLY from these + operator brief)\n\n${blocks.join("\n\n")}`
      : `## UPSTREAM SECTION BODIES\n(NONE FOUND in ${subjectDir}. Plan from the corpus excerpts + operator brief only, and NOTE the missing upstream sections as a gap.)`;
  return { text: header, present, missing };
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
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv: string[]) {
  const positional: string[] = [];
  let corpusPath = DEFAULT_CORPUS_PATH;
  let subjectOverride: string | undefined;
  let dry = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") dry = true;
    else if (a === "--corpus") corpusPath = argv[++i] ?? corpusPath;
    else if (a.startsWith("--corpus=")) corpusPath = a.slice("--corpus=".length);
    else if (a === "--subject") subjectOverride = argv[++i];
    else if (a.startsWith("--subject=")) subjectOverride = a.slice("--subject=".length);
    else if (!a.startsWith("--")) positional.push(a);
  }
  return { positional, corpusPath, subjectOverride, dry };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "subject";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { positional, corpusPath, subjectOverride, dry } = parseArgs(process.argv.slice(2));
  const arg = (positional[0] ?? "").toLowerCase();
  const section = SECTION_ALIASES[arg];
  if (!section) {
    console.error(
      "usage: npx tsx scripts/zz-agentic-section.ts <voc|demand|market|buyer|competitor|offer|paidmedia> [--corpus <path>] [--subject <slug>] [--dry]",
    );
    process.exit(2);
  }
  const meta = SECTION_META[section];

  // Load + assemble grounding (this validates corpus load + prompt assembly
  // even when the live model call 403s).
  const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
  const excerpts: Excerpt[] = corpus?.corpus?.sectionExcerpts?.[meta.excerptKey] ?? [];

  const companyName: string = corpus?.company?.name ?? "";
  const companyDesc: string = corpus?.company?.description ?? "";
  const websiteUrl: string = corpus?.company?.websiteUrl ?? "";

  // Subject slug + output dir. Backward-compat: the default Ramp corpus with no
  // explicit --subject keeps the legacy flat path tmp/zz-agentic-glm/<section>/
  // so the proven voc/demand outputs do not move.
  const isLegacyRampDefault =
    corpusPath === DEFAULT_CORPUS_PATH && !subjectOverride;
  const subjectSlug =
    subjectOverride?.trim() || slugify(companyName || corpusPath.split("/").pop() || "subject");
  const subjectDir = isLegacyRampDefault ? OUT_ROOT : `${OUT_ROOT}/${subjectSlug}`;
  const outDir = `${subjectDir}/${section}`;

  const tools = toolsFor(section);

  // paidmedia synthesis: read the other 6 sections' body.md from the same subject dir.
  let upstreamNote: string | undefined;
  let upstreamText = "";
  let upstreamPresent: Section[] = [];
  let upstreamMissing: Section[] = [];
  if (section === "paidmedia") {
    const up = await readUpstreamBodies(subjectDir);
    upstreamText = up.text;
    upstreamPresent = up.present;
    upstreamMissing = up.missing;
    upstreamNote =
      up.present.length > 0
        ? `Upstream sections present this run: ${up.present.join(", ")}.${up.missing.length ? ` Missing (note as gaps, do not invent): ${up.missing.join(", ")}.` : ""}`
        : `No upstream section bodies were found. Plan only from the corpus excerpts + operator brief, and note every missing section as a gap.`;
  }

  const system = systemPromptFor(section, {
    companyName,
    companyDesc,
    websiteUrl,
    upstreamNote,
  });
  const grounding = buildGroundingText(corpus, excerpts);

  const promptParts = [
    `Write the ${meta.title} section for ${companyName || "the subject"}.`,
    section === "paidmedia"
      ? "Synthesize the upstream section bodies below, then write. Here is your grounding context:"
      : "Research first with the tools, then write. Here is your grounding context:",
    "",
    grounding,
  ];
  if (section === "paidmedia") {
    promptParts.push("", upstreamText);
  }
  const prompt = promptParts.join("\n");

  console.log(
    `[setup] section=${section} (${meta.positioningId}) subject=${subjectSlug} model=${modelId} baseURL=${baseURL} tools=${Object.keys(tools).join(",")} excerptKey=${meta.excerptKey} excerpts=${excerpts.length} promptChars=${prompt.length} outDir=${outDir}`,
  );

  // ---- DRY MODE: assemble-only, $0, exit before any live call ----
  if (dry) {
    console.log("\n========== DRY RUN (no live call) ==========");
    console.log(`section:        ${section}`);
    console.log(`positioningId:  ${meta.positioningId}`);
    console.log(`subject:        ${companyName || "(unknown)"} -> slug=${subjectSlug}`);
    console.log(`corpusPath:     ${corpusPath}`);
    console.log(`excerptKey:     ${meta.excerptKey}`);
    console.log(`excerpts:       ${excerpts.length}`);
    console.log(`tools:          ${Object.keys(tools).join(", ")}`);
    console.log(`systemChars:    ${system.length}`);
    console.log(`promptChars:    ${prompt.length}`);
    console.log(`maxSteps:       ${MAX_STEPS}`);
    console.log(`outDir:         ${outDir}`);
    if (section === "paidmedia") {
      console.log(`upstreamPresent: [${upstreamPresent.join(", ")}]`);
      console.log(`upstreamMissing: [${upstreamMissing.join(", ")}]`);
    }
    console.log("\n[dry-ok] corpus load + prompt + tool assembly verified; exiting 0 before any generateText() call.");
    process.exit(0);
  }

  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  let result: Awaited<ReturnType<typeof generateText>>;
  try {
    result = await generateText({
      model: sectionModel,
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

  const metaOut = {
    section,
    positioningId: meta.positioningId,
    subject: subjectSlug,
    corpusPath,
    model: modelId,
    baseURL,
    finishReason: result.finishReason,
    steps: steps.length,
    toolCallCount,
    totalToolCalls,
    usage: result.usage,
    startedAt,
    durationMs,
    ...(section === "paidmedia"
      ? { upstreamPresent, upstreamMissing }
      : {}),
  };

  await mkdir(dirname(`${outDir}/body.md`), { recursive: true });
  await writeFile(`${outDir}/body.md`, result.text ?? "");
  await writeFile(`${outDir}/transcript.json`, JSON.stringify(transcript, null, 2));
  await writeFile(`${outDir}/meta.json`, JSON.stringify(metaOut, null, 2));

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
