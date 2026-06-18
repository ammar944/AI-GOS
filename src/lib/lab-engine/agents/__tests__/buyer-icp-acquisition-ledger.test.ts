import { describe, expect, it } from "vitest";

import { buyerICPFixtureArtifact } from "../../fixtures/buyer-icp-artifact";
import {
  buyerICPBodySchema,
  buyerICPEvidenceGapReason,
  validateBuyerICPMinimums,
} from "../../artifacts/schemas/buyer-icp";
import { acquisitionSufficiencySchema } from "../../artifacts/schemas/strategic-insight";
import type { ArtifactEnvelope } from "../../artifacts/artifact-envelope";
import {
  classifyBuyerPersonaLookupGap,
  type BuyerPersonaCandidate,
  type BuyerPersonaLookup,
} from "../buyer-persona-acquisition";
import {
  buildBuyerICPAcquisitionLedger,
  buildBuyerICPAttemptLedgerRows,
  withBuyerICPAcquisitionLedger,
} from "../buyer-icp-acquisition-ledger";

const observedAt = "2026-06-16T00:00:00.000Z";

function candidate(
  overrides: Partial<BuyerPersonaCandidate> = {},
): BuyerPersonaCandidate {
  return {
    company: "Acme Corp",
    name: "Jane Doe",
    title: "VP Finance",
    url: "https://www.g2.com/users/jane-doe",
    venue: "reviewer_identities",
    ...overrides,
  };
}

describe("buildBuyerICPAcquisitionLedger", () => {
  it("promotes candidates whose name was grounded as a named persona and rejects the rest", () => {
    const candidates: BuyerPersonaCandidate[] = [
      candidate({ name: "Jane Doe", url: "https://g2.com/u/jane" }),
      candidate({ name: "Carlos Vega", url: "https://linkedin.com/in/carlos" }),
      candidate({ name: "Mina Park", url: "https://capterra.com/u/mina" }),
    ];

    const rows = buildBuyerICPAcquisitionLedger({
      candidates,
      promotedNames: new Set(["jane doe", "mina park"]),
      observedAt,
    });

    expect(rows).toHaveLength(3);

    const jane = rows.find((row) => row.sourceUrl === "https://g2.com/u/jane");
    expect(jane?.promotionStatus).toBe("promoted");
    expect(jane?.rejectionReason).toBeUndefined();
    expect(jane?.source).toBe("reviewer_identities");
    expect(jane?.candidateLabel).toContain("Jane Doe");
    expect(jane?.domain?.length ?? 0).toBeGreaterThan(0);
    expect(jane?.observedAt).toBe(observedAt);
    expect(jane?.query.length).toBeGreaterThan(0);

    const carlos = rows.find(
      (row) => row.sourceUrl === "https://linkedin.com/in/carlos",
    );
    expect(carlos?.promotionStatus).toBe("rejected");
    expect(carlos?.rejectionReason).toBe("not_selected");
  });

  it("matches promoted names case- and whitespace-insensitively", () => {
    const rows = buildBuyerICPAcquisitionLedger({
      candidates: [candidate({ name: "  Jane   Doe " })],
      promotedNames: new Set(["jane doe"]),
      observedAt,
    });

    expect(rows[0]?.promotionStatus).toBe("promoted");
  });

  it("rejects every candidate when no persona was grounded (zero fabrication)", () => {
    const rows = buildBuyerICPAcquisitionLedger({
      candidates: [candidate({ name: "Jane Doe" }), candidate({ name: "Carlos Vega" })],
      promotedNames: new Set(),
      observedAt,
    });

    expect(rows.every((row) => row.promotionStatus === "rejected")).toBe(true);
    expect(rows.every((row) => row.rejectionReason === "not_selected")).toBe(true);
  });
});

