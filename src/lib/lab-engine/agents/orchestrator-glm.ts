/**
 * orchestrator-glm.ts — GLM-5.2 agentic ORCHESTRATOR (in-process).
 *
 * The "our own research agent" (LOCK 2026-06-24 §2/§7D). Runs ONBOARDING-SUBMIT
 * → identity-lock + GTM field extraction + corpus gather over the intelligence
 * buckets (market · ICP · competitor · VoC · demand · offer) → writes facts to
 * the SHARED LEDGER. Streams partials. One visible compute wait.
 *
 * Shape: faithful to the PROVEN agentic-glm-runner (blind A/B 8-9, 2026-06-22):
 * generateText + stopWhen(stepCountIs) with a gather-only tool set. Reuses the
 * existing src/lib Firecrawl/Perplexity tools — no worker re-impl (final-arch
 * Phase 4 "HOLD"). Perplexity is an orchestrator tool, decided empirically.
 *
 * Scope: GATHER + EXTRACT + LEDGER WRITE only. Does NOT compose the deck
 * (that's the composer, Step E) and does NOT run the 6 sections (those read
 * this ledger and top-up where thin). This module owns the orchestrator loop.
 */
import { generateText, stepCountIs } from "ai";
import { z } from "zod";

import { getAgenticGLMModel } from "../ai/models";
import { TOOL_CATALOG, type ToolName } from "./tools/index";
import type { TranscriptRecord } from "./verification/provenance-detect";
import {
  buildTranscriptRecord,
  GROUNDING_LAW,
} from "./agentic-glm-runner";
import {
  appendResearchFactsBestEffort,
  buildResearchFactsFromCorpusExcerpts,
  type ResearchFact,
  type ResearchFactStore,
} from "../evidence/research-fact";

// ---------------------------------------------------------------------------
// Tool set — gather only. The orchestrator researches the company + market;
// it does NOT run ad-library/keyword probes (those are section top-ups).
// Perplexity is included as a candidate tool; keep/kill is empirical.
// ---------------------------------------------------------------------------
const ORCHESTRATOR_TOOLS: readonly ToolName[] = [
  "web_search",
  "firecrawl",
  "perplexity_research",
];

const ORCHESTRATOR_TOOL_REQUIRED_ENV: Record<ToolName, readonly string[]> = {
  web_search: ["FIRECRAWL_API_KEY"],
  firecrawl: ["FIRECRAWL_API_KEY"],
  perplexity_research: ["PERPLEXITY_API_KEY"],
  // Remaining tools are not orchestrator tools; keep the map total for type
  // safety but they'll never be selected here.
  adlibrary: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  google_ads: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  meta_ads: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  linkedin_ads: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  pagespeed: [],
  keyword_ad_probe: ["SEARCHAPI_KEY"],
  keyword_trends: ["SEARCHAPI_KEY"],
  keyword_volume: ["SPYFU_API_KEY"],
  keyword_discovery: ["SPYFU_API_KEY"],
  reviews: ["SEARCHAPI_KEY", "FIRECRAWL_API_KEY"],
};

