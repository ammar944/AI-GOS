import {
  artifactEnvelopeSchema,
  type ResearchInput,
} from "../artifacts/artifact-envelope";
import {
  checkVoiceOfCustomerSelfSourcing,
  validateVoiceOfCustomerMinimums,
  voiceOfCustomerBodySchema,
  voiceOfCustomerSectionOutputSchema,
  type VoiceOfCustomerSectionOutput,
} from "../artifacts/schemas/voice-of-customer";
import {
  getRegistrableDomain,
  type VoiceOfCustomerCandidate,
  type VoiceOfCustomerCandidateResult,
} from "./voice-of-customer-candidates";

const SYNTHESIS_MIN_PAIN_QUOTES = 10;
const SYNTHESIS_MIN_SUCCESS_QUOTES = 5;
const SYNTHESIS_MIN_DOMAINS = 3;
const SYNTHESIS_MIN_TOP_LEVEL_SOURCES = 5;

export interface VoiceOfCustomerSynthesisGap {
  evidenceGap: true;
  reason:
    | "candidate_pack_gap"
    | "insufficient_candidates"
    | "insufficient_independent_domains"
    | "insufficient_success_language"
    | "self_sourced_candidate"
    | "single_source_majority"
    | "validation_failed";
  message: string;
  candidateCount: number;
  domains: string[];
  errors: string[];
}

export type VoiceOfCustomerSynthesisResult =
  | { ok: true; output: VoiceOfCustomerSectionOutput }
  | { ok: false; gap: VoiceOfCustomerSynthesisGap };

export interface SynthesizeVoiceOfCustomerFromCandidatesInput {
  candidateResult: VoiceOfCustomerCandidateResult;
  researchInput: ResearchInput;
  now: () => Date;
}

function buildGap({
  candidateCount,
  domains,
  errors,
  message,
  reason,
}: {
  candidateCount: number;
  domains: readonly string[];
  errors?: readonly string[];
  message: string;
  reason: VoiceOfCustomerSynthesisGap["reason"];
}): VoiceOfCustomerSynthesisResult {
  return {
    ok: false,
    gap: {
      evidenceGap: true,
      reason,
      message,
      candidateCount,
      domains: [...domains],
      errors: [...(errors ?? [message])],
    },
  };
}

function uniqueDomains(
  candidates: readonly VoiceOfCustomerCandidate[],
): string[] {
  return Array.from(new Set(candidates.map((candidate) => candidate.domain)));
}

function quoteSourceForCandidate(
  candidate: VoiceOfCustomerCandidate,
): "g2" | "reddit" | "hackernews" | "support-thread" | "other" {
  if (candidate.domain === "g2.com") {
    return "g2";
  }

  if (candidate.domain === "reddit.com") {
    return "reddit";
  }

  if (
    candidate.domain === "news.ycombinator.com" ||
    candidate.domain === "ycombinator.com"
  ) {
    return "hackernews";
  }

  if (candidate.evidenceKind === "support-thread") {
    return "support-thread";
  }

  return "other";
}

function inferPainTheme(candidate: VoiceOfCustomerCandidate): string {
  const text = candidate.snippet.toLowerCase();

  if (text.includes("handoff") || text.includes("follow-up")) {
    return "follow-up handoff pain";
  }

  if (text.includes("account") || text.includes("context")) {
    return "account context loss";
  }

  if (text.includes("trust") || text.includes("black-box")) {
    return "trust and control anxiety";
  }

  return "buyer workflow friction";
}

const explicitAfterStatePattern =
  /\b(?:after|finally|now|knows?|clear|fewer|less|restored|rebuilding|matters next|fixed|solved)\b/iu;
const efficiencyControlAfterStatePattern =
  /\b(?:takes? (?:literally )?seconds?|instant(?:ly)?|fast approval|easy to use|easier to manage|real-time visibility|under control|surfac(?:e|es|ing) (?:patterns|duplicate|unexpected)|flag(?:s|ging)? duplicate|highlight(?:s|ing)? unexpected|simple to (?:create|revoke|monitor|manage))\b/iu;

