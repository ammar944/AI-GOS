#!/usr/bin/env tsx
/**
 * zz-claim-source-verifier.ts — THROWAWAY PROTOTYPE.
 *
 * Offline claim->source entailment verifier (the QA backlog "LLM-judge /
 * entailment verifier"). NOT wired to production — this proves the detector
 * works against the audit's labeled known violations. Stage B wires it as a
 * gate.
 *
 *   npx tsx scripts/zz-claim-source-verifier.ts <plan.json> --run <run_id>
 *   npx tsx scripts/zz-claim-source-verifier.ts --selftest   # runs all 4 labeled cases
 *
 * Pipeline per plan:
 *   1. Fetch the 6 committed positioning sections' markdown from Supabase
 *      (reuse of the fetch in zz-prove-lean-media-plan.ts).
 *   2. Extract EVERY grounded field across creativeFramework, anglesToTest,
 *      competitorReviewInsights, crossSectionInsight, audienceTypes[].detail.
 *   3. DETERMINISTIC pre-pass — INVALID_ENUM, EMPTY_SECTION_CITATION,
 *      FABRICATED_QUOTE (verbatim), and the UNVERIFIED->PASS short-circuit.
 *   4. LLM-judge — ONE batched deepseek-v4-flash call per plan that sees all
 *      remaining claims + the section text, returning a verdict array. Catches
 *      FABRICATION, PROVENANCE_INFLATION, MIS_ATTRIBUTION, semantic
 *      FABRICATED_QUOTE, and CONTRADICTION (an asserted fact a section flags
 *      as a gap / open question / contradicts).
 *
 * Flag types (per the spec):
 *   FABRICATION | PROVENANCE_INFLATION | MIS_ATTRIBUTION | FABRICATED_QUOTE |
 *   EMPTY_SECTION_CITATION | INVALID_ENUM | PASS
 *   (grounding === 'UNVERIFIED' is ALWAYS a PASS — honest hedging not punished.)
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import { z } from "zod";

const CANONICAL_ZONES = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
] as const;
type Zone = (typeof CANONICAL_ZONES)[number];

const EMPTY_BODY_CHARS = 200;

type FlagType =
  | "FABRICATION"
  | "PROVENANCE_INFLATION"
  | "MIS_ATTRIBUTION"
  | "FABRICATED_QUOTE"
  | "CONTRADICTION"
  | "EMPTY_SECTION_CITATION"
  | "INVALID_ENUM"
  // VERIFIER_ERROR — the judge could NOT produce a trustworthy verdict for this
  // claim (truncation / missing-verdict that survived a retry). It is a BLOCKING
  // status (counts as needs-review/fail at the gate), NEVER a silent PASS. A
  // truncated/incomplete judge must fail LOUD.
  | "VERIFIER_ERROR"
  | "PASS";

// Judge batching — claims are sent in small chunks so a verdict array cannot
// truncate. Each chunk re-injects the full 6-section context. On an incomplete
// chunk (non-stop finish or any missing verdict) we retry ONCE with a smaller
// chunk + more tokens; if that still fails, the chunk's claims become
// VERIFIER_ERROR (fail loud), never defaulted PASS.
const JUDGE_CHUNK_SIZE = 8;
const JUDGE_RETRY_CHUNK_SIZE = 4;
const JUDGE_MAX_OUTPUT_TOKENS = 16384;
const JUDGE_RETRY_MAX_OUTPUT_TOKENS = 24576;

interface Claim {
  id: string; // stable id e.g. "creativeFramework[5].USP"
  kind: string;
  // The headline text of the claim (hook / description / complaint / tension / detail)
  text: string;
  // The grounding assertion the author attached (may inflate provenance)
  grounding: string;
  // The single cited section (crossSectionInsight cites many -> joined)
  sourceSection: string;
}

interface Verdict {
  id: string;
  flag: FlagType;
  reason: string;
  by: "deterministic" | "judge";
}

// ----------------------------------------------------------------------------
// Supabase fetch (reuse of zz-prove-lean-media-plan.ts)
// ----------------------------------------------------------------------------
async function fetchSections(runId: string): Promise<Record<Zone, string>> {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) throw new Error("Supabase URL/key missing");
  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  const { data: arts, error: aErr } = await sb
    .from("research_artifacts")
    .select("id")
    .eq("run_id", runId)
    .limit(1);
  if (aErr) throw new Error("artifact query: " + aErr.message);
  const artifactId = arts?.[0]?.id;
  if (!artifactId) throw new Error("no artifact for run " + runId);

  const { data: sections, error: sErr } = await sb
    .from("research_artifact_sections")
    .select("zone,markdown")
    .eq("artifact_id", artifactId)
    .in("zone", CANONICAL_ZONES as unknown as string[])
    .eq("status", "complete");
  if (sErr) throw new Error("sections query: " + sErr.message);
  if (!sections?.length)
    throw new Error("no sections (RLS? need SUPABASE_SERVICE_ROLE_KEY)");

  const out = {} as Record<Zone, string>;
  for (const z of CANONICAL_ZONES) {
    const row = sections.find((s) => s.zone === z);
    out[z] = row?.markdown ?? "";
  }
  return out;
}

// ----------------------------------------------------------------------------
// Claim extraction — EVERY grounded field
// ----------------------------------------------------------------------------
function extractClaims(plan: any): Claim[] {
  const claims: Claim[] = [];
  const push = (c: Claim) => claims.push(c);

  // creativeFramework[] — hook + grounding + sourceSection
  (plan.creativeFramework ?? []).forEach((cf: any, i: number) => {
    push({
      id: `creativeFramework[${i}].${cf.label ?? i}`,
      kind: "creativeFramework.hook",
      text: cf.hook ?? "",
      grounding: cf.grounding ?? "",
      sourceSection: cf.sourceSection ?? "",
    });
  });

  // anglesToTest[]
  (plan.anglesToTest ?? []).forEach((a: any, i: number) => {
    push({
      id: `anglesToTest[${i}].${a.shortName ?? i}`,
      kind: "anglesToTest",
      text: a.description ?? a.shortName ?? "",
      grounding: a.grounding ?? "",
      sourceSection: a.sourceSection ?? "",
    });
  });

  // competitorReviewInsights[]
  (plan.competitorReviewInsights ?? []).forEach((c: any, i: number) => {
    push({
      id: `competitorReviewInsights[${i}]`,
      kind: "competitorReviewInsights",
      text: c.complaint ?? "",
      grounding: c.grounding ?? "",
      sourceSection: c.sourceSection ?? "",
    });
  });

  // crossSectionInsight[] — cites MANY sections
  (plan.crossSectionInsight ?? []).forEach((t: any, i: number) => {
    push({
      id: `crossSectionInsight[${i}]`,
      kind: "crossSectionInsight",
      text: t.tension ?? "",
      grounding: t.implicationForPlan ?? "",
      sourceSection: Array.isArray(t.sourceSections)
        ? t.sourceSections.join(", ")
        : (t.sourceSection ?? ""),
    });
  });

  // audienceTypes[].detail
  (plan.audienceTypes ?? []).forEach((a: any, i: number) => {
    push({
      id: `audienceTypes[${i}].${a.archetype ?? i}`,
      kind: "audienceTypes.detail",
      text: a.detail ?? "",
      grounding: a.grounding ?? "",
      sourceSection: a.sourceSection ?? "",
    });
  });

  // competitorMarketingInsights[] — adjacent grounded field. Spec's 5-field
  // list does not name it, but the RAMP R5 labeled violation (BILL "$45/$55"
  // tagged "...positioningCompetitorLandscape (verified)") lives here and is a
  // textbook PROVENANCE_INFLATION. Verifying it strengthens the detector; the
  // failure mode is identical to the other provenance-inflation cases.
  (plan.competitorMarketingInsights ?? []).forEach((c: any, i: number) => {
    push({
      id: `competitorMarketingInsights[${i}].${c.competitor ?? i}`,
      kind: "competitorMarketingInsights",
      text: [c.offer, c.positioning, c.messaging].filter(Boolean).join(" | "),
      grounding: c.grounding ?? "",
      sourceSection: c.sourceSection ?? "",
    });
  });

  return claims;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
const isUnverified = (g: string): boolean =>
  /^\s*unverified\b/i.test(g ?? "") || /\bunverified\b/i.test((g ?? "").trim().slice(0, 12));

// Does the buyer-facing text assert a SPECIFIC quantified customer-outcome — a
// hard delivered result with a number+unit ('10 day close', '3 day close',
// '100% data accuracy', 'reclaimed 20 hours a week', 'cuts meeting time by 30%',
// '5x faster')? Such a figure under an UNVERIFIED hedge is NOT honest hedging —
// it still points the buyer at a concrete claimed result, so it must be checked
// against the sections (FABRICATION if it lives nowhere). Generic numbers like a
// '1% lookalike' targeting setting or a '$X budget' are NOT outcome metrics.
function assertsQuantifiedOutcome(text: string): boolean {
  const t = (text ?? "").toLowerCase().replace(/[–—]/g, "-");
  // Strong, self-evident outcome metrics (a duration/result with an outcome unit).
  const strong: RegExp[] = [
    /\b\d+\s*-?\s*day\b/, // "10 day close", "3-day close"
    /\b\d+\s*hours?\b/, // "20 hours a week", "1-2 hours"
    /\b\d+\s*x\s*(?:faster|more|less)?\b/, // "5x faster"
  ];
  if (strong.some((re) => re.test(t))) return true;
  // A percentage or week/minute figure ONLY counts as an outcome if it sits near
  // an outcome cue — this excludes targeting settings ('1% lookalike') and
  // awareness splits, which are not delivered customer results.
  const outcomeCue =
    /(close|faster|accuracy|reclaim|save[ds]?|cut|cuts|reduc|fewer|decrease|increase|boost|roi|payback|productivity|efficien)/;
  const pct = /\b\d{1,3}\s*%/;
  const weekMin = /\b\d+\s*(?:weeks?|minutes?)\b/;
  if ((pct.test(t) || weekMin.test(t)) && outcomeCue.test(t)) return true;
  return false;
}

function normalizeForQuote(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9'%$.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pull quoted spans of >=4 words out of text. Double / typographic quotes are
// unambiguous. Straight single-quotes are ONLY treated as delimiters when the
// opening quote is NOT preceded by a letter (otherwise it is a possessive /
// contraction apostrophe, e.g. "Ramp's own messaging" — NOT a quote). This was
// the source of the crossSectionInsight false-positives.
function extractQuotedSpans(text: string): string[] {
  const spans: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const span = raw.trim();
    if (span.split(/\s+/).length >= 4 && !seen.has(span)) {
      seen.add(span);
      spans.push(span);
    }
  };

  // Double + typographic-double quotes, and typographic single (curly) quotes —
  // unambiguous delimiters.
  const unambig = /["“]([^"”]{12,}?)["”]|‘([^’]{12,}?)’/g;
  let m: RegExpExecArray | null;
  while ((m = unambig.exec(text)) !== null) add(m[1] ?? m[2] ?? "");

  // Straight single-quote pairs: opening ' must be at start or after a
  // non-letter; closing ' must be at end or before a non-letter.
  const straight = /(^|[^A-Za-z])'([^']{12,}?)'(?=[^A-Za-z]|$)/g;
  while ((m = straight.exec(text)) !== null) add(m[2] ?? "");

  return spans;
}

// Token-overlap verbatim check: is the quote's normalized token sequence a
// contiguous substring of any section? (allows minor punctuation drift).
function quoteAppearsVerbatim(quote: string, sections: Record<Zone, string>): boolean {
  const nq = normalizeForQuote(quote);
  if (!nq) return true; // empty -> don't flag
  for (const z of CANONICAL_ZONES) {
    const ns = normalizeForQuote(sections[z]);
    if (ns.includes(nq)) return true;
    // Allow a high-overlap fuzzy match (>=85% of quote's words contiguous-ish):
    const qWords = nq.split(" ");
    if (qWords.length >= 6) {
      const half = qWords.slice(0, Math.ceil(qWords.length * 0.7)).join(" ");
      if (ns.includes(half)) return true;
    }
  }
  return false;
}

function clip(s: string, n: number): string {
  if (!s) return "(empty section)";
  return s.length > n ? s.slice(0, n) + "\n…[truncated]" : s;
}

// Fuzzy "is this quoted span's substance in the section?" — tolerant of ellipsis
// drift and partial overlap. Used to check the CITED section LENIENTLY so an
// honest section-verdict paraphrase is NOT flagged as mis-attributed.
function spanFuzzyInSection(span: string, sectionText: string): boolean {
  const nq = normalizeForQuote(span);
  const ns = normalizeForQuote(sectionText);
  if (!nq) return true;
  if (ns.includes(nq)) return true;
  const w = nq.split(" ");
  if (w.length >= 6) {
    const head = w.slice(0, Math.ceil(w.length * 0.6)).join(" ");
    if (ns.includes(head)) return true;
    const tail = w.slice(Math.floor(w.length * 0.4)).join(" ");
    if (ns.includes(tail)) return true;
  }
  for (const chunk of span.split(/\.\.\.|…/)) {
    const c = normalizeForQuote(chunk);
    if (c.split(" ").length >= 4 && ns.includes(c)) return true;
  }
  return false;
}

// Strict "is this quoted span verbatim-contiguous in the section?" — no fuzzing.
function spanVerbatimInSection(span: string, sectionText: string): boolean {
  const nq = normalizeForQuote(span);
  if (nq.length < 10) return false;
  return normalizeForQuote(sectionText).includes(nq);
}

// Deterministic MIS_ATTRIBUTION via a mis-stamped verbatim quote: a quoted span
// (in the claim text OR grounding) that is present VERBATIM-CONTIGUOUS in a
// NON-cited section yet is NOT even fuzzily present in ANY cited section. This is
// the textbook provenance lie — a real sentence lifted from another section and
// stamped to the cited one. It is HIGH-PRECISION (proven zero false positives on
// the labeled clean set: honest section-verdict paraphrases ARE fuzzily present
// in their cited section, so they are excluded). It gives the judge-flaky
// provenance cases a STABLE deterministic recall floor.
function findMisStampedQuote(
  text: string,
  grounding: string,
  citedZones: Zone[],
  sections: Record<Zone, string>,
): { span: string; zone: Zone } | null {
  const spans = [...extractQuotedSpans(grounding ?? ""), ...extractQuotedSpans(text ?? "")];
  // ALSO grab the full quoted region between the FIRST and LAST quote char of a
  // review-complaint wrapper like `paraphrased pattern: 'Per-seat pricing ...
  // you're trying ...'`. The generic single-quote extractor truncates at the
  // first inner apostrophe ("you're"), so the verbatim review sentence is missed.
  // First-to-last gives the full sentence whose provenance we must check.
  for (const src of [text ?? "", grounding ?? ""]) {
    const first = src.search(/['‘]/);
    const last = Math.max(src.lastIndexOf("'"), src.lastIndexOf("’"));
    if (first !== -1 && last > first + 12) {
      const full = src.slice(first + 1, last).trim();
      if (full.split(/\s+/).length >= 4 && !spans.includes(full)) spans.push(full);
    }
  }
  for (const span of spans) {
    const inCited = citedZones.some((z) => spanFuzzyInSection(span, sections[z] ?? ""));
    if (inCited) continue;
    const elsewhere = CANONICAL_ZONES.find(
      (z) => !citedZones.includes(z) && spanVerbatimInSection(span, sections[z] ?? ""),
    );
    if (elsewhere) return { span, zone: elsewhere };
  }
  return null;
}

// Pull distinctive whole-number counts (>=3 digits, e.g. "404", "2,389",
// "500K") out of a string. These are high-signal: a precise count attributed to
// a section that lacks it — while another section contains it — is a textbook
// MIS_ATTRIBUTION the LLM judge tends to rationalize away ("pain language
// supports it"). 1-2 digit numbers and money/multiplier tokens are excluded
// (handled by the judge / other rules) to keep this deterministic check precise.
function extractDistinctiveCounts(s: string): string[] {
  const out: string[] = [];
  const re = /(?<![\d.$])\b(\d{1,3}(?:,\d{3})+|\d{3,})(k\+?)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(m[1].replace(/,/g, ""));
  }
  return [...new Set(out)];
}

// Does the section text contain this numeric count (comma-insensitive)?
function sectionHasCount(section: string, count: string): boolean {
  const ns = section.replace(/,/g, "");
  return new RegExp(`\\b${count}\\b`).test(ns);
}

// Money tokens ($12, $10/seat, $15K+, $8.4B) from a claim's text — used by the
// competitorMarketingInsights price false-alarm guard.
function extractMoneyTokens(s: string): string[] {
  const out: string[] = [];
  const re = /\$\s?\d[\d,]*(?:\.\d+)?\s?[kmb]?\+?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(m[0]);
  return [...new Set(out)];
}

const normMoney = (s: string): string =>
  s.toLowerCase().replace(/[–—]/g, "-").replace(/,/g, "").replace(/\s+/g, "");

// Is the numeric core of this money token present verbatim in ANY section?
// (Matches just the figure so "$10" matches "$10/seat/month" and "$15K+"
// matches "$15K+/year". The competitor's own price line lives somewhere in the
// six sections — usually the CompetitorLandscape pricing table.)
function moneyAppearsVerbatim(token: string, sections: Record<Zone, string>): boolean {
  const core = normMoney(token).replace(/\+$/, "").replace(/\/.*$/, "");
  if (!core) return false;
  for (const z of CANONICAL_ZONES) {
    if (normMoney(sections[z]).includes(core)) return true;
  }
  return false;
}

// Longest run of CONSECUTIVE claim-text words that appears verbatim in `section`.
// Used by the multi-word false-alarm guard: if a long contiguous span of the
// claim's own wording is literally present in the CITED section, the judge's
// "this fact is absent from the cited section" verdict is provably a
// hallucination (the Fellow integration-list mode: 'Slack, Zoom, Meet, Teams,
// Jira, Asana' IS in CompetitorLandscape).
function maxContiguousRun(claimText: string, section: string): number {
  const cw = normalizeForQuote(claimText).split(" ").filter(Boolean);
  const ns = " " + normalizeForQuote(section) + " ";
  let best = 0;
  for (let i = 0; i < cw.length; i++) {
    for (let j = i + 1; j <= cw.length; j++) {
      const span = cw.slice(i, j).join(" ");
      if (ns.includes(" " + span + " ")) {
        best = Math.max(best, j - i);
      } else {
        break;
      }
    }
  }
  return best;
}

// Does the claim text have a >=N-word verbatim run in ANY of its CITED sections?
const CITED_VERBATIM_RUN_MIN = 6;
function claimHasLongVerbatimRunInCited(
  claimText: string,
  citedZones: Zone[],
  sections: Record<Zone, string>,
): boolean {
  return citedZones.some(
    (z) => maxContiguousRun(claimText, sections[z] ?? "") >= CITED_VERBATIM_RUN_MIN,
  );
}

// Distinctive PERCENTAGE-RANGE tokens ONLY ('85-92%', '85–92%', '70-80%') — the
// accuracy-benchmark signature the judge recurrently hallucinates as absent from
// a cited section that actually contains it. Deliberately NARROW: a two-number
// range with a percent. It excludes bare counts ('150+') and single percentages
// ('40%', '100%'), because a claim can legitimately carry a present count/percent
// AND a separate fabricated/mis-attributed fact (Clay 'no database cap' alongside
// a real '150+'; Clay PST3 a real '40%' alongside a mis-stamped frame) — only the
// distinctive two-sided benchmark range is safe to treat as a presence proof.
function extractRangeTokens(s: string): string[] {
  const t = (s ?? "").replace(/[–—]/g, "-");
  const out: string[] = [];
  const re = /\b\d{1,3}\s*-\s*\d{1,3}\s*%/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) out.push(m[0].replace(/\s+/g, ""));
  return [...new Set(out)];
}
function rangeTokenInCited(
  token: string,
  citedZones: Zone[],
  sections: Record<Zone, string>,
): boolean {
  const core = token.replace(/[–—]/g, "-").replace(/\s+/g, "").toLowerCase();
  return citedZones.some((z) =>
    (sections[z] ?? "").replace(/[–—]/g, "-").replace(/\s+/g, "").toLowerCase().includes(core),
  );
}

// ----------------------------------------------------------------------------
// Deterministic pre-pass
// ----------------------------------------------------------------------------
function deterministicPass(
  claims: Claim[],
  sections: Record<Zone, string>,
): { verdicts: Verdict[]; needJudge: Claim[] } {
  const verdicts: Verdict[] = [];
  const needJudge: Claim[] = [];

  for (const c of claims) {
    // Compute cited zones up front — the STRUCTURAL citation checks (invalid
    // enum, dead/empty section) run BEFORE the UNVERIFIED short-circuit. A
    // citation pointing at a non-existent enum value or a structurally-empty
    // section is a provenance lie that an "honest hedge" label cannot excuse:
    // an UNVERIFIED hook that still stamps sourceSection=<empty BuyerICP> is a
    // dead citation, not honest hedging. (Recovers the Airtable audienceTypes
    // case where the hook hedges UNVERIFIED but cites a 21-char BuyerICP body.)
    const citedZones = c.sourceSection
      .split(/[,+]/)
      .map((z) => z.trim())
      .filter(Boolean);

    // (a) INVALID_ENUM — sourceSection not one of the 6 (crossSection cites many,
    //     so check each token).
    const badZone = citedZones.find(
      (z) => !(CANONICAL_ZONES as readonly string[]).includes(z),
    );
    if (badZone) {
      verdicts.push({
        id: c.id,
        flag: "INVALID_ENUM",
        reason: `sourceSection '${badZone}' is not one of the 6 canonical zones`,
        by: "deterministic",
      });
      continue;
    }

    // (b) EMPTY_SECTION_CITATION — cited section body < 200 chars / 0 claims.
    //     Only when a real section IS cited (citedZones non-empty); a claim with
    //     no sourceSection at all is left to the UNVERIFIED / judge path.
    const emptyCited = (citedZones as Zone[]).find(
      (z) => (sections[z] ?? "").trim().length < EMPTY_BODY_CHARS,
    );
    if (citedZones.length > 0 && emptyCited) {
      verdicts.push({
        id: c.id,
        flag: "EMPTY_SECTION_CITATION",
        reason: `cites '${emptyCited}' whose body is <${EMPTY_BODY_CHARS} chars (effectively empty)`,
        by: "deterministic",
      });
      continue;
    }

    // (c) UNVERIFIED short-circuit -> PASS, never punished. Runs AFTER the
    //     structural citation checks: honest hedging is protected, but only once
    //     we know the citation it carries is to a real, existing section.
    //     EXCEPTION: an UNVERIFIED label does NOT license shipping a SPECIFIC
    //     fabricated customer-outcome metric in the buyer-facing TEXT ('10 day
    //     close -> 3 day', '100% data accuracy', 'reclaimed 20 hours a week',
    //     'cuts X by 30%'). An honest hedge asserts no hard delivered result; a
    //     hook that hides a concrete fabricated figure under 'UNVERIFIED' still
    //     points the buyer at an invented outcome -> route to the judge, which
    //     PASSes it if the figure is real somewhere and FABRICATION-flags it if
    //     it appears in no section (the wrong-vertical case).
    if (isUnverified(c.grounding)) {
      if (assertsQuantifiedOutcome(c.text)) {
        needJudge.push(c);
        continue;
      }
      verdicts.push({
        id: c.id,
        flag: "PASS",
        reason: "grounding declared UNVERIFIED (honest hedge), citation structurally valid",
        by: "deterministic",
      });
      continue;
    }

    // (c2) MIS_ATTRIBUTION via distinctive count — a >=3-digit count asserted in
    //      the grounding/text that is ABSENT from every cited section but PRESENT
    //      in another section. High-precision: catches the "404 action-item
    //      mentions cited to VoC but living in OfferDiagnostic" class the judge
    //      rationalizes away. (If absent everywhere, leave it to the judge to
    //      decide FABRICATION vs supported-prose.)
    const counts = [
      ...extractDistinctiveCounts(c.grounding),
      ...extractDistinctiveCounts(c.text),
    ];
    const citedSet = new Set(citedZones as Zone[]);
    const misattributedCount = counts.find((n) => {
      const inCited = (citedZones as Zone[]).some((z) => sectionHasCount(sections[z] ?? "", n));
      if (inCited) return false;
      const elsewhereZone = CANONICAL_ZONES.find(
        (z) => !citedSet.has(z) && sectionHasCount(sections[z] ?? "", n),
      );
      return Boolean(elsewhereZone);
    });
    if (misattributedCount) {
      const elsewhereZone = CANONICAL_ZONES.find(
        (z) => !citedSet.has(z) && sectionHasCount(sections[z] ?? "", misattributedCount),
      );
      verdicts.push({
        id: c.id,
        flag: "MIS_ATTRIBUTION",
        reason: `count '${misattributedCount}' is absent from cited ${c.sourceSection} but present in ${elsewhereZone}`,
        by: "deterministic",
      });
      continue;
    }

    // (c3) MIS_ATTRIBUTION via mis-stamped verbatim quote — a quoted phrase (in
    //      text or grounding) present verbatim-contiguous in a NON-cited section
    //      but absent (even fuzzily) from every cited section. Deterministic,
    //      proven zero-FP on the labeled clean set. Stabilizes the judge-flaky
    //      provenance cases (e.g. Ramp 'no visibility into spend' stamped to VoC
    //      but living verbatim in BuyerICP).
    const misStamped = findMisStampedQuote(
      c.text,
      c.grounding,
      citedZones as Zone[],
      sections,
    );
    if (misStamped) {
      verdicts.push({
        id: c.id,
        flag: "MIS_ATTRIBUTION",
        reason: `quoted phrase "${misStamped.span.slice(0, 50)}…" absent from cited ${c.sourceSection} but verbatim in ${misStamped.zone}`,
        by: "deterministic",
      });
      continue;
    }

    // (d) FABRICATED_QUOTE — quoted spans presented as a REAL CUSTOMER REVIEW
    //     not verbatim in any section. Restricted to `competitorReviewInsights`
    //     claims, where a quoted span genuinely purports to be a buyer review.
    //     Quoted spans in hooks / anglesToTest descriptions / competitorMarketing
    //     are PROPOSED CREATIVE (the ad line being tested) or a competitor's own
    //     marketing copy — NOT a claimed-real-review quote — so the deterministic
    //     verbatim rule must NOT fire there (it over-flagged Ramp's "AI co-pilot"
    //     test line and Brex's "corporate card for startups" positioning label).
    //     Those go to the judge, which handles paraphrase-vs-verbatim
    //     semantically and only flags substance that is absent from every section.
    const quotedSpans =
      c.kind === "competitorReviewInsights" ? extractQuotedSpans(c.text) : [];
    const fabricatedQuote = quotedSpans.find(
      (q) => !quoteAppearsVerbatim(q, sections),
    );
    if (fabricatedQuote) {
      verdicts.push({
        id: c.id,
        flag: "FABRICATED_QUOTE",
        reason: `quoted text "${fabricatedQuote.slice(0, 70)}…" not found verbatim in any section`,
        by: "deterministic",
      });
      continue;
    }

    // Everything else needs the entailment judge.
    needJudge.push(c);
  }

  return { verdicts, needJudge };
}

// ----------------------------------------------------------------------------
// LLM-judge — ONE batched call per plan
// ----------------------------------------------------------------------------
const judgeVerdictSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string().describe("the claim id, copied verbatim"),
      flag: z
        .string()
        .describe(
          "one of: FABRICATION, PROVENANCE_INFLATION, MIS_ATTRIBUTION, FABRICATED_QUOTE, CONTRADICTION, PASS",
        ),
      reason: z.string().describe("one sentence: the specific fact and why it fails"),
    }),
  ),
});

// Telemetry for one physical judge API call (for the per-plan summary).
interface JudgeCallStat {
  chunk: number; // 1-based chunk index
  attempt: number; // 1 = first try, 2 = retry
  claimsInBatch: number;
  verdictsReturned: number;
  finishReason: string;
  complete: boolean; // finishReason==='stop' AND every batch id covered
}

// Recover verdict objects from raw judge text when Output.object did not yield a
// well-shaped object. Handles: (1) a wrapped `{ "verdicts": [...] }`, (2) a BARE
// top-level array `[{...}]`, and (3) a last-resort per-object regex scrape. Never
// invents verdicts — only extracts what the model actually wrote.
function recoverVerdictsFromText(
  txt: string,
): Array<{ id: string; flag: string; reason: string }> {
  if (!txt) return [];
  // (1)+(2): parse the largest JSON value (object or array) in the text.
  const objStart = txt.indexOf("{");
  const arrStart = txt.indexOf("[");
  const candidates: string[] = [];
  if (arrStart !== -1) {
    const arrEnd = txt.lastIndexOf("]");
    if (arrEnd > arrStart) candidates.push(txt.slice(arrStart, arrEnd + 1));
  }
  if (objStart !== -1) {
    const objEnd = txt.lastIndexOf("}");
    if (objEnd > objStart) candidates.push(txt.slice(objStart, objEnd + 1));
  }
  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.verdicts)) return parsed.verdicts;
    } catch {
      /* try next candidate / regex */
    }
  }
  // (3): per-object regex scrape (order of keys may vary, so match loosely).
  const out: Array<{ id: string; flag: string; reason: string }> = [];
  const objRe =
    /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"flag"\s*:\s*"([^"]+)"\s*,\s*"reason"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(txt)) !== null) {
    out.push({ id: m[1], flag: m[2], reason: m[3] });
  }
  return out;
}

