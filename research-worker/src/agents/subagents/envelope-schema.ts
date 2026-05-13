import { z } from 'zod';

/**
 * Schema-enforced output for the 6 positioning subagents.
 *
 * Wired into each ToolLoopAgent via `output: Output.object({ schema })` so
 * Anthropic constrains the final answer to this shape — no manual JSON
 * extraction, no "No parseable JSON found" failure mode.
 *
 * `.min()/.max()` are intentionally avoided on numbers — Anthropic rejects
 * those constraints in structured-output schemas (see learned-patterns.md).
 * Range guidance moves to `.describe()` and is post-clamped in the runner.
 */
export const PositioningEnvelopeSchema = z.object({
  sectionTitle: z.string().describe('Title of this positioning section.'),
  verdict: z
    .string()
    .describe('One-line judgment / verdict for this section (e.g. "Strong fit", "Weak signal").'),
  statusSummary: z
    .string()
    .describe('2–4 sentence summary of what was found, suitable as the first paragraph of the artifact.'),
  confidence: z
    .number()
    .describe('Self-rated confidence in the findings, 0–10. Reflects evidence strength, not advocacy.'),
  keyFindings: z
    .array(
      z.object({
        title: z.string().describe('Short headline for the finding.'),
        detail: z.string().describe('Evidence-backed detail, 1–3 sentences.'),
        evidence: z.string().optional().describe('Verbatim snippet or data point from a tool result.'),
        sourceUrl: z.string().optional().describe('Public URL backing the claim, when available.'),
      }),
    )
    .describe('3–6 evidence-backed findings. Cite a sourceUrl whenever possible.'),
  evidenceQuotes: z
    .array(
      z.object({
        quote: z.string().describe('Verbatim quote from a third-party source (review, article, transcript).'),
        source: z.string().describe('Source label (publication, reviewer, role).'),
        interpretation: z.string().optional().describe('Optional one-line interpretation.'),
      }),
    )
    .describe('0–4 verbatim quotes from third-party sources, where applicable.'),
  risksOrGaps: z
    .array(z.string())
    .describe('Concrete risks, blind spots, or missing-credential gaps. Each entry one sentence.'),
  recommendedMoves: z
    .array(z.string())
    .describe('Concrete next actions a marketer can take this week. Each entry one sentence.'),
  sources: z
    .array(
      z.object({
        title: z.string().describe('Source title (page title, article headline, tool name).'),
        url: z.string().describe('Source URL.'),
        whyItMatters: z.string().optional().describe('Optional one-line reason this source counts.'),
      }),
    )
    .describe('Every distinct source consulted during the run, with URLs.'),
});

export type PositioningEnvelope = z.infer<typeof PositioningEnvelopeSchema>;
