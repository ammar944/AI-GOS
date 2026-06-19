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
import { getRegistrableDomain } from "../domain-utils";

export const BUYER_PERSONA_VENUES = [
  "public_voices",
  "reviewer_identities",
] as const;

// W5 second acquisition pass: fired only when the first pass leaves a thin
// lead pack. Distinct hunting grounds from the broad first-pass sweep —
// named champions quoted in customer case studies, and named speakers on
// webinar/conference rosters (incl. LinkedIn event posts).
export const BUYER_PERSONA_SECOND_PASS_VENUES = [
  "case_study_champions",
  "event_speakers",
] as const;

// Deterministic, I/O-free venue: role/segment phrases extracted from the
// prepared corpus excerpts (about-us, "who uses", analyst research, review
// title distributions). This is the SEGMENT-first primitive — an ICP is a
// buyer segment/role, not a named-person list, and every subject exposes
// role/segment language on live pages. Never counted toward the Perplexity
// call budget; mined locally from researchInput.corpus by
// buyer-segment-mining.ts.
export const SEGMENT_EVIDENCE_VENUE = "segment_evidence" as const;

export type BuyerPersonaVenue =
  | (typeof BUYER_PERSONA_VENUES)[number]
  | (typeof BUYER_PERSONA_SECOND_PASS_VENUES)[number]
  | typeof SEGMENT_EVIDENCE_VENUE;

/**
 * First pass: 2 venues x (1 initial + at most 1 retry). Thin-pack second
 * pass: 2 venues x 1 attempt, no retries. Structural cap, never a loop.
 */
export const BUYER_PERSONA_MAX_PERPLEXITY_CALLS =
  BUYER_PERSONA_VENUES.length * 2 + BUYER_PERSONA_SECOND_PASS_VENUES.length;

/**
 * Below this many viable leads after the first pass, mine the second-pass
 * venues. Committed personas attrite from leads (the agent must verify each
 * name at its URL), so the 5-persona deliverable needs lead headroom — the
 * live 3/5 runs came from thin packs, not from the agent ignoring leads.
 */
export const BUYER_PERSONA_SECOND_PASS_THRESHOLD = 8;

/** Lead-pack ceiling — the floor is 3 personas; a dozen leads is plenty. */
export const BUYER_PERSONA_PACK_MAX_SIZE = 12;

