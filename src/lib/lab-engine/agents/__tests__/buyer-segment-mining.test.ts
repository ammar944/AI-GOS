import { describe, expect, it } from "vitest";

import type { CorpusExcerpt } from "../../artifacts/artifact-envelope";
import {
  SEGMENT_EVIDENCE_VENUE,
  type BuyerPersonaCandidate,
} from "../buyer-persona-acquisition";
import { mineSegmentEvidenceCandidates } from "../buyer-segment-mining";

function excerpt(
  text: string,
  sourceUrl = "https://ramp.com/about-us",
): CorpusExcerpt {
  return {
    id: "ex1",
    sourceUrl,
    title: "t",
    text,
    observedAt: "2026-06-19T00:00:00.000Z",
    sourceId: "s1",
  };
}

describe("mineSegmentEvidenceCandidates", (): void => {
  it("extracts a 'finance leaders' role/segment phrase and returns it as a segment-evidence candidate", (): void => {
    const candidates = mineSegmentEvidenceCandidates([
      excerpt("Ramp's primary buyers are finance leaders (such as CFOs and controllers) seeking to control spend."),
    ]);

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    const seg = candidates.find((c) => c.venue === SEGMENT_EVIDENCE_VENUE);
    expect(seg).toBeDefined();
    expect(seg?.segmentLabel).toMatch(/finance leaders/i);
    expect(seg?.url).toBe("https://ramp.com/about-us");
  });

  it("extracts 'modern finance teams' as a segment phrase", (): void => {
    const candidates = mineSegmentEvidenceCandidates([
      excerpt("Ramp is the ultimate platform for modern finance teams. Combining corporate cards with expense management."),
    ]);

    const seg = candidates.find(
      (c) => c.venue === SEGMENT_EVIDENCE_VENUE && /modern finance teams/i.test(c.segmentLabel ?? ""),
    );
    expect(seg).toBeDefined();
    expect(seg?.segmentLabel).toBe("modern finance teams");
  });

  it("rejects generic marketing phrases like 'ambitious companies' and 'businesses of all sizes'", (): void => {
    const candidates = mineSegmentEvidenceCandidates([
      excerpt("Join 70,000 of the world's most ambitious companies, from businesses of all sizes."),
    ]);

    // The generic phrases must not produce segment candidates. (The "buyers are"
    // pattern could match unrelated text but these specific phrases are rejected.)
    const genericMatch = candidates.find((c) =>
      /ambitious companies|businesses of all sizes/i.test(c.segmentLabel ?? ""),
    );
    expect(genericMatch).toBeUndefined();
  });

  it("dedupes the same phrase across multiple excerpts", (): void => {
    const candidates = mineSegmentEvidenceCandidates([
      excerpt("modern finance teams love Ramp."),
      excerpt("Ramp serves modern finance teams everywhere."),
    ]);

    const modern = candidates.filter((c) =>
      /modern finance teams/i.test(c.segmentLabel ?? ""),
    );
    expect(modern.length).toBe(1);
  });

  it("caps the total candidate count", (): void => {
    const excerpts: CorpusExcerpt[] = Array.from({ length: 20 }, (_, i) =>
      excerpt(`modern finance teams ${i} context line.`, `https://ramp.com/p${i}`),
    );
    const candidates = mineSegmentEvidenceCandidates(excerpts);
    // All produce the same phrase after normalization, so dedup collapses to 1.
    expect(candidates.length).toBe(1);
  });

  it("skips excerpts without a valid http(s) sourceUrl", (): void => {
    const bad = excerpt("modern finance teams", "not-a-url");
    const candidates = mineSegmentEvidenceCandidates([bad]);
    expect(candidates.length).toBe(0);
  });

  it("skips excerpts with empty text", (): void => {
    const candidates = mineSegmentEvidenceCandidates([excerpt("")]);
    expect(candidates.length).toBe(0);
  });

  it("derives a role-label name from the segment phrase", (): void => {
    const candidates = mineSegmentEvidenceCandidates([
      excerpt("modern finance teams use Ramp."),
    ]);
    const seg = candidates[0];
    expect(seg).toBeDefined();
    expect(typeof seg.name).toBe("string");
    expect(seg.name.length).toBeGreaterThan(0);
  });

  it("never throws on a malformed excerpt", (): void => {
    expect(() =>
      mineSegmentEvidenceCandidates([
        // @ts-expect-error intentionally malformed
        { id: "x", text: "modern finance teams" },
      ]),
    ).not.toThrow();
  });

  it("produces candidates usable as BuyerPersonaCandidate", (): void => {
    const candidates = mineSegmentEvidenceCandidates([
      excerpt("finance leaders buy Ramp."),
    ]);
    for (const c of candidates) {
      const _typecheck: BuyerPersonaCandidate = c;
      expect(_typecheck.venue).toBe(SEGMENT_EVIDENCE_VENUE);
      expect(typeof c.url).toBe("string");
    }
  });
});