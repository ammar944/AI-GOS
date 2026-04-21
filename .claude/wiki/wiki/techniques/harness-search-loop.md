# Harness search loop

An outer-loop algorithm that evolves LLM harness code using a coding agent as the proposer, conditioned on filesystem access to all prior candidates' source + traces + scores. Introduced by Lee et al. (2026); we do not run this loop directly, but several of its moving parts transfer to how we manage AIGOS.

## The loop (Algorithm 1 in the paper)

```
for iter in 1..N:
    # proposer = Claude Code Opus-4.6 with skill file + directory path
    candidate_code = proposer.write_candidate(
        skill=skill_file,
        history_dir=all_prior_candidates/
    )
    if not lightweight_validation(candidate_code):  # import + instantiate + tiny eval
        log_and_skip()
        continue
    score, traces = evaluator.run(candidate_code, search_set)  # separate from proposer
    persist(candidate_code, score, traces)  # into history_dir
```

The inner components — skill file, search set, evaluator, history directory — are the design space. The outer loop is thin.

## Components, mapped to AIGOS

| Paper component | AIGOS equivalent (today) | Gap |
|---|---|---|
| Skill file | `.claude/CLAUDE.md` + `.claude/rules/*.md` + `.claude/commands/*.md` | None — this is already our highest-leverage lever |
| History directory | `.claude/wiki/log.md` + `learned-patterns.md` + session memories | We capture **summaries**, not **traces** |
| Evaluator | `.claude/rules/verification.md` gate (build + test + curl) | None — already outside the proposer |
| Search set | N/A | We have no canonical "hard set of cases baseline gets wrong" |
| Lightweight validation | `npm run build` hook | None |
| Outer loop | We don't run one | Intentional — Meta-Harness is offline search, we are doing live work |

The gaps worth addressing: (a) traces not summaries, (b) a failure corpus.

## What we borrow without running the loop

Even without the outer loop, three practices transfer:

1. **Record traces alongside lessons.** When `learned-patterns.md` gets a new entry, include a pointer to the transcript that surfaced it. This turns future sessions into selective-access readers of prior history.
2. **Keep an evaluator-outside-proposer discipline.** Our verification gate already enforces this. Don't let implementation agents grade their own output.
3. **Invest in the skill text first.** The paper found skill iteration had a larger effect than population size or iteration count. For us: sharpening CLAUDE.md and the rule files is higher-leverage than adding more workspaces.

## What would it take to run the loop on our rules

Hypothetical: if we wanted to literally evolve `.claude/rules/` via Meta-Harness-style search, we would need:

- An automated metric (code-review passes / tests green / time-to-ship / user-marked-satisfied).
- A search set of "hard cases" — sessions where the current rules produced bad outcomes.
- A worktree-sandboxed proposer that edits only `.claude/` and reports scores.
- A 10M-token/iter budget. Not trivial.

Out of scope for now. Noted for when the failure corpus grows large enough to be searchable.

## Sources
- [[raw/meta-harness-lee-2026.pdf]] — Algorithm 1 (Section 3), Appendix D (practical tips)
- [[wiki/sources/meta-harness-lee-2026.md]]

## Related
- [[wiki/concepts/harness-engineering.md]]
- [[wiki/concepts/filesystem-as-feedback-channel.md]]
- [[wiki/concepts/additive-over-mutation.md]]
