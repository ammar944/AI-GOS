import { describe, expect, it } from "vitest";

import {
  AGENTIC_GLM_MAX_STEPS,
  GROUNDING_LAW,
  buildAgenticTools,
  buildTranscriptRecord,
} from "../agentic-glm-runner";
import { SECTION_REGISTRY } from "../../sections/section-registry";

// Env with every tool credential present, so buildAgenticTools' credential-skip
// never trims the registry-filtered set — lets us assert the pure allowedTools
// projection. The skip behavior gets its own dedicated test below.
const FULL_CRED_ENV: Record<string, string> = {
  FIRECRAWL_API_KEY: "x",
  FOREPLAY_API_KEY: "x",
  SEARCHAPI_KEY: "x",
  SPYFU_API_KEY: "x",
  PERPLEXITY_API_KEY: "x",
};

describe("buildTranscriptRecord", () => {
  it("maps a synthetic steps array to TranscriptRecord[] joining calls to results by toolCallId", () => {
    const steps = [
      {
        toolCalls: [
          { toolName: "web_search", toolCallId: "c1", input: { query: "ramp reviews" } },
          { toolName: "reviews", toolCallId: "c2", input: { domain: "ramp.com" } },
        ],
        toolResults: [
          { toolCallId: "c1", type: "tool-result", output: { hits: 3 } },
          { toolCallId: "c2", type: "tool-error", error: new Error("SEARCHAPI_KEY missing") },
        ],
      },
      {
        toolCalls: [
          { toolName: "firecrawl", toolCallId: "c3", input: { url: "https://ramp.com" } },
        ],
        toolResults: [], // call with no matching result -> output null, not an error
      },
    ];

    const records = buildTranscriptRecord(steps, "positioningVoiceOfCustomer");

    expect(records).toHaveLength(3);

    expect(records[0]).toEqual({
      step: 0,
      toolName: "web_search",
      toolCallId: "c1",
      input: { query: "ramp reviews" },
      output: { hits: 3 },
      isError: false,
    });

    // tool-error maps to isError:true with the error stringified under { error }
    expect(records[1].step).toBe(0);
    expect(records[1].toolName).toBe("reviews");
    expect(records[1].isError).toBe(true);
    expect(records[1].output).toEqual({ error: "Error: SEARCHAPI_KEY missing" });

    // a call with no result is not an error; output is null
    expect(records[2]).toEqual({
      step: 1,
      toolName: "firecrawl",
      toolCallId: "c3",
      input: { url: "https://ramp.com" },
      output: null,
      isError: false,
    });
  });

  it("returns [] for non-array steps input", () => {
    expect(buildTranscriptRecord(undefined, "positioningDemandIntent")).toEqual([]);
    expect(buildTranscriptRecord(null, "positioningDemandIntent")).toEqual([]);
  });
});

describe("buildAgenticTools", () => {
  it("returns ONLY the tools in SECTION_REGISTRY[VoC].allowedTools", () => {
    const tools = buildAgenticTools("positioningVoiceOfCustomer", FULL_CRED_ENV);
    const keys = Object.keys(tools).sort();
    const allowed = [...SECTION_REGISTRY.positioningVoiceOfCustomer.allowedTools].sort();
    expect(keys).toEqual(allowed);
    // sanity: VoC must not leak a Demand-only tool
    expect(keys).not.toContain("keyword_volume");
  });

  it("returns ONLY the tools in SECTION_REGISTRY[Demand].allowedTools", () => {
    const tools = buildAgenticTools("positioningDemandIntent", FULL_CRED_ENV);
    const keys = Object.keys(tools).sort();
    const allowed = [...SECTION_REGISTRY.positioningDemandIntent.allowedTools].sort();
    expect(keys).toEqual(allowed);
    // sanity: Demand must not leak a VoC-only tool
    expect(keys).not.toContain("reviews");
  });

  it("skips a tool whose required credential is missing", () => {
    // Demand needs SPYFU_API_KEY for keyword_volume/keyword_discovery. Drop it.
    const env: Record<string, string> = {
      FIRECRAWL_API_KEY: "x",
      SEARCHAPI_KEY: "x",
      PERPLEXITY_API_KEY: "x",
      // SPYFU_API_KEY intentionally absent
    };
    const keys = Object.keys(buildAgenticTools("positioningDemandIntent", env));
    expect(keys).not.toContain("keyword_volume");
    expect(keys).not.toContain("keyword_discovery");
    // tools whose creds ARE present still appear
    expect(keys).toContain("web_search");
    expect(keys).toContain("perplexity_research");
  });

  it("throws on an unknown sectionId", () => {
    expect(() => buildAgenticTools("notASection", FULL_CRED_ENV)).toThrow(
      /unknown sectionId/,
    );
  });
});

describe("module constants", () => {
  it("exposes the bounded step cap and a non-empty grounding law", () => {
    expect(AGENTIC_GLM_MAX_STEPS).toBe(16);
    expect(GROUNDING_LAW).toContain("GROUNDING LAW");
    expect(GROUNDING_LAW.length).toBeGreaterThan(200);
  });
});

// NOTE: generateAgenticGLMSection is a LIVE call (GLM-5.2 via the Ollama proxy,
// ~100-200s). It is deliberately NOT exercised here — the unit suite must stay
// offline and fast. Live generation is covered by the optional env-gated smoke
// run reported in the task handoff, not by this test.