// ONE physical judge call over a batch of claims. Returns the verdicts the model
// actually produced (recovered from raw text if Output.object truncates) PLUS
// the finishReason — the caller decides completeness, never this function.
async function judgeCall(
  batch: Claim[],
  sections: Record<Zone, string>,
  maxOutputTokens: number,
): Promise<{
  byId: Map<string, { id: string; flag: string; reason: string }>;
  finishReason: string;
}> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");

  const sectionBlock = CANONICAL_ZONES.map(
    (z) => `\n### ${z}\n${clip(sections[z], 5000)}`,
  ).join("\n");

  const claimBlock = batch
    .map(
      (c) =>
        `- id: ${c.id}\n  cited_section: ${c.sourceSection}\n  claim_text: ${c.text}\n  grounding_assertion: ${c.grounding}`,
    )
    .join("\n");

  const system =
    "You are a careful, EVIDENCE-FIRST fact-checker auditing a paid-media plan against the SIX research sections it claims to be grounded in. You verify ENTAILMENT, but you flag ONLY what you can PROVE wrong by quoting the sections. The dominant failure mode you must avoid is FALSE ALARMS: flagging a fact as missing/contradicted when it is actually present verbatim or as a clear paraphrase in one of the six sections. Before you raise ANY flag you MUST quote the exact section sentence that proves the absence or contradiction; if you cannot quote such a sentence, the verdict is PASS. You do NOT punish honest hedging or minor wording drift. Output only the structured verdict array — one verdict per claim id, every id covered exactly once.";

  const prompt = [
    "For EACH claim run this EXACT procedure, then assign ONE flag:",
    "  STEP A — Isolate the load-bearing tokens: every hard number/%/dollar, named mechanism (e.g. 'three-way matching', 'OCR'), competitor parity figure, quoted span, and the grounding's provenance word ('verified'/'public info'/etc). IGNORE generic ad-copy phrasing, calls-to-action, and stylistic wording — only specific facts are load-bearing. CRITICAL: quoted phrases INSIDE the grounding_assertion (e.g. grounding says \"buyer quotes describe 'approval bottlenecks' and 'no visibility into spend'\" cited to VoiceOfCustomer; or \"white-space opening: 'technical operators hitting Apollo ceiling' — from CompetitorLandscape\") are PROVENANCE CLAIMS: that exact phrase must appear in the section the grounding names / the claim cites. A quoted phrase in the grounding attributed to a section that does NOT contain it is MIS_ATTRIBUTION (phrase is in another section) or FABRICATED_QUOTE (phrase is in NO section).",
    "  STEP B — SEARCH ALL SIX SECTIONS for each token (not only the cited one). For each token decide: PRESENT (verbatim or a clear paraphrase / minor wording drift in SOME section) or ABSENT (in NO section). When present, copy the exact supporting sentence.",
    "  STEP C — Only for tokens you judged ABSENT or for an asserted capability/outcome: scan all six sections for a sentence that explicitly CONTRADICTS or FLAGS it (look for 'must manually', 'unverifiable', 'open question', 'not disclosed', 'self-reported', 'proprietary', '#1 objection', gap/flag/contradiction markers). Copy that exact sentence.",
    "",
    "THE EVIDENCE RULE (decides every flag): you may raise a flag ONLY if you can QUOTE the exact section sentence that justifies it. For CONTRADICTION quote the contradicting sentence. For MIS_ATTRIBUTION quote the sentence in the OTHER section that actually contains the token (and confirm the cited section lacks it). For FABRICATION the proof is the ABSENCE of the specific asserted fact from ALL SIX sections after you have actually scanned them — so a FABRICATION verdict must name the exact fabricated token (the number/metric/timeframe/mechanism). If you can neither quote a contradiction/other-section sentence NOR name a specific asserted fact that is absent everywhere, the verdict is PASS.",
    "",
    "FLAGS (pick the FIRST that applies):",
    "CONTRADICTION — you can QUOTE a section sentence that directly contradicts the claim or flags the asserted capability/outcome as an OPEN buyer question / unverifiable marketing copy / a known gap / the #1 objection, yet the claim asserts it as delivered fact. (e.g. hook says 'no manual data entry' but OfferDiagnostic says 'you must manually sync the new vendor to your ERP'.) Quote the contradicting section + sentence in `reason`. BUT NOT A REASSURANCE THAT ADDRESSES THE OBJECTION: a hook that openly ACKNOWLEDGES a documented objection and promises transparency about it ('No credit overage — I'll show you the real cost before you pay', 'see the true price upfront', 'we'll show you exactly what you'll pay') is HONORING the red flag, not denying it — that is PASS, not contradiction. Only flag CONTRADICTION when the hook DENIES the objection exists or asserts the opposite as delivered fact.",
    "FABRICATION — a SPECIFIC asserted fact (a hard number, %, metric, timeframe, named mechanism, or a customer-outcome figure presented as delivered — e.g. 'cuts meeting time by 30%', 'reclaim 1-2 hours/week', '10 day close to 3 day', 'cut tooling costs by 40%', 'pays for itself before month one', 'no manual data entry', 'free CRM') that appears in NO section AT ALL after you scan all six. Name the fabricated token. NOTE: a fact stated only as a generic benefit/CTA with no specific figure is NOT fabrication; a fabricated SPECIFIC figure is. A specific number invented to dramatize a before/after IS fabrication even if a vaguer real stat exists.",
    "MIS_ATTRIBUTION — the load-bearing token is ABSENT from EVERY cited section but you can QUOTE it in a DIFFERENT (non-cited) section (e.g. a precise count like '404 action-item mentions' cited to VoiceOfCustomer but the sentence containing '404' is in OfferDiagnostic; a 'single operator replaces a team' frame stamped to OfferDiagnostic but the sentence is in VoiceOfCustomer; a verbatim review quote stamped to VoiceOfCustomer but the exact sentence is in OfferDiagnostic). If the token IS present in any cited section, this is NOT mis-attribution.",
    "PROVENANCE_INFLATION — the grounding_assertion uses a provenance word ('verified' / 'from <section> (verified)' / 'company site verified' / 'public info') but you scanned and the specific fact is in NO section (or a section flags it a gap). The hedge is dishonest.",
    "FABRICATED_QUOTE — a quoted span explicitly presented as a REAL CUSTOMER REVIEW whose SUBSTANCE is absent from every section. A proposed creative ad line or a competitor's own marketing copy in quotes is NOT a fabricated review quote.",
    "PASS — every load-bearing token is PRESENT (verbatim or clear paraphrase) in the cited section OR a sibling section that is a defensible source, and no section sentence contradicts it.",
    "",
    "RULES (read carefully — half are to catch fabrication, half to stop FALSE ALARMS):",
    "- Keep every `reason` under 30 words and INCLUDE the specific token plus a short quote of the section sentence (for CONTRADICTION/MIS_ATTRIBUTION) or the named fabricated token (for FABRICATION).",
    "- DO catch fabricated outcome numbers: a SPECIFIC performance/outcome figure ('30%', '1-2 hours/week', '10 day -> 3 day', '40% cost cut', '20 hours a week', '100% data accuracy', 'pays for itself before month one') asserted in a hook that appears in NO section is FABRICATION — do not excuse it because a vaguer or different real stat exists, and do not require a contradicting sentence (absence is the proof).",
    "- DO catch wrong-vertical / wrong-product copy: a hook describing a capability or outcome for a DIFFERENT product category than the six sections describe (e.g. expense-receipt reconciliation or month-end close copy on a no-code database; OCR/three-way-matching on a meeting tool) is FABRICATION — the specific mechanism appears in no section.",
    "- CHECK THE CITED SECTION FIRST, and do it carefully: a fact present (verbatim or clear paraphrase) in the CITED section is a PASS, full stop. Before you EVER say a token is absent from the cited section you MUST quote the cited section to yourself — competitor prices, accuracy benchmarks ('85-92% vs 70-80%'), and integration lists ('Slack, Zoom, Meet, Teams, Jira, Asana') ARE written in these sections (often the CompetitorLandscape pricing table or integration axis). Re-scan before flagging. If the token is genuinely in the cited section, PASS even if it also appears in a sibling.",
    "- VERBATIM PRICES/NUMBERS ARE NEVER FABRICATION: if the claim states a competitor price or figure ('$10/seat/month', '$30/user/month', '$15K+ entry', '$12/user/mo', '$8.4B', '85-92%') and that exact number appears ANYWHERE in the six sections, it is PASS. SCAN the pricing table before you ever say a competitor price is absent — these prices ARE in the sections.",
    "- COMPETITOR-MARKETING GLOSS IS PASS: a competitorMarketingInsights 'Marketed: ... Backend: ...' line is a paraphrased gloss of a documented competitor. PASS it when the competitor's prices/positioning are documented; flag it ONLY if it invents a specific NAMED feature/price that is absent AND not a fair paraphrase (e.g. Apollo 'free CRM' when no section says that).",
    "- PARAPHRASE OF SUBSTANCE IS PASS, BUT A MIS-STAMPED VERBATIM QUOTE IS NOT: a complaint/offer that PARAPHRASES a point made in the CITED section is PASS. HOWEVER, when a claim presents a VERBATIM QUOTE (exact wording in quotation marks) and stamps it to a cited section, that EXACT sentence must be in the CITED section. If the exact quoted sentence lives in a DIFFERENT section (e.g. a G2/Trustpilot quote stamped to VoiceOfCustomer but the exact sentence is in OfferDiagnostic), that is MIS_ATTRIBUTION even though the broad sentiment also appears in the cited section.",
    "- MIS_ATTRIBUTION = the load-bearing token (a precise count, a verbatim quoted sentence, a named white-space phrase) is ABSENT FROM THE CITED SECTION but you can quote it in another section. The grounding's OWN provenance claim is binding: if the grounding says a figure/frame is 'from OfferDiagnostic' but the figure actually lives in VoiceOfCustomer (and not in OfferDiagnostic), flag MIS_ATTRIBUTION — honor what the grounding claims and check THAT section.",
    "- A named white-space / positioning phrase the grounding attributes to a specific section ('directly sourced from CompetitorLandscape exploitable opening', 'from OfferDiagnostic') must appear in THAT section. If the verbatim phrase is in a different section, MIS_ATTRIBUTION.",
    "- For a borderline CONTRADICTION you cannot pin down with a quote, PASS. But a specific fabricated figure absent everywhere is FABRICATION; a precise figure/verbatim-quote/named-phrase absent from the cited-or-grounding-named section but present elsewhere is MIS_ATTRIBUTION — these are NOT borderline, flag them.",
    "",
    "=== SIX SECTIONS ===",
    sectionBlock,
    "",
    "=== CLAIMS TO JUDGE ===",
    claimBlock,
  ].join("\n");

  const deepseek = createDeepSeek({ apiKey });
  const model = deepseek("deepseek-v4-flash");

  // generateText() with Output.object THROWS (NoObjectGeneratedError) when the
  // model emits valid JSON in the WRONG shape — most commonly a BARE ARRAY
  // `[{...}]` instead of `{ "verdicts": [...] }` — even with finishReason==='stop'.
  // That must NOT crash the run: the error object carries `.text` and
  // `.finishReason`, so we recover the verdicts from raw text and let the caller
  // decide completeness. A malformed-but-complete response becomes recovered
  // verdicts (or, if truly unrecoverable, VERIFIER_ERROR) — never a process crash,
  // never a silent defaulted PASS.
  let outputVerdicts: Array<{ id: string; flag: string; reason: string }> | null = null;
  let rawText = "";
  let finishReason = "unknown";
  try {
    const result = await generateText({
      model,
      output: Output.object({
        schema: judgeVerdictSchema,
        name: "ClaimVerdicts",
        description: "Entailment verdict per claim id.",
      }),
      // temperature 0 — a verifier must be DETERMINISTIC. A sampling judge gives
      // run-to-run verdict drift (a fabricated 'database cap' flagged on one run,
      // PASSed the next), which is unacceptable for a gate and makes precision/
      // recall unmeasurable. Greedy decoding also reduces the hallucinated-absence
      // false-alarm mode.
      temperature: 0,
      maxOutputTokens,
      abortSignal: AbortSignal.timeout(180_000),
      system,
      prompt,
    });
    rawText = result.text ?? "";
    finishReason = result.finishReason ?? "unknown";
    try {
      outputVerdicts = (result.output?.verdicts ?? null) as typeof outputVerdicts;
    } catch {
      outputVerdicts = null; // fall through to raw-text recovery below
    }
  } catch (err: any) {
    // NoObjectGeneratedError (or any generate throw): salvage text + finishReason.
    rawText = (err?.text as string) ?? "";
    finishReason = (err?.finishReason as string) ?? "error";
    outputVerdicts = null;
  }

  let raw: Array<{ id: string; flag: string; reason: string }> = outputVerdicts ?? [];
  if (!outputVerdicts) {
    raw = recoverVerdictsFromText(rawText);
  }
  const byId = new Map(raw.map((v) => [v.id, v]));
  return { byId, finishReason };
}

