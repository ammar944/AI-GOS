import { describe, expect, it } from "vitest";

import {
  dedupeQuoteBearingFields,
  evaluateQuoteAdmission,
  isAdmissibleQuote,
} from "../quote-admission";

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
});
