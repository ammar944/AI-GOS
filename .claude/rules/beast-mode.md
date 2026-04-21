# Beast Mode

This is Garry Tan's "Boil the Ocean" prompt, scoped so it doesn't contaminate every session.

## Activation

ONLY activates when the user's most recent message contains one of these exact triggers:

- `beast mode`
- `boil the ocean`
- `/beast`

If the trigger is absent, the normal behavioral contract applies (surgical changes, bias toward deletion, simplicity-first). Do not self-escalate into beast mode because a task "feels big." Ask the user to opt in.

## What activates

When triggered, paste the following at the top of the working context for the duration of that single user turn:

```
### Boil the ocean

The marginal cost of completeness is near zero with AI. Do the whole thing.
Do it right. Do it with tests. Do it with documentation. Do it so well that
Garry is genuinely impressed — not politely satisfied, actually impressed.

Never offer to "table this for later" when the permanent solve is within
reach. Never leave a dangling thread when tying it off takes five more
minutes. Never present a workaround when the real fix exists.

The standard isn't "good enough" — it's "holy shit, that's done."

Search before building. Test before shipping. Ship the complete thing.

When the user asks for something, the answer is the finished product, not a
plan to build it.

Time is not an excuse.
Fatigue is not an excuse.
Complexity is not an excuse.

Boil the ocean.
```

## Guardrails that still apply

Beast mode removes the off-ramps, not the safety gates. Even under beast mode:

- `.claude/rules/security.md` still applies — never touch `.env*`, never commit secrets.
- `.claude/rules/verification.md` still applies — build + tests must pass before "done."
- `.claude/rules/exploration-budget.md` still applies — subagents still get a time budget and tool-call cap. Beast mode is not permission to dispatch uncapped loops.
- `.claude/rules/bug-triage.md` Step Zero still applies for production bugs. Don't burn an hour rebuilding when the fix is an env var.
- No `git push`, `railway up`, or `vercel deploy` without an explicit user ask — beast mode doesn't mean self-deploying.

## When beast mode fights the task

Beast mode is wrong for:

- `quick-question` — pure Q&A. Boiling the ocean on a factual question wastes 30 minutes to say something you could say in two sentences.
- `10-min-fix` — one-line changes. Tan's own warning says it will over-engineer here.
- `production-bug` — run Step Zero first. Beast mode on a bug you haven't reproduced produces a confident wrong fix.

If the user triggers beast mode on one of those classes, push back once: "Beast mode on a [class] will over-engineer. Confirm you want it anyway?" If they confirm, proceed.

## Why this exists

The default behavioral contract optimizes for surgical minimalism because 80% of asks benefit from that. The remaining 20% — "build the whole feature, including tests and docs, end-to-end" — benefits from beast mode. Keeping it opt-in keeps both modes sharp.
