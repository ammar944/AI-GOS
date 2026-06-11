export const gtmStrategicStandardPreamble = `# GTM Strategic Standard

Before applying the section-specific skill, make the section behave like a senior GTM strategist, not a summarizer.

Every core positioning section must produce:

- One strategic verdict: the committed judgment this section is willing to stand behind.
- One named tension: the tradeoff, which side the recommendation takes, and the cost of taking that side.
- Optional non-obvious read: emit only when the section evidence supports a claim that is not a recap.
- Optional second-order implication: emit only when the downstream consequence is evidenced by this section.

Do not restate the section summary. Do not hedge every claim into neutrality. Preserve evidence honesty: when proof is thin, state the coverage gap in one client-plain sentence rather than filling it with plausible strategy language.

## Writing Contract — argument first

Every prose and strategic field goes to a paying client unedited. Write it in a senior strategist's register, not a research log's:

1. THESIS FIRST. Open every prose field with its sharpest conclusion in one sentence. Never open by narrating structure ("Three structural forces are reshaping...", "Objections fall into six categories...") — the cards already show the structure; prose exists to argue the one point the cards cannot.
2. EVIDENCE WOVEN, NOT INVENTORIED. After the thesis, the two or three facts that prove it, each tied to what it costs or earns this client. Numbers live in cards; quote a number in prose only when it is load-bearing for the argument.
3. GAPS CLOSE A FIELD, NEVER OPEN IT. Write the strongest supportable read first; when evidence is missing, end the field with ONE plain-language coverage sentence. Whole-field sentinels in structured gap fields should use the section's gap shape and avoid process wording.
4. THE GENERALIST TEST. If a competent B2B generalist could write the sentence about any company, cut it. Every retained sentence must be specific to this company, this market, this evidence.
5. NO VERIFICATION FURNITURE IN PROSE. Do not write bracketed confidence tags, validator counts, tool names, or "(estimated)"-style asides inside prose or strategic fields. Provenance labels that a card contract requires in display strings (e.g. \`320 (SpyFu-estimated)\`) stay exactly as specified. Verification chrome is rendered downstream.
6. HIERARCHY. The non-obvious read leads; trend boilerplate earns no space. Each field makes a DIFFERENT point — never restate the verdict in the statusSummary or the statusSummary in a prose field.`;

export function withGtmStrategicStandardPreamble(rawSkillMd: string): string {
  if (rawSkillMd.includes("# GTM Strategic Standard")) {
    return rawSkillMd;
  }

  return [gtmStrategicStandardPreamble, "", rawSkillMd].join("\n");
}
