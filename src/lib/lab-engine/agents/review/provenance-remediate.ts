/**
 * provenance-remediate.ts — IN-MEMORY port of the Phase B provenance gate's "hands"
 * (proven script-side at `scripts/zz-provenance-remediate.ts`).
 *
 * Given a section body + its tool transcript, drives:
 *   1. optional SELF-AUDIT — feed GLM its OWN body + full transcript, ask it to flag/repair
 *      any unsupported citation/quote/number/attribution using its own intelligence (NO
 *      deterministic hints). Measures the model-vs-gate contribution.
 *   2. CONSTRAINED REMEDIATION — feed GLM the body + the deterministically-detected
 *      violations (exact span + reason) and ask it to rewrite ONLY those spans. Convergence
 *      loop: detect → GLM-remediate → re-detect, max `maxRounds` GLM rounds.
 *   3. DETERMINISTIC STRIP — if violations survive the GLM rounds, neutralize the offending
 *      spans inline so the value/structure survives but the receipt is honestly flagged.
 *      GUARANTEES 0 surviving detector-violations.
 *
 * Every pass uses ONLY the existing transcript as source of truth — NO new tool calls,
 * NO file I/O. The body and transcript records are passed in-memory; the GLM rewrite fn is
 * injectable so tests run without a live model.
 *
 * Ground-truth detection is delegated to the proven in-memory detector at
 * `../verification/provenance-detect`.
 */
import { generateText } from "ai";

import { getAgenticGLMModel } from "../../ai/models";
import {
  detectProvenanceViolations,
  type ProvenanceViolation,
  type TranscriptRecord,
} from "../verification/provenance-detect";

// GLM-5.2 is a reasoning model — without a generous output budget the rewritten content
// comes back EMPTY (the model spends the whole budget on reasoning tokens). 8k matches the
// review path's convention and is ample for a full-body rewrite.
const DEFAULT_MAX_OUTPUT_TOKENS = 8_000;
const DEFAULT_MAX_GLM_ROUNDS = 2;

/** A constrained rewrite of a section body. Injectable so tests avoid a live GLM. */
export type RewriteFn = (system: string, prompt: string) => Promise<string>;

export interface RemediateProvenanceArgs {
  body: string;
  transcript: TranscriptRecord[];
  section: string;
  subject: string;
  /** parsed sibling-section transcript record arrays (paidmedia carry-forward grounding). */
  siblingTranscripts?: TranscriptRecord[][];
  /** raw text of the OTHER sibling section bodies (paidmedia carry-forward grounding). */
  siblingBodies?: string[];
  /** run the model-level self-audit pass before constrained remediation (default true). */
  selfAudit?: boolean;
  /** max constrained GLM convergence rounds (default 2). */
  maxRounds?: number;
  /** the rewrite function; defaults to GLM via getAgenticGLMModel. INJECTABLE for tests. */
  rewrite?: RewriteFn;
  /** env for the default GLM rewrite (so callers thread deps.env, not process.env). */
  env?: Record<string, string | undefined>;
}

export interface RemediateProvenanceResult {
  remediatedBody: string;
  violationsBefore: ProvenanceViolation[];
  /** violations remaining after the self-audit pass (null when selfAudit=false). */
  violationsAfterSelfAudit: ProvenanceViolation[] | null;
  violationsAfter: ProvenanceViolation[];
  rounds: number;
  strippedDeterministically: boolean;
}