const JUDGE_ALLOWED_FLAGS: FlagType[] = [
  "FABRICATION",
  "PROVENANCE_INFLATION",
  "MIS_ATTRIBUTION",
  "FABRICATED_QUOTE",
  "CONTRADICTION",
  "PASS",
];

function toVerdict(
  c: Claim,
  v: { id: string; flag: string; reason: string } | undefined,
): Verdict {
  const flagRaw = (v?.flag ?? "PASS").toUpperCase().trim();
  const flag = (JUDGE_ALLOWED_FLAGS as string[]).includes(flagRaw)
    ? (flagRaw as FlagType)
    : "PASS";
  return {
    id: c.id,
    flag,
    reason: v?.reason ?? "(judge returned no verdict)",
    by: "judge" as const,
  };
}

// Run ONE chunk through the judge with complete-or-error semantics:
//   - call → assert finishReason==='stop' AND every claim id covered.
//   - incomplete → retry ONCE with a smaller chunk + more tokens.
//   - still incomplete → the claims that STILL lack a verdict become
//     VERIFIER_ERROR (fail loud). Claims that DID get a verdict keep it.
async function judgeChunk(
  chunk: Claim[],
  sections: Record<Zone, string>,
  chunkIndex: number,
  stats: JudgeCallStat[],
): Promise<Verdict[]> {
  const isComplete = (
    batch: Claim[],
    byId: Map<string, { id: string; flag: string; reason: string }>,
    finishReason: string,
  ): boolean =>
    finishReason === "stop" && batch.every((c) => byId.has(c.id));

  // Attempt 1 — full chunk.
  const first = await judgeCall(chunk, sections, JUDGE_MAX_OUTPUT_TOKENS);
  const firstComplete = isComplete(chunk, first.byId, first.finishReason);
  stats.push({
    chunk: chunkIndex,
    attempt: 1,
    claimsInBatch: chunk.length,
    verdictsReturned: chunk.filter((c) => first.byId.has(c.id)).length,
    finishReason: first.finishReason,
    complete: firstComplete,
  });
  if (firstComplete) {
    return chunk.map((c) => toVerdict(c, first.byId.get(c.id)));
  }

  console.log(
    `  [judge] chunk ${chunkIndex} INCOMPLETE (finishReason=${first.finishReason}, ` +
      `${chunk.filter((c) => first.byId.has(c.id)).length}/${chunk.length} verdicts) — retrying smaller`,
  );

  // Attempt 2 — re-judge ONLY the still-missing claims, in sub-chunks of
  // JUDGE_RETRY_CHUNK_SIZE, with more tokens. Carry forward any verdicts the
  // first call DID return.
  const recovered = new Map(first.byId);
  const stillMissing = chunk.filter((c) => !recovered.has(c.id));
  for (let i = 0; i < stillMissing.length; i += JUDGE_RETRY_CHUNK_SIZE) {
    const sub = stillMissing.slice(i, i + JUDGE_RETRY_CHUNK_SIZE);
    const retry = await judgeCall(sub, sections, JUDGE_RETRY_MAX_OUTPUT_TOKENS);
    const retryComplete = isComplete(sub, retry.byId, retry.finishReason);
    stats.push({
      chunk: chunkIndex,
      attempt: 2,
      claimsInBatch: sub.length,
      verdictsReturned: sub.filter((c) => retry.byId.has(c.id)).length,
      finishReason: retry.finishReason,
      complete: retryComplete,
    });
    for (const c of sub) {
      const v = retry.byId.get(c.id);
      if (v) recovered.set(c.id, v);
    }
  }

  // Final assembly: any claim STILL without a verdict fails loud.
  return chunk.map((c) => {
    const v = recovered.get(c.id);
    if (v) return toVerdict(c, v);
    return {
      id: c.id,
      flag: "VERIFIER_ERROR" as FlagType,
      reason:
        "judge truncated/incomplete after retry — no trustworthy verdict (BLOCKS, never a silent PASS)",
      by: "judge" as const,
    };
  });
}

