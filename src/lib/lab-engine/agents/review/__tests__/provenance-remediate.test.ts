/**
 * provenance-remediate.test.ts — pins the remediation loop's MECHANICS with an INJECTED
 * rewrite fn (no live GLM). Mirrors the script's remediateCell flow:
 *   (a) self-audit invoked when selfAudit=true,
 *   (b) convergence re-detects between rounds,
 *   (c) when the rewrite fails to fix, the deterministic strip yields 0 surviving violations,
 *   (d) clean body in → unchanged out, 0 rounds.
 */
import { describe, it, expect, vi } from "vitest";

import {
  remediateProvenance,
  selfAuditPrompt,
  remediationPrompt,
  stripViolationsDeterministically,
  type RewriteFn,
} from "../provenance-remediate";
import {
  detectProvenanceViolations,
  type TranscriptRecord,
} from "../../verification/provenance-detect";

function rec(partial: Partial<TranscriptRecord>): TranscriptRecord {
  return {
    step: 0,
    toolName: "web_search",
    toolCallId: "call_0",
    input: {},
    output: {},
    isError: false,
    ...partial,
  };
}

// A body with a URL the transcript never returned -> url_not_in_transcript.
const DIRTY_BODY = "Pricing is documented at [pricing](https://example.com/pricing/plans).";
const DIRTY_TRANSCRIPT: TranscriptRecord[] = [
  rec({ toolName: "web_search", output: { results: [{ url: "https://other.com/home", snippet: "hi" }] } }),
];

// A fully grounded body -> zero violations.
const CLEAN_BODY =
  'The keyword "ai crm" shows 1,600 searches/mo per SpyFu (spyfu.com). That is a real opportunity.';
const CLEAN_TRANSCRIPT: TranscriptRecord[] = [
  rec({
    toolName: "keyword_volume",
    output: {
      keywords: [
        {
          keyword: "ai crm",
          searchVolume: 1600,
          cpc: 0.5,
          sourceUrl: "https://www.spyfu.com/keyword/overview/us?query=ai+crm",
        },
      ],
    },
  }),
];

describe("remediateProvenance — self-audit", () => {
  it("(a) invokes the rewrite for a self-audit pass when selfAudit=true", async () => {
    const systems: string[] = [];
    const rewrite = vi.fn<RewriteFn>(async (system) => {
      systems.push(system);
      return DIRTY_BODY; // never fixes — keeps the loop honest
    });

    const out = await remediateProvenance({
      body: DIRTY_BODY,
      transcript: DIRTY_TRANSCRIPT,
      section: "competitor",
      subject: "acme",
      selfAudit: true,
      rewrite,
    });

    // self-audit fired (the FIRST call uses the auditor persona), then remediation rounds.
    expect(rewrite).toHaveBeenCalled();
    expect(systems[0]).toContain("rigorous provenance auditor");
    expect(out.violationsAfterSelfAudit).not.toBeNull();
    // the self-audit returned the still-dirty body, so its measurement carries the violation.
    expect(out.violationsAfterSelfAudit!.map((v) => v.check)).toContain("url_not_in_transcript");
  });

  it("does NOT run a self-audit pass when selfAudit=false (only remediation rounds)", async () => {
    const calls: string[] = [];
    const rewrite: RewriteFn = async (system) => {
      calls.push(system);
      return DIRTY_BODY; // never fixes
    };

    const out = await remediateProvenance({
      body: DIRTY_BODY,
      transcript: DIRTY_TRANSCRIPT,
      section: "competitor",
      subject: "acme",
      selfAudit: false,
      rewrite,
    });

    expect(out.violationsAfterSelfAudit).toBeNull();
    // no self-audit system prompt was used; every call is the remediation persona.
    expect(calls.every((s) => s.includes("remediating a GTM research section"))).toBe(true);
  });
});

describe("remediateProvenance — convergence loop", () => {
  it("(b) re-detects between rounds and stops once the rewrite produces a clean body", async () => {
    let round = 0;
    const rewrite: RewriteFn = async (system, prompt) => {
      if (system.includes("rigorous provenance auditor")) return DIRTY_BODY; // self-audit no-op
      round++;
      // round 1: hand back a clean, grounded body (the URL claim demoted to directional prose).
      expect(prompt).toContain("DETECTED VIOLATIONS");
      return "Pricing is documented on the vendor's pricing page.";
    };

    const out = await remediateProvenance({
      body: DIRTY_BODY,
      transcript: DIRTY_TRANSCRIPT,
      section: "competitor",
      subject: "acme",
      selfAudit: true,
      rewrite,
    });

    expect(round).toBe(1); // converged in a single round
    expect(out.rounds).toBe(1);
    expect(out.violationsAfter).toHaveLength(0);
    expect(out.strippedDeterministically).toBe(false);
    expect(out.remediatedBody).toBe("Pricing is documented on the vendor's pricing page.");
  });

  it("respects maxRounds and runs at most that many remediation rounds", async () => {
    let remediationCalls = 0;
    const rewrite: RewriteFn = async (system) => {
      if (system.includes("rigorous provenance auditor")) return DIRTY_BODY;
      remediationCalls++;
      return DIRTY_BODY; // never fixes -> loop runs to the cap
    };

    const out = await remediateProvenance({
      body: DIRTY_BODY,
      transcript: DIRTY_TRANSCRIPT,
      section: "competitor",
      subject: "acme",
      selfAudit: false,
      maxRounds: 1,
      rewrite,
    });

    expect(remediationCalls).toBe(1);
    expect(out.rounds).toBe(1);
  });
});

