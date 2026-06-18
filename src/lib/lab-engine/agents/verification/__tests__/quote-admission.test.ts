import { describe, expect, it } from "vitest";

import {
  cleanQuoteText,
  dedupeQuoteBearingFields,
  evaluateQuoteAdmission,
  isAdmissibleQuote,
  isDirectionalAdmissibleQuote,
} from "../quote-admission";

// The exact laundered blob shipped as a "verbatim" customer quote on run
// c9bc2056 (tmp/gt-c9bc2056-fresh/positioningVoiceOfCustomer.json,
// body.painLanguage.quotes[0]): a truncated review fragment + a different
// review's title, glued together by SearchAPI index-page DOM chrome.
const c9bc2056LaunderedBlob =
  'The downsides are that you can\'t edit files that are attached and the gantt features require business higher to be as strong as Microsoft Project, bu...! Verified User Small-Business (50 or fewer emp.) "Integrates with Tons of Software, Makes Workflows Seamless"';

describe("quote admission", (): void => {
  it("rejects navigation and markdown snippets", (): void => {
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://www.infoworld.com/article/example",
      text: "## Topics\n\nClose\n\n01. [Analytics](https://example.com/a)\n02. [AI](https://example.com/b)\n03. [Cloud](https://example.com/c)",
    });

    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain("navigation-or-markdown-snippet");
  });

  it("rejects product prose that is not a human quote", (): void => {
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://example.com/blog/feature-release",
      text: "The platform includes reporting, dashboards, and workflow automation for operations teams.",
    });

    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain("not-human-voice");
    expect(result.reasons).toContain("source-url-not-permalink");
  });

  it("accepts a real-looking third-party review quote", (): void => {
    expect(
      isAdmissibleQuote({
        sourceUrl: "https://www.g2.com/products/acme/reviews/acme-review-12345",
        subjectDomain: "https://acme.example",
        text: "We switched because our team kept losing deal context, and this finally gave us one place to see what changed.",
      }),
    ).toBe(true);
  });

  it("rejects overlong quotes", (): void => {
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://www.g2.com/products/acme/reviews/acme-review-12345",
      text: `We need a shorter quote. ${"This sentence repeats. ".repeat(30)}`,
    });

    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain("quote-too-long");
  });

  it("rejects subject-domain quote sources", (): void => {
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://www.airtable.com/customers/acme",
      subjectDomain: "https://airtable.com",
      text: "We use it every day because it keeps our team aligned.",
    });

    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain("subject-domain-source");
  });

  it("rejects the c9bc2056 laundered chrome blob", (): void => {
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://www.capterra.com/p/146652/Airtable/reviews/1769670/",
      subjectDomain: "https://airtable.com",
      text: c9bc2056LaunderedBlob,
    });

    expect(result.admissible).toBe(false);
    // The blob glues a truncated review fragment, chrome labels, AND a second
    // review's title — chrome between two real fragments is not salvageable, so
    // it is rejected as a multi-review chrome concatenation.
    expect(result.reasons).toContain("contains-ui-chrome");
  });

  it("rejects an unsalvageable multi-review chrome concatenation", (): void => {
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://www.g2.com/products/acme/reviews/acme-review-12345",
      // Two reviews glued by an interior chrome token: stripping the trailing
      // tail leaves chrome mid-text, so the blob is not a single human quote.
      text: 'Approvals were slow before we switched. Mid-Market (51-1000 emp.) "A totally different review about onboarding pain."',
    });

    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain("contains-ui-chrome");
  });

  it("rejects a quote that is too short after stripping chrome", (): void => {
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://www.g2.com/products/acme/reviews/acme-review-12345",
      text: "Great tool. Verified User Small-Business (50 or fewer emp.)",
    });

    expect(result.admissible).toBe(false);
    expect(result.reasons).toContain("too-short-after-chrome-strip");
  });

  it("accepts a real review with a salvageable trailing chrome tail and returns the cleaned text", (): void => {
    const raw =
      "We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes. Verified User Mid-Market (51-1000 emp.)";
    const result = evaluateQuoteAdmission({
      sourceUrl: "https://www.g2.com/products/acme/reviews/acme-review-12345",
      subjectDomain: "https://acme.example",
      text: raw,
    });

    expect(result.admissible).toBe(true);
    expect(result.normalizedText).toBe(
      "We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes.",
    );
  });
});