async function judgePass(
  claims: Claim[],
  sections: Record<Zone, string>,
): Promise<{ verdicts: Verdict[]; stats: JudgeCallStat[] }> {
  if (claims.length === 0) return { verdicts: [], stats: [] };
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");

  const stats: JudgeCallStat[] = [];
  const verdicts: Verdict[] = [];
  let chunkIndex = 0;
  for (let i = 0; i < claims.length; i += JUDGE_CHUNK_SIZE) {
    chunkIndex++;
    const chunk = claims.slice(i, i + JUDGE_CHUNK_SIZE);
    const chunkVerdicts = await judgeChunk(chunk, sections, chunkIndex, stats);
    verdicts.push(...chunkVerdicts);
  }
  return { verdicts, stats };
}

// ----------------------------------------------------------------------------
// Orchestration for one plan
// ----------------------------------------------------------------------------
interface PlanSummary {
  totalClaims: number;
  judged: number; // claims routed to the judge
  deterministicFlags: number; // non-PASS deterministic verdicts
  judgeFlags: number; // non-PASS, non-VERIFIER_ERROR judge verdicts
  verifierErrors: number; // VERIFIER_ERROR count (BLOCKING)
  stats: JudgeCallStat[];
}

async function verifyPlan(
  planPath: string,
  runId: string,
): Promise<{ verdicts: Verdict[]; claims: Claim[]; summary: PlanSummary }> {
  const plan = JSON.parse(readFileSync(planPath, "utf8")).plan;
  const sections = await fetchSections(runId);
  const claims = extractClaims(plan);
  const { verdicts: detVerdicts, needJudge } = deterministicPass(claims, sections);
  const { verdicts: judgeVerdicts, stats } = await judgePass(needJudge, sections);

  // Deterministic FALSE-ALARM guard (the "Fellow over-flag" mode): the judge is
  // unreliable at scanning the CompetitorLandscape pricing table and recurrently
  // FABRICATION-flags a competitor price that is present verbatim ($12 Brex, $10
  // Fireflies, $30 Otter, $15K+ ZoomInfo, $8.4B Smartsheet). For a
  // competitorMarketingInsights claim whose stated money tokens ALL appear
  // verbatim in some section, a FABRICATION/PROVENANCE_INFLATION verdict is a
  // hallucinated absence -> downgrade to PASS. Claims with NO money token (e.g.
  // Apollo 'free CRM') are untouched, so genuine fabrications still flag.
  const claimById = new Map(claims.map((c) => [c.id, c]));
  for (const v of judgeVerdicts) {
    const c = claimById.get(v.id);
    if (!c) continue;

    // Guard 1 — competitor-price hallucinated absence. The judge recurrently
    // claims a competitor price is FABRICATED, mis-stamped to another section
    // (MIS_ATTRIBUTION), or unverified — when it IS present verbatim. For a
    // competitorMarketingInsights claim whose stated money tokens ALL appear
    // verbatim somewhere in the six sections, any such absence verdict is false.
    if (
      (v.flag === "FABRICATION" ||
        v.flag === "PROVENANCE_INFLATION" ||
        v.flag === "MIS_ATTRIBUTION") &&
      c.kind === "competitorMarketingInsights"
    ) {
      const money = extractMoneyTokens(c.text);
      if (money.length > 0 && money.every((t) => moneyAppearsVerbatim(t, sections))) {
        v.flag = "PASS";
        v.reason = `competitor price(s) ${money.join(", ")} present verbatim in sections — judge price over-flag downgraded`;
        continue;
      }
    }

    // Guards 2+3 only down-convert an ABSENCE verdict (MIS_ATTRIBUTION /
    // FABRICATION) — never a CONTRADICTION (which is about meaning, not presence).
    if (v.flag === "MIS_ATTRIBUTION" || v.flag === "FABRICATION") {
      const citedZones = c.sourceSection
        .split(/[,+]/)
        .map((z) => z.trim())
        .filter((z) => (CANONICAL_ZONES as readonly string[]).includes(z)) as Zone[];

      // Guard 2 — multi-word hallucinated absence: a long contiguous span (>=6
      // words) of the claim's own wording is verbatim in a CITED section, making
      // the absence verdict provably false (the Fellow 'Slack, Zoom, Meet, Teams,
      // Jira, Asana' integration list IS in the cited CompetitorLandscape). Dirty
      // cases (fabricated copy, wrong-section verbatim quotes) have no such long
      // run in the cited section.
      if (claimHasLongVerbatimRunInCited(c.text, citedZones, sections)) {
        v.flag = "PASS";
        v.reason = `>=${CITED_VERBATIM_RUN_MIN}-word verbatim run of claim text present in cited ${c.sourceSection} — judge absence over-flag downgraded`;
        continue;
      }

      // Guard 3 — distinctive numeric-range / accuracy-benchmark hallucinated
      // absence: a range/percent token ('85-92%', '150+') from the claim text is
      // verbatim in a CITED section, so the judge's 'benchmark absent from cited'
      // verdict is false. Fabricated figures (30%, 40%, 100%) are NOT in the cited
      // section, so they are not downgraded.
      const ranges = extractRangeTokens(c.text);
      const present = ranges.find((tok) => rangeTokenInCited(tok, citedZones, sections));
      if (present) {
        v.flag = "PASS";
        v.reason = `range/benchmark token '${present}' present verbatim in cited ${c.sourceSection} — judge absence over-flag downgraded`;
        continue;
      }
    }
  }

  const verdicts = [...detVerdicts, ...judgeVerdicts];

  const summary: PlanSummary = {
    totalClaims: claims.length,
    judged: needJudge.length,
    deterministicFlags: detVerdicts.filter((v) => v.flag !== "PASS").length,
    judgeFlags: judgeVerdicts.filter(
      (v) => v.flag !== "PASS" && v.flag !== "VERIFIER_ERROR",
    ).length,
    verifierErrors: judgeVerdicts.filter((v) => v.flag === "VERIFIER_ERROR")
      .length,
    stats,
  };
  return { verdicts, claims, summary };
}

