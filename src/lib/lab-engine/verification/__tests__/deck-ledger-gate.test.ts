import { describe, expect, it } from "vitest";

import type { ResearchFact } from "@/lib/lab-engine/evidence/research-fact";
import {
  checkDeckAgainstLedger,
  resolveCellSourceUrls,
  type DeckBundle,
  type GroundedCell,
} from "@/lib/lab-engine/verification/deck-ledger-gate";

// ---------------------------------------------------------------------------
// Hand-authored fixtures. Every shape mirrors the real frozen-fixture shapes
// (paid-media evidencePack refs + upstream VoC painLanguage.quotes) but is
// fully inline so this suite is independent of the ledger's persistence layer.
// ---------------------------------------------------------------------------

const RUN_ID = "run-test";
const NOW = "2026-06-18T00:00:00.000Z";

// A VoC upstream body whose painLanguage.quotes[0] carries a real sourceUrl +
// verbatim quote — the locator target a grounded PMP cell dereferences into.
function vocBodyWith(
  quote: { verbatimText: string; sourceUrl: string },
): Record<string, unknown> {
  return {
    painLanguage: {
      quotes: [
        {
          verbatimText: quote.verbatimText,
          sourceUrl: quote.sourceUrl,
          painTheme: "manual reconciliation",
        },
      ],
    },
  };
}

// A grounded PMP cell whose evidencePack ref points at the VoC quote above.
function groundedCellPointingAtVocQuote(): GroundedCell {
  return {
    sectionId: "positioningPaidMediaPlan",
    rowKind: "anglesToTest",
    rowIndex: 0,
    evidencePack: {
      status: "grounded",
      refs: [
        {
          sourceSection: "positioningVoiceOfCustomer",
          evidenceKind: "painQuote",
          locator: "body.painLanguage.quotes[0]",
          excerpt: "Closing the books takes us a full week every month.",
        },
      ],
    },
  };
}

function voiceFact(args: {
  sourceUrl: string;
  sourceQuote: string;
}): ResearchFact {
  return {
    runId: RUN_ID,
    sectionId: "positioningVoiceOfCustomer",
    factKind: "voc_quote",
    sourceUrl: args.sourceUrl,
    sourceQuote: args.sourceQuote,
    claimToken: args.sourceQuote.split(/\s+/u)[0] ?? args.sourceQuote,
    createdAt: NOW,
  };
}

describe("resolveCellSourceUrls", () => {
  it("dereferences an evidencePack ref locator into the upstream section body", () => {
    const url = "https://www.g2.com/products/acme/reviews";
    const cell = groundedCellPointingAtVocQuote();
    const deck: DeckBundle = {
      positioningVoiceOfCustomer: {
        body: vocBodyWith({
          verbatimText: "Closing the books takes us a full week every month.",
          sourceUrl: url,
        }),
      },
    };

    const resolved = resolveCellSourceUrls(cell, deck);

    expect(resolved).toEqual([
      {
        sourceUrl: url,
        quote: "Closing the books takes us a full week every month.",
        locator: "body.painLanguage.quotes[0]",
      },
    ]);
  });

  it("returns an unresolvable marker when the locator does not resolve", () => {
    const cell = groundedCellPointingAtVocQuote();
    // Upstream body present but the indexed path is out of range / missing.
    const deck: DeckBundle = {
      positioningVoiceOfCustomer: {
        body: { painLanguage: { quotes: [] } },
      },
    };

    const resolved = resolveCellSourceUrls(cell, deck);

    expect(resolved).toEqual([
      { locator: "body.painLanguage.quotes[0]", unresolvable: true },
    ]);
  });
});

