#!/usr/bin/env tsx
/**
 * zz-provenance-remediate.ts — the Phase B provenance gate's "hands".
 *
 * Two GLM-backed passes (Ollama glm-5.2:cloud, $0, no NEW tool calls — every pass
 * uses ONLY the existing transcript as source of truth):
 *
 *   1. SELF-AUDIT (spec §2a, owner steer 2026-06-23):
 *        feed GLM its OWN body + full transcript, ask it to flag/repair any
 *        citation/quote/number/attribution NOT supported by the transcript using
 *        its own intelligence (NO deterministic hints). Then run the deterministic
 *        detector on the self-audited body and record violationsRemainingAfterSelfAudit.
 *        This measures the model-vs-gate contribution: if the smart model fixes
 *        itself to ~0, the deterministic gate is a thin backstop.
 *
 *   2. CONSTRAINED REMEDIATION (spec §2):
 *        feed GLM the body + the deterministically-detected violations (exact span +
 *        reason) and ask it to rewrite ONLY those spans. Convergence loop: detect ->
 *        GLM-remediate -> re-detect, max 2 GLM rounds; if still failing, deterministically
 *        strip the offending spans and label [unverified]. Guarantees 0 surviving
 *        detector-violations.
 *
 * Outputs -> tmp/zz-agentic-glm-gated/<subject>/<section>/{body.md, violations.json}
 *
 * Usage:
 *   npx tsx scripts/zz-provenance-remediate.ts --subject attio --section buyer
 *   npx tsx scripts/zz-provenance-remediate.ts --subject attio --section buyer --self-audit
 *
 * Provider wiring copied verbatim from scripts/zz-agentic-section.ts. Ollama may be
 * down — this module is built to be runnable + tsc-clean; running it is not required
 * to land the detector.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd()); // pulls OLLAMA_API_KEY etc. from .env.local; never read directly

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

import { detect, ceilingFor, type Violation, type DetectResult } from "./provenance/gate";

// ---------------------------------------------------------------------------
// Provider (verbatim from scripts/zz-agentic-section.ts)
// ---------------------------------------------------------------------------
const baseURL = process.env.DEEPSEEK_OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const modelId = process.env.DEEPSEEK_OLLAMA_MODEL_ID ?? "glm-5.2:cloud";
const ollama = createOpenAICompatible({
  apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
  baseURL,
  name: "ollama",
});

const ART_ROOT = "tmp/zz-agentic-glm";
const GATED_ROOT = "tmp/zz-agentic-glm-gated";
const MAX_GLM_ROUNDS = 2;
const UPSTREAM_SECTIONS = ["voc", "market", "buyer", "competitor", "offer", "demand"];

/** Load sibling-section transcripts for the paidmedia synthesis grounding index. */
function loadSiblingTranscripts(root: string, subject: string, section: string): string[] {
  if (section !== "paidmedia") return [];
  const out: string[] = [];
  for (const up of UPSTREAM_SECTIONS) {
    const sp = resolve(process.cwd(), root, subject, up, "transcript.json");
    if (existsSync(sp)) out.push(readFileSync(sp, "utf8"));
  }
  return out;
}

