# Context Management Rules

## The #1 Rule
`/clear` between unrelated tasks. This is the single most important habit.

## When to Clear
- Switching from frontend work to backend work
- After completing a task before starting the next
- After 2 failed corrections on the same issue
- When context feels "noisy" or Claude is confused

## When to Compact
- At ~70% context usage (don't wait for auto-compact)
- `/compact Focus on [current feature] changes`
- When compacting, preserve: modified file list, test commands, current task spec

## Subagents for Research
- "Use a subagent to investigate X" — keeps main context clean
- Scope narrowly: "look at src/auth/" not "investigate the codebase"
- Use the `researcher` agent (haiku model) for cost efficiency

## Session Management
- Name sessions: `/rename sprint2-chat-agent`
- Resume: `claude --resume sprint2-chat-agent`
- Different sessions for different features
- Never mix unrelated work in one session
