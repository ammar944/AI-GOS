# Skill issue

When the agent fails, the default assumption is: it's not that the model can't do it, it's that you haven't given it the right setup. Named after the gaming meme.

## Karpathy's line

"When it doesn't work I think to a large extent you feel like it's skill issue. It's not that the capability is not there. It's that you just haven't found a way to string it together. I didn't give good enough instructions in the agents.md file or whatever it may be. I don't have a nice enough memory tool."

## What "skill issue" means concretely

- `CLAUDE.md` / `AGENTS.md` too vague or contradictory.
- Memory tool too thin — agent has to re-derive context each turn.
- No budget on subagents → they spiral.
- Task not decomposed small enough for parallel dispatch.
- Missing the right tool (web-search, DB access, screenshot) so the agent hallucinates.
- Verification loop missing → agent "thinks" it's done and moves on.

## Diagnostic questions before blaming the model

1. Could a human senior engineer solve this from the same instructions + tools the agent had?
2. If no, the skill issue is in the setup. If yes, then maybe it really is a capability gap.

## When it ISN'T a skill issue

- Tasks that require current data the model doesn't have (fresh news, live prices, your repo's un-committed state). Give it the data via tool.
- Soft tasks that jaggedness ([[wiki/concepts/jaggedness.md]]) makes unreliable. Do those yourself.
- Models that were retired — `claude-3.5-sonnet` on new code with 2026 patterns will genuinely lag.

## In this repo, skill-issue debugging has a playbook

`.claude/rules/bug-triage.md` Step Zero + `.claude/rules/verification.md` Bug Fix Protocol. Before assuming the model broke something, check:

1. Env vars.
2. Rate limits / provider status.
3. Deploy status.
4. Worker reachability.

Most "the model broke it" turns out to be infra.

## Sources

- [[raw/karpathy-noam-no-priors-transcript.md]]

## Related

- [[wiki/sources/karpathy-noam-no-priors-transcript.md]]
- [[wiki/concepts/jaggedness.md]]
- [[wiki/concepts/auto-research.md]]
- [[wiki/entities/karpathy.md]]
