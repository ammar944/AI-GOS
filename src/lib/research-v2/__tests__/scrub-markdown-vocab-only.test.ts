import { describe, expect, it } from "vitest";

import {
  findInternalVocabularyToken,
  scrubMarkdownVocabOnly,
} from "../client-surface-sanitizer";

// scrubMarkdownVocabOnly is the markdown-safe scrub used for the long GLM
// narrative blob persisted to the section card. Unlike scrubClientSurfaceText
// it MUST (a) preserve newlines (markdown structure) and (b) NOT wholesale-
// replace prose that incidentally matches a validator-message signature
// (e.g. any word ending in "Schema") — while still removing internal pipeline
// vocabulary so the client never sees tool names.
describe("scrubMarkdownVocabOnly", () => {
  it("preserves markdown newlines and structure", () => {
    const md = "# Heading\n\n- bullet one\n- bullet two\n\nParagraph.";
    const out = scrubMarkdownVocabOnly(md);
    expect(out).toContain("\n");
    expect(out.split("\n").length).toBeGreaterThanOrEqual(5);
    expect(out).toContain("# Heading");
  });

  it("rewrites internal tool vocabulary to client-readable terms", () => {
    const md = "We ran web_search and pulled keyword_volume from corpus data.";
    const out = scrubMarkdownVocabOnly(md);
    expect(out).toContain("web research");
    expect(out).not.toMatch(/web_search/);
    expect(out).not.toMatch(/keyword_volume/);
    expect(out).not.toMatch(/\bcorpus\b/);
  });

  it("does NOT wholesale-replace prose that mentions a 'Schema' word", () => {
    const md =
      "Plain exposes a GraphQLSchema with full UI-to-API parity for technical teams.";
    const out = scrubMarkdownVocabOnly(md);
    // The whole sentence must survive — not be nuked to the gap fallback.
    expect(out).toContain("GraphQLSchema");
    expect(out).toContain("technical teams");
    expect(out).not.toContain("Not enough public evidence was found");
  });

  it("leaves the result free of internal vocabulary deny tokens", () => {
    const md = "Pulled from corpus via web_search across the fan-out.";
    const out = scrubMarkdownVocabOnly(md);
    expect(findInternalVocabularyToken(out)).toBeNull();
  });

  it("does not collapse a long multi-paragraph blob onto one line", () => {
    const md = Array.from({ length: 6 }, (_, i) => `## Section ${i}\n\nProse ${i}.`).join("\n\n");
    const out = scrubMarkdownVocabOnly(md);
    expect(out.split("\n").length).toBeGreaterThan(6);
  });

  it("does NOT delete legitimate English words that merely contain a deny token", () => {
    // Ramp is a spend/cost-containment company; 'liveness' appears in eng prose.
    // The deny tokens 'containment' and 'liveness' must not eat real words.
    const md = "Ramp wins on cost containment and uptime liveness checks for finance teams.";
    const out = scrubMarkdownVocabOnly(md);
    expect(out).toContain("cost containment");
    expect(out).toContain("liveness checks");
  });

  it("preserves leading indentation so nested lists and code blocks survive", () => {
    const md = "- top\n  - child A\n    - grandchild\n\n```\n    indented code\n```";
    const out = scrubMarkdownVocabOnly(md);
    expect(out).toContain("\n  - child A");
    expect(out).toContain("\n    - grandchild");
    expect(out).toContain("    indented code");
  });
});