function printPlanSummary(label: string, s: PlanSummary): void {
  console.log(`  --- judge summary [${label}] ---`);
  console.log(
    `      claims=${s.totalClaims}  judged=${s.judged}  detFlags=${s.deterministicFlags}  ` +
      `judgeFlags=${s.judgeFlags}  VERIFIER_ERROR=${s.verifierErrors}`,
  );
  s.stats.forEach((st) => {
    console.log(
      `      call chunk=${st.chunk} attempt=${st.attempt} batch=${st.claimsInBatch} ` +
        `verdicts=${st.verdictsReturned} finishReason=${st.finishReason} ` +
        `complete=${st.complete}`,
    );
  });
  if (s.verifierErrors > 0) {
    console.log(
      `      ⚠️  ${s.verifierErrors} VERIFIER_ERROR — judge could not verify; these BLOCK (fail-loud), not PASS.`,
    );
  }
}

// ----------------------------------------------------------------------------
// Self-test against the 4 labeled-violation outputs
// ----------------------------------------------------------------------------
interface LabeledCase {
  name: string;
  file: string;
  runId: string;
  // Each labeled violation: a matcher (claim-id substring + a text/grounding
  // fragment) and the set of flags that COUNT as a catch (any non-PASS subset).
  violations: Array<{
    label: string;
    match: { idIncludes?: string; textIncludes?: string; groundingIncludes?: string };
    acceptableFlags: FlagType[];
  }>;
}

