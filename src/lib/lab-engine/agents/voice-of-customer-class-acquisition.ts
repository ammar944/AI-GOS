// Voice of Customer class acquisition (W1a).
//
// The pain loop in buildVoiceOfCustomerCandidatePrepass scrapes PAIN
// candidates only, while the schema demands five quote classes. This module
// runs one perplexity sonar-pro call per class (parallel) — the four
// SECONDARY classes (success language, objections, switching stories,
// decision criteria) plus a PAIN rescue channel — through a deterministic
// strict-line parser and per-class dedup/per-domain caps so one quote-rich
// domain cannot starve another class.
//
// Paid-API discipline: at most one retry per class on zero parsed lines,
// hard cap VOC_CLASS_MAX_PERPLEXITY_CALLS total, abort all retries on a
// credential gap. No loops.

import {
  acquisitionModeForEvidenceKind,
  createVoiceOfCustomerCandidate,
  inferVoiceOfCustomerEvidenceKind,
  VOC_CANDIDATE_PER_DOMAIN_CAP,
  type VoiceOfCustomerCandidate,
} from "./voice-of-customer-candidates";
import { getRegistrableDomain } from "../domain-utils";

export const VOC_SECONDARY_CLASSES = [
  "success",
  "objections",
  "switching",
  "criteria",
] as const;

export type VoiceOfCustomerSecondaryClass =
  (typeof VOC_SECONDARY_CLASSES)[number];

// Pain rides the same acquisition fan-out as a RESCUE channel (the Anura
// rerun proved quotable pain can span <3 domains even when the candidate
// pack clears its floors): pain-class candidates join the PAIN pack through
// selectVoiceOfCustomerCandidates, never the secondary-class block, and the
// pain floors stay unchanged.
export const VOC_ACQUISITION_CLASSES = [
  "pain",
  ...VOC_SECONDARY_CLASSES,
] as const;

export type VoiceOfCustomerAcquisitionClass =
  (typeof VOC_ACQUISITION_CLASSES)[number];

/** 5 classes x (1 initial + at most 1 retry). Structural cap, never a loop. */
export const VOC_CLASS_MAX_PERPLEXITY_CALLS =
  VOC_ACQUISITION_CLASSES.length * 2;

/** Per-class selected-candidate ceiling — small by design, like the pain pack. */
export const VOC_CLASS_PACK_MAX_SIZE = 8;

/** Below this length a "quote" is interjection noise, not promotable language. */
const VOC_CLASS_MIN_QUOTE_LENGTH = 12;

export interface VoiceOfCustomerClassCandidate extends VoiceOfCustomerCandidate {
  vocClass: VoiceOfCustomerAcquisitionClass;
}

export type VoiceOfCustomerClassCandidates = Record<
  VoiceOfCustomerAcquisitionClass,
  VoiceOfCustomerClassCandidate[]
>;

export interface VoiceOfCustomerSubjectCompany {
  category: string;
  name: string;
  websiteUrl: string;
}

export interface VoiceOfCustomerClassLookup {
  attempt: 1 | 2;
  output: unknown;
  question: string;
  vocClass: VoiceOfCustomerAcquisitionClass;
}

export interface AcquireVoiceOfCustomerClassCandidatesResult {
  candidatesByClass: VoiceOfCustomerClassCandidates;
  lookupCount: number;
  lookups: VoiceOfCustomerClassLookup[];
}

export interface ParsedVerbatimQuoteLine {
  quote: string;
  sourceLabel: string;
  url: string;
}

export function createEmptyVoiceOfCustomerClassCandidates(): VoiceOfCustomerClassCandidates {
  return {
    criteria: [],
    objections: [],
    pain: [],
    success: [],
    switching: [],
  };
}

const quoteMarks = new Set(['"', "“", "”", "‘", "’", "'"]);
const listMarkerPattern = /^\s*(?:[-*•]|\d+[.)])\s*/;
const trailingUrlPattern = /(https?:\/\/\S+?)[).,;:!?]*\s*$/i;
const separatorTrimPattern = /^[\s—–-]+|[\s—–-]+$/g;