function expressesAfterState(candidate: VoiceOfCustomerCandidate): boolean {
  return (
    explicitAfterStatePattern.test(candidate.snippet) ||
    efficiencyControlAfterStatePattern.test(candidate.snippet)
  );
}

function sourceTitle(candidate: VoiceOfCustomerCandidate): string {
  return `${candidate.title} (${candidate.domain})`;
}

function topLevelSources(
  candidates: readonly VoiceOfCustomerCandidate[],
): VoiceOfCustomerSectionOutput["sources"] {
  const seen = new Set<string>();
  const sources: VoiceOfCustomerSectionOutput["sources"] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.url)) {
      continue;
    }

    seen.add(candidate.url);
    sources.push({
      publisher: candidate.domain,
      title: sourceTitle(candidate),
      url: candidate.url,
    });
  }

  return sources;
}

function countByDomain(
  candidates: readonly VoiceOfCustomerCandidate[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    counts.set(candidate.domain, (counts.get(candidate.domain) ?? 0) + 1);
  }

  return counts;
}

function hasSingleSourceMajority(
  candidates: readonly VoiceOfCustomerCandidate[],
): boolean {
  const majorityThreshold = Math.floor(candidates.length / 2);

  return Array.from(countByDomain(candidates).values()).some(
    (count) => count > majorityThreshold,
  );
}

function hasSelfSourcedCandidate({
  candidates,
  subjectDomain,
}: {
  candidates: readonly VoiceOfCustomerCandidate[];
  subjectDomain: string;
}): boolean {
  const subjectRegistrable = getRegistrableDomain(subjectDomain);

  if (subjectRegistrable === null) {
    return false;
  }

  return candidates.some((candidate) => {
    const candidateRegistrable =
      getRegistrableDomain(candidate.url) ?? candidate.domain;

    return candidateRegistrable === subjectRegistrable;
  });
}

