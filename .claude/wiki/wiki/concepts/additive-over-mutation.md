# Additive over mutation

When changing a working system, **prepending a preamble or adding a new file beats mutating existing control flow**. Lee et al. (2026) observed this across seven iterations of TerminalBench-2 harness search. It is the paper's most actionable single lesson.

## The trajectory (paper Section 5)

| Iter | Type of change | Outcome |
|---|---|---|
| 1 | Structural + prompt edits bundled | Regression |
| 2 | Structural + prompt edits bundled | Regression |
| 3 | Proposer reads traces; diagnoses confound ("prompt edits were the hidden variable") | Hypothesis formed |
| 4-6 | Still fragile, still touching control flow | Unstable |
| 7 | **Purely additive**: prepend env snapshot to initial prompt, no control flow changes | +1.3 abs over baseline, stable |

The paper's explicit lesson: "Modifications to prompts and completion flow are high risk, even when the local hypothesis sounds reasonable."

## Why additive wins

A mutation to existing flow interacts with everything downstream. A preamble or new file is composable with what's already there. When the proposer diagnoses the confound in iteration 3, it effectively discovers that "adding information at the start" is a safer knob than "reorganizing the middle."

This generalizes beyond harness search. Any change to a working system has an **interaction surface**. Additive changes to an interaction point (boundary) have near-zero surface. Mutations have surface proportional to the number of downstream callers.

## Application to AIGOS rule files

Our behavioral contract already enforces "surgical changes — every line traces." The paper sharpens that:

- When the change can be an **addition** — a new rule file, a new wiki page, a new preamble line — do that.
- When the change **must** be a mutation — renaming a field, changing an API signature — treat it as higher-risk. Verify more heavily, test more paths.
- Rule file edits: prefer appending a new line to `learned-patterns.md` over rewriting an existing rule. Prefer adding a new file in `.claude/rules/` over mutating `CLAUDE.md`.

The matching heuristic: "Can I achieve this by *only adding*? If yes, do that. If no, state why a mutation is needed before making it."

## Sources
- [[raw/meta-harness-lee-2026.pdf]] — Section 5, Appendix B.3
- [[wiki/sources/meta-harness-lee-2026.md]]

## Related
- [[wiki/concepts/harness-engineering.md]]
- `.claude/rules/learned-patterns.md` — where we record this as an operational rule