// Build a minimally-shaped committed BuyerICP gap artifact. withBuyerICPAcquisitionLedger
// only reads sectionId, body.evidenceGapReport, and body.personaReality.personas.
function gapArtifact(
  personas: ReadonlyArray<Record<string, unknown>>,
): ArtifactEnvelope {
  return {
    sectionId: "positioningBuyerICP",
    body: {
      personaReality: { prose: "gap", personas },
      evidenceGap: true,
      evidenceGapReport: {
        reason: "insufficient_named_buyer_personas",
        summary: "Evidence gap.",
        foundNamedPersonaCount: personas.length,
        requiredNamedPersonaCount: 3,
        rejectedPersonaLabels: [],
        sourcingPlan: ["Mine named reviewers and case-study buyers."],
      },
    },
  } as unknown as ArtifactEnvelope;
}

const namedPersona = {
  name: "Jane Doe",
  title: "VP Finance",
  company: "Acme Corp",
  role: "Finance leader",
  seniority: "VP",
};

describe("withBuyerICPAcquisitionLedger", () => {
  it("populates acquisitionLedger and sufficiency on the committed gap report when candidates exist", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: gapArtifact([namedPersona]),
      candidates: [
        candidate({ name: "Jane Doe", url: "https://g2.com/u/jane" }),
        candidate({ name: "Carlos Vega", url: "https://linkedin.com/in/carlos" }),
      ],
      observedAt,
    });

    const report = (enriched.body as Record<string, unknown>)
      .evidenceGapReport as Record<string, unknown>;

    expect(Array.isArray(report.acquisitionLedger)).toBe(true);
    expect((report.acquisitionLedger as unknown[]).length).toBe(2);

    const sufficiency = acquisitionSufficiencySchema.parse(report.sufficiency);
    expect(sufficiency).toMatchObject({
      tier: "partial",
      candidatesFound: 2,
      promoted: 1,
      rejected: 1,
    });
  });

  it("reports insufficient when candidates were acquired but none were grounded", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: gapArtifact([]),
      candidates: [candidate({ name: "Jane Doe" }), candidate({ name: "Carlos Vega" })],
      observedAt,
    });

    const report = (enriched.body as Record<string, unknown>)
      .evidenceGapReport as Record<string, unknown>;
    const sufficiency = acquisitionSufficiencySchema.parse(report.sufficiency);

    expect(sufficiency.tier).toBe("insufficient");
    expect(sufficiency.promoted).toBe(0);
    expect(sufficiency.rejected).toBe(2);
  });

  it("leaves the artifact untouched when no candidates were acquired", () => {
    const artifact = gapArtifact([namedPersona]);
    const enriched = withBuyerICPAcquisitionLedger({
      artifact,
      candidates: [],
      observedAt,
    });

    const report = (enriched.body as Record<string, unknown>)
      .evidenceGapReport as Record<string, unknown>;
    expect(report.acquisitionLedger).toBeUndefined();
    expect(report.sufficiency).toBeUndefined();
  });

  it("is idempotent when an acquisitionLedger is already present", () => {
    const artifact = gapArtifact([namedPersona]);
    (
      (artifact.body as Record<string, unknown>).evidenceGapReport as Record<
        string,
        unknown
      >
    ).acquisitionLedger = [{ marker: "pre-existing" }];

    const enriched = withBuyerICPAcquisitionLedger({
      artifact,
      candidates: [candidate()],
      observedAt,
    });

    const report = (enriched.body as Record<string, unknown>)
      .evidenceGapReport as Record<string, unknown>;
    expect(report.acquisitionLedger).toEqual([{ marker: "pre-existing" }]);
    expect(report.sufficiency).toBeUndefined();
  });
});

function credentialGapLookup(): BuyerPersonaLookup {
  return {
    attempt: 1,
    venue: "public_voices",
    question: "find named ICP voices",
    output: { type: "gap", reason: "missing_credential" },
  };
}

function answeredLookup(): BuyerPersonaLookup {
  return {
    attempt: 1,
    venue: "reviewer_identities",
    question: "find named reviewer identities",
    output: { type: "result", answer: "Several reviewers mention the product but list no full names." },
  };
}