function findLastQuoteMarkIndex(text: string): number {
  for (let index = text.length - 1; index > 0; index -= 1) {
    if (quoteMarks.has(text[index] ?? "")) {
      return index;
    }
  }

  return -1;
}

/**
 * Parse the strict acquisition line format the class questions demand:
 *   "<verbatim quote>" — <source site> — <url>
 * Tolerates list markers, curly quotes, en/em/hyphen separators, and trailing
 * punctuation after the URL. Lines without BOTH quotation-marked text and a
 * URL are dropped — paraphrase and commentary never become candidates.
 */
export function parseVerbatimQuoteLines(
  answer: string,
): ParsedVerbatimQuoteLine[] {
  return answer.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.replace(listMarkerPattern, "").trim();

    if (line.length === 0 || !quoteMarks.has(line[0] ?? "")) {
      return [];
    }

    const urlMatch = trailingUrlPattern.exec(line);
    const url = urlMatch?.[1];

    if (urlMatch === null || url === undefined) {
      return [];
    }

    const beforeUrl = line
      .slice(0, urlMatch.index)
      .replace(separatorTrimPattern, "");
    const lastQuoteMarkIndex = findLastQuoteMarkIndex(beforeUrl);

    if (lastQuoteMarkIndex <= 0) {
      return [];
    }

    const quote = beforeUrl.slice(1, lastQuoteMarkIndex).trim();
    const sourceLabel = beforeUrl
      .slice(lastQuoteMarkIndex + 1)
      .replace(separatorTrimPattern, "")
      .trim();

    if (quote.length < VOC_CLASS_MIN_QUOTE_LENGTH) {
      return [];
    }

    return [{ quote, sourceLabel, url }];
  });
}

interface ClassQuestionSpec {
  ask: string;
  retryAsk: string;
}

const classQuestionSpecs: Readonly<
  Record<VoiceOfCustomerAcquisitionClass, ClassQuestionSpec>
> = {
  pain: {
    ask: "Find verbatim customer PAIN quotes — complaints, frustrations, struggles, things that broke or wasted time/money — from independent reviews and forums (G2, Capterra, Trustpilot, SoftwareAdvice, Reddit, Hacker News)",
    retryAsk:
      "Search more broadly across review platforms, Reddit, Hacker News, Trustpilot, and practitioner forums for verbatim customer complaints and frustration language",
  },
  success: {
    ask: "Find verbatim customer quotes describing concrete OUTCOMES and after-state results (time saved, money saved, a metric improved, control regained) from independent reviews and forums (G2, Capterra, Trustpilot, Reddit)",
    retryAsk:
      "Search more broadly across review platforms, Reddit, Hacker News, and practitioner forums for verbatim customer quotes describing measurable results or relief after adopting",
  },
  objections: {
    ask: "Find verbatim buyer objections and pre-purchase concerns (price, trust, switching cost, integration effort, timing, stakeholder pushback) voiced in independent reviews and forum threads",
    retryAsk:
      "Search more broadly across review platforms, Reddit, Hacker News, and practitioner forums for verbatim buyer hesitations, complaints raised during evaluation, and reasons buyers almost did not purchase",
  },
  switching: {
    ask: "Find verbatim accounts of buyers who switched to or away from this product, naming the prior tool they left and why they switched",
    retryAsk:
      "Search more broadly across review platforms, Reddit, Hacker News, and comparison threads for verbatim switching stories that name the prior tool the buyer migrated from and the trigger for the switch",
  },
  criteria: {
    ask: "Find verbatim statements of the decision criteria buyers used when evaluating or choosing this product — what they compared, tested, and said mattered most",
    retryAsk:
      "Search more broadly across review platforms, Reddit, Hacker News, and evaluation threads for verbatim buyer statements about how they compared vendors and what requirements drove the final choice",
  },
};

