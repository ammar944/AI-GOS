import { describe, expect, it } from "vitest";
import { join } from "node:path";

import { readCorpus, readSectionBody } from "./fixture-loader";

// Real frozen fixtures from run b0d12b45 (the slop-proof corpus). These tests
// pin the CORRECTED access contract so the inverted-access bug can never
// silently pass:
//   - per-section files ARE ArtifactEnvelopes  -> body lives at obj.body
//   - the corpus file is RAW                    -> evidence lives at obj.corpus.evidence
const FIXTURE_DIR = join(process.cwd(), "tmp", "accept", "b0d12b45");

describe("readSectionBody", () => {
  it("exposes body.personaReality for the BuyerICP envelope (personas len 0)", async () => {
    const body = await readSectionBody(
      join(FIXTURE_DIR, "positioningBuyerICP.json"),
    );
    expect(body.personaReality).toBeDefined();
    const personas = (body.personaReality as { personas?: unknown[] }).personas;
    expect(Array.isArray(personas)).toBe(true);
    expect(personas).toHaveLength(0);
  });

  it("throws a clear error when the file has no .body (inverted-access guard)", async () => {
    // The corpus file is RAW (no .body) — feeding it to readSectionBody must
    // throw, not silently return undefined.
    await expect(
      readSectionBody(join(FIXTURE_DIR, "deepResearchProgram.json")),
    ).rejects.toThrow(/\.body/);
  });
});

describe("readCorpus", () => {
  it("exposes corpus.evidence as a non-empty array", async () => {
    const corpus = await readCorpus(
      join(FIXTURE_DIR, "deepResearchProgram.json"),
    );
    expect(Array.isArray(corpus.evidence)).toBe(true);
    expect(corpus.evidence.length).toBeGreaterThan(0);
  });

  it("throws a clear error when the file has no .corpus (inverted-access guard)", async () => {
    // A per-section envelope has no .corpus — feeding it to readCorpus must throw.
    await expect(
      readCorpus(join(FIXTURE_DIR, "positioningBuyerICP.json")),
    ).rejects.toThrow(/\.corpus/);
  });
});
