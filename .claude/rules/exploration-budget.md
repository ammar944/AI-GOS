# Exploration Budget

Every subagent dispatch (Agent, Task, Explore) states a budget before it runs. No uncapped exploration.

## The Rule

Before dispatching any subagent, state in the prompt:

1. **Time budget**: max duration in minutes (example: "spend up to 5 minutes").
2. **Tool-call cap**: max number of file reads or shell commands (example: "no more than 20 tool calls").
3. **Output format**: what to report back (example: "report findings in under 200 words").

If the subagent hits either cap without completing, it reports what it has and stops. It does not request to extend.

## Why

The usage report showed 35 buggy-code and 28 wrong-approach incidents, and named exploration spirals as a top friction pattern. Subagents run until they feel "done" unless you tell them when to stop. A 2-minute, 161k-token audit of the UI was not wrong in absolute terms. It was wrong in that it ran without a cap while the feature itself had not been scoped.

## Defaults by Subagent Type

| Subagent | Default budget | Default tool-call cap |
|----------|---------------|----------------------|
| researcher (Haiku) | 5 minutes | 30 calls |
| Explore (general) | 3 minutes | 20 calls |
| frontend / backend / qa (Sonnet) | 15 minutes | 50 calls |
| Opus cross-cutting work | 30 minutes | 80 calls |

Override up when the task genuinely needs it, but state the override in the prompt so it is visible.

## Special Case: Skills

Skills can dispatch subagents internally. When invoking a skill on a large task, wrap the skill in a `/feature` call first so 01-discover sets scope. Inside 02-plan, the skill invocation inherits the budget stated in the plan atom. This prevents skill-internal exploration from running wild.

## Forbidden

- Dispatching a subagent with "investigate the codebase" as the entire brief.
- Letting a subagent decide its own budget.
- Re-dispatching a subagent after it hits its cap without re-scoping the task.