describe("checkDeckAgainstLedger", () => {
  it("BLOCKS when no ledger fact exists for a grounded cell's claimed source", () => {
    const url = "https://www.g2.com/products/acme/reviews";
    const deck: DeckBundle = {
      positioningPaidMediaPlan: {
        body: { anglesToTest: [groundedCellRow()] },
      },
      positioningVoiceOfCustomer: {
        body: vocBodyWith({
          verbatimText: "Closing the books takes us a full week every month.",
          sourceUrl: url,
        }),
      },
    };
    // Ledger has a DIFFERENT url — no fact matches the cell's claimed source.
    const ledger: ResearchFact[] = [
      voiceFact({
        sourceUrl: "https://other.example.com/post",
        sourceQuote: "Closing the books takes us a full week every month.",
      }),
    ];

    const verdict = checkDeckAgainstLedger({ deck, ledger });

    expect(verdict.blocked).toBe(true);
    expect(verdict.violations).toHaveLength(1);
    expect(verdict.violations[0]?.reason).toBe("no-ledger-fact-for-source");
    expect(verdict.violations[0]?.sourceUrl).toBe(url);
  });

  it("BLOCKS when a ledger fact exists at the URL but its quote does not contain the claimed token", () => {
    const url = "https://www.g2.com/products/acme/reviews";
    const deck: DeckBundle = {
      positioningPaidMediaPlan: {
        body: { anglesToTest: [groundedCellRow()] },
      },
      positioningVoiceOfCustomer: {
        body: vocBodyWith({
          verbatimText: "Closing the books takes us a full week every month.",
          sourceUrl: url,
        }),
      },
    };
    // Same URL, but the ledger quote is about something else entirely — the
    // claimed token ("Closing") is absent.
    const ledger: ResearchFact[] = [
      voiceFact({
        sourceUrl: url,
        sourceQuote: "Pricing is opaque and the sales process dragged on.",
      }),
    ];

    const verdict = checkDeckAgainstLedger({ deck, ledger });

    expect(verdict.blocked).toBe(true);
    expect(verdict.violations[0]?.reason).toBe("token-not-in-ledger-quote");
    expect(verdict.violations[0]?.sourceUrl).toBe(url);
  });

  it("BLOCKS on an embedded substring that is not a clean token boundary (Cox vs Coxwell)", () => {
    const url = "https://www.example.com/case-study";
    const cell: GroundedCell = {
      sectionId: "positioningPaidMediaPlan",
      rowKind: "audienceTypes",
      rowIndex: 0,
      evidencePack: {
        status: "grounded",
        refs: [
          {
            sourceSection: "positioningVoiceOfCustomer",
            evidenceKind: "painQuote",
            // Locator resolves to a quote whose first token is "Cox".
            locator: "body.painLanguage.quotes[0]",
            excerpt: "Cox onboarding",
          },
        ],
      },
    };
    const deck: DeckBundle = {
      positioningPaidMediaPlan: { body: { audienceTypes: [cellToRow(cell)] } },
      positioningVoiceOfCustomer: {
        body: vocBodyWith({
          verbatimText: "Cox approved the rollout in a week.",
          sourceUrl: url,
        }),
      },
    };
    // Ledger quote at the same URL contains only "Coxwell" — "Cox" must NOT
    // match at a clean boundary.
    const ledger: ResearchFact[] = [
      voiceFact({
        sourceUrl: url,
        sourceQuote: "Coxwell led the finance team through the migration.",
      }),
    ];

    const verdict = checkDeckAgainstLedger({ deck, ledger });

    expect(verdict.blocked).toBe(true);
    expect(verdict.violations[0]?.reason).toBe("token-not-in-ledger-quote");
  });

  it("BLOCKS a grounded cell whose locator is unresolvable", () => {
    const deck: DeckBundle = {
      positioningPaidMediaPlan: {
        body: { anglesToTest: [groundedCellRow()] },
      },
      positioningVoiceOfCustomer: {
        body: { painLanguage: { quotes: [] } }, // index [0] out of range
      },
    };
    const ledger: ResearchFact[] = [];

    const verdict = checkDeckAgainstLedger({ deck, ledger });

    expect(verdict.blocked).toBe(true);
    expect(verdict.violations[0]?.reason).toBe("locator-unresolvable");
  });

  it("does NOT block a PaidMedia audienceTypes[0] cell whose refs dereference ONLY to a clean firmographicCut + a clean persona (PaidMedia cap-clear)", () => {
    // §4.7 cap-clear regression guard. After the LOCUS A inference-disclaimer
    // guard drops the un-grounded firmographicCut[1] ref, audienceTypes[0] binds
    // only to a ledger-backed industry cut + a ledger-backed persona. Both refs
    // resolve to a real (sourceUrl, quote) pair backed by a containing ledger
    // fact, so the gate must NOT block. (No case-insensitive gate test is added
    // — HARD RULE 1: the gate stays case-sensitive; the cut[0] casing fix lives
    // in §4.4, not here.)
    const cutUrl = "https://ramp.com/";
    const personaUrl = "https://ramp.com/customers/acme";
    const cutValue = "technology, ecommerce, professional services";
    const personaEvidence =
      "Procurement leaders consolidated five tools into Ramp.";

    const cell: GroundedCell = {
      sectionId: "positioningPaidMediaPlan",
      rowKind: "audienceTypes",
      rowIndex: 0,
      evidencePack: {
        status: "grounded",
        refs: [
          {
            sourceSection: "positioningBuyerICP",
            evidenceKind: "firmographicCut",
            locator: "body.icpExistenceCheck.firmographicCuts[0]",
            excerpt: cutValue,
          },
          {
            sourceSection: "positioningBuyerICP",
            evidenceKind: "persona",
            locator: "body.personaReality.personas[0]",
            excerpt: personaEvidence,
          },
        ],
      },
    };

    const deck: DeckBundle = {
      positioningPaidMediaPlan: {
        body: {
          audienceTypes: [
            {
              slot: "01",
              archetype: "Technology and ecommerce operators",
              sourceSection: "positioningBuyerICP",
              grounding: "Industry cut + persona evidence.",
              evidencePack: cell.evidencePack,
            },
          ],
        },
      },
      positioningBuyerICP: {
        body: {
          icpExistenceCheck: {
            firmographicCuts: [
              {
                cutType: "industry",
                value: cutValue,
                sourceUrl: cutUrl,
                dateObserved: "2026-01-01",
              },
            ],
          },
          personaReality: {
            personas: [
              {
                name: "Procurement leaders",
                evidence: personaEvidence,
                sourceUrl: personaUrl,
              },
            ],
          },
        },
      },
    };

    const ledger: ResearchFact[] = [
      voiceFact({ sourceUrl: cutUrl, sourceQuote: cutValue }),
      voiceFact({ sourceUrl: personaUrl, sourceQuote: personaEvidence }),
    ];

    const verdict = checkDeckAgainstLedger({ deck, ledger });

    expect(verdict.blocked).toBe(false);
    expect(verdict.violations).toEqual([]);
  });

  it("does NOT block when every grounded cell is backed by a containing ledger fact and honest-gap cells are skipped", () => {
    const url = "https://www.g2.com/products/acme/reviews";
    const verbatim = "Closing the books takes us a full week every month.";

    const deck: DeckBundle = {
      positioningPaidMediaPlan: {
        body: {
          // 1 grounded cell — backed below.
          anglesToTest: [groundedCellRow()],
          // honest-gap cells: explicit gap status + empty refs => SKIPPED.
          competitorReviewInsights: [
            {
              complaint: "Evidence gap: no third-party reviews surfaced.",
              howWeLeverage: "n/a",
              sourceSection: "positioningVoiceOfCustomer",
              grounding: "gap",
              evidencePack: { status: "gap", refs: [] },
            },
          ],
        },
      },
      // honest-gap upstream section: empty personas array must never be flagged.
      positioningBuyerICP: { body: { personaReality: { personas: [] } } },
      positioningVoiceOfCustomer: {
        body: vocBodyWith({ verbatimText: verbatim, sourceUrl: url }),
      },
    };

    const ledger: ResearchFact[] = [
      voiceFact({ sourceUrl: url, sourceQuote: verbatim }),
    ];

    const verdict = checkDeckAgainstLedger({ deck, ledger });

    expect(verdict.blocked).toBe(false);
    expect(verdict.violations).toEqual([]);
  });
});

// ---- inline row helpers (deck rows are plain records carrying evidencePack) --

function groundedCellRow(): Record<string, unknown> {
  return cellToRow(groundedCellPointingAtVocQuote());
}

function cellToRow(cell: GroundedCell): Record<string, unknown> {
  return {
    shortName: "Consolidation angle",
    description: "Replace five tools with one.",
    sourceSection: cell.evidencePack.refs[0]?.sourceSection ?? "unattributed",
    grounding: "grounded",
    evidencePack: cell.evidencePack,
  };
}