function noResultLookup(): BuyerPersonaLookup {
  return {
    attempt: 2,
    venue: "case_study_champions",
    question: "find named case-study champions",
    output: null,
  };
}

describe("classifyBuyerPersonaLookupGap", () => {
  it("classifies a credential gap, a returned-but-empty answer, and a no-result output", () => {
    expect(classifyBuyerPersonaLookupGap(credentialGapLookup().output)).toBe(
      "missing_credential",
    );
    expect(classifyBuyerPersonaLookupGap(answeredLookup().output)).toBe(
      "no_named_individuals",
    );
    expect(classifyBuyerPersonaLookupGap(noResultLookup().output)).toBe(
      "no_result",
    );
  });
});

describe("buildBuyerICPAttemptLedgerRows", () => {
  it("emits one not_applicable attempt row per lookup with the right toolGapReason and no rejectionReason", () => {
    const rows = buildBuyerICPAttemptLedgerRows({
      lookups: [credentialGapLookup(), answeredLookup(), noResultLookup()],
      observedAt,
    });

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.promotionStatus === "not_applicable")).toBe(
      true,
    );
    expect(rows.every((row) => row.rejectionReason === undefined)).toBe(true);
    expect(rows.every((row) => row.observedAt === observedAt)).toBe(true);
    expect(rows.every((row) => row.query.length > 0)).toBe(true);
    expect(rows.every((row) => row.sourceUrl === undefined)).toBe(true);
    expect(rows.every((row) => row.domain === undefined)).toBe(true);
    expect(rows.every((row) => row.candidateLabel === undefined)).toBe(true);

    expect(rows.map((row) => row.toolGapReason)).toEqual([
      "missing_credential",
      "no_named_individuals",
      "no_result",
    ]);
    expect(rows.map((row) => row.source)).toEqual([
      "public_voices",
      "reviewer_identities",
      "case_study_champions",
    ]);
  });
});

// A schema-valid BuyerICP gap body whose personaReality is empty (every venue
// pass returned, but no named buyer survived). Derived from the live fixture so
// the persisted body validates against buyerICPBodySchema as a whole.
function emptyPersonaGapArtifact(): ArtifactEnvelope {
  const fixtureBody = buyerICPFixtureArtifact.body;

  return {
    ...buyerICPFixtureArtifact,
    body: {
      ...fixtureBody,
      personaReality: {
        ...fixtureBody.personaReality,
        prose:
          "Evidence gap: every venue pass returned but no named buyer cleared the bar.",
        personas: [],
      },
      evidenceGap: true,
      evidenceGapReport: {
        reason: "insufficient_named_buyer_personas",
        summary: "Found 0 named buyer personas; required 3.",
        foundNamedPersonaCount: 0,
        requiredNamedPersonaCount: 3,
        rejectedPersonaLabels: [],
        sourcingPlan: ["Mine named reviewers and case-study buyers."],
      },
    },
  } as unknown as ArtifactEnvelope;
}

