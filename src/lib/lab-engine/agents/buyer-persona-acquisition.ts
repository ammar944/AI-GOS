// Buyer ICP venue prepass (W2).
//
// Agent-driven persona mining demonstrably underperforms (perplexity was
// available on the Anura rerun; 2 personas found, both vendor case studies).
// This module acquires named-persona LEADS harness-side with two parallel
// perplexity sonar-pro calls — (1) named ICP-role individuals visible in
// podcasts / conference talks / LinkedIn posts for the category, (2) named
// reviewer identities on G2/Capterra-class sites — and renders them as a
// candidate block the agent verifies and promotes.
//
// Paid-API discipline: one retry per venue on zero parsed lines, hard cap
// BUYER_PERSONA_MAX_PERPLEXITY_CALLS, credential gap aborts retries.

import { isLikelyNamedBuyerIdentity } from "../artifacts/schemas/buyer-icp";
import { getRegistrableDomain } from "./voice-of-customer-candidates";

export const BUYER_PERSONA_VENUES = [
  "public_voices",
  "reviewer_identities",
] as const;

export type BuyerPersonaVenue = (typeof BUYER_PERSONA_VENUES)[number];

/** 2 venues x (1 initial + at most 1 retry). Structural cap, never a loop. */
export const BUYER_PERSONA_MAX_PERPLEXITY_CALLS =
  BUYER_PERSONA_VENUES.length * 2;

/** Lead-pack ceiling — the floor is 3 personas; a dozen leads is plenty. */
export const BUYER_PERSONA_PACK_MAX_SIZE = 12;

export interface BuyerPersonaCandidate {
  company: string;
  name: string;
  title: string;
  url: string;
  venue: BuyerPersonaVenue;
}

export interface ParsedNamedPersonaLine {
  company: string;
  name: string;
  title: string;
  url: string;
}

export interface BuyerPersonaLookup {
  attempt: 1 | 2;
  output: unknown;
  question: string;
  venue: BuyerPersonaVenue;
}

export interface AcquireBuyerPersonaCandidatesResult {
  candidates: BuyerPersonaCandidate[];
  lookupCount: number;
  lookups: BuyerPersonaLookup[];
}

export interface BuyerPersonaSubjectCompany {
  category: string;
  name: string;
  websiteUrl: string;
}

const listMarkerPattern = /^\s*(?:[-*•]|\d+[.)])\s*/;
const trailingUrlPattern = /(https?:\/\/\S+?)[).,;:!?]*\s*$/i;
const separatorSplitPattern = /\s+[—–-]+\s+/;

function stripMarkdownEmphasis(value: string): string {
  return value.replace(/\*\*?|__/g, "").trim();
}

/**
 * Parse the strict lead line format the venue questions demand:
 *   <full name> — <title> — <company> — <url>
 * Lines without a URL or with fewer than three identity fields are dropped.
 */
export function parseNamedPersonaLines(
  answer: string,
): ParsedNamedPersonaLine[] {
  return answer.split(/\r?\n/).flatMap((rawLine) => {
    const line = rawLine.replace(listMarkerPattern, "").trim();

    if (line.length === 0) {
      return [];
    }

    const urlMatch = trailingUrlPattern.exec(line);
    const url = urlMatch?.[1];

    if (urlMatch === null || url === undefined) {
      return [];
    }

    const beforeUrl = line
      .slice(0, urlMatch.index)
      .replace(/[\s—–-]+$/, "")
      .trim();
    const segments = beforeUrl
      .split(separatorSplitPattern)
      .map((segment) => stripMarkdownEmphasis(segment))
      .filter((segment) => segment.length > 0);

    if (segments.length < 3) {
      return [];
    }

    const [name, title, ...companyParts] = segments;

    if (name === undefined || title === undefined) {
      return [];
    }

    return [
      {
        name,
        title,
        company: companyParts.join(" — "),
        url,
      },
    ];
  });
}

interface VenueQuestionSpec {
  ask: string;
  retryAsk: string;
}

const venueQuestionSpecs: Readonly<Record<BuyerPersonaVenue, VenueQuestionSpec>> =
  {
    public_voices: {
      ask: "Find NAMED individuals in ICP buyer roles for this category who are publicly visible — podcast guests, conference/webinar speakers, LinkedIn authors posting about this problem space, case-study champions",
      retryAsk:
        "Search more broadly across podcasts, conference agendas, webinar rosters, LinkedIn posts, and customer case studies for NAMED individuals in buyer roles for this category",
    },
    reviewer_identities: {
      ask: "Find NAMED reviewer identities on G2, Capterra, TrustRadius, or similar review platforms who reviewed this product or close competitors — full reviewer name (or public reviewer handle) with their stated title and company",
      retryAsk:
        "Search more broadly across G2, Capterra, TrustRadius, Gartner Peer Insights, and Trustpilot for NAMED reviewer identities (name or public handle, title, company) for this product or its category",
    },
  };

