/**
 * fixture-loader.ts — shared, access-correct readers for the frozen b0d12b45
 * acceptance fixtures, used by the offline liar-catcher + replay spine.
 *
 * The two file kinds have DIFFERENT shapes; mixing them up is the inverted-access
 * bug that silently passed empty data through earlier drafts. These readers
 * fail-closed so that bug can never happen again:
 *
 *   - Per-section files (positioningBuyerICP.json, etc.) ARE ArtifactEnvelopes.
 *     The section output lives at obj.body (e.g. personas at obj.body.personaReality.personas).
 *     readSectionBody THROWS if obj.body is undefined.
 *
 *   - The corpus file (deepResearchProgram.json) is RAW (not an envelope).
 *     The evidence lives at obj.corpus.evidence. readCorpus THROWS if
 *     obj.corpus is missing or obj.corpus.evidence is not an array.
 */

import { readFile } from "node:fs/promises";

export type SectionBody = Record<string, unknown>;

export interface FixtureCorpus {
  evidence: unknown[];
  [key: string]: unknown;
}

/**
 * Read a per-section ArtifactEnvelope fixture and return its `.body`.
 * Throws a clear, named error if the file is not an envelope (no `.body`),
 * so feeding a raw corpus file here can never silently yield undefined.
 */
export async function readSectionBody(file: string): Promise<SectionBody> {
  const obj = JSON.parse(await readFile(file, "utf8")) as {
    body?: SectionBody;
  };
  if (obj.body === undefined) {
    throw new Error(
      `[fixture-loader] readSectionBody: ${file} has no .body — this is NOT an ` +
        `ArtifactEnvelope. Per-section fixtures expose their output at obj.body; ` +
        `the RAW corpus file (deepResearchProgram.json) must be read with readCorpus instead.`,
    );
  }
  return obj.body;
}

/**
 * Read the RAW corpus fixture (deepResearchProgram.json) and return its
 * `.corpus`. Throws a clear, named error if `.corpus` is missing or
 * `.corpus.evidence` is not an array, so feeding a section envelope here can
 * never silently yield undefined.
 */
export async function readCorpus(file: string): Promise<FixtureCorpus> {
  const obj = JSON.parse(await readFile(file, "utf8")) as {
    corpus?: FixtureCorpus;
  };
  if (!obj.corpus || !Array.isArray(obj.corpus.evidence)) {
    throw new Error(
      `[fixture-loader] readCorpus: ${file} has no .corpus.evidence array — this ` +
        `is NOT the RAW corpus file. deepResearchProgram.json exposes evidence at ` +
        `obj.corpus.evidence; per-section ArtifactEnvelopes must be read with readSectionBody instead.`,
    );
  }
  return obj.corpus;
}