describe("withBuyerICPAcquisitionLedger — attempted-but-empty lookups path", () => {
  it("persists not_applicable attempt rows + an insufficient sufficiency when candidates is empty but lookups were made", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: emptyPersonaGapArtifact(),
      candidates: [],
      lookups: [credentialGapLookup(), answeredLookup(), noResultLookup()],
      observedAt,
    });

    const report = (enriched.body as Record<string, unknown>)
      .evidenceGapReport as Record<string, unknown>;

    expect(Array.isArray(report.acquisitionLedger)).toBe(true);
    const ledger = report.acquisitionLedger as ReadonlyArray<
      Record<string, unknown>
    >;
    expect(ledger).toHaveLength(3);
    expect(ledger.every((row) => row.promotionStatus === "not_applicable")).toBe(
      true,
    );
    expect(ledger.map((row) => row.toolGapReason)).toEqual([
      "missing_credential",
      "no_named_individuals",
      "no_result",
    ]);

    const sufficiency = acquisitionSufficiencySchema.parse(report.sufficiency);
    expect(sufficiency.tier).toBe("insufficient");
    expect(sufficiency.promoted).toBe(0);
    expect(sufficiency.candidatesFound).toBe(0);
  });

  it("produces a body that still validates against buyerICPBodySchema", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: emptyPersonaGapArtifact(),
      candidates: [],
      lookups: [credentialGapLookup(), answeredLookup(), noResultLookup()],
      observedAt,
    });

    const parsed = buyerICPBodySchema.safeParse(enriched.body);
    expect(parsed.success).toBe(true);
  });

  it("returns the artifact unchanged when there are neither candidates nor lookups", () => {
    const artifact = emptyPersonaGapArtifact();
    const enriched = withBuyerICPAcquisitionLedger({
      artifact,
      candidates: [],
      lookups: [],
      observedAt,
    });

    const report = (enriched.body as Record<string, unknown>)
      .evidenceGapReport as Record<string, unknown>;
    expect(report.acquisitionLedger).toBeUndefined();
    expect(report.sufficiency).toBeUndefined();
    expect(enriched).toBe(artifact);
  });
});

// P0b: degraded BuyerICP runs must persist acquisition diagnostics. The Ramp run
// (d2abf018) took the persona-blockGap exit (personaReality.blockGap with 0
// personas) but carried NO evidenceGapReport, so withBuyerICPAcquisitionLedger
// no-opped — the ledger/sufficiency had nowhere to live. The fix synthesizes a
// COMPLETE schema-valid evidenceGapReport carrying acquisitionLedger + sufficiency
// and sets body.evidenceGap=true for coherence with validateBuyerICPMinimums.
// This test reproduces the degraded shape (blockGap, no report, non-empty
// lookups) and asserts the synthesized report is complete + schema-valid.

// A degraded BuyerICP artifact mirroring Ramp: personaReality.blockGap present,
// 0 personas, NO evidenceGapReport, NO evidenceGap flag. Derived from the live
// fixture so the body validates against buyerICPBodySchema as a whole.
function degradedPersonaBlockGapArtifact(): ArtifactEnvelope {
  const fixtureBody = buyerICPFixtureArtifact.body;

  return {
    ...buyerICPFixtureArtifact,
    body: {
      ...fixtureBody,
      personaReality: {
        prose:
          "Evidence gap: every venue prepass ran but no named buyer cleared the grounding bar.",
        personas: [],
        blockGap: {
          summary:
            "No named buyer personas could be independently verified from public surfaces.",
          foundCount: 0,
          requiredCount: 3,
          sourcingPlan: [
            "Recover named buyer personas from approved public surfaces and re-run this section.",
          ],
        },
      },
      // Ramp's degraded body had NO evidenceGapReport and evidenceGap was null/absent.
    },
  } as unknown as ArtifactEnvelope;
}