export function buildBuyerPersonaVenueQuestion({
  attempt = 1,
  company,
  venue,
}: {
  attempt?: 1 | 2;
  company: BuyerPersonaSubjectCompany;
  venue: BuyerPersonaVenue;
}): string {
  const spec = venueQuestionSpecs[venue];
  const subject = `${company.name} (${company.websiteUrl}), the ${company.category}`;

  return [
    `${attempt === 1 ? spec.ask : spec.retryAsk}, for ${subject}.`,
    "Return ONLY lines in this exact format, one person per line:",
    "<full name> — <title> — <company> — <url>",
    "Name people exactly as the source states them; every line must trace to a real URL where that name appears. If the search finds nobody reliable, say so explicitly.",
  ].join("\n");
}

export function buildBuyerPersonaCandidates({
  answer,
  venue,
}: {
  answer: string;
  venue: BuyerPersonaVenue;
}): BuyerPersonaCandidate[] {
  return parseNamedPersonaLines(answer).flatMap((line) => {
    if (
      !isLikelyNamedBuyerIdentity(line.name, {
        company: line.company,
        title: line.title,
      })
    ) {
      return [];
    }

    return [{ ...line, venue }];
  });
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

export async function acquireBuyerPersonaCandidates({
  company,
  executeLookup,
}: {
  company: BuyerPersonaSubjectCompany;
  executeLookup: (question: string) => Promise<unknown>;
}): Promise<AcquireBuyerPersonaCandidatesResult> {
  let lookupCount = 0;
  let credentialGapSeen = false;
  const lookups: BuyerPersonaLookup[] = [];
  const collectedByVenue = new Map<BuyerPersonaVenue, BuyerPersonaCandidate[]>();

  const runVenue = async (venue: BuyerPersonaVenue): Promise<void> => {
    const collected: BuyerPersonaCandidate[] = [];

    for (const attempt of [1, 2] as const) {
      if (
        credentialGapSeen ||
        lookupCount >= BUYER_PERSONA_MAX_PERPLEXITY_CALLS
      ) {
        break;
      }

      lookupCount += 1;
      const question = buildBuyerPersonaVenueQuestion({
        attempt,
        company,
        venue,
      });
      const output = await executeLookup(question);
      lookups.push({ attempt, output, question, venue });

      if (isCredentialGapOutput(output)) {
        credentialGapSeen = true;
        break;
      }

      const answer = extractAnswer(output);
      if (answer !== null) {
        collected.push(...buildBuyerPersonaCandidates({ answer, venue }));
      }

      if (collected.length > 0) {
        break;
      }
    }

    collectedByVenue.set(venue, collected);
  };

  await Promise.all(BUYER_PERSONA_VENUES.map((venue) => runVenue(venue)));

  const seenKeys = new Set<string>();
  const candidates: BuyerPersonaCandidate[] = [];

  for (const venue of BUYER_PERSONA_VENUES) {
    for (const candidate of collectedByVenue.get(venue) ?? []) {
      const key = `${candidate.name.toLowerCase()}::${candidate.url}`;

      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      candidates.push(candidate);

      if (candidates.length >= BUYER_PERSONA_PACK_MAX_SIZE) {
        return { candidates, lookupCount, lookups };
      }
    }
  }

  return { candidates, lookupCount, lookups };
}

/**
 * Derive-don't-ask vendor-independence label: a persona is vendor-sourced
 * when its sourceUrl's registrable domain equals the audited company's.
 * Unparseable URLs derive false — independence is the default claim and the
 * URL validator rejects junk separately.
 */
export function deriveVendorSourced({
  sourceUrl,
  subjectWebsiteUrl,
}: {
  sourceUrl: string;
  subjectWebsiteUrl: string;
}): boolean {
  const sourceDomain = getRegistrableDomain(sourceUrl);
  const subjectDomain = getRegistrableDomain(subjectWebsiteUrl);

  return (
    sourceDomain !== null &&
    subjectDomain !== null &&
    sourceDomain === subjectDomain
  );
}

/**
 * Render the persona leads for the agent prompt. Leads are NOT personas:
 * the agent must verify the name at the URL before promoting it.
 */
export function formatBuyerPersonaCandidateBlock(
  candidates: readonly BuyerPersonaCandidate[],
): string {
  if (candidates.length === 0) {
    return [
      "Buyer persona venue leads (perplexity prepass)",
      "",
      "None acquired — the venue passes surfaced no named individuals. Mine your own tool fills (case studies, webinar rosters, named reviewers); below the floor, file the structured evidence-gap report instead of padding.",
    ].join("\n");
  }

  return [
    "Buyer persona venue leads (perplexity prepass)",
    "",
    "Instructions:",
    "- These are LEADS, not personas. Promote a persona only after the named evidence at its URL supports it; `sourceUrl` is that URL.",
    "- Keep names exactly as the source states them; never merge leads or upgrade a handle to a full name.",
    "- Do not author `vendorSourced` — the runner derives it from the sourceUrl domain.",
    "",
    "Leads:",
    ...candidates.map(
      (candidate, index) =>
        `${index + 1}. [${candidate.venue}] ${candidate.name} — ${candidate.title} — ${candidate.company}\n   URL: ${candidate.url}`,
    ),
  ].join("\n");
}
