// BuyerICP acquisition ledger (Wave 2B).
//
// The buyer-persona venue prepass (buyer-persona-acquisition.ts) discovers named
// persona LEADS via Perplexity. This module turns that bounded discovery into an
// honest audit trail attached to the section's evidenceGapReport at commit:
// which leads were searched, which were promoted into grounded named personas,
// and which were not. Promotion is derived deterministically by reconciling each
// lead's name against the committed body's grounded named personas — never the
// other way around, so a fabricated persona (one absent from the leads) can
// never inflate the promoted count. Rejected leads stay rejected.

import type { ArtifactEnvelope } from "../artifacts/artifact-envelope";
import { buyerICPEvidenceGapReason, isLikelyNamedBuyerIdentity } from "../artifacts/schemas/buyer-icp";
import { computeAcquisitionSufficiency } from "../artifacts/schemas/strategic-insight";
import { getRegistrableDomain } from "../domain-utils";
import {
  classifyBuyerPersonaLookupGap,
  type BuyerPersonaCandidate,
  type BuyerPersonaLookup,
  type BuyerPersonaLookupGapReason,
  type BuyerPersonaVenue,
} from "./buyer-persona-acquisition";

// Mirrors buyerICPRequiredNamedPersonaCount / validateBuyerICPMinimums: a section
// reports "sufficient" acquisition only once >= 3 leads are grounded as personas.
const BUYER_ICP_PROMOTED_PERSONA_FLOOR = 3;

export type BuyerICPAcquisitionLedgerRejectionReason =
  | "not_named_individual"
  | "not_buyer_role"
  | "unverifiable_source"
  | "duplicate"
  | "insufficient_evidence"
  | "not_selected";

export interface BuyerICPAcquisitionLedgerRow {
  // Optional on query-level attempt rows: a venue pass that surfaced no
  // candidate has no source URL/domain. Candidate rows always carry both.
  sourceUrl?: string;
  domain?: string;
  query: string;
  source: string;
  candidateLabel?: string;
  promotionStatus: "promoted" | "rejected" | "not_applicable";
  // Persona-classification reason (candidate rows only).
  rejectionReason?: BuyerICPAcquisitionLedgerRejectionReason;
  // Lookup-outcome reason (query-level attempt rows only).
  toolGapReason?: BuyerPersonaLookupGapReason;
  observedAt: string;
}

// Honest, concise description of the bounded discovery query behind each venue.
const venueQueryLabel: Readonly<Record<BuyerPersonaVenue, string>> = {
  public_voices:
    "Perplexity venue prepass: named ICP-role individuals in podcasts, talks, and posts",
  reviewer_identities:
    "Perplexity venue prepass: named reviewer identities on G2/Capterra/TrustRadius",
  case_study_champions:
    "Perplexity venue prepass: named champions quoted in customer case studies",
  event_speakers:
    "Perplexity venue prepass: named speakers from webinars and conference rosters",
};

function normalizePersonaName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

function ledgerDomain(url: string): string {
  const registrable = getRegistrableDomain(url);
  if (registrable !== null && registrable.length > 0) {
    return registrable;
  }

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.length > 0) {
      return host;
    }
  } catch {
    // fall through to the raw url
  }

  return url.length > 0 ? url : "unknown";
}

function isNamedBuyerPersona(persona: Record<string, unknown>): boolean {
  const name = persona.name;
  if (typeof name !== "string") {
    return false;
  }

  return isLikelyNamedBuyerIdentity(name, {
    company: typeof persona.company === "string" ? persona.company : undefined,
    role: typeof persona.role === "string" ? persona.role : undefined,
    seniority:
      typeof persona.seniority === "string" ? persona.seniority : undefined,
    title: typeof persona.title === "string" ? persona.title : undefined,
  });
}

/**
 * Build one ledger row per discovered lead. A lead is "promoted" only when its
 * normalized name is present in `promotedNames` (the grounded named personas in
 * the committed body); otherwise it is "rejected" with reason "not_selected".
 * No row is ever fabricated and no rejected row is recovered.
 */
export function buildBuyerICPAcquisitionLedger({
  candidates,
  promotedNames,
  observedAt,
}: {
  candidates: readonly BuyerPersonaCandidate[];
  promotedNames: ReadonlySet<string>;
  observedAt: string;
}): BuyerICPAcquisitionLedgerRow[] {
  return candidates.map((candidate) => {
    const promoted = promotedNames.has(normalizePersonaName(candidate.name));

    return {
      sourceUrl: candidate.url,
      domain: ledgerDomain(candidate.url),
      query: venueQueryLabel[candidate.venue],
      source: candidate.venue,
      candidateLabel: `${candidate.name} — ${candidate.title} — ${candidate.company}`,
      promotionStatus: promoted ? "promoted" : "rejected",
      ...(promoted ? {} : { rejectionReason: "not_selected" as const }),
      observedAt,
    };
  });
}

/**
 * Build query-level attempt rows for the case where every venue pass ran but
 * NO candidate survived. One `not_applicable` row per lookup records the venue,
 * its query label, and why the lookup yielded no named buyer — so the section's
 * acquisition diagnostics stay honest instead of silently absent. These rows
 * carry no sourceUrl/domain/candidateLabel (a query attempt has none) and never
 * a candidate `rejectionReason`.
 */
