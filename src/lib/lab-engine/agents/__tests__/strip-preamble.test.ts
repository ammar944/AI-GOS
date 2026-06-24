import { describe, expect, it } from "vitest";

import { stripThinkingPreamble } from "../strip-preamble";

// The four preambles below are the verbatim first lines of the live-proven
// GLM bodies in tmp/zz-agentic-glm/{ramp,attio}/{market,voc}/body.md. The two
// "no preamble" cases are plain/market and plain/voc, which open directly on a
// heading. The strip MUST remove the meta-narration line (and a trailing `---`
// rule) when present and leave a clean-opening body untouched.
describe("stripThinkingPreamble", () => {
  it("strips the ramp/market 'Now I have comprehensive evidence' preamble", () => {
    const input =
      "Now I have comprehensive evidence. Let me synthesize and write the section.\n\n---\n\n# Market & Category Intelligence: Ramp\n\nbody...";
    const out = stripThinkingPreamble(input);
    expect(out.startsWith("# Market & Category Intelligence: Ramp")).toBe(true);
    expect(out).not.toContain("Let me synthesize");
  });

  it("strips the ramp/voc 'I have enough sourced material now' preamble", () => {
    const input =
      "I have enough sourced material now. Let me write the Voice of the Customer section.\n\n---\n\n# Voice of the Customer — Ramp\n\nbody...";
    const out = stripThinkingPreamble(input);
    expect(out.startsWith("# Voice of the Customer — Ramp")).toBe(true);
    expect(out).not.toContain("Let me write the Voice");
  });

  it("strips the attio/market 'Now I have enough sourced evidence' preamble", () => {
    const input =
      "Now I have enough sourced evidence. Let me write the section.\n\n---\n\n# Market & Category Intelligence: Attio\n\nbody...";
    const out = stripThinkingPreamble(input);
    expect(out.startsWith("# Market & Category Intelligence: Attio")).toBe(true);
  });

  it("strips the attio/voc multi-source 'I now have substantial evidence' preamble", () => {
    const input =
      "I now have substantial evidence from competitor reviews (Salesforce, HubSpot, Pipedrive), Attio's own case studies (Snackpass, Granola), and category discussion (Reddit). Let me write the section.\n\n---\n\n# Voice of the Customer — Attio (attio.com)\n\nbody...";
    const out = stripThinkingPreamble(input);
    expect(out.startsWith("# Voice of the Customer — Attio (attio.com)")).toBe(true);
    expect(out).not.toContain("substantial evidence from competitor");
  });

  it("leaves a body that opens directly on an h2 heading untouched (plain/market)", () => {
    const input =
      "## Market & Category Intelligence: Plain\n\n### Strategic Verdict: Enter \"API-First Customer Support Infrastructure\"\n\nbody...";
    expect(stripThinkingPreamble(input)).toBe(input);
  });

  it("leaves a body that opens directly on an h1 heading untouched (plain/voc)", () => {
    const input =
      "# Voice of the Customer — Plain (plain.com)\n\n## Lead Insight\n\nbody...";
    expect(stripThinkingPreamble(input)).toBe(input);
  });

  it("does NOT strip a real non-heading opening paragraph that is not meta-narration", () => {
    const input =
      "Ramp is a $44B spend-management platform competing with Brex and Navan.\n\n# Market & Category Intelligence\n\nbody...";
    expect(stripThinkingPreamble(input)).toBe(input);
  });

  it("does NOT strip a real sentence that merely starts 'Let me write off...' (no 'write the section')", () => {
    const input =
      "Let me write off the naive assumption that buyers are rational here.\n\n# Market & Category Intelligence\n\nbody...";
    expect(stripThinkingPreamble(input)).toBe(input);
  });

  it("does NOT strip a real intro that says 'I have evidence' without a section-write announcement", () => {
    const input =
      "I have comprehensive evidence that the category is consolidating fast.\n\n# Market & Category Intelligence\n\nbody...";
    expect(stripThinkingPreamble(input)).toBe(input);
  });

  it("returns markdown with no heading at all unchanged", () => {
    const input = "Just a paragraph with no heading and no preamble signature.";
    expect(stripThinkingPreamble(input)).toBe(input);
  });
});