// ---------------------------------------------------------------------------
// Prompt assembly (verbatim from the script)
// ---------------------------------------------------------------------------
export function selfAuditPrompt(
  body: string,
  transcript: string,
): { system: string; prompt: string } {
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

export function remediationPrompt(
  body: string,
  transcript: string,
  violations: ProvenanceViolation[],
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

// ---------------------------------------------------------------------------
// Default GLM rewrite (injectable)
// ---------------------------------------------------------------------------
function makeGlmRewrite(
  env?: Record<string, string | undefined>,
): RewriteFn {
  return async (system: string, prompt: string): Promise<string> => {
    const result = await generateText({
      model: getAgenticGLMModel(env),
      system,
      prompt,
      // GLM-5.2 reasoning burns the budget on thinking tokens — a generous ceiling keeps the
      // rewritten body from coming back empty.
      maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
    });
    return result.text ?? "";
  };
}

// ---------------------------------------------------------------------------
// Deterministic last-resort strip (guarantees 0 surviving detector-violations)
// ---------------------------------------------------------------------------
/**
 * Neutralize every violation by replacing the line(s) that carry the offending span with an
 * honest-gap marker. The surrounding structure survives; the unsupported receipt is removed
 * and flagged.
 *
 * NB (one strengthening over the script): the script appended `[unverified]` to a literal
 * `span` occurrence. That is a no-op for several checks — a `url_not_in_transcript` span is
 * the NORMALIZED url ("example.com/x"), never the literal "https://example.com/x" in the
 * body, and appending a marker would not remove the offending token from any check's view.
 * To meet the gate's invariant (zero surviving violations), this neutralizes at the line
 * granularity (the span literal OR a case-insensitive match) and verifies via re-detection.
 * The honest-gap marker preserves value-bearing structure while removing the bad receipt.
 */
export function stripViolationsDeterministically(
  body: string,
  violations: ProvenanceViolation[],
): string {
  let lines = body.split("\n");
  for (const v of violations) {
    if (!v.span) continue;
    const spanLower = v.span.toLowerCase();
    lines = lines.map((line) => {
      if (line.includes(v.span) || line.toLowerCase().includes(spanLower)) {
        return "> [unverified — claim could not be grounded in retrieved sources and was removed]";
      }
      return line;
    });
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Transcript serialization (the prompts + detector ground truth want a string view)
// ---------------------------------------------------------------------------
function serializeTranscript(records: TranscriptRecord[]): string {
  try {
    return JSON.stringify(records, null, 2);
  } catch {
    return String(records ?? "");
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
/**
 * In-memory remediation entry point. Faithful to the script's `remediateCell` flow, but the
 * body + transcript are passed in (no file I/O) and the GLM rewrite is injectable.
 */
export async function remediateProvenance(
  args: RemediateProvenanceArgs,
): Promise<RemediateProvenanceResult> {
  const {
    body: originalBody,
    transcript,
    section,
    subject,
    siblingTranscripts,
    siblingBodies,
    selfAudit = true,
    maxRounds = DEFAULT_MAX_GLM_ROUNDS,
    rewrite = makeGlmRewrite(args.env),
  } = args;

  const records = Array.isArray(transcript) ? transcript : [];
  const transcriptText = serializeTranscript(records);

  const detectArgs = {
    transcript: records,
    section,
    subject,
    siblingTranscripts,
    siblingBodies,
  };
  const detect = (candidate: string): ProvenanceViolation[] =>
    detectProvenanceViolations({ body: candidate, ...detectArgs }).violations;

  // baseline (raw) detection
  const violationsBefore = detect(originalBody);

  // §2a — model-level self-audit (measurement only; does not feed the convergence loop, to
  // mirror the script which runs self-audit as an independent measurement pass).
  let violationsAfterSelfAudit: ProvenanceViolation[] | null = null;
  if (selfAudit) {
    const sa = selfAuditPrompt(originalBody, transcriptText);
    const audited = await rewrite(sa.system, sa.prompt);
    // a rewrite that returns empty/whitespace is treated as "no change" (model produced no
    // usable body) — fall back to the original so the audit measurement is meaningful.
    const auditedBody = audited.trim().length > 0 ? audited : originalBody;
    violationsAfterSelfAudit = detect(auditedBody);
  }

  // §2 — constrained convergence loop
  let body = originalBody;
  let current = violationsBefore;
  let rounds = 0;
  while (current.length > 0 && rounds < maxRounds) {
    rounds++;
    const rp = remediationPrompt(body, transcriptText, current);
    const rewritten = await rewrite(rp.system, rp.prompt);
    // empty rewrite = no usable body; keep the prior body so the strip fallback can act on it.
    if (rewritten.trim().length > 0) body = rewritten;
    current = detect(body);
  }

  // last-resort deterministic strip — guarantees 0 surviving detector-violations
  let strippedDeterministically = false;
  if (current.length > 0) {
    strippedDeterministically = true;
    body = stripViolationsDeterministically(body, current);
    current = detect(body);
  }

  return {
    remediatedBody: body,
    violationsBefore,
    violationsAfterSelfAudit,
    violationsAfter: current,
    rounds,
    strippedDeterministically,
  };
}