describe("remediateProvenance — deterministic strip fallback", () => {
  it("(c) when the rewrite never fixes, the strip yields 0 surviving violations", async () => {
    // rewrite that always hands back the still-dirty body -> GLM rounds exhaust -> strip.
    const rewrite: RewriteFn = async () => DIRTY_BODY;

    const out = await remediateProvenance({
      body: DIRTY_BODY,
      transcript: DIRTY_TRANSCRIPT,
      section: "competitor",
      subject: "acme",
      selfAudit: true,
      rewrite,
    });

    expect(out.strippedDeterministically).toBe(true);
    expect(out.violationsAfter).toHaveLength(0);
    // the gate's invariant: re-detecting the remediated body finds nothing.
    const reDetect = detectProvenanceViolations({
      body: out.remediatedBody,
      transcript: DIRTY_TRANSCRIPT,
      section: "competitor",
      subject: "acme",
    });
    expect(reDetect.violations).toHaveLength(0);
  });

  it("strip neutralizes a sourced-number and an invented-bidder violation to zero", async () => {
    const numberBody = 'The keyword "ai notetaker" shows 9,900 searches/mo per SpyFu.';
    const numberTranscript: TranscriptRecord[] = [
      rec({ toolName: "keyword_volume", output: { keywords: [{ keyword: "ai notetaker", searchVolume: 1600 }] } }),
    ];
    const rewrite: RewriteFn = async () => numberBody; // never fixes

    const out = await remediateProvenance({
      body: numberBody,
      transcript: numberTranscript,
      section: "demand",
      subject: "acme",
      selfAudit: false,
      rewrite,
    });

    expect(out.strippedDeterministically).toBe(true);
    const re = detectProvenanceViolations({
      body: out.remediatedBody,
      transcript: numberTranscript,
      section: "demand",
      subject: "acme",
    });
    expect(re.violations).toHaveLength(0);
  });
});

describe("remediateProvenance — clean body short-circuit", () => {
  it("(d) a clean body in returns unchanged, 0 rounds, no strip", async () => {
    // rewrite should NEVER be called for the remediation loop on a clean body; self-audit off.
    const rewrite = vi.fn<RewriteFn>(async () => "SHOULD NOT BE USED");

    const out = await remediateProvenance({
      body: CLEAN_BODY,
      transcript: CLEAN_TRANSCRIPT,
      section: "demand",
      subject: "acme",
      selfAudit: false,
      rewrite,
    });

    expect(out.violationsBefore).toHaveLength(0);
    expect(out.violationsAfter).toHaveLength(0);
    expect(out.rounds).toBe(0);
    expect(out.strippedDeterministically).toBe(false);
    expect(out.remediatedBody).toBe(CLEAN_BODY);
    expect(rewrite).not.toHaveBeenCalled();
  });

  it("with selfAudit=true on a clean body, the self-audit runs but no remediation rounds occur", async () => {
    const rewrite = vi.fn<RewriteFn>(async () => CLEAN_BODY);

    const out = await remediateProvenance({
      body: CLEAN_BODY,
      transcript: CLEAN_TRANSCRIPT,
      section: "demand",
      subject: "acme",
      selfAudit: true,
      rewrite,
    });

    // self-audit pass ran exactly once; no remediation rounds (already clean).
    expect(rewrite).toHaveBeenCalledTimes(1);
    expect(out.violationsAfterSelfAudit).toEqual([]);
    expect(out.rounds).toBe(0);
    expect(out.strippedDeterministically).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pure helper exports
// ---------------------------------------------------------------------------
describe("pure helper exports", () => {
  it("selfAuditPrompt embeds the body + transcript and the auditor persona", () => {
    const { system, prompt } = selfAuditPrompt("BODY-X", "TRANSCRIPT-Y");
    expect(system).toContain("rigorous provenance auditor");
    expect(prompt).toContain("BODY-X");
    expect(prompt).toContain("TRANSCRIPT-Y");
    expect(prompt).toContain("FULL TOOL TRANSCRIPT");
  });

  it("remediationPrompt lists each violation's check + span + reason", () => {
    const { system, prompt } = remediationPrompt("BODY-X", "TRANSCRIPT-Y", [
      {
        check: "url_not_in_transcript",
        severity: "laundered",
        ceiling: 7,
        span: "example.com/missing",
        reason: "not in transcript",
      },
    ]);
    expect(system).toContain("remediating a GTM research section");
    expect(prompt).toContain("DETECTED VIOLATIONS");
    expect(prompt).toContain("url_not_in_transcript");
    expect(prompt).toContain("example.com/missing");
    expect(prompt).toContain("not in transcript");
    expect(prompt).toContain("BODY-X");
  });

  it("stripViolationsDeterministically replaces the offending line with an honest-gap marker", () => {
    const stripped = stripViolationsDeterministically(
      "Line A is fine.\nPricing at https://example.com/pricing/plans is here.\nLine C is fine.",
      [
        {
          check: "url_not_in_transcript",
          severity: "laundered",
          ceiling: 7,
          span: "example.com/pricing/plans",
          reason: "not in transcript",
        },
      ],
    );
    expect(stripped).toContain("Line A is fine.");
    expect(stripped).toContain("Line C is fine.");
    expect(stripped).not.toContain("https://example.com/pricing/plans");
    expect(stripped).toContain("[unverified");
  });
});