function hasRequiredCredential(
  tool: ToolName,
  env: Record<string, string | undefined>,
): boolean {
  const required = ORCHESTRATOR_TOOL_REQUIRED_ENV[tool];
  if (required.length === 0) {
    return true;
  }
  return required.some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function buildOrchestratorTools(
  env: Record<string, string | undefined> = process.env,
): Record<string, unknown> {
  const tools: Record<string, unknown> = {};
  for (const name of ORCHESTRATOR_TOOLS) {
    if (!hasRequiredCredential(name, env)) {
      continue;
    }
    tools[name] = TOOL_CATALOG[name];
  }
  return tools;
}

// ---------------------------------------------------------------------------
// Identity-lock — the TLD-collision-safe topic reconcile (final-arch §1 step 1).
// Stated up front so the model commits to ONE company before it gathers.
// ---------------------------------------------------------------------------
export const IDENTITY_LOCK_PREAMBLE = `
IDENTITY LOCK (commit before you gather anything):
- You are researching exactly ONE company: the one named in the user brief below.
- If a tool returns results about a different company with a similar name, DISCARD them and re-search with a disambiguating query (the company's website domain is the strongest disambiguator).
- Never blend facts across two companies. If you are unsure a fact is about the target company, mark it "[unverified identity]" rather than state it as fact.
`.trim();

// ---------------------------------------------------------------------------
// GTM field extraction — structured output bound ONCE here (final-arch §3:
// schema binds at the composer; the orchestrator binds a SMALL extraction
// schema only, not the deck). These are the fields the sections + deck need
// seeded and that the human onboarding may have left thin.
// ---------------------------------------------------------------------------
export const orchestratorGtmFieldsSchema = z.object({
  companyName: z.string(),
  category: z.string(),
  productDescription: z.string(),
  targetCustomer: z.string(),
  topCompetitors: z.array(z.string()),
  marketProblem: z.string(),
});

export type OrchestratorGtmFields = z.infer<typeof orchestratorGtmFieldsSchema>;

// ---------------------------------------------------------------------------
// Orchestrator loop
// ---------------------------------------------------------------------------
export interface GenerateAgenticGLMOrchestratorArgs {
  /** The operator's website URL (strongest identity disambiguator). */
  websiteUrl: string;
  /** The operator's filled onboarding (GTM brief), as JSON string. */
  onboardingBrief: string;
  /** Defaults to buildOrchestratorTools(env). */
  tools?: Record<string, unknown>;
  /** Defaults to ORCHESTRATOR_MAX_STEPS. */
  maxSteps?: number;
  signal?: AbortSignal;
  env?: Record<string, string | undefined>;
  /**
   * Best-effort per-step progress hook (passed straight to generateText's
   * onStepFinish). The orchestrator runs ~161-340s; the caller uses this to
   * stream "gather progress" so the operator does not stare at a silent gap.
   * Never block the loop — broadcast best-effort and swallow errors.
   */
  onStepFinish?: (step: unknown) => void | Promise<void>;
  /** DI seam for tests — defaults to the real `ai` generateText. */
  generateTextImpl?: typeof generateText;
}

export interface GenerateAgenticGLMOrchestratorResult {
  gtmFields: OrchestratorGtmFields | null;
  researchDigest: string;
  transcript: TranscriptRecord[];
  steps: unknown;
  stepCount: number;
}

export const ORCHESTRATOR_MAX_STEPS = 14;

const ORCHESTRATOR_MAX_OUTPUT_TOKENS = 8000;

export async function generateAgenticGLMOrchestrator(
  args: GenerateAgenticGLMOrchestratorArgs,
): Promise<GenerateAgenticGLMOrchestratorResult> {
  const env = args.env ?? process.env;
  const maxSteps = args.maxSteps ?? ORCHESTRATOR_MAX_STEPS;
  const tools = args.tools ?? buildOrchestratorTools(env);

  const systemPrompt = [
    IDENTITY_LOCK_PREAMBLE,
    GROUNDING_LAW,
    `
You are the RESEARCH ORCHESTRATOR for a GTM positioning audit. Your job:
1. Confirm the company identity (the website URL is the source of truth).
2. Gather evidence across six intelligence buckets — market category, buyer ICP, competitor landscape, voice-of-customer (reviews/switching stories), demand intent (search keywords/questions), and the offer's wedge.
3. Extract the GTM fields (companyName, category, productDescription, targetCustomer, topCompetitors[], marketProblem).
4. Write a research DIGEST (markdown) summarizing the strongest evidence you found per bucket, with inline source URLs. This digest seeds the six positioning sections.

Use the tools FREELY. Cite every load-bearing claim with its source URL. Honest gaps are good; fabrication is the cardinal sin. The onboarding brief below is operator-supplied context — trust it as the company's own claim, but verify market/competitor facts with tools.

OUTPUT FORMAT (write BOTH, in this order):
1. A fenced JSON block tagged \`\`\`gtm-fields containing exactly: { "companyName": string, "category": string, "productDescription": string, "targetCustomer": string, "topCompetitors": string[], "marketProblem": string }
2. The markdown research digest (## headers per bucket, inline source URLs).
`,
  ].join("\n\n");

  const userPrompt = [
    `COMPANY WEBSITE: ${args.websiteUrl}`,
    `OPERATOR ONBOARDING BRIEF (JSON):`,
    args.onboardingBrief,
    "",
    "Now research the company and the six buckets. Use tools. Then emit the gtm-fields JSON block + the markdown research digest.",
  ].join("\n");

  const generateTextFn = args.generateTextImpl ?? generateText;
  const result = await generateTextFn({
    model: getAgenticGLMModel(env),
    tools: tools as Parameters<typeof generateText>[0]["tools"],
    stopWhen: stepCountIs(maxSteps),
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: args.signal,
    maxOutputTokens: ORCHESTRATOR_MAX_OUTPUT_TOKENS,
    ...(args.onStepFinish === undefined
      ? {}
      : { onStepFinish: args.onStepFinish }),
  });

  const transcript = buildTranscriptRecord(result.steps, "orchestrator");

  const gtmFields = parseOrchestratorGtmFieldsFromText(result.text);
  // Digest = the model text with the gtm-fields fenced block stripped, so the
  // section seed corpus is pure prose, not JSON.
  const researchDigest = stripGtmFieldsFence(result.text);

  return {
    gtmFields,
    researchDigest,
    transcript,
    steps: result.steps,
    stepCount: Array.isArray(result.steps) ? result.steps.length : 0,
  };
}

function stripGtmFieldsFence(text: string): string {
  return text
    .replace(/```gtm-fields\s*[\s\S]*?```/i, "")
    .replace(/```json\s*[\s\S]*?```/i, "")
    .trim();
}

function parseOrchestratorGtmFieldsFromText(
  text: string,
): OrchestratorGtmFields | null {
  if (text.length === 0) {
    return null;
  }
  // Pull the ```gtm-fields fenced block. Falls back to the first ```json block
  // if the model used the generic tag. Tolerates surrounding prose.
  const fenceMatch = /```gtm-fields\s*([\s\S]*?)```/i.exec(text);
  const jsonMatch = /```json\s*([\s\S]*?)```/i.exec(text);
  const raw = (fenceMatch?.[1] ?? jsonMatch?.[1] ?? "").trim();
  if (raw.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    const safe = orchestratorGtmFieldsSchema.safeParse(parsed);
    return safe.success ? safe.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Ledger promotion — turn the orchestrator's tool-result transcript into
// ResearchFacts and append them (best-effort, never throws). Sections READ
// these via getResearchFactStorageContext so they don't re-derive the same
// company facts (the double-search the ledger kills).
// ---------------------------------------------------------------------------
export function buildOrchestratorFactsFromTranscript(
  transcript: readonly TranscriptRecord[],
  ctx: {
    runId: string;
    createdAt: string;
    parentAuditRunId?: string;
  },
): ResearchFact[] {
  // The orchestrator's tool outputs are web/firecrawl/perplexity results —
  // treat each successful, URL-bearing result as a corpus_excerpt fact. This
  // reuses the corpus-excerpt promoter so the ledger keeps one fact shape.
  const excerpts = transcriptToCorpusExcerpts(transcript);
  return buildResearchFactsFromCorpusExcerpts(excerpts, {
    runId: ctx.runId,
    sectionId: "orchestrator",
    createdAt: ctx.createdAt,
    ...(ctx.parentAuditRunId !== undefined
      ? { parentAuditRunId: ctx.parentAuditRunId }
      : {}),
  });
}

function transcriptToCorpusExcerpts(
  transcript: readonly TranscriptRecord[],
): { id: string; sourceUrl: string; title: string; text: string; observedAt: string; sourceId: string }[] {
  const out: { id: string; sourceUrl: string; title: string; text: string; observedAt: string; sourceId: string }[] = [];
  const seenUrls = new Set<string>();

  for (const entry of transcript) {
    if (entry.isError || entry.output === null || entry.output === undefined) {
      continue;
    }
    const output = entry.output as Record<string, unknown> | string | null;
    if (output === null || typeof output !== "object") {
      continue;
    }
    const url =
      typeof output.url === "string" ? output.url :
      typeof output.sourceUrl === "string" ? output.sourceUrl :
      typeof output.link === "string" ? output.link : null;
    if (url === null || !/^https?:\/\//.test(url) || seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);
    const title =
      typeof output.title === "string" ? output.title :
      typeof output.source === "string" ? output.source : url;
    const text =
      typeof output.text === "string" ? output.text :
      typeof output.markdown === "string" ? output.markdown :
      typeof output.content === "string" ? output.content :
      typeof output.summary === "string" ? output.summary : title;
    out.push({
      id: `excerpt_orchestrator_${entry.step}_${entry.toolCallId}`,
      sourceId: `source_orchestrator_${entry.step}_${entry.toolName}`,
      sourceUrl: url,
      title,
      text,
      observedAt: new Date().toISOString(),
    });
  }

  return out;
}

export async function promoteOrchestratorFactsToLedger(
  store: ResearchFactStore,
  transcript: readonly TranscriptRecord[],
  ctx: {
    runId: string;
    createdAt: string;
    parentAuditRunId?: string;
  },
): Promise<void> {
  const facts = buildOrchestratorFactsFromTranscript(transcript, ctx);
  await appendResearchFactsBestEffort(store, facts);
}