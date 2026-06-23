/**
 * provenance-detect.test.ts — IN-MEMORY port of the proven
 * `scripts/provenance/__tests__/gate.test.ts` suite.
 *
 * Pins the MECHANICS of each of the deterministic provenance checks with small INLINE
 * fixtures. Each test fabricates a tiny transcript+body pair (now in-memory, not written to
 * disk) that isolates one check so a regression in any single mechanic surfaces here.
 *
 * These do NOT test against the real oracle cells (the verify phase does that).
 *
 * Spec: docs/plans/2026-06-23-phase-B-provenance-gate-spec.md §1.
 */
import { describe, it, expect } from "vitest";

import {
  detectProvenanceViolations,
  type TranscriptRecord,
} from "../provenance-detect";

// ---------------------------------------------------------------------------
// Fixture helper: run the in-memory detector over a body + transcript pair.
// ---------------------------------------------------------------------------
function run(opts: {
  body: string;
  transcript: TranscriptRecord[];
  section: string;
  subject?: string;
  siblingBodies?: string[];
  siblingTranscripts?: TranscriptRecord[][];
}) {
  return detectProvenanceViolations({
    body: opts.body,
    transcript: opts.transcript,
    section: opts.section,
    subject: opts.subject ?? "acme",
    siblingBodies: opts.siblingBodies,
    siblingTranscripts: opts.siblingTranscripts,
  });
}

function rec(partial: Partial<TranscriptRecord>): TranscriptRecord {
  return {
    step: 0,
    toolName: "web_search",
    toolCallId: "call_0",
    input: {},
    output: {},
    isError: false,
    ...partial,
  };
}

function checks(violations: { check: string }[]): string[] {
  return violations.map((v) => v.check);
}