describe("withBuyerICPAcquisitionLedger — degraded persona-blockGap synthesis (P0b)", () => {
  it("synthesizes a complete evidenceGapReport with acquisitionLedger+sufficiency when the body has personaReality.blockGap but no report (lookups path)", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: degradedPersonaBlockGapArtifact(),
      candidates: [],
      lookups: [credentialGapLookup(), answeredLookup(), noResultLookup()],
      observedAt,
    });

    const body = enriched.body as Record<string, unknown>;

    // P0b: body.evidenceGap must be set true for coherence with
    // validateBuyerICPMinimums (evidenceGap=true requires a matching report).
    expect(body.evidenceGap).toBe(true);

    const report = body.evidenceGapReport as Record<string, unknown>;
    expect(report).toBeDefined();
    expect(typeof report).toBe("object");
    expect(Array.isArray(report)).toBe(false);

    // Every .strict() required field must be present and schema-valid.
    expect(report.reason).toBe(buyerICPEvidenceGapReason);
    expect(typeof report.summary).toBe("string");
    expect((report.summary as string).length).toBeGreaterThan(0);
    expect(report.foundNamedPersonaCount).toBe(0);
    expect(report.requiredNamedPersonaCount).toBe(3);
    expect(Array.isArray(report.rejectedPersonaLabels)).toBe(true);
    expect(report.rejectedPersonaLabels as unknown[]).toEqual([]);

    // The acquisitionLedger carries honest query-level attempt rows.
    expect(Array.isArray(report.acquisitionLedger)).toBe(true);
    const ledger = report.acquisitionLedger as ReadonlyArray<
      Record<string, unknown>
    >;
    expect(ledger).toHaveLength(3);
    expect(
      ledger.every((row) => row.promotionStatus === "not_applicable"),
    ).toBe(true);

    // Sufficiency is deterministic and honest: 0 promoted -> insufficient.
    const sufficiency = acquisitionSufficiencySchema.parse(report.sufficiency);
    expect(sufficiency.tier).toBe("insufficient");
    expect(sufficiency.promoted).toBe(0);
    expect(sufficiency.candidatesFound).toBe(0);

    // sourcingPlan must carry at least one actionable string.
    expect(Array.isArray(report.sourcingPlan)).toBe(true);
    expect((report.sourcingPlan as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  it("synthesizes a complete evidenceGapReport when candidates exist but none were promoted (candidates path)", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: degradedPersonaBlockGapArtifact(),
      candidates: [
        candidate({ name: "Jane Doe", url: "https://g2.com/u/jane" }),
        candidate({ name: "Carlos Vega", url: "https://linkedin.com/in/carlos" }),
      ],
      observedAt,
    });

    const body = enriched.body as Record<string, unknown>;
    expect(body.evidenceGap).toBe(true);

    const report = body.evidenceGapReport as Record<string, unknown>;
    expect(report.reason).toBe(buyerICPEvidenceGapReason);
    expect(report.foundNamedPersonaCount).toBe(0);
    expect(report.requiredNamedPersonaCount).toBe(3);
    expect(report.rejectedPersonaLabels).toEqual([]);

    const ledger = report.acquisitionLedger as ReadonlyArray<
      Record<string, unknown>
    >;
    expect(ledger).toHaveLength(2);
    expect(
      ledger.every((row) => row.promotionStatus === "rejected"),
    ).toBe(true);

    const sufficiency = acquisitionSufficiencySchema.parse(report.sufficiency);
    expect(sufficiency.tier).toBe("insufficient");
    expect(sufficiency.promoted).toBe(0);
    expect(sufficiency.candidatesFound).toBe(2);
    expect(sufficiency.rejected).toBe(2);
  });

  it("produces a synthesized body that validates against buyerICPBodySchema + validateBuyerICPMinimums (persistability)", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: degradedPersonaBlockGapArtifact(),
      candidates: [],
      lookups: [credentialGapLookup(), answeredLookup(), noResultLookup()],
      observedAt,
    });

    // The synthesized body must pass strict schema parse — a partial report
    // would fail here and turn the silent no-op into a hard commit failure.
    const parsedBody = buyerICPBodySchema.parse(enriched.body);

    // validateBuyerICPMinimums runs at both save and review; the synthesized
    // evidenceGap=true + matching report must pass its coherence check.
    const minimums = validateBuyerICPMinimums({
      ...enriched,
      body: parsedBody,
    });
    expect(minimums.ok).toBe(true);
  });

  it("preserves existing behavior when evidenceGapReport already exists (no synthesis)", () => {
    // The existing gap artifact already has a report — the synthesis branch
    // must NOT fire. The existing report is enriched in place.
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: emptyPersonaGapArtifact(),
      candidates: [],
      lookups: [credentialGapLookup(), answeredLookup(), noResultLookup()],
      observedAt,
    });

    const body = enriched.body as Record<string, unknown>;
    // evidenceGap was already true on the input; no synthesis needed.
    expect(body.evidenceGap).toBe(true);

    const report = body.evidenceGapReport as Record<string, unknown>;
    // The existing report's summary is preserved (not the synthesized one).
    expect(report.summary).toBe("Found 0 named buyer personas; required 3.");
    // The ledger is attached additively.
    expect(Array.isArray(report.acquisitionLedger)).toBe(true);
    expect((report.acquisitionLedger as unknown[]).length).toBe(3);
  });
});