export function buildBuyerICPAttemptLedgerRows({
  lookups,
  observedAt,
}: {
  lookups: readonly BuyerPersonaLookup[];
  observedAt: string;
}): BuyerICPAcquisitionLedgerRow[] {
  return lookups.map((lookup) => ({
    source: lookup.venue,
    query: venueQueryLabel[lookup.venue],
    promotionStatus: "not_applicable",
    toolGapReason: classifyBuyerPersonaLookupGap(lookup.output),
    observedAt,
  }));
}

/**
 * Enrich a committed BuyerICP evidence-gap artifact with its acquisition ledger
 * and the deterministic sufficiency roll-up, derived from the persona-venue
 * prepass candidates. No-op unless this is a BuyerICP artifact that had
 * candidates/lookups acquired and does not already carry a ledger.
 *
 * P0b: when the committed body carries NO evidenceGapReport (the degraded
 * persona-blockGap exit — personaReality.blockGap present, 0 personas, no
 * report), synthesize a COMPLETE schema-valid evidenceGapReport carrying the
 * acquisitionLedger + sufficiency so the app explains failed acquisition
 * instead of silently omitting diagnostics. body.evidenceGap is set true for
 * coherence with validateBuyerICPMinimums, which requires a matching report
 * whenever evidenceGap=true. Purely additive; never weakens schema fields.
 */
export function withBuyerICPAcquisitionLedger({
  artifact,
  candidates,
  lookups,
  observedAt,
}: {
  artifact: ArtifactEnvelope;
  candidates: readonly BuyerPersonaCandidate[];
  lookups?: readonly BuyerPersonaLookup[];
  observedAt: string;
}): ArtifactEnvelope {
  if (artifact.sectionId !== "positioningBuyerICP") {
    return artifact;
  }

  // Genuinely nothing attempted: no candidates promoted/rejected AND no venue
  // lookups to record. Leave the artifact untouched.
  if (candidates.length === 0 && (lookups === undefined || lookups.length === 0)) {
    return artifact;
  }

  const body = artifact.body as Record<string, unknown>;
  const report = body.evidenceGapReport;

  let acquisitionLedger: BuyerICPAcquisitionLedgerRow[];

  if (candidates.length > 0) {
    const personaReality = body.personaReality;
    const personas =
      personaReality !== null &&
      typeof personaReality === "object" &&
      Array.isArray((personaReality as Record<string, unknown>).personas)
        ? ((personaReality as Record<string, unknown>)
            .personas as ReadonlyArray<Record<string, unknown>>)
        : [];
    const promotedNames = new Set(
      personas
        .filter((persona) => isNamedBuyerPersona(persona))
        .map((persona) => normalizePersonaName(String(persona.name ?? ""))),
    );

    acquisitionLedger = buildBuyerICPAcquisitionLedger({
      candidates,
      promotedNames,
      observedAt,
    });
  } else {
    // Attempted-but-empty: every venue pass ran but no candidate survived.
    // Persist honest query-level attempt rows so the diagnostics aren't silently
    // omitted. `lookups` is guaranteed non-empty by the early guard above.
    acquisitionLedger = buildBuyerICPAttemptLedgerRows({
      lookups: lookups ?? [],
      observedAt,
    });
  }

  const sufficiency = computeAcquisitionSufficiency(acquisitionLedger, {
    promotedFloor: BUYER_ICP_PROMOTED_PERSONA_FLOOR,
  });

  // P0b: degraded persona-blockGap exit carries personaReality.blockGap with
  // 0 personas but NO evidenceGapReport, so the ledger/sufficiency had nowhere
  // to live. Synthesize a COMPLETE schema-valid report — every .strict()
  // required field — carrying the ledger, and set body.evidenceGap=true so
  // validateBuyerICPMinimums' coherence check (evidenceGap=true requires a
  // matching report) passes. Never partial; the report schema is .strict().
  if (report === null || typeof report !== "object" || Array.isArray(report)) {
    const personaReality = body.personaReality;
    const personas =
      personaReality !== null &&
      typeof personaReality === "object" &&
      Array.isArray((personaReality as Record<string, unknown>).personas)
        ? ((personaReality as Record<string, unknown>)
            .personas as ReadonlyArray<Record<string, unknown>>)
        : [];
    const groundedPersonaCount = personas.filter(isNamedBuyerPersona).length;

    const synthesizedReport = {
      reason: buyerICPEvidenceGapReason,
      summary:
        "Evidence gap: the buyer-persona venue prepass ran but no named buyer cleared the grounding bar, so personaReality is empty. Acquisition diagnostics are persisted below.",
      foundNamedPersonaCount: groundedPersonaCount,
      requiredNamedPersonaCount: BUYER_ICP_PROMOTED_PERSONA_FLOOR,
      rejectedPersonaLabels: [],
      acquisitionLedger,
      sufficiency,
      sourcingPlan: [
        "Recover named buyer personas from approved public surfaces (G2/Capterra/TrustRadius reviewer identities, case-study champions, webinar/event speakers, podcast bylines) and re-run this section.",
      ],
    };

    return {
      ...artifact,
      body: {
        ...body,
        evidenceGap: true,
        evidenceGapReport: synthesizedReport,
      },
    };
  }

  const reportRecord = report as Record<string, unknown>;
  if (reportRecord.acquisitionLedger !== undefined) {
    return artifact;
  }

  return {
    ...artifact,
    body: {
      ...body,
      evidenceGapReport: {
        ...reportRecord,
        acquisitionLedger,
        sufficiency,
      },
    },
  };
}
