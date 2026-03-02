# Hooks & Automation Patterns

## Active Hooks (settings.json)

| Hook | Trigger | What It Does |
|------|---------|--------------|
| TypeScript Check | PostToolUse (Write/Edit) | Runs `tsc --noEmit` after every file change |
| Prettier Format | PostToolUse (Edit/Write) | Auto-formats .ts/.tsx/.js/.jsx files |
| Dev Server Blocker | PreToolUse (Bash) | Warns if `npm run dev` is run outside tmux |

## Memory Persistence Pattern

At the end of each work session, save a summary to `.claude/memory/`:

```
## Session: [date]-[feature]
### What was done
- [completed tasks]
### What's left
- [remaining tasks]
### Key decisions
- [why you chose X over Y]
### Gotchas found
- [things that surprised you]
```

When starting a new session, read the latest memory file first:
```
Read .claude/memory/ and continue from where we left off.
```

## Continuous Learning Pattern

When Claude discovers a non-obvious solution (a bug fix that required understanding architecture, an API pattern that works better than the docs suggest), convert it into a rule:

1. Add a one-liner to `.claude/rules/learned-patterns.md`
2. Keep it factual: "When X happens, do Y because Z"
3. Prune monthly — if a pattern hasn't been useful in 4 weeks, remove it

## tmux for Long-Running Tasks

```bash
# Start dev server in background
tmux new-session -d -s dev "cd ~/projects/AI-GOS && npm run dev"

# Start test watcher in background
tmux new-session -d -s tests "cd ~/projects/AI-GOS && npm test"

# Check on them
tmux attach -t dev
tmux attach -t tests
```