const NON_PASS: FlagType[] = [
  "FABRICATION",
  "PROVENANCE_INFLATION",
  "MIS_ATTRIBUTION",
  "FABRICATED_QUOTE",
  "CONTRADICTION",
  "EMPTY_SECTION_CITATION",
  "INVALID_ENUM",
];

const TMP = join(process.cwd(), "tmp", "zz-section-out");

const CASES: LabeledCase[] = [
  {
    name: "RAMP",
    file: join(TMP, "v3-0dc9720b-PREFIX.json"),
    runId: "0dc9720b-81a3-487f-ab1f-fac60329b25b",
    violations: [
      {
        label: "R1 FABRICATION testimonial USP cites VoC w/ zero quotes",
        match: { idIncludes: "USP", textIncludes: "Before Ramp" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "R2 INFLATION+IGNORED-FLAG PST3 close books 3 vs 10 (5x unverifiable)",
        match: { idIncludes: "PST 3", textIncludes: "3 days instead of 10" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "R3 FABRICATION parity 1.5% same as Brex and BILL",
        match: { idIncludes: "Objection 1", textIncludes: "same as Brex and BILL" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "R4 CONTRADICTION Objection2 no manual data entry vs HIGH flag must sync",
        match: { idIncludes: "Objection 2", textIncludes: "no manual data entry" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "R5 INFLATION BILL $45/$55 tagged '...(verified)' — figures not in section",
        match: { idIncludes: "competitorMarketingInsights", groundingIncludes: "verified" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "R6 UNVERIFIED-AS-FACT PST1 automated three-way matching (DemandIntent open Q)",
        match: { idIncludes: "PST 1", textIncludes: "three-way matching" },
        acceptableFlags: NON_PASS,
      },
    ],
  },
  {
    name: "CLAY",
    file: join(TMP, "v3-43ec34fc-PREFIX.json"),
    runId: "43ec34fc-5762-4452-b3df-9899d0302d2e",
    violations: [
      {
        label: "C1 INFLATION/mis-attr 85-92 vs Apollo 70-80 (no section attributes 70-80 to Apollo)",
        match: { textIncludes: "85-92" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "C2 FAB-REASSURANCE no hidden costs vs OfferDiagnostic #1 pricing objection",
        match: { textIncludes: "hidden cost" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "C3 MIS-ATTR 85-92 (DemandIntent-flagged proprietary) shown clean",
        match: { textIncludes: "85-92" },
        acceptableFlags: NON_PASS,
      },
    ],
  },
  {
    name: "FELLOW",
    file: join(TMP, "v3-fbd2b98c-PREFIX.json"),
    runId: "fbd2b98c-69db-4947-b0ca-85e2704297e6",
    violations: [
      {
        label: "F1 FABRICATED competitor quote Uploads often fail out of order",
        match: { idIncludes: "competitorReviewInsights[0]", textIncludes: "Uploads often fail" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "F2 FABRICATED review quote Zoom summaries too basic",
        match: { idIncludes: "competitorReviewInsights[1]", textIncludes: "too basic" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "F3 MIS-ATTR anglesToTest[0] cites VoC but 404 figure lives in OfferDiagnostic",
        match: { idIncludes: "anglesToTest[0]", groundingIncludes: "404" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "F4 INTERNAL CONTRADICTION PST2 2 hours/wk vs grounding 6 hours saved",
        match: { idIncludes: "PST 2" },
        acceptableFlags: NON_PASS,
      },
    ],
  },
  {
    name: "AIRTABLE",
    file: join(TMP, "v3-fcc5dc24-PREFIX.json"),
    runId: "fcc5dc24-b3fa-43b3-8f29-47869c82c28d",
    violations: [
      {
        label: "A1 FAB+WRONG-PRODUCT PST1 fintech OCR + [Product] token",
        match: { idIncludes: "PST 1", textIncludes: "OCR" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "A2 FAB+WRONG-PRODUCT Before/After 10-day close 100% receipt capture",
        match: { idIncludes: "Before / After", textIncludes: "10-day close" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "A3 INFLATION/WRONG-SECTION all 3 audiences cite EMPTY BuyerICP",
        match: { idIncludes: "audienceTypes[0]" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "A4 FABRICATION Objection1 pays for itself within 2 months",
        match: { idIncludes: "Objection 1", textIncludes: "Airtable is too expensive" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "A5 MALFORMED-ENUM positioningVoC + quote lives in OfferDiagnostic",
        match: { idIncludes: "competitorReviewInsights[2]" },
        acceptableFlags: NON_PASS,
      },
      {
        label: "A6 WEAK-PROVENANCE 500K+ teams grounded 'Airtable public info' — no 500K anywhere",
        match: { textIncludes: "500" },
        acceptableFlags: NON_PASS,
      },
    ],
  },
];

function matchClaim(c: Claim, m: LabeledCase["violations"][0]["match"]): boolean {
  if (m.idIncludes && !c.id.includes(m.idIncludes)) return false;
  if (m.textIncludes && !c.text.toLowerCase().includes(m.textIncludes.toLowerCase()))
    return false;
  if (
    m.groundingIncludes &&
    !c.grounding.toLowerCase().includes(m.groundingIncludes.toLowerCase())
  )
    return false;
  return true;
}

async function selftest(): Promise<void> {
  let knownTotal = 0;
  let caught = 0;
  const missed: string[] = [];
  const falsePositives: string[] = [];
  const verifierErrors: string[] = [];

  for (const tc of CASES) {
    console.log(`\n========== ${tc.name} (${tc.runId.slice(0, 8)}) ==========`);
    const { verdicts, claims, summary } = await verifyPlan(tc.file, tc.runId);
    printPlanSummary(tc.name, summary);
    const vById = new Map(verdicts.map((v) => [v.id, v]));

    // Map each violation to the claim(s) it matches, check the flag.
    const labeledClaimIds = new Set<string>();
    for (const viol of tc.violations) {
      knownTotal++;
      const hits = claims.filter((c) => matchClaim(c, viol.match));
      if (hits.length === 0) {
        missed.push(`${tc.name} ${viol.label} :: NO CLAIM MATCHED MATCHER`);
        console.log(`  MISS  ${viol.label} — matcher hit 0 claims`);
        continue;
      }
      // A violation is caught if ANY matched claim got an acceptable (non-PASS) flag.
      const caughtHit = hits.find((h) => {
        const v = vById.get(h.id);
        return v && viol.acceptableFlags.includes(v.flag);
      });
      hits.forEach((h) => labeledClaimIds.add(h.id));
      if (caughtHit) {
        caught++;
        const v = vById.get(caughtHit.id)!;
        console.log(`  CATCH ${viol.label}\n        -> [${v.flag}/${v.by}] ${v.reason}`);
      } else {
        const v = vById.get(hits[0].id);
        missed.push(`${tc.name} ${viol.label} (flagged ${v?.flag ?? "?"})`);
        console.log(
          `  MISS  ${viol.label}\n        -> got [${v?.flag ?? "none"}] ${v?.reason ?? ""}`,
        );
      }
    }

    // VERIFIER_ERROR is a BLOCKING needs-review status (judge could not verify),
    // NOT a violation-catch and NOT a clean-claim false-positive. Bucket it
    // separately so a truncation surfaces loudly instead of inflating either
    // recall or the FP count.
    for (const v of verdicts) {
      if (v.flag === "VERIFIER_ERROR") {
        verifierErrors.push(`${tc.name} ${v.id} ${v.reason}`);
      }
    }

    // False positives: any NON-labeled claim flagged a real violation (non-PASS,
    // non-VERIFIER_ERROR).
    // (Heuristic — a clean claim flagged is an FP. We only count claims NOT
    //  matched by any labeled violation. Note: a plan may have genuine extra
    //  violations beyond the labeled set; we report these for human review.)
    for (const v of verdicts) {
      if (v.flag === "PASS" || v.flag === "VERIFIER_ERROR") continue;
      if (labeledClaimIds.has(v.id)) continue;
      falsePositives.push(`${tc.name} ${v.id} [${v.flag}/${v.by}] ${v.reason}`);
    }
  }

  const recallPct = knownTotal ? Math.round((caught / knownTotal) * 1000) / 10 : 0;
  console.log(`\n\n================ SUMMARY ================`);
  console.log(`knownTotal: ${knownTotal}`);
  console.log(`caught:     ${caught}`);
  console.log(`missed (${missed.length}):`);
  missed.forEach((m) => console.log(`  - ${m}`));
  console.log(`falsePositives / extra flags (${falsePositives.length}):`);
  falsePositives.forEach((f) => console.log(`  - ${f}`));
  console.log(`VERIFIER_ERROR / fail-loud-on-truncation (${verifierErrors.length}):`);
  verifierErrors.forEach((e) => console.log(`  - ${e}`));
  console.log(`recall%: ${recallPct}`);
  if (verifierErrors.length > 0) {
    console.log(
      `⚠️  ${verifierErrors.length} VERIFIER_ERROR — judge truncated/incomplete and FAILED LOUD (blocks; not a silent PASS).`,
    );
  }

  const outDir = join(process.cwd(), "tmp", "zz-section-out");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "zz-verifier-result.json"),
    JSON.stringify(
      {
        knownTotal,
        caught,
        missed,
        falsePositives,
        verifierErrors,
        verifierErrorCount: verifierErrors.length,
        recallPct,
      },
      null,
      2,
    ),
    "utf8",
  );
}

// ----------------------------------------------------------------------------
async function main(): Promise<void> {
  if (process.argv.includes("--selftest")) {
    await selftest();
    return;
  }
  const planPath = process.argv[2];
  const runId =
    process.argv.indexOf("--run") !== -1
      ? process.argv[process.argv.indexOf("--run") + 1]
      : undefined;
  if (!planPath || !runId) {
    console.error("usage: zz-claim-source-verifier.ts <plan.json> --run <run_id>");
    console.error("   or: zz-claim-source-verifier.ts --selftest");
    process.exit(1);
  }
  const { verdicts, summary } = await verifyPlan(planPath, runId);
  for (const v of verdicts) {
    console.log(`[${v.flag}/${v.by}] ${v.id}\n    ${v.reason}`);
  }
  printPlanSummary(runId.slice(0, 8), summary);
  // Fail loud at the process level too: a plan whose judge could not verify some
  // claims must NOT exit clean.
  if (summary.verifierErrors > 0) {
    console.error(
      `[verifier] ${summary.verifierErrors} VERIFIER_ERROR — judge incomplete; gate must treat as needs-review/fail, NOT clean.`,
    );
    process.exit(2);
  }
}

// Auto-run only when executed directly (not when imported by an eval harness).
const invokedDirectly =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  /zz-claim-source-verifier\.ts$/.test(process.argv[1] ?? "");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[verifier] FATAL", err);
    process.exit(1);
  });
}

// Exports for the testset eval harness (precision/recall against
// tmp/verifier-testset.json over the v3b plans). No behavior change to the CLI.
export { verifyPlan, extractClaims, deterministicPass, judgePass };
export type { Claim, Verdict, FlagType };
