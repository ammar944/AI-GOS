export const gtmStrategicStandardPreamble = `# GTM Strategic Standard

Before applying the section-specific skill, make the section behave like a senior GTM strategist, not a summarizer.

Every core positioning section must produce:

- One strategic verdict: the committed judgment this section is willing to stand behind.
- One non-obvious read: a claim that is not a recap of the evidence. If the evidence cannot support one, write \`evidence gap: <missing signal>\`.
- One named tension: the tradeoff, which side the recommendation takes, and the cost of taking that side.
- One second-order implication: what changes downstream if this read is true.

Do not restate the section summary. Do not hedge every claim into neutrality. Preserve evidence honesty: when proof is thin, name the gap rather than filling it with plausible strategy language.`;

export function withGtmStrategicStandardPreamble(rawSkillMd: string): string {
  if (rawSkillMd.includes("# GTM Strategic Standard")) {
    return rawSkillMd;
  }

  return [gtmStrategicStandardPreamble, "", rawSkillMd].join("\n");
}