export function buildVoiceOfCustomerClassQuestion({
  attempt = 1,
  company,
  vocClass,
}: {
  attempt?: 1 | 2;
  company: VoiceOfCustomerSubjectCompany;
  vocClass: VoiceOfCustomerAcquisitionClass;
}): string {
  const spec = classQuestionSpecs[vocClass];
  // Carry the category disambiguator on every query — a bare brand name
  // surfaces homonyms (the Anura run pulled threads about the film "Anora").
  const subject = `${company.name} (${company.websiteUrl}), the ${company.category}`;

  return [
    `${attempt === 1 ? spec.ask : spec.retryAsk} about ${subject}.`,
    "Return ONLY lines in this exact format, one quote per line:",
    '"<verbatim quote>" — <source site> — <url>',
    "Quote exactly as written (verbatim, preserving typos and casing); never paraphrase or merge quotes; only include quotes that trace to a real URL. If the search finds nothing reliable, say so explicitly.",
  ].join("\n");
}

export function buildVoiceOfCustomerClassCandidates({
  answer,
  auditedCompanyDomain,
  vocClass,
}: {
  answer: string;
  auditedCompanyDomain: string;
  vocClass: VoiceOfCustomerAcquisitionClass;
}): VoiceOfCustomerClassCandidate[] {
  return parseVerbatimQuoteLines(answer).flatMap((line) => {
    const domain = getRegistrableDomain(line.url);

    if (domain === null) {
      return [];
    }

    const evidenceKind = inferVoiceOfCustomerEvidenceKind({
      domain,
      source: "perplexity_research",
      snippet: line.quote,
      title: line.sourceLabel,
      url: line.url,
    });
    const candidate = createVoiceOfCustomerCandidate({
      acquisitionMode: acquisitionModeForEvidenceKind(evidenceKind),
      auditedCompanyDomain,
      evidenceKind,
      source: "perplexity_research",
      title: line.sourceLabel.length > 0 ? line.sourceLabel : undefined,
      url: line.url,
      snippet: line.quote,
    });

    return candidate === null ? [] : [{ ...candidate, vocClass }];
  });
}

/**
 * Per-class selection: dedupe by url+quote, cap per domain WITHIN the class
 * (one quote-rich domain must not starve the class), cap the class pack size.
 * No pain floors here — class minimums are the schema validator's job, with
 * blockGap as the honest escape.
 */
