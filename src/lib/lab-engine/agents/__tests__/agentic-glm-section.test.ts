import { describe, expect, it } from "vitest";

import {
  buildAgentStepsFromTranscript,
  deriveAgenticEvidenceVerdict,
  isThinAgenticBody,
  shouldUseAgenticGLM,
} from "../run-section";
import type { TranscriptRecord } from "../verification/provenance-detect";

describe("shouldUseAgenticGLM", () => {
  it("is off when LAB_AGENTIC_GLM_SECTIONS is unset or empty", () => {
    expect(shouldUseAgenticGLM("positioningVoiceOfCustomer", {})).toBe(false);
    expect(
      shouldUseAgenticGLM("positioningVoiceOfCustomer", {
        LAB_AGENTIC_GLM_SECTIONS: "",
      }),
    ).toBe(false);
    expect(
      shouldUseAgenticGLM("positioningVoiceOfCustomer", {
        LAB_AGENTIC_GLM_SECTIONS: "   ",
      }),
    ).toBe(false);
  });

  it("routes only the sectionIds in the csv set", () => {
    const env = {
      LAB_AGENTIC_GLM_SECTIONS:
        "positioningVoiceOfCustomer, positioningDemandIntent",
    };
    expect(shouldUseAgenticGLM("positioningVoiceOfCustomer", env)).toBe(true);
    expect(shouldUseAgenticGLM("positioningDemandIntent", env)).toBe(true);
    expect(shouldUseAgenticGLM("positioningMarketCategory", env)).toBe(false);
  });
});

describe("buildAgentStepsFromTranscript (THE ADAPTER)", () => {
  it("maps a transcript into AgentStep[] carrying the real tool evidence the verifier mines", () => {
    const transcript: TranscriptRecord[] = [
      {
        step: 0,
        toolName: "reviews",
        toolCallId: "c1",
        input: { domain: "ramp.com" },
        output: {
          reviews: [
            {
              quote: "Cards were issued on the very first day.",
              url: "https://www.capterra.com/p/207081/Ramp/reviews/",
            },
          ],
        },
        isError: false,
      },
      {
        step: 0,
        toolName: "web_search",
        toolCallId: "c2",
        input: { query: "ramp reviews" },
        output: { results: [{ url: "https://g2.com/products/ramp" }] },
        isError: false,
      },
      {
        step: 1,
        toolName: "perplexity_research",
        toolCallId: "c3",
        input: { query: "ramp pain points" },
        output: { error: "PERPLEXITY_API_KEY missing" },
        isError: true,
      },
    ];

    const steps = buildAgentStepsFromTranscript(transcript);

    // grouped by transcript step
    expect(steps).toHaveLength(2);
    expect(steps[0].stepNumber).toBe(0);
    expect(steps[1].stepNumber).toBe(1);

    // step 0 carries BOTH tool calls + their results (the evidence)
    expect(steps[0].toolCalls.map((c) => c.toolName)).toEqual([
      "reviews",
      "web_search",
    ]);
    expect(steps[0].toolResults).toHaveLength(2);
    // CRITICAL: the real tool output flows into toolResults[].output so the
    // verifier sees the evidence (not an empty modelSteps array).
    expect(JSON.stringify(steps[0].toolResults[0].output)).toContain(
      "capterra.com",
    );
    expect(steps[0].toolResults[0].type).toBe("tool-result");

    // the errored tool maps to type tool-error (verifier can skip it)
    expect(steps[1].toolResults[0].type).toBe("tool-error");
  });

  it("returns [] for an empty transcript (the failure mode we must avoid in prod)", () => {
    expect(buildAgentStepsFromTranscript([])).toEqual([]);
  });
});

describe("deriveAgenticEvidenceVerdict (deterministic, never from the model)", () => {
  it("clean when verified rows >=4 and nothing unsupported/invented", () => {
    const verdict = deriveAgenticEvidenceVerdict({
      provViolationCount: 0,
      survivingInventionCount: 0,
      verifiedRowCount: 6,
      unsupportedRowCount: 0,
    });
    expect(verdict.outcome).toBe("clean");
    expect(verdict.verifiedRowCount).toBe(6);
  });

  it("overclaim forces the counts so the value-read ceiling caps it (P1-1)", () => {
    const verdict = deriveAgenticEvidenceVerdict({
      provViolationCount: 2,
      survivingInventionCount: 1,
      verifiedRowCount: 5,
      unsupportedRowCount: 0, // 0/0 counts would otherwise read clean→ceiling 9
    });
    expect(verdict.outcome).toBe("overclaim");
    expect(verdict.note).toContain("invented");
    // The COUNTS (not the outcome string) drive the value-read ceiling, so they
    // MUST be >= the surviving inventions or an overclaim reads as clean.
    expect(verdict.unsupportedRowCount).toBeGreaterThanOrEqual(1);
    expect(verdict.rowsMissingRealSource).toBeGreaterThanOrEqual(1);
  });

  it("unverified-directional when rows are missing a real source", () => {
    const verdict = deriveAgenticEvidenceVerdict({
      provViolationCount: 3,
      survivingInventionCount: 0,
      verifiedRowCount: 5,
      unsupportedRowCount: 2,
    });
    expect(verdict.outcome).toBe("unverified-directional");
    expect(verdict.rowsMissingRealSource).toBe(2);
  });

  it("unverified-directional when clean but fewer than 4 verified rows", () => {
    const verdict = deriveAgenticEvidenceVerdict({
      provViolationCount: 0,
      survivingInventionCount: 0,
      verifiedRowCount: 2,
      unsupportedRowCount: 0,
    });
    expect(verdict.outcome).toBe("unverified-directional");
  });
});

describe("isThinAgenticBody (triggers the one-shot retry)", () => {
  it("flags a short stub", () => {
    expect(
      isThinAgenticBody("I have enough evidence. Let me compile the section."),
    ).toBe(true);
    expect(isThinAgenticBody("")).toBe(true);
  });

  it("flags a research-narration stub even just over the length floor", () => {
    // Opens with a stub marker and is under 2x the floor -> still thin.
    const stub = "Now I have substantial data from G2 and Trustpilot. " + "x".repeat(1500);
    expect(isThinAgenticBody(stub)).toBe(true);
  });

  it("passes a real, long section body that opens with a heading", () => {
    const body =
      "# Voice of Customer — Ramp\n\n## Key Findings\n\n" +
      "Real sourced analysis with quotes and URLs. ".repeat(120);
    expect(body.length).toBeGreaterThan(3000);
    expect(isThinAgenticBody(body)).toBe(false);
  });
});
