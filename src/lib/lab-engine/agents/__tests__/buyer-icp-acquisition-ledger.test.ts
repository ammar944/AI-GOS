import { describe, expect, it } from "vitest";

import { buyerICPFixtureArtifact } from "../../fixtures/buyer-icp-artifact";
import { buyerICPBodySchema } from "../../artifacts/schemas/buyer-icp";
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