// ---------------------------------------------------------------------------
// Check 1 — url_not_in_transcript
// ---------------------------------------------------------------------------
describe("Check 1 — url_not_in_transcript", () => {
  it("flags a body URL that does NOT appear in the transcript", () => {
    const { violations } = run({
      section: "competitor",
      body: "Pricing is documented at [pricing](https://example.com/pricing/plans).",
      transcript: [
        rec({
          toolName: "web_search",
          output: { results: [{ url: "https://other.com/home", snippet: "hi" }] },
        }),
      ],
    });
    expect(checks(violations)).toContain("url_not_in_transcript");
  });

  it("clears when the cited URL IS present in a tool output", () => {
    const { violations } = run({
      section: "competitor",
      body: "Pricing is documented at [pricing](https://example.com/pricing/plans).",
      transcript: [
        rec({
          toolName: "web_search",
          output: {
            results: [
              { url: "https://example.com/pricing/plans", snippet: "plans" },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("url_not_in_transcript");
  });

  it("clears a parenthetical bare-domain citation that is in the transcript", () => {
    const { violations } = run({
      section: "voc",
      body: "Users complain about pricing (g2.com/products/intercom/reviews).",
      transcript: [
        rec({
          toolName: "reviews",
          output: {
            excerpts: [
              {
                url: "https://www.g2.com/products/intercom/reviews",
                reviewText: "the pricing keeps going up and up",
              },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("url_not_in_transcript");
  });
});

// ---------------------------------------------------------------------------
// Check 2 — quote_not_in_transcript / number_not_in_transcript
// ---------------------------------------------------------------------------
describe("Check 2 — quote/number grounding", () => {
  it("flags a >=15-char quote that is not in the transcript", () => {
    const { violations } = run({
      section: "voc",
      body: '> "This product completely changed how our team operates daily."\n— A customer',
      transcript: [
        rec({
          toolName: "reviews",
          output: { excerpts: [{ reviewText: "something totally unrelated about onboarding" }] },
        }),
      ],
    });
    expect(checks(violations)).toContain("quote_not_in_transcript");
  });

  it("clears a quote that IS present in the transcript", () => {
    const { violations } = run({
      section: "voc",
      body: '> "This product completely changed how our team operates daily."\n— A customer',
      transcript: [
        rec({
          toolName: "reviews",
          output: {
            excerpts: [
              {
                reviewText:
                  "This product completely changed how our team operates daily and we love it.",
              },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("quote_not_in_transcript");
  });

  it("flags a sourced number (per SpyFu) absent from the transcript", () => {
    const { violations } = run({
      section: "demand",
      body: 'The keyword "ai notetaker" shows 9,900 searches/mo per SpyFu.',
      transcript: [
        rec({
          toolName: "keyword_volume",
          output: {
            keywords: [
              {
                keyword: "ai notetaker",
                searchVolume: 1600,
                cpc: null,
                sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=ai+notetaker",
              },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).toContain("number_not_in_transcript");
  });

  it("clears a sourced number that matches the transcript (comma-insensitive)", () => {
    const { violations } = run({
      section: "demand",
      body: 'The keyword "ai notetaker" shows 1,600 searches/mo per SpyFu.',
      transcript: [
        rec({
          toolName: "keyword_volume",
          output: {
            keywords: [
              {
                keyword: "ai notetaker",
                searchVolume: 1600,
                cpc: null,
                sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=ai+notetaker",
              },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("number_not_in_transcript");
  });

  it("does NOT flag a rhetorical/derived number with no source attribution", () => {
    const { violations } = run({
      section: "market",
      body: "There are roughly 3 distinct buyer clusters worth pursuing.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).not.toContain("number_not_in_transcript");
  });
});

// ---------------------------------------------------------------------------
// Check 3 — invented_bidder / invented_volume_cpc
// ---------------------------------------------------------------------------
describe("Check 3 — invented advertiser / fabricated volume-CPC", () => {
  it("flags a NAMED company asserted as a bidder when only ad-probe/keyword evidence exists", () => {
    const { violations } = run({
      section: "demand",
      body: 'Enterprise players like Zendesk will outbid a free product on these CRM terms.',
      transcript: [
        rec({
          toolName: "keyword_ad_probe",
          output: {
            keyword: "call recording software",
            organic_count: 8,
            ad_count: 2,
            top_organic: [{ url: "https://example.com", title: "t", snippet: "s" }],
          },
        }),
      ],
    });
    expect(checks(violations)).toContain("invented_bidder");
  });

  it("does NOT flag a generic/hedged bidder phrase (no named company)", () => {
    const { violations } = run({
      section: "demand",
      body: "Enterprise competitors are likely bidding on these CRM terms at high CPCs.",
      transcript: [
        rec({
          toolName: "keyword_ad_probe",
          output: { keyword: "call recording software", organic_count: 8, ad_count: 2, top_organic: [] },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("invented_bidder");
  });

  it("P2-3: an EMPTY free-text tool no longer silences bidder detection (web_search returned nothing)", () => {
    // A keyword-only run that ALSO ran a web_search returning no results. Previously the empty
    // web_search marked the tool "used" -> usedFreeText -> bidder check suppressed -> a
    // fabricated bidder slipped through. With the usable-output guard the empty web_search no
    // longer counts, so the named-bidder fabrication is still caught.
    const { violations } = run({
      section: "demand",
      body: "Enterprise players like Zendesk will outbid a free product on these CRM terms.",
      transcript: [
        rec({
          toolName: "keyword_ad_probe",
          output: { keyword: "call recording software", organic_count: 8, ad_count: 2, top_organic: [] },
        }),
        // empty free-text result — ran, but returned nothing groundable
        rec({ toolName: "web_search", output: { results: [] } }),
      ],
    });
    expect(checks(violations)).toContain("invented_bidder");
  });

  it("P2-3: a free-text tool that returned REAL content still suppresses bidder detection (defer to URL/quote checks)", () => {
    // The suppression is correct when the free-text tool actually surfaced content: the named
    // bidder could be grounded in that text, so detectInventedBidder rightly defers.
    const { violations } = run({
      section: "demand",
      body: "Enterprise players like Zendesk will outbid a free product on these CRM terms.",
      transcript: [
        rec({
          toolName: "keyword_ad_probe",
          output: { keyword: "call recording software", organic_count: 8, ad_count: 2, top_organic: [] },
        }),
        rec({
          toolName: "web_search",
          output: { results: [{ url: "https://example.com/crm", title: "CRM bidders", snippet: "who bids on crm terms" }] },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("invented_bidder");
  });

  it("flags invented_volume_cpc when a 'per SpyFu' volume is cited but only ad-probe ran", () => {
    const { violations } = run({
      section: "paidmedia",
      body: 'The term "crm software" shows 40,500 searches/mo per SpyFu with a $12.50 CPC.',
      transcript: [
        rec({
          toolName: "keyword_ad_probe",
          output: { keyword: "crm software", organic_count: 8, ad_count: 3, top_organic: [] },
        }),
      ],
    });
    expect(checks(violations)).toContain("invented_volume_cpc");
  });

  it("does NOT flag volume-CPC when a real keyword_volume tool carries the number", () => {
    const { violations } = run({
      section: "paidmedia",
      body: 'The term "crm software" shows 40,500 searches/mo per SpyFu.',
      transcript: [
        rec({
          toolName: "keyword_volume",
          output: {
            keywords: [
              {
                keyword: "crm software",
                searchVolume: 40500,
                cpc: 12.5,
                sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=crm+software",
              },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("invented_volume_cpc");
  });
});

// ---------------------------------------------------------------------------
// Check 4 — arithmetic_error
// ---------------------------------------------------------------------------
describe("Check 4 — numeric coherence", () => {
  it("flags an incorrect $/mo × 12 = $/yr assertion", () => {
    const { violations } = run({
      section: "paidmedia",
      body: "At $345/mo, that is $345/mo x 12 = $5,000/yr in spend.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).toContain("arithmetic_error");
  });

  it("clears a correct $/mo × 12 = $/yr assertion", () => {
    const { violations } = run({
      section: "paidmedia",
      body: "At $345/mo, that is $345/mo x 12 = $4,140/yr in spend.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).not.toContain("arithmetic_error");
  });

  it("flags an incorrect per-seat × seats × 12 = per-year assertion", () => {
    const { violations } = run({
      section: "competitor",
      body: "At $29/seat/month for a 5-seat team: $4,140/year.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).toContain("arithmetic_error");
  });

  it("flags an incorrect A x N = B multiplication", () => {
    const { violations } = run({
      section: "demand",
      body: "Each of the 4 clusters needs 3 ads, so 4 x 3 = 15 creatives.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).toContain("arithmetic_error");
  });

  it("clears a correct A x N = B multiplication", () => {
    const { violations } = run({
      section: "demand",
      body: "Each of the 4 clusters needs 3 ads, so 4 x 3 = 12 creatives.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).not.toContain("arithmetic_error");
  });
});

// ---------------------------------------------------------------------------
// Check 5 — synthesized_evidence
// ---------------------------------------------------------------------------
describe("Check 5 — zero-evidence synthesis", () => {
  it("flags a VoC section presenting customer quotes with ZERO customer-voice evidence", () => {
    const { violations } = run({
      section: "voc",
      subject: "thinsubject",
      body:
        'Customers love it:\n> "The onboarding was the smoothest I have ever experienced anywhere."\n— A happy customer',
      transcript: [
        // Only navigation/title-level web_search results, no quotable customer voice.
        rec({
          toolName: "web_search",
          output: { results: [{ url: "https://thinsubject.com", title: "Home", snippet: "Home" }] },
        }),
      ],
    });
    expect(checks(violations)).toContain("synthesized_evidence");
  });

  it("does NOT fire for VoC when real customer-voice evidence was retrieved", () => {
    const { violations } = run({
      section: "voc",
      subject: "thicksubject",
      body:
        'Customers love it:\n> "The onboarding was the smoothest I have ever experienced anywhere."\n— A happy customer',
      transcript: [
        rec({
          toolName: "reviews",
          output: {
            excerpts: [
              {
                url: "https://g2.com/products/x/reviews",
                reviewText:
                  "The onboarding was the smoothest I have ever experienced anywhere and support is great.",
              },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("synthesized_evidence");
  });

  it("does NOT fire for a non-VoC/buyer/competitor section even with no customer voice", () => {
    const { violations } = run({
      section: "market",
      subject: "thinsubject",
      body: 'A buyer once said: "this changes everything for our category positioning forever".',
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).not.toContain("synthesized_evidence");
  });
});

// ---------------------------------------------------------------------------
// FIX 1 — invented_customer (named entities laundered onto a real fetched page)
// ---------------------------------------------------------------------------
describe("FIX 1 — invented_customer", () => {
  it("flags a named customer that is ABSENT from a cited page whose content IS in the transcript", () => {
    const { violations } = run({
      section: "buyer",
      subject: "acme",
      body:
        "Acme's customers page also names **Coca-Cola, Superhuman, and Ryanair** ([acme.com/customers](https://acme.com/customers)).",
      transcript: [
        rec({
          toolName: "firecrawl",
          input: { url: "https://acme.com/customers" },
          output: {
            url: "https://acme.com/customers",
            markdown:
              "Our customers: Granola, Modal, Railway, Replicate, Snackpass build on Acme.",
          },
        }),
      ],
    });
    expect(checks(violations)).toContain("invented_customer");
    const inv = violations.filter((v) => v.check === "invented_customer");
    // every fabricated name fires; none of them are in the transcript
    const spans = inv.map((v) => v.span.toLowerCase()).join(" | ");
    expect(spans).toMatch(/coca-cola|superhuman|ryanair/);
  });

  it("does NOT flag named customers that ARE present on the cited fetched page", () => {
    const { violations } = run({
      section: "buyer",
      subject: "acme",
      body:
        "Acme's customers page names **Granola, Modal, and Railway** ([acme.com/customers](https://acme.com/customers)).",
      transcript: [
        rec({
          toolName: "firecrawl",
          input: { url: "https://acme.com/customers" },
          output: {
            url: "https://acme.com/customers",
            markdown: "Our customers: Granola, Modal, Railway, Replicate build on Acme.",
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("invented_customer");
  });

  it("flags 'homepage shows X and Y logos' when X/Y are absent from the transcript", () => {
    const { violations } = run({
      section: "offer",
      subject: "acme",
      body: "The homepage shows Coca-Cola and Ryanair logos (acme.com/customers).",
      transcript: [
        rec({
          toolName: "firecrawl",
          input: { url: "https://acme.com/customers" },
          output: {
            url: "https://acme.com/customers",
            markdown: "Logos: Granola, Modal, Railway, Snackpass.",
          },
        }),
      ],
    });
    expect(checks(violations)).toContain("invented_customer");
  });

  it("does NOT fire when the cited page's content is NOT in the transcript (absence is not meaningful)", () => {
    const { violations } = run({
      section: "buyer",
      subject: "acme",
      // The cited page was never fetched — its absence proves nothing.
      body:
        "Acme's customers page also names **Coca-Cola and Ryanair** ([acme.com/customers](https://acme.com/customers)).",
      transcript: [
        rec({
          toolName: "web_search",
          output: { results: [{ url: "https://unrelated.com", snippet: "nothing relevant" }] },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("invented_customer");
  });
});

// ---------------------------------------------------------------------------
// FIX 2 — broadened invented_bidder (adjectival / possessive / slash / territory)
// ---------------------------------------------------------------------------
describe("FIX 2 — broadened invented_bidder", () => {
  it("flags 'Gong-class players bid up' when only keyword tools ran and Gong is absent", () => {
    const { violations } = run({
      section: "demand",
      subject: "acme",
      body:
        "On CRM-adjacent terms, Gong-class conversation-intelligence players have bid up the auction.",
      transcript: [
        rec({
          toolName: "keyword_discovery",
          output: { keywords: [{ keyword: "crm software", searchVolume: 1600, cpc: 11.5 }] },
        }),
        rec({
          toolName: "keyword_volume",
          output: { keywords: [{ keyword: "ai notetaker", searchVolume: 1600, cpc: null }] },
        }),
      ],
    });
    expect(checks(violations)).toContain("invented_bidder");
  });

  it("flags a slash/territory attribution 'Gong/Chorus enterprise territory' (keyword-only, names absent)", () => {
    const { violations } = run({
      section: "demand",
      subject: "acme",
      body: "| salesforce call recording | $11.56 | Gong/Chorus enterprise territory |",
      transcript: [
        rec({
          toolName: "keyword_volume",
          output: { keywords: [{ keyword: "salesforce call recording", searchVolume: 44, cpc: 11.56 }] },
        }),
      ],
    });
    expect(checks(violations)).toContain("invented_bidder");
  });

  it("does NOT flag a pure generic hedge with no named company", () => {
    const { violations } = run({
      section: "demand",
      subject: "acme",
      body:
        "Enterprise vendors with $50k ACVs can afford to outbid a free product on these terms.",
      transcript: [
        rec({
          toolName: "keyword_volume",
          output: { keywords: [{ keyword: "crm software", searchVolume: 1600, cpc: 11.5 }] },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("invented_bidder");
  });

  it("does NOT flag a named bidder that IS present in the transcript (keyword-only run)", () => {
    const { violations } = run({
      section: "demand",
      subject: "acme",
      body: "Microsoft-ecosystem enterprise bids drive these CPCs up.",
      transcript: [
        rec({
          toolName: "keyword_volume",
          output: {
            keywords: [
              { keyword: "teams meeting notes", searchVolume: 270, cpc: 6.63, display: "Microsoft Teams notes" },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).not.toContain("invented_bidder");
  });
});

// ---------------------------------------------------------------------------
// FIX 3 — broadened arithmetic_error (per-seat × seats = total)
// ---------------------------------------------------------------------------
describe("FIX 3 — seat-math arithmetic_error", () => {
  it("flags an understated per-seat × seats = monthly total ($90/seat × 10 ≠ $450/mo)", () => {
    const { violations } = run({
      section: "competitor",
      subject: "acme",
      body:
        "A 10-person startup on HubSpot Professional ($90/seat/month) pays $450/month.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).toContain("arithmetic_error");
  });

  it("clears a correct per-seat × seats = monthly total ($29/seat × 10 = $290/mo)", () => {
    const { violations } = run({
      section: "competitor",
      subject: "acme",
      body: "A 10-person team on Attio Plus ($29/seat/month) pays $290/month.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).not.toContain("arithmetic_error");
  });

  it("flags a vendor-rate-reconciled monthly total when the per-seat rate is established elsewhere in the body", () => {
    const { violations } = run({
      section: "competitor",
      subject: "acme",
      body:
        "HubSpot Professional costs $90/seat/month (hubspot.com/pricing).\n\n" +
        "The same team on HubSpot Professional pays $450/month for 10 people.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).toContain("arithmetic_error");
  });

  it("does NOT fire on a pricing-table row stating a tier's own correct per-seat price", () => {
    const { violations } = run({
      section: "competitor",
      subject: "acme",
      // a bare pricing-table row: "$35/mo (1 seat)" is the vendor's OWN correct tier price,
      // NOT a "team pays $T" headcount-total claim — reconciliation must not touch it.
      body:
        "Pylon Starter at $59/seat/month (pylon.com).\n\n" +
        "| **Plain** | Foundation: $35/mo (1 seat, +$35/additional seat) | Horizon: $299/mo (3 seats) | plain.com/pricing |",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).not.toContain("arithmetic_error");
  });

  it("does NOT fire a vendor-reconciliation FP on a correct year-total-with-onboarding line", () => {
    const { violations } = run({
      section: "competitor",
      subject: "acme",
      body:
        "A 5-seat HubSpot Professional deployment costs $90/seat/month + $1,500 upfront — that's $6,900 in year one. Attio Pro at the same headcount is $69/seat/month with no onboarding fee, totaling $4,140/year.",
      transcript: [rec({ toolName: "web_search", output: { results: [] } })],
    });
    expect(checks(violations)).not.toContain("arithmetic_error");
  });
});

// ---------------------------------------------------------------------------
// FIX 4 — paidmedia grounds quotes/URLs against sibling section BODIES
// ---------------------------------------------------------------------------
describe("FIX 4 — paidmedia sibling-body grounding", () => {
  it("clears a paidmedia quote carried verbatim from a sibling section body", () => {
    // paidmedia's OWN transcript only ad-probes — the quote is NOT in it.
    const transcript = [
      rec({
        toolName: "keyword_ad_probe",
        output: { keyword: "support tool", organic_count: 8, ad_count: 1, top_organic: [] },
      }),
    ];
    // the sibling Offer BODY carries the phrase verbatim.
    const siblingBody =
      "### Break point 1: Landing page → engagement (paradigm-before-proof on the landing page)";
    const { violations } = detectProvenanceViolations({
      body:
        'The upstream Offer section flagged "paradigm-before-proof on the landing page" as the core gap.',
      transcript,
      section: "paidmedia",
      subject: "acme",
      siblingBodies: [siblingBody],
    });
    expect(checks(violations)).not.toContain("quote_not_in_transcript");
  });

  it("clears a paidmedia URL carried from a sibling section body", () => {
    const transcript = [
      rec({
        toolName: "keyword_ad_probe",
        output: { keyword: "x", organic_count: 1, ad_count: 0, top_organic: [] },
      }),
    ];
    const { violations } = detectProvenanceViolations({
      body: "See the migration guide ([guide](https://acme.com/help/migrate)).",
      transcript,
      section: "paidmedia",
      subject: "acme",
      siblingBodies: ["The help center has a migration guide (acme.com/help/migrate)."],
    });
    expect(checks(violations)).not.toContain("url_not_in_transcript");
  });

  it("clears a paidmedia carry-forward whose coined phrase is verbatim in a sibling body but with author connective drift", () => {
    // paidmedia adds "on the landing page" after the upstream coined term — a contiguous run
    // ("paradigm before proof on the") is still verbatim in the Offer body.
    const transcript = [
      rec({ toolName: "keyword_ad_probe", output: { keyword: "x", organic_count: 1, ad_count: 0, top_organic: [] } }),
    ];
    const { violations } = detectProvenanceViolations({
      body:
        'The Offer diagnostic named the constraint "paradigm-before-proof on the landing page" (acme.com/customers).',
      transcript,
      section: "paidmedia",
      subject: "acme",
      siblingBodies: [
        "### Break point 1: Landing page → engagement (paradigm-before-proof on the landing page)",
      ],
    });
    expect(checks(violations)).not.toContain("quote_not_in_transcript");
  });

  it("still flags a quote ASSEMBLED from scattered words (no long contiguous run in the corpus)", () => {
    const { violations } = run({
      section: "competitor",
      subject: "acme",
      body:
        '> "Acme is still relatively new compared to established tools and asks about long-term durability."\n— G2 reviewer',
      transcript: [
        rec({
          toolName: "reviews",
          // every common word appears, but never as a contiguous quote
          output: {
            excerpts: [
              { reviewText: "Acme is great." },
              { reviewText: "We were relatively new to this." },
              { reviewText: "Established tools are rigid." },
              { reviewText: "I asks about pricing." },
              { reviewText: "long term value is good and the new compared options." },
            ],
          },
        }),
      ],
    });
    expect(checks(violations)).toContain("quote_not_in_transcript");
  });

  it("still flags an invented_bidder on paidmedia even if a sibling body mentions the name (invented stays transcript-based)", () => {
    const transcript = [
      rec({
        toolName: "keyword_ad_probe",
        output: { keyword: "ai crm", organic_count: 8, ad_count: 2, top_organic: [] },
      }),
    ];
    const { violations } = detectProvenanceViolations({
      body: "Salesforce will outbid us on these CRM terms.",
      transcript,
      section: "paidmedia",
      subject: "acme",
      // a sibling body that mentions Salesforce must NOT launder the invented bidder
      siblingBodies: ["Salesforce is the incumbent CRM in this category."],
    });
    expect(checks(violations)).toContain("invented_bidder");
  });
});

// ---------------------------------------------------------------------------
// Stats / contract shape
// ---------------------------------------------------------------------------
describe("detectProvenanceViolations() contract", () => {
  it("returns violations[] with {check,severity,ceiling,span,reason}, a ceiling, and a stats object", () => {
    const out = run({
      section: "competitor",
      body: "[x](https://nope.com/missing)",
      transcript: [rec({ output: { results: [] } })],
    });
    expect(Array.isArray(out.violations)).toBe(true);
    const v = out.violations[0];
    expect(v).toHaveProperty("check");
    expect(v).toHaveProperty("severity");
    expect(v).toHaveProperty("ceiling");
    expect(v).toHaveProperty("span");
    expect(v).toHaveProperty("reason");
    expect(typeof out.ceiling).toBe("number");
    expect(out.stats).toBeDefined();
    expect(out.stats).toHaveProperty("toolsUsed");
    expect(out.stats).toHaveProperty("citedUrls");
  });

  it("a clean grounded body produces zero violations and a ceiling of 10", () => {
    const out = run({
      section: "demand",
      body:
        'The keyword "ai crm" shows 1,600 searches/mo per SpyFu (spyfu.com). That is a real opportunity.',
      transcript: [
        rec({
          toolName: "keyword_volume",
          output: {
            keywords: [
              {
                keyword: "ai crm",
                searchVolume: 1600,
                cpc: 0.5,
                sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=ai+crm",
              },
            ],
          },
        }),
      ],
    });
    expect(out.violations).toHaveLength(0);
    expect(out.ceiling).toBe(10);
  });
});