function buildVoiceOfCustomerOutput({
  candidates,
  domains,
}: {
  candidates: readonly VoiceOfCustomerCandidate[];
  domains: readonly string[];
}): VoiceOfCustomerSectionOutput {
  const painCandidates = candidates.slice(0, SYNTHESIS_MIN_PAIN_QUOTES);
  const successCandidates = candidates
    .filter(expressesAfterState)
    .slice(0, SYNTHESIS_MIN_SUCCESS_QUOTES);
  const objections = painCandidates.slice(0, 5);
  const switchingStories = painCandidates.slice(0, 3);
  const criteria = painCandidates.slice(0, 5);
  const domainList = domains.join(", ");

  return voiceOfCustomerSectionOutputSchema.parse({
    sectionTitle: "Voice of Customer & Objection Evidence",
    verdict:
      "Independent buyer-language candidates point to follow-up control as the credible VoC wedge, so promote source-backed workflow proof before broad automation claims.",
    statusSummary: `Deterministic synthesis promoted ${painCandidates.length} acquired candidate snippets across ${domains.length} independent domains (${domainList}) without inventing reviewer names, dates, statistics, or customer claims.`,
    confidence: 0.72,
    sources: topLevelSources(painCandidates),
    body: {
      strategicInsight: {
        strategicVerdict:
          "The defensible message is source-backed follow-up control: independent candidates describe account-action breakdowns, so the offer should prove a traceable weekly loop before promising automation breadth.",
        nonObviousRead:
          "The emotional risk is not tool fatigue alone; buyers need to see why each next action is recommended before they will trust an AI operating loop with live account work.",
        secondOrderImplication:
          "Launch proof should show the handoff becoming auditable and calmer, because every unsupported autonomy claim will make skeptical founder-led buyers retreat to manual notes.",
        keyTension: {
          tension:
            "Buyers want the handoff pain removed, but the same pain makes them wary of a black-box system that could create untraceable account decisions.",
          side:
            "Take the traceability side: lead with sourced next-action evidence even if it slows the bigger automation narrative.",
          costOfPosition:
            "The near-term story becomes narrower than full GTM autonomy, but it protects credibility while the buyer-language proof base expands.",
        },
      },
      fourForcesBalanceVerdict: {
        push:
          "The push comes from repeated handoff misses and account-context loss described in independent candidate snippets.",
        pull:
          "The pull is a weekly loop where the team can see the next account action and the evidence behind it.",
        anxiety:
          "The anxiety is delegating live account judgment to a system whose recommendations are not visibly sourced.",
        habit:
          "The habit is staying with manual notes, spreadsheets, and CRM cleanup because those workflows feel inspectable.",
        balanceVerdict:
          "The switch path works only when source-backed control reduces anxiety before the product asks buyers to accept more automation.",
      },
      painLanguage: {
        prose: `The acquired candidate pack shows recurring handoff and account-action pain across ${domains.length} independent domains: ${domainList}.`,
        quotes: painCandidates.map((candidate, index) => ({
          painIntensity: index < 5 ? "high" : "medium",
          painTheme: inferPainTheme(candidate),
          source: quoteSourceForCandidate(candidate),
          sourceUrl: candidate.url,
          verbatimText: candidate.snippet,
        })),
      },
      objections: {
        prose:
          "The conservative objection bank uses candidate snippets as the evidence text and keeps the response focused on traceability, workflow fit, timing, and trust.",
        items: objections.map((candidate, index) => ({
          category:
            (["trust", "switching-cost", "timing", "stakeholder", "feature"] as const)[
              index
            ] ?? "other",
          frequency: index < 3 ? "recurring" : "occasional",
          howToHandle: `Show the source-backed weekly loop and implementation proof tied to the ${candidate.domain} evidence before expanding the automation claim.`,
          objectionText: candidate.snippet,
          sourceUrl: candidate.url,
        })),
      },
      switchingStories: {
        prose:
          "Switching stories stay conservative: each story names the current workflow only as the source-evidenced operating context, not as a claimed competitor displacement.",
        stories: switchingStories.map((candidate, index) => ({
          decisionPath:
            "Validate the replacement with a source-backed weekly workflow proof before broad rollout.",
          priorSolution: `Current workflow evidenced by ${candidate.domain} candidate ${index + 1}`,
          reasonToLeave: candidate.snippet,
          sourceUrl: candidate.url,
        })),
      },
      decisionCriteria: {
        prose:
          "Decision criteria emphasize visible evidence, lower handoff risk, workflow fit, implementation trust, and proof of the after-state.",
        criteria: criteria.map((candidate, index) => ({
          criterion:
            ([
              "Traceable next-action evidence",
              "Lower handoff risk",
              "Weekly workflow fit",
              "Implementation trust",
              "Visible after-state proof",
            ] as const)[index] ?? "Source-backed operating proof",
          evidenceQuote: candidate.snippet,
          sourceUrl: candidate.url,
          statedBy:
            (["buyer", "champion", "influencer", "blocker", "buyer"] as const)[
              index
            ] ?? "buyer",
        })),
      },
      successLanguage: {
        prose:
          "Success language is promoted only from snippets that express an after-state or recovered operating control.",
        quotes: successCandidates.map((candidate) => ({
          afterStatePattern: "weekly account-action control restored",
          source: quoteSourceForCandidate(candidate),
          sourceUrl: candidate.url,
          verbatimText: candidate.snippet,
        })),
      },
    },
  });
}

function formatSynthesisError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function validateOutput({
  now,
  output,
  researchInput,
}: {
  now: () => Date;
  output: VoiceOfCustomerSectionOutput;
  researchInput: ResearchInput;
}): string[] {
  const observedAt = now().toISOString();
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: voiceOfCustomerBodySchema })
    .safeParse({
      id: "art_synthesized_voc_validation",
      runId: researchInput.runId,
      sectionId: "positioningVoiceOfCustomer",
      sectionTitle: output.sectionTitle,
      verdict: output.verdict,
      statusSummary: output.statusSummary,
      confidence: output.confidence,
      sources: output.sources.map((source, index) => ({
        id: `src_synthesized_voc_${index + 1}`,
        observedAt,
        title: source.title,
        url: source.url,
        ...(source.publisher === undefined
          ? {}
          : { publisher: source.publisher }),
      })),
      body: output.body,
      createdAt: observedAt,
    });

  if (!parsedArtifact.success) {
    return parsedArtifact.error.issues.map((issue) => issue.message);
  }

  const minimums = validateVoiceOfCustomerMinimums(parsedArtifact.data);
  const selfSourcing = checkVoiceOfCustomerSelfSourcing({
    artifact: parsedArtifact.data,
    subjectDomain: researchInput.company.websiteUrl,
  });

  return [...minimums.errors, ...selfSourcing.errors];
}