// C-LEDGER: the report-absent branch must NOT fabricate an evidence gap when the
// committed body already cleared the persona floor. The Ramp run shipped
// evidenceGap=true + reason=insufficient_named_buyer_personas + a "personaReality
// is empty" summary while personaReality.personas carried 3 grounded named buyers
// (Beatriz Go, Paul Klein IV, Keith Frantz) and sufficiency.tier='sufficient' — a
// flat self-contradiction. When groundedPersonaCount >= floor and no report
// exists, the ledger must attach as a DIAGNOSTIC ONLY: no evidenceGap flip, no
// "personaReality is empty" summary, no insufficient reason literal.

// A BuyerICP body that already cleared the persona floor (the fixture's 5 named
// personas) but carries NO evidenceGapReport and NO evidenceGap flag. Mirrors the
// degraded report-absent exit, except personaReality is genuinely sufficient.
function sufficientPersonaNoReportArtifact(): ArtifactEnvelope {
  const fixtureBody = buyerICPFixtureArtifact.body;

  return {
    ...buyerICPFixtureArtifact,
    body: {
      ...fixtureBody,
      // No evidenceGapReport and no evidenceGap flag on the committed body.
      evidenceGapReport: null,
    },
  } as unknown as ArtifactEnvelope;
}

describe("withBuyerICPAcquisitionLedger — sufficient personas, report absent (C-LEDGER)", () => {
  it("does NOT fabricate an evidence gap when the persona floor is already cleared", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: sufficientPersonaNoReportArtifact(),
      candidates: [
        candidate({ name: "Ava Chen", url: "https://g2.com/u/ava" }),
        candidate({ name: "Maya Singh", url: "https://capterra.com/u/maya" }),
        candidate({ name: "Leo Grant", url: "https://linkedin.com/in/leo" }),
      ],
      observedAt,
    });

    const body = enriched.body as Record<string, unknown>;

    // (a) The honest sufficient state must NOT be flipped to an evidence gap.
    expect(body.evidenceGap).not.toBe(true);

    // (b) The dishonest "personaReality is empty" summary must appear nowhere.
    expect(JSON.stringify(body)).not.toContain("personaReality is empty");

    // (c) Any attached report must NOT carry the insufficient reason literal.
    const report = body.evidenceGapReport;
    if (report !== null && typeof report === "object" && !Array.isArray(report)) {
      expect((report as Record<string, unknown>).reason).not.toBe(
        buyerICPEvidenceGapReason,
      );
    }
  });

  it("produces a body that still validates against buyerICPBodySchema + validateBuyerICPMinimums", () => {
    const enriched = withBuyerICPAcquisitionLedger({
      artifact: sufficientPersonaNoReportArtifact(),
      candidates: [
        candidate({ name: "Ava Chen", url: "https://g2.com/u/ava" }),
        candidate({ name: "Maya Singh", url: "https://capterra.com/u/maya" }),
        candidate({ name: "Leo Grant", url: "https://linkedin.com/in/leo" }),
      ],
      observedAt,
    });

    // (d) The result must still parse strict + pass the section minimums.
    const parsedBody = buyerICPBodySchema.parse(enriched.body);
    const minimums = validateBuyerICPMinimums({
      ...enriched,
      body: parsedBody,
    });
    expect(minimums.ok).toBe(true);
  });
});
