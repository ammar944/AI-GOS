---
description: Convert an informal feature ask into a size-matched, paste-ready workflow prompt. Calls the feature-architect agent.
---

# /plan

Use when you want a prompt to kick off a feature, but don't want to hand-craft it yourself. The `feature-architect` agent classifies your ask, scopes it, and emits a single copy-paste-ready workflow prompt scaled to the size.

## What this does

Dispatches the `feature-architect` agent (Opus, plan mode, read-only) with your ask. The agent:

1. Reads the current contracts (`CLAUDE.md`, `rules/`, first 80 lines of `ARCHITECTURE.md`).
2. Classifies your ask per CLAUDE.md Session Startup Protocol.
3. Asks ≤2 clarifying questions only if genuinely needed.
4. Emits: classification line + scope + one fenced workflow prompt + paste instructions + expected architect gate count.

## When to use

- "I want to work on X, what's the prompt?"
- "Plan a feature for X"
- "How should I kick off X in a Claude session?"
- When you're about to start something and want the right-sized pipeline without re-thinking the shape every time.

## When NOT to use

- You already know the shape — just start the work.
- Pure Q&A — `feature-architect` will tell you no prompt is needed, which is fine but wastes a turn.
- A production bug you've already triaged — go straight to Step Zero per `.claude/rules/bug-triage.md`.

## Arguments

Everything after `/plan` becomes the ask. Be as informal as you want — the agent is built to parse vague input.

Examples:

```
/plan the chat is architecturally fucked, audit it and ship a brain-icon atom for component context injection
/plan fix the 500 on /api/chat — users keep hitting it after onboarding
/plan rewrite research worker in rust  # agent will probably classify this as week+
/plan beast mode: make the onboarding flow actually good end-to-end
```

## The handoff

After the agent emits a prompt, the user pastes it into a new or current session. `feature-architect` itself does not execute.

$ARGUMENTS