export function selectVoiceOfCustomerClassCandidates(
  candidates: readonly VoiceOfCustomerClassCandidate[],
): VoiceOfCustomerClassCandidate[] {
  const seenKeys = new Set<string>();
  const domainCounts = new Map<string, number>();
  const selected: VoiceOfCustomerClassCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.url}::${candidate.snippet.trim().toLowerCase()}`;

    if (seenKeys.has(key)) {
      continue;
    }

    const domainCount = domainCounts.get(candidate.domain) ?? 0;
    if (domainCount >= VOC_CANDIDATE_PER_DOMAIN_CAP) {
      continue;
    }

    seenKeys.add(key);
    domainCounts.set(candidate.domain, domainCount + 1);
    selected.push(candidate);

    if (selected.length >= VOC_CLASS_PACK_MAX_SIZE) {
      break;
    }
  }

  return selected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCredentialGapOutput(output: unknown): boolean {
  return (
    isRecord(output) &&
    output.type === "gap" &&
    output.reason === "missing_credential"
  );
}

function extractAnswer(output: unknown): string | null {
  if (
    isRecord(output) &&
    output.type === "result" &&
    typeof output.answer === "string" &&
    output.answer.trim().length > 0
  ) {
    return output.answer;
  }

  return null;
}

/**
 * Fan out one lookup per secondary class in parallel (added latency is
 * max(call), not sum). Retry a class at most once on zero parsed lines.
 * A credential gap aborts every remaining retry — the key is missing for
 * all classes alike, so retrying is pure spend.
 */
export async function acquireVoiceOfCustomerClassCandidates({
  company,
  executeLookup,
}: {
  company: VoiceOfCustomerSubjectCompany;
  executeLookup: (question: string) => Promise<unknown>;
}): Promise<AcquireVoiceOfCustomerClassCandidatesResult> {
  let lookupCount = 0;
  let credentialGapSeen = false;
  const lookups: VoiceOfCustomerClassLookup[] = [];
  const candidatesByClass = createEmptyVoiceOfCustomerClassCandidates();

  const runClass = async (
    vocClass: VoiceOfCustomerAcquisitionClass,
  ): Promise<void> => {
    const collected: VoiceOfCustomerClassCandidate[] = [];

    for (const attempt of [1, 2] as const) {
      if (credentialGapSeen || lookupCount >= VOC_CLASS_MAX_PERPLEXITY_CALLS) {
        break;
      }

      lookupCount += 1;
      const question = buildVoiceOfCustomerClassQuestion({
        attempt,
        company,
        vocClass,
      });
      const output = await executeLookup(question);
      lookups.push({ attempt, output, question, vocClass });

      if (isCredentialGapOutput(output)) {
        credentialGapSeen = true;
        break;
      }

      const answer = extractAnswer(output);
      if (answer !== null) {
        collected.push(
          ...buildVoiceOfCustomerClassCandidates({
            answer,
            auditedCompanyDomain: company.websiteUrl,
            vocClass,
          }),
        );
      }

      if (collected.length > 0) {
        break;
      }
    }

    candidatesByClass[vocClass] =
      selectVoiceOfCustomerClassCandidates(collected);
  };

  await Promise.all(
    VOC_ACQUISITION_CLASSES.map((vocClass) => runClass(vocClass)),
  );

  return { candidatesByClass, lookupCount, lookups };
}

const classRenderTargets: Readonly<
  Record<
    VoiceOfCustomerSecondaryClass,
    { blockGapPath: string; schemaPath: string }
  >
> = {
  success: {
    blockGapPath: "body.successLanguage.blockGap",
    schemaPath: "body.successLanguage.quotes[]",
  },
  objections: {
    blockGapPath: "body.objections.blockGap",
    schemaPath: "body.objections.items[]",
  },
  switching: {
    blockGapPath: "body.switchingStories.blockGap",
    schemaPath: "body.switchingStories.stories[]",
  },
  criteria: {
    blockGapPath: "body.decisionCriteria.blockGap",
    schemaPath: "body.decisionCriteria.criteria[]",
  },
};

/**
 * Render the class-tagged secondary candidates for the agent prompt. Composed
 * after formatVoiceOfCustomerCandidateBlock (pain pack) by the prepass.
 */
export function formatVoiceOfCustomerClassCandidateBlock(
  candidatesByClass: VoiceOfCustomerClassCandidates,
): string {
  const lines: string[] = [
    "Secondary-class verbatim candidates (perplexity prepass)",
    "",
    "Instructions:",
    "- Each candidate is tagged with the class it serves; route it to the listed schema field.",
    "- Quote text comes from the candidate verbatim; `sourceUrl` is the candidate URL; the `source` enum derives from that URL's domain.",
    "- A class with no candidates and no honest tool fills of your own: file its blockGap (summary, foundCount, requiredCount, sourcingPlan) instead of padding or stretching quotes.",
    "",
  ];

  for (const vocClass of VOC_SECONDARY_CLASSES) {
    const target = classRenderTargets[vocClass];
    const candidates = candidatesByClass[vocClass];

    if (candidates.length === 0) {
      lines.push(
        `[${vocClass}] → ${target.schemaPath}: none acquired — promote from your own tool fills or file ${target.blockGapPath} honestly.`,
      );
      continue;
    }

    lines.push(
      `[${vocClass}] → ${target.schemaPath} (${candidates.length} candidate(s)):`,
    );
    candidates.forEach((candidate, index) => {
      lines.push(
        `${index + 1}. "${candidate.snippet}" (${candidate.domain})`,
        `   URL: ${candidate.url}`,
      );
    });
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
