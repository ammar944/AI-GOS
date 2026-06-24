/**
 * Strip the GLM "thinking preamble" that sometimes opens an agentic section
 * body — a single meta-narration line such as "Now I have comprehensive
 * evidence. Let me synthesize and write the section." followed by an optional
 * `---` rule, before the first real markdown heading.
 *
 * This is the deterministic §4.5 strip (no model call). It is intentionally
 * conservative: it only removes pre-heading content when that content is
 * recognizably meta-narration AND short, so a body that legitimately opens on a
 * paragraph (or already opens on a heading) is returned byte-identical.
 *
 * Live-proven inputs: the first lines of tmp/zz-agentic-glm/{ramp,attio}/
 * {market,voc}/body.md (4 have a preamble) and plain/{market,voc}/body.md
 * (2 open directly on a heading — must be untouched).
 */

// Meta-narration signature: the model announcing it is about to WRITE THE
// SECTION. We anchor specifically on a "(write|synthesize|...) ... section"
// clause — NOT a bare "let me write" or "I have evidence" — so a legitimate
// opening sentence like "Let me write off the naive assumption..." or "I have
// comprehensive evidence that..." is never mistaken for a preamble and eaten.
// All four live-proven preambles end with "...write [the X] section".
const PREAMBLE_WRITE_SECTION_RE =
  /\blet me\s+(?:now\s+|then\s+)?(?:synthesize\s+and\s+)?(?:write|compile|draft|produce|synthesize)\b[^.\n]*\bsection\b/i;

// Pre-heading narration longer than this (or with more than two paragraphs) is
// treated as real content, never stripped.
const MAX_PREAMBLE_CHARS = 600;

export function stripThinkingPreamble(markdown: string): string {
  if (markdown.length === 0) return markdown;

  const lines = markdown.split("\n");
  const headingIdx = lines.findIndex((line) => /^#{1,6}\s/.test(line));

  // No heading, or the body already opens on a heading → nothing to strip.
  if (headingIdx <= 0) return markdown;

  const pre = lines.slice(0, headingIdx).join("\n");
  // Drop `---`/`***` horizontal rules and blank lines to inspect the narration.
  const preCore = pre
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .trim();

  if (preCore.length === 0) {
    // Pre-heading was only a rule / whitespace — collapse to the heading.
    return lines.slice(headingIdx).join("\n").replace(/^\n+/, "");
  }

  const isMetaNarration = PREAMBLE_WRITE_SECTION_RE.test(preCore);
  const isShort =
    preCore.length <= MAX_PREAMBLE_CHARS &&
    preCore.split(/\n\s*\n/).length <= 2;

  if (isMetaNarration && isShort) {
    return lines.slice(headingIdx).join("\n").replace(/^\n+/, "");
  }

  return markdown;
}
