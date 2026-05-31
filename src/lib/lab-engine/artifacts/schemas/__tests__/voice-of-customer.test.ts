import { describe, expect, it } from "vitest";

import { voiceOfCustomerFixtureArtifact } from "../../../fixtures/voice-of-customer-artifact";
import {
  checkVoiceOfCustomerSelfSourcing,
  voiceOfCustomerBodySchema,
  type VoiceOfCustomerArtifact,
} from "../voice-of-customer";

type PainQuote =
  VoiceOfCustomerArtifact["body"]["painLanguage"]["quotes"][number];

function painQuote(sourceUrl: string, index: number): PainQuote {
  return {
    verbatimText: `this keeps breaking on us ${index}`,
    source: "g2",
    sourceUrl,
    painTheme: "fragmentation",
    painIntensity: "high",
  };
}

// Reuse the valid fixture envelope/body and swap only the pain quotes so the
// re-parse inside checkVoiceOfCustomerSelfSourcing always sees a valid VoC body.
function withPainQuotes(quotes: PainQuote[]): VoiceOfCustomerArtifact {
  return {
    ...voiceOfCustomerFixtureArtifact,
    body: {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes,
      },
    },
  };
}

const subjectDomain = "https://acme.com";

describe("painQuoteSchema role/date", (): void => {
  it("accepts optional role and date on a pain quote", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes: [
          {
            ...painQuote("https://g2.com/review/1", 1),
            role: "VP Revenue Operations",
            date: "2026-03-02",
          },
        ],
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).not.toThrow();
  });

  it("accepts a pain quote without role or date (both optional)", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes: [painQuote("https://g2.com/review/1", 1)],
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).not.toThrow();
  });
});

describe("checkVoiceOfCustomerSelfSourcing", (): void => {
  it("passes when pain quotes come from independent domains", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://g2.com/review/2", 2),
      painQuote("https://reddit.com/r/sales/3", 3),
      painQuote("https://reddit.com/r/sales/4", 4),
      painQuote("https://trustpilot.com/review/5", 5),
      painQuote("https://trustpilot.com/review/6", 6),
    ]);

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a pain quote sourced from the subject's own registrable domain", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://reddit.com/r/sales/2", 2),
      painQuote("https://trustpilot.com/review/3", 3),
      painQuote("https://acme.com/customers", 4),
    ]);

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("own domain");
  });

  it("defeats subdomain evasion via registrable-domain match", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://reddit.com/r/sales/2", 2),
      painQuote("https://trustpilot.com/review/3", 3),
      painQuote("https://blog.acme.com/testimonials", 4),
    ]);

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("own domain");
  });

  it("rejects a single-source majority of pain quotes", (): void => {
    const artifact = withPainQuotes(
      Array.from({ length: 6 }, (_, index) =>
        painQuote(`https://g2.com/review/${index + 1}`, index + 1),
      ),
    );

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("single-source majority");
  });
});