describe("permalink vs index/filter source URLs", (): void => {
  // A clean, human, salvageable quote so the ONLY admission failure is the URL.
  const cleanQuote =
    "We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes.";

  const reasonsFor = (sourceUrl: string): string[] =>
    evaluateQuoteAdmission({
      sourceUrl,
      subjectDomain: "https://airtable.com",
      text: cleanQuote,
    }).reasons;

  it("accepts the two real per-review permalinks", (): void => {
    expect(
      reasonsFor("https://www.g2.com/products/acme/reviews/acme-review-12345"),
    ).not.toContain("source-url-not-permalink");
    expect(
      reasonsFor(
        "https://www.capterra.com/p/146652/Airtable/reviews/1769670/",
      ),
    ).not.toContain("source-url-not-permalink");
  });

  it("rejects the five c9bc2056 index/filter URLs as non-permalinks", (): void => {
    const indexUrls = [
      "https://g2.com/products/airtable/reviews?qs=pros-and-cons",
      "https://trustpilot.com/review/airtable.com",
      "https://trustpilot.com/review/airtable.com?page=4",
      "https://capterra.com/p/146652/Airtable/reviews/",
      "https://softwareadvice.com/project-management/airtable-profile/reviews/",
    ];

    for (const url of indexUrls) {
      expect(reasonsFor(url), url).toContain("source-url-not-permalink");
    }
  });

  it("admits a TrustRadius per-review permalink via the /reviews/ path", (): void => {
    expect(
      reasonsFor("https://www.trustradius.com/reviews/airtable-review-5512"),
    ).not.toContain("source-url-not-permalink");
  });

  // Exercises the trusted-host allowlist branch directly: this TrustRadius
  // per-review deep link (a #review-<id> fragment on a product path) has no
  // /reviews/ path segment and no permalink query, so it only survives the
  // permalink floor because trustradius.com is a trusted quote host.
  it("admits a TrustRadius product deep link only because the host is trusted", (): void => {
    expect(
      reasonsFor("https://www.trustradius.com/products/airtable#review-5512"),
    ).not.toContain("source-url-not-permalink");
  });

  it("still rejects a TrustRadius product listing leaf (floor not weakened)", (): void => {
    const listingUrls = [
      // hostname-like-leaf listing: the leaf is itself a vendor domain — an
      // index of all reviews for that product, not a single review.
      "https://www.trustradius.com/products/airtable.com",
      // bare review-listing root.
      "https://www.trustradius.com/products/airtable/reviews",
    ];

    for (const url of listingUrls) {
      expect(reasonsFor(url), url).toContain("source-url-not-permalink");
    }
  });
});

describe("isDirectionalAdmissibleQuote (FIX-VOC directional lane)", (): void => {
  // A clean, human, salvageable quote so the ONLY admission failure is the URL.
  const cleanQuote =
    "We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes.";

  it("tolerates a lone non-permalink rejection on a trusted host", (): void => {
    // Strict admission drops it; the directional lane keeps it.
    expect(
      isAdmissibleQuote({
        sourceUrl: "https://www.trustpilot.com/review/acme.example",
        subjectDomain: "https://airtable.com",
        text: cleanQuote,
      }),
    ).toBe(false);
    expect(
      isDirectionalAdmissibleQuote({
        sourceUrl: "https://www.trustpilot.com/review/acme.example",
        subjectDomain: "https://airtable.com",
        text: cleanQuote,
      }),
    ).toBe(true);
  });

  it("keeps strictly-admissible per-review permalinks admissible", (): void => {
    expect(
      isDirectionalAdmissibleQuote({
        sourceUrl: "https://www.g2.com/products/acme/reviews/acme-review-12345",
        subjectDomain: "https://airtable.com",
        text: cleanQuote,
      }),
    ).toBe(true);
  });

  it("does NOT tolerate a non-permalink on an untrusted host", (): void => {
    // Sanity-check the fixture: this untrusted-host listing URL really does
    // trip the lone source-url-not-permalink rejection (so the directional
    // gate is what rejects it, not some other reason).
    expect(
      evaluateQuoteAdmission({
        sourceUrl: "https://random-blog.example/products",
        subjectDomain: "https://airtable.com",
        text: cleanQuote,
      }).reasons,
    ).toEqual(["source-url-not-permalink"]);
    expect(
      isDirectionalAdmissibleQuote({
        sourceUrl: "https://random-blog.example/products",
        subjectDomain: "https://airtable.com",
        text: cleanQuote,
      }),
    ).toBe(false);
  });

  it("never tolerates chrome / truncation / not-human-voice alongside the URL gap", (): void => {
    // chrome concatenation on a trusted host — must still be rejected.
    expect(
      isDirectionalAdmissibleQuote({
        sourceUrl: "https://www.trustpilot.com/review/acme.example",
        subjectDomain: "https://airtable.com",
        text: 'Approvals were slow before we switched. Mid-Market (51-1000 emp.) "A totally different review about onboarding pain."',
      }),
    ).toBe(false);
    // product prose (not-human-voice) on a trusted host — must still be rejected.
    expect(
      isDirectionalAdmissibleQuote({
        sourceUrl: "https://www.trustpilot.com/review/acme.example",
        subjectDomain: "https://airtable.com",
        text: "The platform includes reporting, dashboards, and workflow automation for operations teams.",
      }),
    ).toBe(false);
  });

  it("never tolerates a subject-domain source even on a non-permalink", (): void => {
    expect(
      isDirectionalAdmissibleQuote({
        sourceUrl: "https://www.airtable.com/customers",
        subjectDomain: "https://airtable.com",
        text: cleanQuote,
      }),
    ).toBe(false);
  });
});