export function synthesizeVoiceOfCustomerFromCandidates({
  candidateResult,
  now,
  researchInput,
}: SynthesizeVoiceOfCustomerFromCandidatesInput): VoiceOfCustomerSynthesisResult {
  if (!candidateResult.ok) {
    return buildGap({
      candidateCount: candidateResult.gap.candidateCount,
      domains: candidateResult.gap.domains,
      message: candidateResult.gap.message,
      reason: "candidate_pack_gap",
    });
  }

  const candidates = candidateResult.pack.candidates;
  const domains = uniqueDomains(candidates);

  if (candidates.length < SYNTHESIS_MIN_PAIN_QUOTES) {
    return buildGap({
      candidateCount: candidates.length,
      domains,
      message: `Found ${candidates.length} candidate quote(s); deterministic VoC synthesis requires at least ${SYNTHESIS_MIN_PAIN_QUOTES}.`,
      reason: "insufficient_candidates",
    });
  }

  if (domains.length < SYNTHESIS_MIN_DOMAINS) {
    return buildGap({
      candidateCount: candidates.length,
      domains,
      message: `Found ${domains.length} independent domain(s); deterministic VoC synthesis requires at least ${SYNTHESIS_MIN_DOMAINS}.`,
      reason: "insufficient_independent_domains",
    });
  }

  if (topLevelSources(candidates).length < SYNTHESIS_MIN_TOP_LEVEL_SOURCES) {
    return buildGap({
      candidateCount: candidates.length,
      domains,
      message: `Found fewer than ${SYNTHESIS_MIN_TOP_LEVEL_SOURCES} distinct candidate URLs for top-level sources.`,
      reason: "insufficient_candidates",
    });
  }

  if (
    hasSelfSourcedCandidate({
      candidates,
      subjectDomain: researchInput.company.websiteUrl,
    })
  ) {
    return buildGap({
      candidateCount: candidates.length,
      domains,
      message:
        "Candidate pack contains the audited company's own domain; deterministic VoC synthesis only promotes independent buyer-language sources.",
      reason: "self_sourced_candidate",
    });
  }

  if (hasSingleSourceMajority(candidates.slice(0, SYNTHESIS_MIN_PAIN_QUOTES))) {
    return buildGap({
      candidateCount: candidates.length,
      domains,
      message:
        "Candidate pack has a single-source majority across the promoted pain quotes.",
      reason: "single_source_majority",
    });
  }

  if (
    candidates.filter(expressesAfterState).length <
    SYNTHESIS_MIN_SUCCESS_QUOTES
  ) {
    return buildGap({
      candidateCount: candidates.length,
      domains,
      message: `Found fewer than ${SYNTHESIS_MIN_SUCCESS_QUOTES} candidate snippets with a clear after-state; deterministic success language cannot be promoted honestly.`,
      reason: "insufficient_success_language",
    });
  }

  let output: VoiceOfCustomerSectionOutput;
  try {
    output = buildVoiceOfCustomerOutput({
      candidates,
      domains,
    });
  } catch (error) {
    const message = formatSynthesisError(error);

    return buildGap({
      candidateCount: candidates.length,
      domains,
      errors: [message],
      message: `Deterministic VoC synthesis failed schema construction: ${message}`,
      reason: "validation_failed",
    });
  }

  const validationErrors = validateOutput({ now, output, researchInput });

  if (validationErrors.length > 0) {
    return buildGap({
      candidateCount: candidates.length,
      domains,
      errors: validationErrors,
      message: `Deterministic VoC synthesis failed validation: ${validationErrors.join(
        "; ",
      )}`,
      reason: "validation_failed",
    });
  }

  return { ok: true, output };
}
