import { describe, expect, it } from "vitest";

import { looksLikeNonReviewBoilerplate } from "../run-section";

// Pins the boilerplate filter contract (run 3b568ea0 + Codex tightenings).
// The filter must reject scraped non-review boilerplate WITHOUT dropping
// genuine reviews — including terse third-person praise and first-person
// paraphrases, the two false-positive classes Codex flagged.
describe("looksLikeNonReviewBoilerplate", (): void => {
  describe("keeps genuine customer reviews", (): void => {
    it("survives terse third-person praise (no first-person voice)", (): void => {
      // Pure A.3 case: "reliable" + "saves time" are the only signals.
      expect(looksLikeNonReviewBoilerplate("Reliable and saves time.")).toBe(
        false,
      );
    });

    it("survives a first-person review that paraphrases other reviewers", (): void => {
      // A.1: the paraphrase pattern matches "other users say", but a
      // first-person voice ("I") is present, so the row is a genuine review.
      expect(
        looksLikeNonReviewBoilerplate(
          "I agree with what other users say about the slow support.",
        ),
      ).toBe(false);
    });

    it("survives a first-person pain review", (): void => {
      expect(
        looksLikeNonReviewBoilerplate(
          "I hate how the base stops syncing once we cross 50k rows.",
        ),
      ).toBe(false);
    });

    it("survives terse third-person sentiment with new vocabulary", (): void => {
      expect(looksLikeNonReviewBoilerplate("Support was rude and unhelpful.")).toBe(
        false,
      );
      expect(looksLikeNonReviewBoilerplate("Works great for our team.")).toBe(
        false,
      );
    });
  });

  describe("rejects non-review boilerplate", (): void => {
    it("drops empty text", (): void => {
      expect(looksLikeNonReviewBoilerplate("   ")).toBe(true);
    });

    it("drops affiliate / advertising disclosures", (): void => {
      expect(
        looksLikeNonReviewBoilerplate(
          "Advertising disclosure: we may earn a commission from purchases.",
        ),
      ).toBe(true);
    });

    it("drops third-person paraphrases that carry no first-person voice or sentiment", (): void => {
      expect(
        looksLikeNonReviewBoilerplate(
          "Reviewers report a range of opinions about the platform.",
        ),
      ).toBe(true);
    });

    it("drops generic aggregator/article intros", (): void => {
      expect(
        looksLikeNonReviewBoilerplate(
          "Workflow management is critical for modern teams.",
        ),
      ).toBe(true);
    });

    it("drops generic product/category intros that carry only bare positive adjectives", (): void => {
      // Regression guard (Codex review): bare positive adjectives like
      // "reliable"/"useful" appear in descriptive category prose and must NOT
      // count as customer-experience signal on their own.
      expect(
        looksLikeNonReviewBoilerplate(
          "A reliable project management system is critical for modern teams.",
        ),
      ).toBe(true);
      expect(
        looksLikeNonReviewBoilerplate(
          "This guide covers useful workflow management features for modern teams.",
        ),
      ).toBe(true);
      expect(
        looksLikeNonReviewBoilerplate(
          "Airtable is a flexible, reliable, and helpful no-code platform for teams.",
        ),
      ).toBe(true);
    });
  });
});