describe("cleanQuoteText", (): void => {
  it("strips a trailing chrome tail down to the bare review fragment", (): void => {
    expect(
      cleanQuoteText(
        "We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes. Verified User Mid-Market (51-1000 emp.)",
      ),
    ).toBe(
      "We switched because our finance team kept losing receipts, and now reconciliation finally takes minutes.",
    );
  });

  it("leaves a genuinely clean review untouched", (): void => {
    const clean =
      "We switched because our team kept losing deal context, and this finally gave us one place to see what changed.";
    expect(cleanQuoteText(clean)).toBe(clean);
  });

  it("does not salvage the c9bc2056 blob because a second review's title follows the chrome", (): void => {
    // The chrome ("Verified User ... emp.)") is followed by a DIFFERENT review's
    // title — substantial prose — so cleanQuoteText refuses to strip it, leaving
    // the chrome in place for the admission check to reject.
    const cleaned = cleanQuoteText(c9bc2056LaunderedBlob);
    expect(cleaned).toContain("Verified User");
    expect(cleaned).toContain("Integrates with Tons of Software");
  });
});

describe("dedupeQuoteBearingFields", (): void => {
  it("drops the second occurrence of the same long quote text", (): void => {
    const quote =
      "We moved our intake process because the previous workflow forced our team to copy customer details across spreadsheets, support tools, and campaign planning docs before every launch review. ".repeat(
        2,
      );
    const result = dedupeQuoteBearingFields({
      body: {
        painLanguage: {
          quotes: [
            {
              sourceUrl: "https://www.g2.com/products/acme/reviews/one",
              verbatimText: quote,
            },
            {
              sourceUrl: "https://www.g2.com/products/acme/reviews/two",
              quote,
            },
          ],
        },
      },
    });
    const body = result.body as {
      painLanguage?: { quotes?: unknown[] };
    };

    expect(body.painLanguage?.quotes).toHaveLength(1);
    expect(result.dropped).toEqual([
      expect.objectContaining({
        path: "body.painLanguage.quotes[1].quote",
        reason: "duplicate-long-quote",
      }),
    ]);
  });

  it("drops a long quote reused as an objection / decision / switching field", (): void => {
    const quote =
      "We moved our intake process because the previous workflow forced our team to copy customer details across spreadsheets, support tools, and campaign planning docs before every launch review. ".repeat(
        2,
      );
    const result = dedupeQuoteBearingFields({
      body: {
        painLanguage: {
          quotes: [
            {
              sourceUrl: "https://www.g2.com/products/acme/reviews/one",
              verbatimText: quote,
            },
          ],
        },
        objections: {
          items: [
            {
              sourceUrl: "https://www.g2.com/products/acme/reviews/two",
              objectionText: quote,
            },
          ],
        },
        decisionCriteria: {
          criteria: [
            {
              sourceUrl: "https://www.g2.com/products/acme/reviews/three",
              evidenceQuote: quote,
            },
          ],
        },
      },
    });
    const body = result.body as {
      painLanguage?: { quotes?: unknown[] };
      objections?: { items?: unknown[] };
      decisionCriteria?: { criteria?: unknown[] };
    };

    // The pain quote stays; its reuse as an objection and a decision criterion
    // is dropped as duplicate-long-quote.
    expect(body.painLanguage?.quotes).toHaveLength(1);
    expect(body.objections?.items).toHaveLength(0);
    expect(body.decisionCriteria?.criteria).toHaveLength(0);
    expect(result.dropped.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        "body.objections.items[0].objectionText",
        "body.decisionCriteria.criteria[0].evidenceQuote",
      ]),
    );
  });
});