export interface BuyerPersonaCandidate {
  company: string;
  name: string;
  title: string;
  url: string;
  venue: BuyerPersonaVenue;
  // Segment-evidence venue only: the verbatim role/segment phrase mined from
  // the sourceUrl page (e.g. "modern finance teams", "CFOs and controllers").
  // The model authors the persona's `segmentLabel` field from this phrase,
  // verbatim, so it clears source-liveness strict-containment. Absent for the
  // named-champion / Perplexity venues (those ground on `name`).
  segmentLabel?: string;
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
    case_study_champions: {
      ask: "Find NAMED customer champions quoted in customer case studies, customer-story pages, and testimonial sections for this product or its close competitors — the quoted person's full name, stated title, and company",
      retryAsk:
        "Search vendor case-study libraries, customer-story pages, and press releases announcing customer wins for NAMED individuals (full name, title, company) who championed this product or a close competitor",
    },
    event_speakers: {
      ask: "Find NAMED speakers from recent webinars, conference sessions, summits, and meetups about this category — speaker full name, stated title, and company, from event agenda/roster pages or LinkedIn event posts",
      retryAsk:
        "Search conference agendas, webinar registration pages, podcast guest lists, and LinkedIn event posts for NAMED speakers (full name, title, company) presenting on this category's problem space",
    },
    // Segment-evidence is mined deterministically from the prepared corpus, not
    // searched via Perplexity, so these asks are never dispatched. The framing
    // mirrors the segment-first path: surface the buyer SEGMENT/ROLE language
    // present on live pages, not a named-person list.
    segment_evidence: {
      ask: "Extract the buyer SEGMENT/ROLE language for this category from the prepared corpus — role/segment phrases on about-us, 'who uses', analyst research, and case-study role lines",
      retryAsk:
        "Re-scan the prepared corpus for buyer SEGMENT/ROLE phrases (e.g. 'modern finance teams', 'controllers at mid-market firms') present verbatim on live pages",
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

/**
 * Subject-own-company reconciliation (Fix B). A lead is the subject's OWN
 * employee — not an external buyer — when its company label or its source URL
 * resolves to the audited company. Catches "Eric Glyman — CEO — Ramp" (company
 * label) regardless of whether the lead URL is the subject's domain or a third
 * party (youtube.com). The company label is truncated at the first clause so
 * "Ramp, the spend platform" still reconciles. Shared by the lead filter and
 * the case-study miner.
 */
export function personaCompanyReconcilesWithSubject({
  company,
  sourceUrl,
  subjectName,
  subjectWebsiteUrl,
}: {
  company: string;
  sourceUrl?: string;
  subjectName: string;
  subjectWebsiteUrl: string;
}): boolean {
  const subjectDomain = getRegistrableDomain(subjectWebsiteUrl);
  const subjectNameSlug = subjectName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const companyHead = company.split(/[,;.]/)[0] ?? company;
  const companySlug = companyHead.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (subjectNameSlug.length > 0 && companySlug === subjectNameSlug) {
    return true;
  }
  const companyDomain = getRegistrableDomain(companyHead);
  if (
    subjectDomain !== null &&
    (companyDomain === subjectDomain ||
      companySlug === subjectDomain.replace(/[^a-z0-9]/g, ""))
  ) {
    return true;
  }
  if (sourceUrl !== undefined) {
    const sourceDomain = getRegistrableDomain(sourceUrl);
    if (subjectDomain !== null && sourceDomain === subjectDomain) {
      return true;
    }
  }
  return false;
}

export function buildBuyerPersonaCandidates({
  answer,
  venue,
  subject,
}: {
  answer: string;
  venue: BuyerPersonaVenue;
  subject?: Pick<BuyerPersonaSubjectCompany, "name" | "websiteUrl">;
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

    // Fix B: a subject-own employee is not an external buyer. Reject at the lead
    // stage so own-execs never reach the agent prompt and crowd out real buyers.
    if (
      subject !== undefined &&
      personaCompanyReconcilesWithSubject({
        company: line.company,
        sourceUrl: line.url,
        subjectName: subject.name,
        subjectWebsiteUrl: subject.websiteUrl,
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

export type BuyerPersonaLookupGapReason =
  | "missing_credential"
  | "no_named_individuals"
  | "no_result";

/**
 * Classify why a single venue lookup yielded no promoted persona, for an
 * honest query-level attempt row: a credential gap aborted the call
 * (`missing_credential`); the call returned no usable answer (`no_result`);
 * or an answer came back but no named buyer identity survived parsing
 * (`no_named_individuals`).
 */
export function classifyBuyerPersonaLookupGap(
  output: unknown,
): BuyerPersonaLookupGapReason {
  if (isCredentialGapOutput(output)) {
    return "missing_credential";
  }

  if (extractAnswer(output) === null) {
    return "no_result";
  }

  return "no_named_individuals";
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

  const runVenue = async (
    venue: BuyerPersonaVenue,
    attempts: readonly (1 | 2)[],
  ): Promise<void> => {
    const collected: BuyerPersonaCandidate[] = [];

    for (const attempt of attempts) {
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
        collected.push(
          ...buildBuyerPersonaCandidates({ answer, venue, subject: company }),
        );
      }

      if (collected.length > 0) {
        break;
      }
    }

    collectedByVenue.set(venue, collected);
  };

  const seenKeys = new Set<string>();
  const candidates: BuyerPersonaCandidate[] = [];

  const appendVenueCandidates = (
    venues: readonly BuyerPersonaVenue[],
  ): void => {
    for (const venue of venues) {
      for (const candidate of collectedByVenue.get(venue) ?? []) {
        const key = `${candidate.name.toLowerCase()}::${candidate.url}`;

        if (seenKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        candidates.push(candidate);

        if (candidates.length >= BUYER_PERSONA_PACK_MAX_SIZE) {
          return;
        }
      }
    }
  };

  await Promise.all(
    BUYER_PERSONA_VENUES.map((venue) => runVenue(venue, [1, 2])),
  );
  appendVenueCandidates(BUYER_PERSONA_VENUES);

  // Thin-pack second pass: distinct surfaces (case studies, event rosters),
  // one attempt per venue, never after a credential gap.
  if (
    !credentialGapSeen &&
    candidates.length < BUYER_PERSONA_SECOND_PASS_THRESHOLD
  ) {
    await Promise.all(
      BUYER_PERSONA_SECOND_PASS_VENUES.map((venue) => runVenue(venue, [1])),
    );
    appendVenueCandidates(BUYER_PERSONA_SECOND_PASS_VENUES);
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
  // An ICP is a buyer SEGMENT/ROLE, not a list of named humans. The primary
  // grounding primitive is the `segmentLabel` ("VP of Finance at mid-market
  // SaaS", "Controllers at 200–1000-employee firms", "modern finance teams")
  // carried on a live sourceUrl — the role/segment language already appears in
  // the Prepared evidence rows (case-study role lines, "who uses" pages, about-us
  // positioning, review title distributions, Contrary/analyst research). The
  // model should author segmentLabel personas from those rows FIRST, then layer
  // a named champion on top only when one is available.
  //
  // Leading with named champions when they exist is the failure mode: it makes
  // the section depend on finding public named buyers (most subjects expose
  // few/none) and ships empty when the miner comes up short. The segment path
  // works on every subject because every subject exposes role/segment language
  // on live pages.
  const lines: string[] = [
    "Buyer ICP segment leads (prepass)",
    "",
    "An ICP is a buyer SEGMENT/ROLE, not a list of named humans. Author `personaReality.personas` in this order:",
    "",
    "1. FIRST — author 2–3 grounded `segmentLabel` personas. The SEGMENT-EVIDENCE leads below are role/segment phrases mined from live pages (about-us, 'who uses', analyst research, case-study role lines). For each, author a persona whose `segmentLabel` is the VERBATIM phrase shown (it is strict-contained on the sourceUrl page by the verifier), `sourceUrl` is the listed URL, `name` is a short role label, and `role`/`seniority`/`company` come from the segment. These are ready-to-author — the grounding is pre-verified. If no segment leads are listed, author `segmentLabel` personas directly from the role/segment language in the Prepared evidence rows.",
    "2. SECOND — if a named champion is listed below, you MAY add ONE as a bonus persona to color the segment. A named champion never replaces a segmentLabel persona and never fills the count alone. Three grounded segmentLabel personas with zero named champions is a complete section.",
    "",
    "Do NOT hunt for named humans as the deliverable. Do NOT ship empty waiting for names when segment leads or prepared-evidence role language exist. Do NOT author `vendorSourced` (the runner derives it).",
  ];

  const segment = candidates.filter(
    (c) => c.venue === SEGMENT_EVIDENCE_VENUE,
  );
  const verified = candidates.filter(
    (c) => c.venue === "case_study_champions",
  );
  const unverified = candidates.filter(
    (c) =>
      c.venue !== "case_study_champions" && c.venue !== SEGMENT_EVIDENCE_VENUE,
  );

  if (segment.length > 0) {
    lines.push(
      "",
      "SEGMENT-EVIDENCE leads (role/segment phrases mined from live pages — author segmentLabel personas from these FIRST):",
    );
    segment.forEach((candidate, i) => {
      lines.push(
        `${i + 1}. ${candidate.segmentLabel ?? candidate.name}\n   URL: ${candidate.url}`,
      );
    });
  }

  if (verified.length > 0) {
    lines.push(
      "",
      "Named champions (bonus layer — name+employer on the page by construction; usable as ONE persona with sourceUrl = the listed URL):",
    );
    verified.forEach((candidate, i) => {
      lines.push(
        `${i + 1}. [${candidate.venue}] ${candidate.name} — ${candidate.title} — ${candidate.company}\n   URL: ${candidate.url}`,
      );
    });
  }

  if (unverified.length > 0) {
    lines.push(
      "",
      "Perplexity name leads (unverified — confirm the named evidence at the URL before using; drop if you cannot):",
    );
    unverified.forEach((candidate, i) => {
      lines.push(
        `${i + 1}. [${candidate.venue}] ${candidate.name} — ${candidate.title} — ${candidate.company}\n   URL: ${candidate.url}`,
      );
    });
  }

  if (segment.length === 0 && verified.length === 0 && unverified.length === 0) {
    lines.push(
      "",
      "No segment or named-champion leads acquired. Proceed with step 1 using role/segment language from the Prepared evidence rows. Below the floor of 3, file the structured evidence-gap report — never pad with invented names or generic roles.",
    );
  }

  return lines.join("\n");
}