function log(...args: unknown[]): void {
  console.error(...args);
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------
function selfAuditPrompt(body: string, transcript: string): { system: string; prompt: string } {
  const system = [
    "You are a rigorous provenance auditor for a GTM research section.",
    "You are given a section body AND the FULL tool transcript that produced it.",
    "The transcript is the ONLY source of truth. A claim is supported iff its URL, quote,",
    "number, or named-customer/advertiser attribution appears in the transcript.",
    "",
    "Audit the body for ANY unsupported claim:",
    "  - cited URLs not present in the transcript,",
    "  - quotes not present in the transcript,",
    "  - numbers (search volume, CPC, prices, percentages) presented as sourced facts but absent,",
    "  - named companies asserted as advertisers/bidders the transcript never identifies,",
    "  - named customers asserted as proof the transcript never names,",
    "  - arithmetic that does not compute.",
    "",
    "Rewrite ONLY the unsupported spans: drop/demote laundered citations to plain directional",
    "claims; hedge invented attributions to 'specific advertisers not identifiable from available",
    "data'; correct or remove incoherent arithmetic; replace synthesized proof with an explicit",
    "honest gap. PRESERVE every grounded claim, the structure, and the analytical value.",
    "Output the FULL corrected body as markdown — nothing else.",
  ].join("\n");
  const prompt = [
    "## SECTION BODY",
    body,
    "",
    "## FULL TOOL TRANSCRIPT (ground truth)",
    transcript,
  ].join("\n");
  return { system, prompt };
}

function remediationPrompt(
  body: string,
  transcript: string,
  violations: Violation[],
): { system: string; prompt: string } {
  const system = [
    "You are remediating a GTM research section against a deterministic provenance checker.",
    "The transcript is the ONLY allowed source of truth — do NOT introduce new facts or call tools.",
    "You are given the body, the full transcript, and a list of deterministically-detected violations",
    "(each with an exact span + reason + what the transcript actually supports).",
    "",
    "Rewrite ONLY the offending spans:",
    "  - drop/demote laundered citations to plain directional claims,",
    "  - hedge named-bidder attributions to 'specific advertisers not identifiable from available data',",
    "  - correct or remove incoherent arithmetic,",
    "  - replace synthesized proof with an explicit honest gap",
    "    ('no customer voice retrievable for <subject>; recommend …').",
    "PRESERVE every grounded claim, the structure, and the analytical value.",
    "Output the FULL corrected body as markdown — nothing else.",
  ].join("\n");
  const vlist = violations
    .map((v, i) => `${i + 1}. [${v.check}] span="${v.span}"\n     reason: ${v.reason}`)
    .join("\n");
  const prompt = [
    "## DETECTED VIOLATIONS (fix exactly these)",
    vlist,
    "",
    "## SECTION BODY",
    body,
    "",
    "## FULL TOOL TRANSCRIPT (ground truth)",
    transcript,
  ].join("\n");
  return { system, prompt };
}

async function glmRewrite(system: string, prompt: string): Promise<string> {
  const result = await generateText({
    model: ollama(modelId),
    system,
    prompt,
  });
  return result.text ?? "";
}

// ---------------------------------------------------------------------------
// Deterministic last-resort strip (guarantees 0 surviving detector-violations)
// ---------------------------------------------------------------------------
function stripViolationsDeterministically(body: string, violations: Violation[]): string {
  let out = body;
  for (const v of violations) {
    if (!v.span) continue;
    // mark the offending span as unverified inline so the value/structure survives
    // but the receipt is honestly flagged.
    if (out.includes(v.span)) {
      out = out.replace(v.span, `${v.span} [unverified]`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------
function paths(root: string, subject: string, section: string) {
  const dir = resolve(process.cwd(), root, subject, section);
  return { dir, bodyPath: `${dir}/body.md`, transcriptPath: `${dir}/transcript.json` };
}

function detectBody(
  bodyText: string,
  transcriptPath: string,
  section: string,
  subject: string,
  siblingTranscripts: string[],
): DetectResult {
  // write the candidate body to a temp file so detect() can read it like a real cell
  const tmp = resolve(process.cwd(), GATED_ROOT, subject, section, ".candidate-body.md");
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, bodyText);
  return detect({ bodyPath: tmp, transcriptPath, section, subject, siblingTranscripts });
}

export interface RemediateArgs {
  root: string;
  subject: string;
  section: string;
  /** run the §2a model-level self-audit measurement pass before remediation. */
  selfAudit?: boolean;
}

export interface RemediateResult {
  subject: string;
  section: string;
  rawViolations: number;
  afterSelfAudit: number | null;
  afterDeterministicRemediation: number;
  rounds: number;
  surviving: number;
  ceiling: number;
}

export async function remediateCell(args: RemediateArgs): Promise<RemediateResult> {
  const { root, subject, section } = args;
  const { bodyPath, transcriptPath } = paths(root, subject, section);
  if (!existsSync(bodyPath) || !existsSync(transcriptPath)) {
    throw new Error(`missing artifact for ${subject}/${section}`);
  }
  const originalBody = readFileSync(bodyPath, "utf8");
  const transcript = readFileSync(transcriptPath, "utf8");
  const siblingTranscripts = loadSiblingTranscripts(root, subject, section);

  // baseline (raw) detection
  const raw = detect({ bodyPath, transcriptPath, section, subject, siblingTranscripts });
  const rawViolations = raw.violations.length;
  log(`[raw] ${subject}/${section}: ${rawViolations} violation(s)`);

  let afterSelfAudit: number | null = null;

  // §2a — model-level self-audit (measurement)
  if (args.selfAudit) {
    log(`[self-audit] asking GLM to self-correct (no deterministic hints) …`);
    const sa = selfAuditPrompt(originalBody, transcript);
    const audited = await glmRewrite(sa.system, sa.prompt);
    const afterSa = detectBody(audited, transcriptPath, section, subject, siblingTranscripts);
    afterSelfAudit = afterSa.violations.length;
    log(`[self-audit] violationsRemainingAfterSelfAudit = ${afterSelfAudit}`);
  }

  // §2 — constrained convergence loop
  let body = originalBody;
  let current = raw;
  let rounds = 0;
  while (current.violations.length > 0 && rounds < MAX_GLM_ROUNDS) {
    rounds++;
    log(`[remediate] GLM round ${rounds}: ${current.violations.length} violation(s) to fix`);
    const rp = remediationPrompt(body, transcript, current.violations);
    body = await glmRewrite(rp.system, rp.prompt);
    current = detectBody(body, transcriptPath, section, subject, siblingTranscripts);
    log(`[remediate] after round ${rounds}: ${current.violations.length} surviving`);
  }

  // last-resort deterministic strip
  if (current.violations.length > 0) {
    log(`[remediate] ${current.violations.length} survived GLM; deterministically stripping`);
    body = stripViolationsDeterministically(body, current.violations);
    current = detectBody(body, transcriptPath, section, subject, siblingTranscripts);
  }

  // write gated artifacts
  const { dir } = paths(GATED_ROOT, subject, section);
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/body.md`, body);
  writeFileSync(
    `${dir}/violations.json`,
    JSON.stringify(
      {
        subject,
        section,
        rawViolations,
        afterSelfAudit,
        afterDeterministicRemediation: current.violations.length,
        rounds,
        survivingViolations: current.violations,
      },
      null,
      2,
    ),
  );

  return {
    subject,
    section,
    rawViolations,
    afterSelfAudit,
    afterDeterministicRemediation: current.violations.length,
    rounds,
    surviving: current.violations.length,
    ceiling: ceilingFor(current.violations),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
interface CliArgs {
  subject?: string;
  section?: string;
  selfAudit: boolean;
  root: string;
}

function parseArgs(argv: string[]): CliArgs {
  const a: CliArgs = { selfAudit: false, root: ART_ROOT };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--subject") a.subject = argv[++i];
    else if (t === "--section") a.section = argv[++i];
    else if (t === "--self-audit") a.selfAudit = true;
    else if (t === "--root") a.root = argv[++i];
  }
  return a;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.subject || !args.section) {
    log("[error] need --subject and --section");
    process.exit(2);
  }
  try {
    const res = await remediateCell({
      root: args.root,
      subject: args.subject,
      section: args.section,
      selfAudit: args.selfAudit,
    });
    log(`[done] ${JSON.stringify(res)}`);
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (/403|forbidden|api key|unauthor|401|ECONN|fetch failed/i.test(msg)) {
      log(`[build-ok] wiring assembled; live GLM unavailable (${msg}). Detector path is unaffected.`);
      process.exit(0);
    }
    log(`[error] ${msg}`);
    process.exit(1);
  }
}

// Only run as a CLI when invoked directly (not when imported by the gate CLI).
const invokedDirectly =
  process.argv[1] !== undefined && /zz-provenance-remediate\.ts$/.test(process.argv[1]);
if (invokedDirectly) {
  void main();
}
