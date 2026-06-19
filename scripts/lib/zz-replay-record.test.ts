import { describe, expect, it } from "vitest";

import {
  makeRecordingDeps,
  replayDepsFromTape,
  type ReplayTape,
} from "./replay-tape";

// The --record MECHANISM, unit-proven OFFLINE with FAKE deps (no network).
// A "seam" here is any async function on the deps object that a live run would
// route through a provider / fetch. We prove: record captures key->response,
// replay reproduces identical outputs by key, and an UN-TAPED key throws (so a
// replay can never silently hit the network).

// Fake deps stand in for the real provider/fetch seams. They are pure +
// deterministic-per-input so we can assert "replay == record" exactly.
function makeFakeDeps() {
  return {
    callStructured: async (input: { topic: string }) => ({
      answer: `structured:${input.topic}`,
    }),
    fetchImpl: async (url: string) => ({ status: 200, url }),
  };
}

describe("makeRecordingDeps", () => {
  it("records each seam call as key -> response into the tape", async () => {
    const tape: ReplayTape = { seams: {} };
    const real = makeFakeDeps();
    const rec = makeRecordingDeps(real, tape);

    const a = await rec.callStructured({ topic: "buyers" });
    const b = await rec.fetchImpl("https://example.com/a");

    // The wrapped seam returns the REAL response unchanged...
    expect(a).toEqual({ answer: "structured:buyers" });
    expect(b).toEqual({ status: 200, url: "https://example.com/a" });

    // ...and the tape now holds an entry per seam call.
    expect(Object.keys(tape.seams).sort()).toEqual([
      "callStructured",
      "fetchImpl",
    ]);
    expect(tape.seams.callStructured).toHaveLength(1);
    expect(tape.seams.fetchImpl).toHaveLength(1);
    expect(tape.seams.callStructured[0].response).toEqual({
      answer: "structured:buyers",
    });
  });
});

describe("replayDepsFromTape", () => {
  it("reproduces identical outputs by key with ZERO calls to the real seam", async () => {
    const tape: ReplayTape = { seams: {} };
    const recorded = makeRecordingDeps(makeFakeDeps(), tape);
    const recA = await recorded.callStructured({ topic: "buyers" });
    const recFetch = await recorded.fetchImpl("https://example.com/a");

    // Replay deps are built from the tape ALONE — no real deps handed in, so a
    // network hit is structurally impossible.
    const replay = replayDepsFromTape(tape);
    const repA = await replay.callStructured({ topic: "buyers" });
    const repFetch = await replay.fetchImpl("https://example.com/a");

    expect(repA).toEqual(recA);
    expect(repFetch).toEqual(recFetch);
  });

  it("throws a clear 'un-taped seam' error on a key not in the tape", async () => {
    const tape: ReplayTape = { seams: {} };
    const recorded = makeRecordingDeps(makeFakeDeps(), tape);
    await recorded.callStructured({ topic: "buyers" });

    const replay = replayDepsFromTape(tape);

    // Same seam, DIFFERENT args -> a key that was never recorded must throw,
    // not silently fall through to the network.
    await expect(replay.callStructured({ topic: "competitors" })).rejects.toThrow(
      /un-taped seam/i,
    );

    // A seam that was never recorded at all must also throw.
    await expect(replay.fetchImpl("https://example.com/never")).rejects.toThrow(
      /un-taped seam/i,
    );
  });
});
